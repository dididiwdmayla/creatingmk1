import type { NivelIA } from "@/lib/ai/nivel";
import type { SugestaoDemo } from "@/lib/ai/sugestao";
import type { ConteudoTraduzivel } from "@/lib/ai/traducaoDemo";
import type { CronExecucao } from "@/lib/buscas/cron";
import type { Busca } from "@/lib/buscas/types";
import type { AppConfig } from "@/lib/config";
import type { DemoAvulsa } from "@/lib/demos/avulsas/types";
import type { ImportacaoMaps } from "@/lib/demos/avulsas/googleMaps";
import type { LeadCapturas } from "@/lib/demos/capturas/estado";
import type { FilaConfig } from "@/lib/fila/config";
import type {
  ContadorPainel,
  FilaEnvioDoc,
  FilaTesteDoc,
  LinhaFilaPainel,
  LinhaRetido,
  PendenciaEnvio,
  RespostaPendente,
} from "@/lib/fila/estado";
import type {
  ConjuntoSkin,
  FrasesProspeccao,
  RelatorioMigracao,
} from "@/lib/frases/types";
import type { UsageCounts, UsoUsuario } from "@/lib/costs";
import type { DemoData, DemoDataPatch, TemaPatch } from "@/lib/demos/types";
import type { Lead, LeadStatus } from "@/lib/leads/types";
import type { JanelasContatoConfig } from "@/lib/leads/janelaContato";
import type { PenetracaoSite } from "@/lib/leads/penetracao";
import type { Metrics, MetricsUsuario } from "@/lib/leads/metrics";
import type { ConversaResumo, Mensagem } from "@/lib/mensagens/types";
import type { RegiaoIndice } from "@/lib/regioes";
import type { TemaApp } from "@/lib/tema";
import type { ProgressoMetas } from "@/lib/usuarios/metas";
import type { PreferenciasListas } from "@/lib/usuarios/preferencias";
import type { LimitesUsuario, MetasUsuario, Papel, UsuarioPublico } from "@/lib/usuarios/types";

/** Espelha o formato de erro padrão das rotas (ver ARCHITECTURE.md). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    // FormData define o próprio Content-Type (multipart com boundary).
    const headers =
      init?.body instanceof FormData
        ? (init?.headers ?? {})
        : { "Content-Type": "application/json", ...(init?.headers ?? {}) };
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(0, "network_error", "Falha de rede. Verifique sua conexão.");
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    const err = (body as { error?: Record<string, unknown> } | undefined)?.error;
    throw new ApiError(
      res.status,
      typeof err?.code === "string" ? err.code : "unknown_error",
      typeof err?.message === "string" ? err.message : `Erro ${res.status}`,
      err ?? {},
    );
  }
  return body as T;
}

export interface UsageResponse {
  period: string;
  usage: UsageCounts;
  caps: UsageCounts;
  cotaGratis: UsageCounts;
  custoProjetado: { usd: number; brl: number };
  /** Só para admin: requests por SKU de cada usuário. */
  porUsuario?: Array<{ userId: string; nome: string; usage: UsageCounts }>;
}

/** Cota individual do usuário logado — indicador permanente em /leads e na ficha. */
export interface CotasResponse {
  buscas: UsoUsuario;
  enriquecimentos: UsoUsuario;
  geracoesIA: UsoUsuario;
}

/** Tabela do painel admin (/config): uso × limite de cada usuário. */
export interface CotasUsuariosResponse {
  usuarios: Array<{
    id: string;
    nome: string;
    papel: Papel;
    ativo: boolean;
    limites: LimitesUsuario;
    buscas: UsoUsuario;
    enriquecimentos: UsoUsuario;
    geracoesIA: UsoUsuario;
  }>;
}

/**
 * Tabela do painel admin (/config): meta × progresso de prospecção de cada
 * usuário. Mesma resposta alimenta a visão consolidada do time no painel.
 */
export interface MetasUsuariosResponse {
  usuarios: Array<{
    id: string;
    nome: string;
    papel: Papel;
    ativo: boolean;
    metas: MetasUsuario;
    prospeccao: ProgressoMetas;
  }>;
}

/** Métricas + (para admin) rollup de ações-chave por usuário. */
export type MetricsResponse = Metrics & {
  porUsuario?: Array<{ userId: string; nome: string } & MetricsUsuario>;
};

