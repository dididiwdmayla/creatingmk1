/**
 * ORQUESTRADOR do workflow de capturas (.github/workflows/capturas.yml).
 *
 * Ele NÃO captura nada: o motor (`scripts/capturas.mjs`) continua sendo o
 * único que sabe enquadrar, e é chamado aqui como processo filho, sem
 * alteração de comportamento. O que este script faz é a parte que só
 * existe porque a geração virou botão na plataforma: mover o estado no doc
 * do alvo e transformar o manifesto do motor em referência gravada.
 *
 * ALVO é a demo de um lead (id cru) ou uma demo avulsa (`avulsa:<id>`) —
 * ver src/lib/demos/capturas/alvo.mjs. O nome do parâmetro continua
 * `--leads` porque é o que o workflow e o `client_payload` já mandam.
 *
 *   node scripts/capturas-ci.mjs --leads=a,b,avulsa:c --execucao=<uuid> [--run-url=<url>]
 *   node scripts/capturas-ci.mjs --leads=... --execucao=... --falhar="<motivo>"
 *
 * O segundo modo é a rede de segurança do workflow: se o job quebrar ANTES
 * do motor (dependência, instalação do Chromium), o alvo ficaria preso em
 * "rodando" até o limite de silêncio expirar. O passo `if: failure()`
 * marca a falha na hora, com motivo.
 *
 * Escreve direto no Firestore com a MESMA credencial que já usa pro
 * Storage. Foi de propósito: um callback HTTP de volta pro Radar exigiria
 * um endpoint público novo e um segredo compartilhado só pra dizer
 * "terminei" — mais superfície pra proteger, nenhum ganho.
 *
 * O lote inteiro roda num `next build` e num Chromium só (`--leads` do
 * motor): o build custa mais que todas as capturas de um lead somadas.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { parseAlvo } from "../src/lib/demos/capturas/alvo.mjs";
import { RAIZ } from "./qa-servidor.mjs";

function opcao(nome) {
  const arg = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return arg?.split("=").slice(1).join("=");
}

const leads = (opcao("leads") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
const execucaoId = opcao("execucao");
const runUrl = opcao("run-url");
const MANIFESTO = path.join(RAIZ, "capturas-ci", "manifesto.json");

if (leads.length === 0 || !execucaoId) {
  console.error("uso: node scripts/capturas-ci.mjs --leads=a,b,c --execucao=<uuid> [--run-url=<url>]");
  process.exit(2);
}

async function db() {
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

/**
 * Aplica um patch em `lead.capturas` SÓ se o pedido ainda for o vigente.
 *
 * É o `escritaAindaVale` de `lib/demos/capturas/estado.ts`, aqui como uma
 * comparação dentro da transação (o script é `.mjs` e não importa TS). O
 * caso que ela cobre: o operador acha demorado, clica em "refazer", e
 * passam a existir dois runs — o antigo termina depois e enterraria o
 * resultado do novo, ou marcaria "falhou" por cima de um "pronto".
 */
async function aplicar(firestore, alvo, patch) {
  const parsed = parseAlvo(alvo);
  if (!parsed) return false;
  // A coleção sai do próprio alvo: `avulsa:<id>` mora em /demosAvulsas, o
  // resto em /leads (ver src/lib/demos/capturas/alvo.mjs). Os dois guardam
  // o estado no MESMO campo `capturas`, com o mesmo contrato.
  const ref = firestore.collection(parsed.colecao).doc(parsed.id);
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const atual = snap.exists ? snap.data()?.capturas : undefined;
    if (!atual || atual.execucaoId !== execucaoId) return false;
    tx.update(ref, {
      capturas: { ...atual, ...patch },
      atualizadoEm: new Date().toISOString(),
    });
    return true;
  });
}

