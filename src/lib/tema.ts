/**
 * Tema da PLATAFORMA (o app autenticado — não confundir com o tema de uma
 * demo, que vive em `lib/demos/tema.ts` e pertence ao lead).
 *
 * A escolha é POR USUÁRIO: mora em `/usuarios/{id}.tema` (self-service,
 * ver "Sistema de temas da plataforma" em ARCHITECTURE.md), não em
 * `/config/app` nem em localStorage. Cada integrante escolhe o seu, e a
 * escolha viaja com a pessoa entre dispositivos.
 *
 * O cookie `radar_tema` é um ESPELHO do doc, não a fonte da verdade: ele
 * existe só para o `RootLayout` conseguir renderizar `data-theme` no HTML
 * do servidor, sem flash de tema errado antes da primeira pintura. Quem
 * escreve o cookie é sempre uma rota (login e PUT /api/tema), a partir do
 * doc — o cliente nunca o escreve (por isso `httpOnly`).
 */

export const TEMAS_APP = ["escuro", "claro", "acido", "vapor", "prisma"] as const;

export type TemaApp = (typeof TEMAS_APP)[number];

/** Tema de quem nunca escolheu — e o bloco base de `:root` no globals.css. */
export const TEMA_PADRAO: TemaApp = "escuro";

export interface TemaMeta {
  id: TemaApp;
  /** Rótulo no seletor do header. */
  nome: string;
  /** Uma linha sobre o caráter do tema, usada como `title` do seletor. */
  descricao: string;
  /** Glifo do seletor (o único canal que não é cor). */
  glifo: string;
}

export const TEMAS_META: Record<TemaApp, TemaMeta> = {
  escuro: {
    id: "escuro",
    nome: "Escuro",
    descricao: "Radar/sonar: azul-profundo com acento verde.",
    glifo: "☾",
  },
  claro: {
    id: "claro",
    nome: "Claro",
    descricao: "Mesmos papéis do escuro, luminâncias invertidas.",
    glifo: "☀",
  },
  acido: {
    id: "acido",
    nome: "Ácido",
    descricao: "Preto neutro, verde-lima elétrico. Alta voltagem.",
    glifo: "◤",
  },
  vapor: {
    id: "vapor",
    nome: "Vapor",
    descricao: "Preto azulado, ciano frio. Técnico, de sala de máquinas.",
    glifo: "◈",
  },
  prisma: {
    id: "prisma",
    nome: "Prisma",
    descricao: "Preto violáceo, violeta elétrico. Película de óleo.",
    glifo: "◇",
  },
};

export function temaValido(valor: unknown): valor is TemaApp {
  return typeof valor === "string" && (TEMAS_APP as readonly string[]).includes(valor);
}

/** Tolera doc/cookie antigo ou sujo: qualquer coisa fora da lista vira o padrão. */
export function temaOuPadrao(valor: unknown): TemaApp {
  return temaValido(valor) ? valor : TEMA_PADRAO;
}

export const TEMA_COOKIE = "radar_tema";

/**
 * `httpOnly` de propósito: o cliente lê o tema do `data-theme` que o
 * servidor já renderizou (ou de GET /api/tema), nunca do cookie. Um ano de
 * validade — é preferência de UI, não credencial; a sessão expira sozinha
 * bem antes e o login reescreve o cookie a partir do doc.
 */
export const TEMA_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  secure: process.env.NODE_ENV === "production",
} as const;