export interface SearchResponse {
  criados: number;
  existentes: number;
  leads: Lead[];
  busca: Busca;
  /** Páginas do Text Search consumidas (cada uma = 1 request de cota). */
  paginas: number;
  /** Endereço que o geocoding resolveu para a região ("Sarandi, PR, Brasil"). */
  regiaoResolvida: string;
  /** Presente quando a busca parou antes da quantidade pedida (teto/erro/fim). */
  aviso?: string;
}

export interface GeocodeResponse {
  regiao: string;
  endereco: string;
  location: { lat: number; lng: number };
  viewport: {
    low: { latitude: number; longitude: number };
    high: { latitude: number; longitude: number };
  };
  cached: boolean;
}

/**
 * `GET /api/fila/diagnostico` — o que o painel "Fila de envio" (/config)
 * desenha: o funil inteiro, na ordem em que a seleção avalia.
 *
 * `pool.geradoEm` date as contagens ESTRUTURAIS: elas só são apuráveis na
 * varredura completa de `/leads`, então são o retrato do último rebuild
 * (até POOL_TTL_MS de idade, ou mais). `nichoBarrado`, `janela`,
 * `elegiveis` e as duas listas são calculados AGORA sobre esse mesmo pool.
 */
export interface FilaDiagnosticoResponse {
  /** Portão de ritmo ativo agora (`pausado`, `meta_atingida`…), ou null. */
  ritmo: string | null;
  contador: ContadorPainel;
  pool: {
    /** ISO do último rebuild, ou null se ninguém bateu em /proximo ainda. */
    geradoEm: string | null;
    lidos: number;
    truncado: boolean;
    estrutural: Record<string, number>;
  };
  nichoBarrado: number;
  janela: { razoavel: number; ruim: number; semNivel: number };
  elegiveis: number;
  /** As próximas linhas a serem entregues, na ordem em que serão. */
  proximos: LinhaFilaPainel[];
  /** Quem passou no nicho e parou na janela, com a próxima faixa aceita. */
  bloqueados: LinhaFilaPainel[];
}

/**
 * `GET /api/config/fila/retidos` e a resposta do DELETE que libera um deles.
 *
 * `total` é o número que o funil mostra e `linhas` é a lista logo abaixo: a
 * MESMA varredura produz os dois, então eles não têm como discordar. A lista
 * não tem teto — o volume é limitado pela própria fila (`metaDiaria` reservas
 * por dia), e um teto esconderia justamente o lead que o operador quer
 * liberar.
 */
export interface FilaRetidosResponse {
  total: number;
  linhas: LinhaRetido[];
  /** `retencaoEnvioHoras` em vigor — 0 quer dizer retenção DESLIGADA. */
  retencaoHoras: number;
}

/**
 * `GET /api/fila/teste` — o estado do disparo de teste do painel
 * "Fila de envio" (/config). Rota própria, e não mais um campo do
 * diagnóstico: o ciclo de vida é outro (recarrega ao injetar, não ao salvar
 * a config) e aqui há escrita.
 */
export interface FilaTesteEstadoResponse {
  /** Destino de TODO disparo de teste. Vazio = disparo desligado. */
  numeroTeste: string;
  leadDeTeste: { leadId: string; nome: string; pronto: boolean };
  /** A tarefa atual, seja qual for o estado dela, ou null se nunca houve. */
  atual: FilaTesteDoc | null;
  validadeMs: number;
}

/**
 * `POST /api/fila/teste` — injetou, ou parou em alguma etapa. Barrar é
 * resultado legítimo (é o diagnóstico que a tela pediu), então vem em 200
 * com `injetada: false` e a etapa NOMINAL.
 */
export type FilaTesteInjecaoResponse =
  | { injetada: true; teste: FilaTesteDoc }
  | { injetada: false; leadId: string; nome: string; etapa: string; motivo: string };

/** Fila do dia (/hoje): as 4 seções + contexto para badges e WhatsApp. */
export interface HojeResponse {
  novos: Lead[];
  followUps: Lead[];
  demosParadas: Lead[];
  /** Contactado, abriu a demo (visita não-interna) e ainda não respondeu. */
  abriramNaoResponderam: Lead[];
  /** Carimbo anterior usado no delta de novos (null = primeira visita). */
  novosDesde: string | null;
  followUpDias: number;
  /** Mensagem global do WhatsApp (fallback quando o grupo não tem própria). */
  mensagemPadrao: string;
  /** Recomendação de janela de contato por família — ver `@/lib/leads/janelaContato`. */
  janelasContato: JanelasContatoConfig;
  /** Meta de prospecção do PRÓPRIO usuário logado (dia/semana); janela sem `meta` não exibe nada. */
  metaProspeccao: ProgressoMetas;
  buscas: Array<{
    id: string;
    nome: string;
    cor: string;
    nicho: string;
    regiao: string;
    mensagemPadrao?: string;
    penetracao?: PenetracaoSite;
  }>;
}

