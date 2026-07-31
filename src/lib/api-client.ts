import type { NivelIA } from "@/lib/ai/nivel";
import type { SugestaoDemo } from "@/lib/ai/sugestao";
import type { CronExecucao } from "@/lib/buscas/cron";
import type { Busca } from "@/lib/buscas/types";
import type { AppConfig } from "@/lib/config";
import type { UsageCounts, UsoUsuario } from "@/lib/costs";
import type { DemoDataPatch, TemaPatch } from "@/lib/demos/types";
import type { Lead, LeadStatus } from "@/lib/leads/types";
import type { PenetracaoSite } from "@/lib/leads/penetracao";
import type { Metrics, MetricsUsuario } from "@/lib/leads/metrics";
import type { ConversaResumo, Mensagem } from "@/lib/mensagens/types";
import type { RegiaoIndice } from "@/lib/regioes";
import type { LimitesUsuario, Papel, UsuarioPublico } from "@/lib/usuarios/types";

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

/** Fila do dia (/hoje): as 3 seções + contexto para badges e WhatsApp. */
export interface HojeResponse {
  novos: Lead[];
  followUps: Lead[];
  demosParadas: Lead[];
  /** Carimbo anterior usado no delta de novos (null = primeira visita). */
  novosDesde: string | null;
  followUpDias: number;
  /** Mensagem global do WhatsApp (fallback quando o grupo não tem própria). */
  mensagemPadrao: string;
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

/** Resumo da página /mensagens: interlocutores + conversas + badge. */
export interface MensagensResumoResponse {
  usuarios: Array<{ id: string; nome: string; ativo: boolean }>;
  conversas: ConversaResumo[];
  totalNaoLidas: number;
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
    },
  ) =>
    request<{ usuario: UsuarioPublico }>(`/api/usuarios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  zerarCotaDiaUsuario: (id: string) =>
    request<void>(`/api/usuarios/${id}/zerar-dia`, { method: "POST" }),
  getCotasUsuarios: () => request<CotasUsuariosResponse>("/api/usuarios/cotas"),

  getConfig: () => request<{ config: AppConfig }>("/api/config"),
  putConfig: (patch: Partial<AppConfig>) =>
    request<{ config: AppConfig }>("/api/config", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

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

  hoje: () => request<HojeResponse>("/api/hoje"),
  cronStatus: () => request<CronStatusResponse>("/api/cron/status"),

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

  getLead: (id: string) => request<{ lead: Lead }>(`/api/leads/${id}`),
  patchLead: (
    id: string,
    patch: {
      status?: LeadStatus;
      notas?: string;
      favorito?: boolean;
      descartado?: boolean;
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
  gerarSugestaoDemo: (id: string, skinId: string, nivel: NivelIA) =>
    request<{ sugestao: SugestaoDemo }>(`/api/leads/${id}/demo/sugestao`, {
      method: "POST",
      body: JSON.stringify({ skinId, nivel }),
    }),
  deleteDemoVideo: (id: string, slot: string, skinId?: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}/demo/videos`, {
      method: "DELETE",
      body: JSON.stringify({ slot, ...(skinId && { skinId }) }),
    }),
};
