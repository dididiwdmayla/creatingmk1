import type { Busca } from "@/lib/buscas/types";
import type { AppConfig } from "@/lib/config";
import type { UsageCounts } from "@/lib/costs";
import type { Lead, LeadStatus } from "@/lib/leads/types";
import type { Metrics } from "@/lib/leads/metrics";

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
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
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
}

export interface SearchResponse {
  criados: number;
  existentes: number;
  leads: Lead[];
  busca: Busca;
}

export const api = {
  login: (senha: string) =>
    request<void>("/api/login", { method: "POST", body: JSON.stringify({ senha }) }),
  logout: () => request<void>("/api/logout", { method: "POST" }),

  getConfig: () => request<{ config: AppConfig }>("/api/config"),
  putConfig: (patch: Partial<AppConfig>) =>
    request<{ config: AppConfig }>("/api/config", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  getUsage: () => request<UsageResponse>("/api/usage"),
  getMetrics: () => request<Metrics>("/api/metrics"),

  search: (body: { nicho?: string; subNicho?: string; regiao?: string; nome?: string }) =>
    request<SearchResponse>("/api/search", { method: "POST", body: JSON.stringify(body) }),

  listBuscas: () => request<{ buscas: Busca[] }>("/api/buscas"),

  listLeads: (filters: {
    status?: string;
    temSite?: string;
    temTelefone?: string;
    buscaId?: string;
  }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return request<{ leads: Lead[] }>(`/api/leads${qs ? `?${qs}` : ""}`);
  },

  getLead: (id: string) => request<{ lead: Lead }>(`/api/leads/${id}`),
  patchLeadStatus: (id: string, status: LeadStatus) =>
    request<{ lead: Lead }>(`/api/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  enrichLead: (id: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}/enrich`, { method: "POST" }),
};