function rodarMotor() {
  return new Promise((resolve) => {
    const filho = spawn(
      "node",
      [
        "scripts/capturas.mjs",
        `--leads=${leads.join(",")}`,
        `--manifesto=${MANIFESTO}`,
        "--saida=capturas-ci",
        "--subir",
      ],
      { cwd: RAIZ, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    // O log inteiro vai pro console do run (é onde se depura uma falha), e
    // as últimas linhas viram a mensagem de erro gravada no lead — um
    // "falhou" sem motivo obriga o operador a caçar o run na mão.
    const cauda = [];
    const acompanhar = (fluxo) => (buf) => {
      const texto = String(buf);
      process.stdout.write(texto);
      for (const linha of texto.split("\n")) {
        if (linha.trim()) cauda.push(linha.trim());
      }
      if (cauda.length > 40) cauda.splice(0, cauda.length - 40);
      void fluxo;
    };
    filho.stdout.on("data", acompanhar("out"));
    filho.stderr.on("data", acompanhar("err"));
    filho.on("error", (e) => resolve({ codigo: -1, cauda: [String(e.message)] }));
    filho.on("exit", (codigo) => resolve({ codigo, cauda }));
  });
}

async function main() {
  const firestore = await db();

  const falhar = opcao("falhar");
  if (falhar !== undefined) {
    for (const leadId of leads) {
      const moveu = await aplicar(firestore, leadId, {
        estado: "falhou",
        erro: (falhar || "o workflow falhou antes de capturar").slice(0, 500),
        geradoEm: new Date().toISOString(),
        runUrl,
      });
      console.log(`[estado] ${leadId} → falhou${moveu ? "" : " (ignorado: pedido já não é o vigente)"}`);
    }
    return;
  }

  const iniciadoEm = new Date().toISOString();

  for (const leadId of leads) {
    const moveu = await aplicar(firestore, leadId, { estado: "rodando", iniciadoEm, runUrl });
    console.log(`[estado] ${leadId} → rodando${moveu ? "" : " (ignorado: pedido já não é o vigente)"}`);
  }

  const { codigo, cauda } = await rodarMotor();

  // Saída ≠ 0 NÃO é sinônimo de fracasso: o motor sai 1 quando alguma
  // captura reprova no portão (título coberto, imagem faltando), e as
  // outras continuam boas. Quem decide é o manifesto.
  let manifesto = [];
  try {
    manifesto = JSON.parse(await fs.readFile(MANIFESTO, "utf8"));
  } catch {
    manifesto = [];
  }

  const porLead = new Map(manifesto.map((e) => [e.leadId ?? e.alvo, e]));
  let prontos = 0;
  let falhos = 0;

  for (const leadId of leads) {
    const entrada = porLead.get(leadId);
    const imagens = (entrada?.imagens ?? []).filter((i) => i.url);

    if (imagens.length === 0) {
      const motivo =
        entrada?.reprovadas?.length > 0
          ? entrada.reprovadas.join(" · ")
          : (cauda.slice(-3).join(" · ") || `o motor saiu com código ${codigo}`);
      await aplicar(firestore, leadId, {
        estado: "falhou",
        erro: motivo.slice(0, 500),
        geradoEm: new Date().toISOString(),
        runUrl,
      });
      falhos += 1;
      console.log(`[estado] ${leadId} → falhou: ${motivo.slice(0, 160)}`);
      continue;
    }

    await aplicar(firestore, leadId, {
      estado: "pronto",
      geradoEm: new Date().toISOString(),
      runUrl,
      imagens: imagens.map((i) => ({
        ancora: i.ancora,
        tela: i.tela,
        ordem: i.ordem,
        url: i.url,
        largura: i.largura,
        altura: i.altura,
        // A versão em moldura só entra se de fato subiu. Gravar a chave com
        // `undefined` derruba a escrita no Firestore, e gravá-la sem `url`
        // faria a ficha oferecer um download que responde 404.
        ...(i.composta?.url
          ? {
              composta: {
                url: i.composta.url,
                largura: i.composta.largura,
                altura: i.composta.altura,
              },
            }
          : {}),
      })),
      // A prévia do link é do lead, não de uma âncora — e é opcional pela
      // mesma razão que a moldura: se ela não saiu, a rota pública serve o
      // recurso de reserva, e as capturas continuam boas. `null` explícito
      // quando não saiu: o patch é mesclado sobre o estado anterior, e
      // omitir a chave deixaria a prévia da rodada PASSADA apontando para
      // um objeto que o motor já apagou do Storage.
      ...(entrada?.previa?.url
        ? {
            previa: {
              url: entrada.previa.url,
              largura: entrada.previa.largura,
              altura: entrada.previa.altura,
              ...(entrada.previa.nome ? { nome: entrada.previa.nome } : {}),
            },
          }
        : { previa: null }),
      // Uma âncora que reprovou no portão não invalida as outras, mas o
      // operador precisa saber que faltou uma — senão ele conta 4 imagens
      // onde esperava 6 e não sabe por quê. A prévia do link entra na MESMA
      // lista (ver `manifesto[].reprovadas` em scripts/capturas.mjs): se ela
      // falhou, o `og:image` caiu pro recurso de reserva (nome sobre a cor
      // da marca, sem descrição, sem janela de navegador) e o operador
      // precisa ver isso aqui — "pronto" sem aviso nenhum é o estado que
      // mente, mesmo com as âncoras todas boas.
      ...(entrada?.reprovadas?.length > 0
        ? { erro: `${entrada.reprovadas.length} problema(s): ${entrada.reprovadas.join(" · ")}`.slice(0, 500) }
        : { erro: null }),
    });
    prontos += 1;
    console.log(`[estado] ${leadId} → pronto (${imagens.length} imagens)`);
  }

  console.log(`\n${prontos} lead(s) pronto(s), ${falhos} falho(s)`);
  // O run só reprova se NINGUÉM ficou pronto: um lote em que um lead falha
  // e nove terminam é um lote bem-sucedido com uma exceção registrada.
  if (prontos === 0) process.exitCode = 1;
}

await main();
