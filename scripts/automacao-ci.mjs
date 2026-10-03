#!/usr/bin/env node
/**
 * O LAÇO da automação do estoque, rodado pelo GitHub Actions
 * (`.github/workflows/automacao.yml`). Não sabe nada de lead, demo nem
 * busca: só chama o Radar, UMA unidade de trabalho por requisição — quem
 * decide tudo são as rotas (`/api/automacao/*`, ver `lib/automacao/motor.ts`).
 * As chaves pagas (Places, Gemini) ficam na Vercel; aqui só existe o
 * `AUTOMACAO_SECRET`.
 *
 * Dois comandos, dois passos do workflow:
 *
 *   node scripts/automacao-ci.mjs laco --estado=<arquivo>
 *     planejar → passo em laço até não haver trabalho. Grava o `execucaoId`
 *     no arquivo de estado LOGO DEPOIS do planejar — é por ele que o passo
 *     final acha a execução mesmo se este processo morrer no meio.
 *
 *   node scripts/automacao-ci.mjs finalizar --estado=<arquivo> --resultado=<outcome>
 *     roda SEMPRE (`if: always()`), com o resultado do passo anterior. Com
 *     erro, grava a falha — a execução nunca termina em silêncio, que era a
 *     doença do cron antigo.
 *
 * Salvaguardas do laço: teto de iterações, para depois de 3 erros seguidos,
 * timeout por requisição abaixo dos 300 s da função, e erro que não se
 * resolve repetindo (401, 404, 409, 503) para na hora.
 *
 * Ambiente: RADAR_URL (endereço público do Radar, sem barra no fim),
 * AUTOMACAO_SECRET, DISPARO (github.event_name), RUN_URL.
 */

import fs from "node:fs";

/** Teto de chamadas ao passo — o alvo padrão é 15; 120 cobre alvo alto com folga. */
export const MAX_ITERACOES = Number(process.env.AUTOMACAO_MAX_ITERACOES ?? 120);
/** Erros seguidos (rede, 5xx, timeout) antes de desistir. */
export const MAX_ERROS_SEGUIDOS = 3;
/** Abaixo do `maxDuration` de 300 s: a requisição desiste antes de a função morrer. */
export const TIMEOUT_MS = Number(process.env.AUTOMACAO_TIMEOUT_MS ?? 280_000);
/** Espera máxima quando o passo pede para esperar uma unidade em andamento. */
const ESPERA_MAX_MS = 60_000;
/** Status que repetir não resolve. */
const FATAIS = new Set([400, 401, 403, 404, 409, 503]);

function arg(nome) {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.slice(nome.length + 3) : undefined;
}

function ambiente() {
  const base = (process.env.RADAR_URL ?? "").replace(/\/+$/, "");
  const segredo = process.env.AUTOMACAO_SECRET ?? "";
  return {
    base,
    segredo,
    disparo: process.env.DISPARO || "desconhecido",
    runUrl: process.env.RUN_URL || undefined,
  };
}

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ErroHttp extends Error {
  constructor(status, corpo) {
    super(`HTTP ${status}: ${JSON.stringify(corpo?.error ?? corpo).slice(0, 300)}`);
    this.status = status;
    this.corpo = corpo;
  }
}

