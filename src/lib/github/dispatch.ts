/**
 * Disparo do workflow de capturas no GitHub Actions
 * (`.github/workflows/capturas.yml`), via `repository_dispatch`.
 *
 * O TOKEN vive só em variável de ambiente do servidor
 * (`GITHUB_CAPTURAS_TOKEN`) e é usado exclusivamente aqui, dentro de route
 * handlers — nenhum caminho do cliente chega perto dele, pelo mesmo
 * princípio que já vale pra chave da Places e pra do Gemini. O cliente
 * pede "gera as capturas deste lead"; quem fala com o GitHub é o servidor.
 *
 * Fail-closed e explícito: sem token ou sem repositório configurado, a
 * rota responde 503 com uma mensagem que diz o que falta, em vez de
 * enfileirar um pedido que nunca sairia da fila.
 */

/** Nome do evento que o workflow escuta (`on.repository_dispatch.types`). */
export const CAPTURAS_EVENT_TYPE = "capturas-demo";

export class CapturasIndisponivelError extends Error {
  readonly code = "capturas_unavailable";
  constructor(message: string) {
    super(message);
    this.name = "CapturasIndisponivelError";
  }
}

export class DispatchError extends Error {
  readonly code = "dispatch_error";
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "DispatchError";
  }
}

export interface ConfigGitHub {
  token: string;
  /** "owner/repo" */
  repo: string;
}

/**
 * Configuração vinda do ambiente, ou `undefined` se faltar alguma parte.
 * `GITHUB_CAPTURAS_REPO` é opcional na Vercel: `VERCEL_GIT_REPO_OWNER`/
 * `VERCEL_GIT_REPO_SLUG` já dizem de qual repositório o deploy saiu.
 */
export function configGitHub(env: NodeJS.ProcessEnv = process.env): ConfigGitHub | undefined {
  const token = env.GITHUB_CAPTURAS_TOKEN;
  const repo =
    env.GITHUB_CAPTURAS_REPO ||
    (env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG
      ? `${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}`
      : undefined);
  if (!token || !repo) return undefined;
  return { token, repo };
}

/** A geração de capturas está configurada? A UI usa isto pra não oferecer um botão morto. */
export function capturasDisponiveis(env: NodeJS.ProcessEnv = process.env): boolean {
  return configGitHub(env) !== undefined;
}

/**
 * Dispara o workflow. Devolve nada em caso de sucesso (o GitHub responde
 * 204 sem corpo — não existe id de run para pegar aqui; o run se anuncia
 * gravando `runUrl` no lead quando começa).
 *
 * As mensagens de erro são específicas de propósito: "falha ao disparar"
 * sozinho obrigaria abrir o painel do GitHub pra descobrir se o token
 * venceu, se falta permissão ou se o nome do repositório está errado.
 */
export async function dispararCapturas(
  payload: { leads: string[]; execucao: string },
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const config = configGitHub(env);
  if (!config) {
    throw new CapturasIndisponivelError(
      "Geração de capturas não configurada: falta GITHUB_CAPTURAS_TOKEN (e GITHUB_CAPTURAS_REPO, se o deploy não for da Vercel).",
    );
  }
  if (payload.leads.length === 0) {
    throw new DispatchError("Nenhum lead para capturar.");
  }

  let resposta: Response;
  try {
    resposta = await fetchImpl(`https://api.github.com/repos/${config.repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: CAPTURAS_EVENT_TYPE,
        // O workflow lê os leads como string separada por vírgula: o
        // `client_payload` chega como expressão de template no YAML, e uma
        // lista viraria "[object Object]" na linha de comando.
        client_payload: { leads: payload.leads.join(","), execucao: payload.execucao },
      }),
    });
  } catch (erro) {
    throw new DispatchError(
      "Não deu para falar com o GitHub para disparar a geração.",
      erro instanceof Error ? erro.message : String(erro),
    );
  }

  if (resposta.status === 204) return;

  const corpo = await resposta.text().catch(() => "");
  throw new DispatchError(mensagemDoStatus(resposta.status, config.repo), corpo.slice(0, 300));
}

function mensagemDoStatus(status: number, repo: string): string {
  if (status === 401) {
    return "O GitHub recusou o token de capturas (401): ele venceu ou foi revogado.";
  }
  if (status === 403) {
    return `O token de capturas não tem permissão de disparo em ${repo} (403): precisa do escopo de escrita em Contents/Actions.`;
  }
  if (status === 404) {
    return `Repositório ${repo} não encontrado pelo token (404): confira GITHUB_CAPTURAS_REPO e se o token enxerga esse repositório.`;
  }
  if (status === 422) {
    return "O GitHub recusou o disparo (422): o workflow de capturas precisa estar no branch default do repositório.";
  }
  return `O GitHub respondeu ${status} ao disparo da geração de capturas.`;
}