/**
 * GET /api/mundo: os países onde AGORA é faixa boa para o nicho escolhido,
 * já na ordem da tela (idioma, depois índice desc). Ver "Onde prospectar
 * agora" em ARCHITECTURE.md — rota derivada, sem nenhuma chamada paga.
 */
export interface MundoResponse {
  familia: string;
  familias: Array<{ id: string; rotulo: string }>;
  /** Instante do cálculo no servidor (ISO). */
  agora: string;
  paises: Array<{
    codigo: string;
    nome: string;
    idiomas: string[];
    /** Hora local do país, pronta pra tela ("9h30"). */
    horaLocal: string;
    minutoLocal: number;
    utcOffsetMinutos: number;
    /** Faixa boa que cobre este minuto, em minuto do dia LOCAL do país. */
    faixa: { inicioMin: number; fimMin: number };
    indice: { indice: number; fonte: "regioes" | "config"; cidades: number };
    /** Total de leads não contatados naquele país e nicho (a lista abaixo é recortada). */
    totalLeads: number;
    leads: Array<{ placeId: string; nome: string; endereco?: string; siteProprio?: boolean }>;
  }>;
  /** Só quando nenhum país está em faixa boa: o próximo a abrir. */
  emBreve?: {
    codigo: string;
    nome: string;
    rotuloDia: string;
    inicioMin: number;
    emMinutos: number;
  };
}

/**
 * GET /api/frases: os conjuntos de frases de abordagem — UM por skin do
 * registro, vazios inclusive, já com nome/nicho da skin resolvidos no
 * servidor. Ver "Frases de prospecção por skin".
 */
export interface FrasesResponse {
  conjuntos: ConjuntoSkin[];
}

/**
 * GET/POST /api/frases/migrar: as entradas antigas (chaveadas pelo texto do
 * nicho) levadas para as skins. `legados` é quantas ainda existem no banco —
 * a seção de frases só mostra o bloco de migração quando é > 0.
 */
export interface MigracaoFrasesResponse {
  legados?: number;
  relatorio: RelatorioMigracao;
}

/** GET /api/regioes: índice de mercado da região (calculadora de precificação). */
export interface RegiaoIndiceResponse {
  regiao: RegiaoIndice;
  cached: boolean;
}

/** GET /api/search/termo-local: dica de termo traduzido pro campo de nicho. */
export type TermoLocalResponse =
  | { disponivel: false }
  | { disponivel: true; pais: string; idioma: string; termo: string };

/** Widget do dashboard: última rodada do cron + recorrentes ligadas. */
export interface CronStatusResponse {
  ultima: CronExecucao | null;
  recorrentes: number;
}

/**
 * Faixa fixa de metas (topo do app): progresso do PRÓPRIO usuário +
 * estado de minimizada — mais leve que HojeResponse (sem a fila do dia).
 */
export type MetaProprioResponse = ProgressoMetas & { minimizada: boolean };

/** Resumo da página /mensagens: interlocutores + conversas + badge. */
export interface MensagensResumoResponse {
  usuarios: Array<{ id: string; nome: string; ativo: boolean }>;
  conversas: ConversaResumo[];
  totalNaoLidas: number;
}

/** Resposta do disparo (individual ou em lote) — ver lib/demos/capturas/enfileirar.ts. */
export interface EnfileiramentoCapturas {
  execucaoId: string;
  enfileirados: string[];
  pulados: Array<{ placeId: string; motivo: string }>;
}