async function chamar(env, rota, corpo) {
  const res = await fetch(`${env.base}/api/automacao/${rota}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.segredo}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const texto = await res.text();
  let json;
  try {
    json = texto ? JSON.parse(texto) : {};
  } catch {
    json = { bruto: texto.slice(0, 300) };
  }
  if (!res.ok) throw new ErroHttp(res.status, json);
  return json;
}

function gravarEstado(arquivo, estado) {
  fs.writeFileSync(arquivo, JSON.stringify(estado));
}

function lerEstado(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return undefined;
  }
}

function mensagem(erro) {
  if (erro?.name === "TimeoutError") return `timeout de ${TIMEOUT_MS / 1000}s`;
  return erro instanceof Error ? erro.message : String(erro);
}

/**
 * A linha do log da VARREDURA das demos vencidas (feita no planejar — ver
 * src/lib/automacao/varredura.ts). Só leitura do que o Radar devolveu.
 */
function resumoVarredura(v) {
  if (v.naoRodou) return `varredura não rodou: ${v.naoRodou}`;
  const partes = [`varredura (prazo ${v.prazoHoras}h): ${v.apagadas} apagada(s), ${v.puladas} pulada(s)`];
  if (v.restantes) partes.push(`${v.restantes} para a próxima`);
  if (v.storageFalhou) partes.push(`${v.storageFalhou} limpeza(s) de Storage falharam`);
  if (v.erro) partes.push(`erro: ${v.erro}`);
  return partes.join(" · ");
}

async function laco(arquivo) {
  const env = ambiente();
  if (!env.base || !env.segredo) {
    gravarEstado(arquivo, { erro: "RADAR_URL ou AUTOMACAO_SECRET ausente no workflow" });
    console.error("[automacao] RADAR_URL (vars.APP_PUBLIC_URL) ou AUTOMACAO_SECRET ausente");
    return 1;
  }

  let plano;
  try {
    plano = await chamar(env, "planejar", { disparo: env.disparo, runUrl: env.runUrl });
  } catch (erro) {
    if (erro instanceof ErroHttp && erro.status === 409) {
      // Outra execução está rodando: a recusa já ficou registrada no Radar.
      console.log(`[automacao] recusada: ${mensagem(erro)}`);
      gravarEstado(arquivo, { encerrada: "recusada" });
      return 0;
    }
    gravarEstado(arquivo, { erro: `planejar: ${mensagem(erro)}` });
    console.error(`[automacao] planejar falhou: ${mensagem(erro)}`);
    return 1;
  }

  if (plano.varredura) console.log(`[automacao] ${resumoVarredura(plano.varredura)}`);

  if (plano.acao !== "executar") {
    console.log(`[automacao] nada a fazer: ${plano.motivo}`);
    gravarEstado(arquivo, { encerrada: "nada", execucaoId: plano.execucaoId });
    return 0;
  }

  const { execucaoId } = plano;
  gravarEstado(arquivo, { execucaoId });
  console.log(`[automacao] execução ${execucaoId}: faltam ${plano.falta}, ${plano.unidades} unidade(s) no plano`);

  let errosSeguidos = 0;
  let motivo = `teto de ${MAX_ITERACOES} iterações`;
  let erroFinal;
  for (let i = 0; i < MAX_ITERACOES; i++) {
    try {
      const r = await chamar(env, "passo", { execucaoId });
      errosSeguidos = 0;
      if (r.unidade) {
        console.log(`[automacao] ${r.unidade.tipo} ${r.unidade.estado}${r.unidade.motivo ? ` — ${r.unidade.motivo}` : ""}`);
      }
      if (!r.temTrabalho) {
        motivo = undefined; // o Radar deriva (alvo atingido, teto, sem par…)
        break;
      }
      if (r.esperarSegundos) await dormir(Math.min(r.esperarSegundos * 1000, ESPERA_MAX_MS));
    } catch (erro) {
      const msg = mensagem(erro);
      console.error(`[automacao] passo falhou: ${msg}`);
      if (erro instanceof ErroHttp && FATAIS.has(erro.status)) {
        erroFinal = `passo: ${msg}`;
        break;
      }
      errosSeguidos += 1;
      if (errosSeguidos >= MAX_ERROS_SEGUIDOS) {
        erroFinal = `${MAX_ERROS_SEGUIDOS} erros seguidos no passo (último: ${msg})`;
        break;
      }
    }
  }

  gravarEstado(arquivo, { execucaoId, ...(motivo && { motivo }), ...(erroFinal && { erro: erroFinal }) });
  return erroFinal ? 1 : 0;
}

async function finalizar(arquivo, resultado) {
  const env = ambiente();
  const estado = lerEstado(arquivo) ?? {};
  if (estado.encerrada) {
    console.log(`[automacao] nada a finalizar (${estado.encerrada})`);
    return 0;
  }
  if (!env.base || !env.segredo) {
    console.error("[automacao] sem RADAR_URL/AUTOMACAO_SECRET não há como registrar a falha no Radar");
    return 1;
  }

  const falhouFora = resultado && resultado !== "success";
  const erro =
    estado.erro ??
    (!estado.execucaoId
      ? `o laço terminou sem plano (resultado do passo: ${resultado ?? "desconhecido"})`
      : falhouFora
        ? `o passo do laço terminou em "${resultado}"`
        : undefined);
  const corpo = {
    ...(estado.execucaoId && { execucaoId: estado.execucaoId }),
    ...(erro && { erro }),
    ...(estado.motivo && { motivo: estado.motivo }),
    disparo: env.disparo,
    ...(env.runUrl && { runUrl: env.runUrl }),
  };

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const { execucao } = await chamar(env, "finalizar", corpo);
      console.log(
        `[automacao] ${execucao.estado}: ${execucao.demosCriadas?.length ?? 0} demo(s), ` +
          `${execucao.requisicoesBusca ?? 0} página(s) de busca, ${execucao.chamadasIA ?? 0} chamada(s) de IA — ${execucao.motivo}`,
      );
      return 0;
    } catch (e) {
      console.error(`[automacao] finalizar falhou (tentativa ${tentativa}): ${mensagem(e)}`);
      if (e instanceof ErroHttp && FATAIS.has(e.status)) break;
      if (tentativa < 3) await dormir(2000 * tentativa);
    }
  }
  return 1;
}

const [comando] = process.argv.slice(2);
const arquivo = arg("estado") ?? "automacao-estado.json";
const codigo =
  comando === "laco"
    ? await laco(arquivo)
    : comando === "finalizar"
      ? await finalizar(arquivo, arg("resultado"))
      : (console.error("uso: automacao-ci.mjs laco|finalizar --estado=<arquivo> [--resultado=<outcome>]"), 2);
process.exit(codigo);
