import { randomUUID } from "node:crypto";

import { canalDoEnvio, envioVigente, gerarEnvioToken } from "./envio";
import type { EnvioDemo, LeadDemo } from "./types";

/**
 * Registro de visita à demo pública, na parte que NÃO depende de onde a
 * demo mora. As duas famílias (a demo do lead, no doc de `/leads`, e a
 * avulsa, no doc de `/demosAvulsas`) guardam exatamente o mesmo par
 * `demo.envios` + `demoVisitas`, e a regra de consumo de token é a mesma —
 * então a regra vive aqui, pura, e cada repositório só faz a leitura e a
 * escrita do seu doc.
 *
 * Ver "Token de envio por canal" em ARCHITECTURE.md.
 */

/** Uma visita registrada — mesmo formato nos dois hospedeiros. */
export interface VisitaDemo {
  id: string;
  /** Início da visita (ISO). */
  em: string;
  interna: boolean;
  /** `geradoEm` do envio cujo token esta visita consumiu — ausente se o token não é reconhecido. */
  envioEm?: string;
  canal?: EnvioDemo["canal"];
  duracaoSegundos?: number;
  /** 0–100, maior profundidade de scroll atingida na visita. */
  scrollPercent?: number;
  geo?: { pais?: string; regiao?: string; cidade?: string };
}

export interface EntradaVisita {
  token?: string;
  interna: boolean;
  /** Geolocalização por IP, só informativa — ver DemoVisita.geo. */
  geo?: { pais?: string; regiao?: string; cidade?: string };
}

export interface ResultadoVisita {
  /** Lista de envios depois da visita — rotacionada só quando o token vigente foi consumido. */
  envios: EnvioDemo[];
  visita: VisitaDemo;
}

/**
 * Aplica uma visita sobre o histórico de envios: monta a entrada e decide
 * se o token apresentado CONSOME o envio vigente do canal dele (gerando o
 * próximo, empurrado para o início da lista).
 *
 * Visita interna (sessão do app ou marcador de dispositivo — ver
 * `lib/device.ts`) nunca consome: preview do time não pode queimar o envio
 * antes de quem recebeu o link abrir.
 */
export function aplicarVisita(
  demo: Pick<LeadDemo, "envios">,
  entrada: EntradaVisita,
  em: string,
  novoId: () => string = randomUUID,
  novoToken: () => string = gerarEnvioToken,
): ResultadoVisita {
  const envios = demo.envios ?? [];
  const envioCorrespondente = envios.find((envio) => envio.token === entrada.token);
  const canal = envioCorrespondente ? canalDoEnvio(envioCorrespondente) : undefined;

  const visita: VisitaDemo = {
    id: novoId(),
    em,
    interna: entrada.interna,
    ...(envioCorrespondente && { envioEm: envioCorrespondente.geradoEm }),
    ...(canal && { canal }),
    ...(entrada.geo && { geo: entrada.geo }),
  };

  // Vigente é POR CANAL: um link copiado não queima o token do WhatsApp e
  // vice-versa (ver EnvioDemo.canal em ./types.ts).
  const vigente = canal ? envioVigente({ envios }, canal) : undefined;
  const consome = !entrada.interna && vigente !== undefined && vigente.token === entrada.token;

  return {
    envios: consome ? [{ token: novoToken(), geradoEm: em, canal: canal! }, ...envios] : envios,
    visita,
  };
}

/** Campos que o beacon do unload completa numa visita já registrada. */
export interface CompletarVisita {
  duracaoSegundos?: number;
  scrollPercent?: number;
  /** Marcador de dispositivo válido — promove a visita a interna, nunca o contrário. */
  marcadorDispositivo?: boolean;
}

/**
 * Completa uma visita já registrada com duração/scroll do beacon. Devolve
 * a lista intocada quando a visita não existe (o beacon é best-effort e
 * não tem pra quem reclamar).
 */
export function completarVisita<T extends VisitaDemo>(
  visitas: T[],
  visitaId: string,
  dados: CompletarVisita,
): T[] {
  const idx = visitas.findIndex((visita) => visita.id === visitaId);
  if (idx === -1) return visitas;

  const atualizadas = [...visitas];
  atualizadas[idx] = {
    ...atualizadas[idx],
    ...(dados.duracaoSegundos !== undefined && { duracaoSegundos: dados.duracaoSegundos }),
    ...(dados.scrollPercent !== undefined && { scrollPercent: dados.scrollPercent }),
    // Só PARA CIMA: um beacon sem marcador nunca derruba uma visita que o
    // carregamento já classificou como interna.
    ...(dados.marcadorDispositivo && { interna: true }),
  };
  return atualizadas;
}