export const api = {
  login: (nome: string, senha: string) =>
    request<void>("/api/login", { method: "POST", body: JSON.stringify({ nome, senha }) }),
  logout: () => request<void>("/api/logout", { method: "POST" }),
  me: () => request<{ usuario: UsuarioPublico }>("/api/me"),

  listUsuarios: () => request<{ usuarios: UsuarioPublico[] }>("/api/usuarios"),
  listNomesUsuarios: () =>
    request<{ usuarios: Array<{ id: string; nome: string }> }>("/api/usuarios/nomes"),
  excluirUsuario: (id: string) => request<void>(`/api/usuarios/${id}`, { method: "DELETE" }),
  createUsuario: (dados: { nome: string; papel?: Papel; senha?: string }) =>
    request<{ usuario: UsuarioPublico }>("/api/usuarios", {
      method: "POST",
      body: JSON.stringify(dados),
    }),
  patchUsuario: (
    id: string,
    patch: {
      nome?: string;
      papel?: Papel;
      ativo?: boolean;
      senha?: string;
      /** number seta o limite; null limpa (sem limite naquela janela). */
      limites?: Partial<Record<keyof LimitesUsuario, number | null>>;
      /** number seta a meta; null limpa (sem meta naquela janela). */
      metas?: Partial<Record<keyof MetasUsuario, number | null>>;
    },
  ) =>
    request<{ usuario: UsuarioPublico }>(`/api/usuarios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  zerarCotaDiaUsuario: (id: string) =>
    request<void>(`/api/usuarios/${id}/zerar-dia`, { method: "POST" }),
  getCotasUsuarios: () => request<CotasUsuariosResponse>("/api/usuarios/cotas"),
  getMetasUsuarios: () => request<MetasUsuariosResponse>("/api/usuarios/metas"),

  /** Enfileira a geração de capturas de UM lead (botão da ficha). */
  gerarCapturas: (id: string, forcar = false) =>
    request<EnfileiramentoCapturas>(`/api/leads/${id}/capturas`, {
      method: "POST",
      body: JSON.stringify({ forcar }),
    }),
  /** Enfileira o LOTE (ação a partir de um grupo de busca). */
  gerarCapturasLote: (placeIds: string[], forcar = false) =>
    request<EnfileiramentoCapturas>("/api/capturas", {
      method: "POST",
      body: JSON.stringify({ placeIds, forcar }),
    }),
  /** Estado da geração dos leads pedidos — o acompanhamento sem recarregar. */
  getEstadoCapturas: (ids: string[]) =>
    request<{ capturas: Record<string, LeadCapturas | null>; disponivel: boolean }>(
      `/api/capturas?ids=${encodeURIComponent(ids.join(","))}`,
    ),

  getConfig: () => request<{ config: AppConfig }>("/api/config"),
  putConfig: (patch: Partial<AppConfig>) =>
    request<{ config: AppConfig }>("/api/config", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  /** Estado/tetos da fila de envio (doc `/config/fila`, próprio) — painel "Fila de envio". */
  getFilaConfig: () => request<{ fila: FilaConfig }>("/api/config/fila"),
  putFilaConfig: (patch: Partial<FilaConfig>) =>
    request<{ fila: FilaConfig }>("/api/config/fila", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  /**
   * Leads que receberam o texto mas não o print (ver `detalheEnvio`) —
   * lista de pendência MANUAL do painel "Fila de envio". `resolvidas`
   * traz também as já fechadas, para desfazer um alternador marcado por
   * engano.
   */
  getFilaPendencias: (resolvidas = false) =>
    request<{ pendencias: PendenciaEnvio[] }>(
      `/api/config/fila/pendencias${resolvidas ? "?resolvidos=1" : ""}`,
    ),
  patchFilaPendencia: (leadId: string, resolvido: boolean) =>
    request<{ pendencia: PendenciaEnvio }>(
      `/api/config/fila/pendencias/${encodeURIComponent(leadId)}`,
      { method: "PATCH", body: JSON.stringify({ resolvido }) },
    ),

  /**
   * Os leads que a RETENÇÃO POR CLAIM NÃO CONFIRMADA está segurando — o
   * aparelho levou a tarefa e não disse o que houve, então o lead fica fora
   * da fila pela janela de `retencaoEnvioHoras` (ver `lib/fila/retidos.ts`).
   *
   * `total` e `linhas` vêm da MESMA varredura de propósito: é o número que o
   * funil do painel mostra, e ele não pode discordar da lista logo abaixo
   * dele. `retencaoHoras` viaja junto porque "0 retidos" com a retenção
   * ligada e "0 retidos" com ela desligada são fatos diferentes.
   *
   * Sob `/api/config/` e não `/api/fila/`, pelo mesmo motivo das pendências
   * de print, e restrita ao admin como todo o painel.
   */
  getFilaRetidos: () => request<FilaRetidosResponse>("/api/config/fila/retidos"),

  /**
   * LIBERA um retido: o operador conferiu que a mensagem não saiu e devolve
   * o lead à fila antes de a janela vencer. Devolve a lista NOVA (quem
   * continua retido é decisão do servidor, não da tela).
   *
   * DELETE porque o que se apaga é a retenção, e a ação é de mão única — não
   * há "re-reter". 409 `claim_ativa` quando o aparelho está com o lead
   * reservado NESTE momento: liberar ali produziria a segunda reserva do
   * mesmo lead, que é a duplicata que a retenção existe para evitar.
   */
  deleteFilaRetido: (leadId: string) =>
    request<FilaRetidosResponse>(`/api/config/fila/retidos/${encodeURIComponent(leadId)}`, {
      method: "DELETE",
    }),

  /**
   * Respostas pendentes: o lead respondeu, a IA rascunhou, e o operador
   * ainda não decidiu. Cada linha traz o que a decisão exige — quem é o
   * lead, o que ELE mandou, o que o Radar tinha mandado e o rascunho.
   *
   * Sob `/api/config/` e não `/api/fila/`, pelo mesmo motivo das
   * pendências de print, e restrita ao admin com uma razão a mais: o
   * corpo destas respostas é conversa PRIVADA do celular do operador.
   *
   * `respostaAutomatica` vem junto porque explica a lista: ligado, o que
   * está na fila do aparelho não aparece aqui, e a tela precisa dizer isso
   * em vez de mostrar um vazio sem motivo.
   */
  getFilaRespostas: () =>
    request<{ respostas: RespostaPendente[]; respostaAutomatica: boolean }>(
      "/api/config/fila/respostas",
    ),

  /**
   * Fecha uma pendência de resposta. `texto` é o que o operador de fato
   * mandou — a caixa da tela é EDITÁVEL, e é a edição dela que vai para o
   * WhatsApp, não o rascunho original.
   *
   * `keepalive` porque no Android o clique em "usar" navega para a URI de
   * intent na MESMA ação (o Chrome recusa lançar app externo sem gesto do
   * usuário, então não dá para esperar esta resposta antes de navegar):
   * sem ele, a marcação poderia morrer junto com a página.
   */
  patchFilaResposta: (id: string, estado: "usada" | "descartada", texto?: string) =>
    request<{ id: string; estado: string }>(
      `/api/config/fila/respostas/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ estado, ...(texto !== undefined && { texto }) }),
        keepalive: true,
      },
    ),

  /**
   * A VISÃO da fila para o painel da /config (admin): o portão de ritmo
   * ativo, o contador do dia, as contagens por etapa do funil e as duas
   * listas curtas (próximos elegíveis, bloqueados por janela).
   *
   * Vive sob `/api/fila/` — o prefixo que o proxy isenta da sessão porque é
   * onde o celular bate com a RADAR_DEVICE_KEY —, mas a rota faz a própria
   * checagem de sessão + papel de admin. Leitura pura: NADA aqui dispara
   * envio, e a chamada nem reconstrói o pool (as contagens estruturais são
   * o retrato do último rebuild, datado em `pool.geradoEm`).
   */
  getFilaDiagnostico: () => request<FilaDiagnosticoResponse>("/api/fila/diagnostico"),

  /**
   * O DISPARO DE TESTE (admin). `getFilaTeste` lê o estado; `postFilaTeste`
   * injeta a tarefa que o aparelho vai puxar na próxima volta de `/proximo`,
   * ou responde qual etapa barrou o lead escolhido.
   */
  getFilaTeste: () => request<FilaTesteEstadoResponse>("/api/fila/teste"),
  postFilaTeste: (corpo: { leadId?: string; pular?: string[] }) =>
    request<FilaTesteInjecaoResponse>("/api/fila/teste", {
      method: "POST",
      body: JSON.stringify(corpo),
    }),
  /**
   * Gera (ou regenera) a captura do LEAD FIXO DE TESTE, direto do painel —
   * reusa `enfileirarCapturas` por baixo (mesmo mecanismo de
   * `gerarCapturas`/`gerarCapturasLote`), mas admin-only como o resto do
   * bloco "Fila de envio" (as outras duas são qualquer sessão).
   */
  postFilaTesteCapturas: (forcar = false) =>
    request<EnfileiramentoCapturas>("/api/fila/teste/capturas", {
      method: "POST",
      body: JSON.stringify({ forcar }),
    }),

  listFrases: () => request<FrasesResponse>("/api/frases"),
  /** Textos de UMA skin do registro (admin). */
  salvarFrases: (skinId: string, frases: string[]) =>
    request<{ conjunto: FrasesProspeccao }>("/api/frases", {
      method: "PUT",
      body: JSON.stringify({ skinId, frases }),
    }),
  /** Gira a rotação da skin — só o clique de enviar pro WhatsApp chama isto. */
  avancarFrase: (skinId: string) =>
    request<{ indice: number }>("/api/frases/avancar", {
      method: "POST",
      body: JSON.stringify({ skinId }),
    }),
  /**
   * Traduz as frases da skin da demo deste lead para o idioma DELE — chamada
   * PAGA (SKU aiTraducao). Só é chamada depois da confirmação com o número
   * de chamadas e o custo na tela.
   */
  traduzirFrases: (leadId: string) =>
    request<{ conjunto: FrasesProspeccao; idioma: string }>("/api/frases/traduzir", {
      method: "POST",
      body: JSON.stringify({ leadId }),
    }),
  /** Prévia da migração das frases antigas (admin) — não escreve nada. */
  previaMigracaoFrases: () => request<MigracaoFrasesResponse>("/api/frases/migrar"),
  /** Executa a migração das frases antigas (admin). */
  migrarFrases: () =>
    request<MigracaoFrasesResponse>("/api/frases/migrar", { method: "POST" }),
  /** Apaga as entradas antigas que sobraram, depois de eu ter copiado o texto (admin). */
  descartarFrasesLegadas: () =>
    request<{ apagadas: number }>("/api/frases/migrar", { method: "DELETE" }),

  getUsage: () => request<UsageResponse>("/api/usage"),
  getMetrics: () => request<MetricsResponse>("/api/metrics"),
  getCotas: () => request<CotasResponse>("/api/cotas"),

  search: (body: {
    nicho?: string;
    subNicho?: string;
    regiao?: string;
    nome?: string;
    quantidade?: number;
    qualificada?: boolean;
    soSemSite?: boolean;
  }) =>
    request<SearchResponse>("/api/search", { method: "POST", body: JSON.stringify(body) }),

  geocode: (regiao?: string) =>
    request<GeocodeResponse>(
      `/api/geocode${regiao ? `?regiao=${encodeURIComponent(regiao)}` : ""}`,
    ),

  termoLocal: (nicho: string, regiao?: string) => {
    const params = new URLSearchParams({ nicho });
    if (regiao) params.set("regiao", regiao);
    return request<TermoLocalResponse>(`/api/search/termo-local?${params.toString()}`);
  },

  getRegiaoIndice: (regiao: string) =>
    request<RegiaoIndiceResponse>(`/api/regioes?regiao=${encodeURIComponent(regiao)}`),
  regenerarRegiaoIndice: (regiao: string) =>
    request<{ regiao: RegiaoIndice }>("/api/regioes/regenerar", {
      method: "POST",
      body: JSON.stringify({ regiao }),
    }),
  ajustarIndiceRegiao: (regiao: string, indiceAjustado: number | null) =>
    request<{ regiao: RegiaoIndice }>("/api/regioes/ajustar", {
      method: "PATCH",
      body: JSON.stringify({ regiao, indiceAjustado }),
    }),

  getPrecoBaseSlider: () => request<{ precoBase: number | null }>("/api/precificacao/slider"),
  putPrecoBaseSlider: (precoBase: number) =>
    request<{ precoBase: number }>("/api/precificacao/slider", {
      method: "PUT",
      body: JSON.stringify({ precoBase }),
    }),

  getTema: () => request<{ tema: TemaApp }>("/api/tema"),
  putTema: (tema: TemaApp) =>
    request<{ tema: TemaApp }>("/api/tema", {
      method: "PUT",
      body: JSON.stringify({ tema }),
    }),

  hoje: () => request<HojeResponse>("/api/hoje"),
  mundo: (familia?: string) =>
    request<MundoResponse>(
      familia ? `/api/mundo?familia=${encodeURIComponent(familia)}` : "/api/mundo",
    ),
  metaProprio: () => request<MetaProprioResponse>("/api/metas/proprio"),
  salvarMetaFaixaMinimizada: (minimizada: boolean) =>
    request<{ minimizada: boolean }>("/api/metas/proprio", {
      method: "PUT",
      body: JSON.stringify({ minimizada }),
    }),
  cronStatus: () => request<CronStatusResponse>("/api/cron/status"),

  preferenciasListas: () =>
    request<{ preferencias: PreferenciasListas }>("/api/preferencias/listas"),
  salvarPreferenciasListas: (preferencias: PreferenciasListas) =>
    request<{ preferencias: PreferenciasListas }>("/api/preferencias/listas", {
      method: "PUT",
      body: JSON.stringify({ preferencias }),
    }),

  listBuscas: () => request<{ buscas: Busca[] }>("/api/buscas"),
  patchBusca: (
    id: string,
    patch: { cor?: string; mensagemPadrao?: string; recorrente?: boolean },
  ) =>
    request<{ busca: Busca }>(`/api/buscas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  gerarAnaliseBusca: (id: string) =>
    request<{ busca: Busca }>(`/api/buscas/${id}/analise`, { method: "POST" }),
  deleteDemosDoGrupo: (buscaId: string) =>
    request<{ apagadas: number; busca: string }>(`/api/buscas/${buscaId}/demos`, {
      method: "DELETE",
    }),

  listLeads: (filters: {
    status?: string;
    temSite?: string;
    temTelefone?: string;
    buscaId?: string;
    favorito?: string;
  }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return request<{ leads: Lead[] }>(`/api/leads${qs ? `?${qs}` : ""}`);
  },

  getLead: (id: string) =>
    request<{ lead: Lead; filaEnvio?: FilaEnvioDoc }>(`/api/leads/${id}`),
  patchLead: (
    id: string,
    patch: {
      status?: LeadStatus;
      notas?: string;
      favorito?: boolean;
      descartado?: boolean;
      /** Número sem WhatsApp: tira o lead da fila de envio, reversível. */
      telefoneInvalido?: boolean;
      /** Admin ajusta o vendedor do fechamento (default: quem fechou). */
      vendidoPor?: string;
    },
  ) =>
    request<{ lead: Lead }>(`/api/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  registrarContato: (id: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}/contato`, { method: "POST" }),
  enrichLead: (id: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}/enrich`, { method: "POST" }),
  buscarHorarios: (id: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}/horarios`, { method: "POST" }),
  putLeadDemo: (
    id: string,
    demo: {
      skinId: string;
      themeId: string;
      dados: DemoDataPatch;
      tema?: TemaPatch;
      idioma?: string;
    },
  ) =>
    request<{ lead: Lead }>(`/api/leads/${id}/demo`, {
      method: "PUT",
      body: JSON.stringify(demo),
    }),
  deleteLeadDemo: (id: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}/demo`, { method: "DELETE" }),
  uploadDemoImagem: (id: string, slot: string, arquivo: File, skinId?: string) => {
    const form = new FormData();
    form.set("slot", slot);
    if (skinId) form.set("skinId", skinId);
    form.set("arquivo", arquivo);
    return request<{ slot: string; url: string }>(`/api/leads/${id}/demo/imagens`, {
      method: "POST",
      body: form,
    });
  },
  deleteDemoImagem: (id: string, slot: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}/demo/imagens`, {
      method: "DELETE",
      body: JSON.stringify({ slot }),
    }),
  uploadDemoVideo: (id: string, slot: string, arquivo: File, skinId?: string) => {
    const form = new FormData();
    form.set("slot", slot);
    if (skinId) form.set("skinId", skinId);
    form.set("arquivo", arquivo);
    return request<{ slot: string; url: string }>(`/api/leads/${id}/demo/videos`, {
      method: "POST",
      body: form,
    });
  },
  mensagensResumo: () => request<MensagensResumoResponse>("/api/mensagens"),
  listConversa: (comUserId: string) =>
    request<{ mensagens: Mensagem[] }>(
      `/api/mensagens?com=${encodeURIComponent(comUserId)}`,
    ),
  enviarMensagem: (paraUserId: string, texto: string) =>
    request<{ mensagem: Mensagem }>("/api/mensagens", {
      method: "POST",
      body: JSON.stringify({ paraUserId, texto }),
    }),
  mensagensNaoLidas: () => request<{ total: number }>("/api/mensagens/nao-lidas"),

  iaStatus: () => request<{ disponivel: boolean; modelo: string }>("/api/ia"),
  iaNivel: () => request<{ nivel: NivelIA }>("/api/ia/nivel"),
  salvarIaNivel: (nivel: NivelIA) =>
    request<{ nivel: NivelIA }>("/api/ia/nivel", {
      method: "PUT",
      body: JSON.stringify({ nivel }),
    }),
  gerarSugestaoDemo: (id: string, skinId: string, nivel: NivelIA, idioma?: string) =>
    request<{ sugestao: SugestaoDemo }>(`/api/leads/${id}/demo/sugestao`, {
      method: "POST",
      body: JSON.stringify({ skinId, nivel, ...(idioma && { idioma }) }),
    }),
  /**
   * 4ª ação do botão de IA do editor: traduz o texto ATUAL do editor (não
   * gera nada novo) — `dados` é o DemoData efetivo em memória, não os
   * slots padrão da skin. Chamada PAGA (SKU aiGeneration, mesma cota da
   * sugestão), só atrás de confirmação com o custo na tela.
   */
  traduzirDemo: (id: string, skinId: string, idioma: string, dados: DemoData) =>
    request<{ traducao: ConteudoTraduzivel; idioma: string }>(`/api/leads/${id}/demo/traduzir`, {
      method: "POST",
      body: JSON.stringify({ skinId, idioma, dados }),
    }),
  deleteDemoVideo: (id: string, slot: string, skinId?: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}/demo/videos`, {
      method: "DELETE",
      body: JSON.stringify({ slot, ...(skinId && { skinId }) }),
    }),

  // ── Demos avulsas (sem lead associado) ────────────────────────────────
  // Mesmos verbos da demo de lead, contra `/api/demos-avulsas/**`. O
  // editor escolhe um dos dois conjuntos pelo tipo da demo que abriu (ver
  // `clienteDaDemo` em app/leads/[id]/demo/editar/cliente.ts).
  listDemosAvulsas: () => request<{ avulsas: DemoAvulsa[] }>("/api/demos-avulsas"),
  cotacaoImportacaoMaps: () =>
    request<{
      chamadas: number;
      sku: "textSearchEnterprise";
      custo: { usd: number; brl: number };
    }>("/api/demos-avulsas/importar-maps"),
  importarDemoAvulsaMaps: (link: string) =>
    request<{
      identidade: ImportacaoMaps;
      leadExistente: { id: string } | null;
    }>("/api/demos-avulsas/importar-maps", {
      method: "POST",
      body: JSON.stringify({ link }),
    }),
  getDemoAvulsa: (id: string) => request<{ avulsa: DemoAvulsa }>(`/api/demos-avulsas/${id}`),
  criarDemoAvulsa: (corpo: {
    nome: string;
    pais?: string;
    cidade?: string;
    endereco?: string;
    telefone?: string;
    whatsapp?: string;
    horarios?: string;
    instagram?: string;
    skinId: string;
    themeId: string;
    dados?: DemoDataPatch;
    tema?: TemaPatch;
  }) =>
    request<{ avulsa: DemoAvulsa }>("/api/demos-avulsas", {
      method: "POST",
      body: JSON.stringify(corpo),
    }),
  patchDemoAvulsa: (id: string, patch: { pais?: string }) =>
    request<{ avulsa: DemoAvulsa }>(`/api/demos-avulsas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteDemoAvulsa: (id: string) =>
    request<{ ok: true }>(`/api/demos-avulsas/${id}`, { method: "DELETE" }),
  putDemoAvulsa: (
    id: string,
    demo: {
      skinId: string;
      themeId: string;
      dados: DemoDataPatch;
      tema?: TemaPatch;
      idioma?: string;
    },
  ) =>
    request<{ avulsa: DemoAvulsa }>(`/api/demos-avulsas/${id}/demo`, {
      method: "PUT",
      body: JSON.stringify(demo),
    }),
  uploadImagemAvulsa: (id: string, slot: string, arquivo: File, skinId?: string) => {
    const form = new FormData();
    form.set("slot", slot);
    if (skinId) form.set("skinId", skinId);
    form.set("arquivo", arquivo);
    return request<{ slot: string; url: string }>(`/api/demos-avulsas/${id}/demo/imagens`, {
      method: "POST",
      body: form,
    });
  },
  deleteImagemAvulsa: (id: string, slot: string) =>
    request<{ avulsa: DemoAvulsa }>(`/api/demos-avulsas/${id}/demo/imagens`, {
      method: "DELETE",
      body: JSON.stringify({ slot }),
    }),
  uploadVideoAvulsa: (id: string, slot: string, arquivo: File, skinId?: string) => {
    const form = new FormData();
    form.set("slot", slot);
    if (skinId) form.set("skinId", skinId);
    form.set("arquivo", arquivo);
    return request<{ slot: string; url: string }>(`/api/demos-avulsas/${id}/demo/videos`, {
      method: "POST",
      body: form,
    });
  },
  deleteVideoAvulsa: (id: string, slot: string, skinId?: string) =>
    request<{ avulsa: DemoAvulsa }>(`/api/demos-avulsas/${id}/demo/videos`, {
      method: "DELETE",
      body: JSON.stringify({ slot, ...(skinId && { skinId }) }),
    }),
  traduzirDemoAvulsa: (id: string, skinId: string, idioma: string, dados: DemoData) =>
    request<{ traducao: ConteudoTraduzivel; idioma: string }>(
      `/api/demos-avulsas/${id}/demo/traduzir`,
      { method: "POST", body: JSON.stringify({ skinId, idioma, dados }) },
    ),
};
