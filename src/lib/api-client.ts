import type { Busca } from "@/lib/buscas/types";
import type { AppConfig } from "@/lib/config";
import type { UsageCounts } from "@/lib/costs";
import type { DemoDataPatch, TemaPatch } from "@/lib/demos/types";
import type { Lead, LeadStatus } from "@/lib/leads/types";
import type { Metrics, MetricsUsuario } from "@/lib/leads/metrics";
import type { Papel, UsuarioPublico } from "@/lib/usuarios/types";

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

export const api = {
  login: (nome: string, senha: string) =>
    request<void>("/api/login", { method: "POST", body: JSON.stringify({ nome, senha }) }),
  logout: () => request<void>("/api/logout", { method: "POST" }),
  me: () => request<{ usuario: UsuarioPublico }>("/api/me"),

  listUsuarios: () => request<{ usuarios: UsuarioPublico[] }>("/api/usuarios"),
  createUsuario: (dados: { nome: string; papel?: Papel; senha?: string }) =>
    request<{ usuario: UsuarioPublico }>("/api/usuarios", {
      method: "POST",
      body: JSON.stringify(dados),
    }),
  patchUsuario: (
    id: string,
    patch: { nome?: string; papel?: Papel; ativo?: boolean; senha?: string },
  ) =>
    request<{ usuario: UsuarioPublico }>(`/api/usuarios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  getConfig: () => request<{ config: AppConfig }>("/api/config"),
  putConfig: (patch: Partial<AppConfig>) =>
    request<{ config: AppConfig }>("/api/config", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  getUsage: () => request<UsageResponse>("/api/usage"),
  getMetrics: () => request<MetricsResponse>("/api/metrics"),

  search: (body: {
    nicho?: string;
    subNicho?: string;
    regiao?: string;
    nome?: string;
    quantidade?: number;
    qualificada?: boolean;
  }) =>
    request<SearchResponse>("/api/search", { method: "POST", body: JSON.stringify(body) }),

  geocode: (regiao?: string) =>
    request<GeocodeResponse>(
      `/api/geocode${regiao ? `?regiao=${encodeURIComponent(regiao)}` : ""}`,
    ),

  listBuscas: () => request<{ buscas: Busca[] }>("/api/buscas"),
  patchBusca: (id: string, patch: { cor?: string; mensagemPadrao?: string }) =>
    request<{ busca: Busca }>(`/api/buscas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
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

  getLead: (id: string) => request<{ lead: Lead }>(`/api/leads/${id}`),
  patchLead: (
    id: string,
    patch: { status?: LeadStatus; notas?: string; favorito?: boolean; descartado?: boolean },
  ) =>
    request<{ lead: Lead }>(`/api/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  enrichLead: (id: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}/enrich`, { method: "POST" }),
  putLeadDemo: (
    id: string,
    demo: { skinId: string; themeId: string; dados: DemoDataPatch; tema?: TemaPatch },
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
  deleteDemoVideo: (id: string, slot: string, skinId?: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}/demo/videos`, {
      method: "DELETE",
      body: JSON.stringify({ slot, ...(skinId && { skinId }) }),
    }),
};
