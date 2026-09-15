import { describe, expect, it } from "vitest";

import {
  PACOTE_WHATSAPP_BUSINESS,
  linkWhatsAppBusinessAndroid,
  podeAbrirBusiness,
} from "../wa";

/**
 * O link que abre o WhatsApp **Business** e não o comum. O aparelho do
 * operador tem os dois instalados; um `wa.me` genérico ali abre o seletor
 * de aplicativo ou o app errado.
 *
 * O que estes testes fazem, e o que NÃO fazem: eles remontam o URI pela
 * GRAMÁTICA de `Intent.parseUri` (o URI de dados, `#Intent;`, campos
 * separados por `;`, `end`) e conferem que o texto volta byte a byte do
 * outro lado. Isso pega a classe de erro que de fato derruba este link —
 * um caractere do rascunho cortando o intent no meio —, mas não prova que
 * o Android escolhe o Business: essa parte é do aparelho, e só o aparelho
 * responde.
 *
 * `parseIntentUri` abaixo é de propósito uma segunda implementação,
 * escrita a partir da gramática e não do construtor: um parser que
 * reusasse a mesma montagem concordaria com ela até quando os dois
 * estivessem errados.
 */

interface IntentUri {
  /** O URI de dados reconstruído — `scheme` + o que vinha antes de `#Intent;`. */
  dados: string;
  campos: Record<string, string>;
}

function parseIntentUri(uri: string): IntentUri {
  const marcador = "#Intent;";
  const corte = uri.indexOf(marcador);
  if (corte < 0) throw new Error("sem o marcador #Intent;");
  if (!uri.startsWith("intent://")) throw new Error("não começa em intent://");

  const cauda = uri.slice(corte + marcador.length);
  if (!cauda.endsWith(";end")) throw new Error("não termina em ;end");

  const campos: Record<string, string> = {};
  for (const par of cauda.slice(0, -";end".length).split(";")) {
    const igual = par.indexOf("=");
    if (igual < 0) throw new Error(`campo sem "=": ${par}`);
    campos[par.slice(0, igual)] = par.slice(igual + 1);
  }

  const autoridadeEPath = uri.slice("intent://".length, corte);
  return { dados: `${campos.scheme}://${autoridadeEPath}`, campos };
}

/** Texto ADVERSÁRIO: tudo que um rascunho de negociação de fato carrega. */
const TEXTO_DIFICIL = [
  "Oi, Ana! Vi que você respondeu 😊",
  "",
  "O site fica em R$ 2.000 (50% de sinal; 50% na entrega).",
  "Pacote #1 inclui domínio & hospedagem = tudo pronto.",
  "Posso te mandar agora? +55 é seu número mesmo?",
].join("\n");

const TELEFONE = "+55 51 96666-0000";
const DIGITOS = "5551966660000";

describe("linkWhatsAppBusinessAndroid", () => {
  it("mira o pacote do Business, não o do WhatsApp comum", () => {
    const uri = linkWhatsAppBusinessAndroid("oi", TELEFONE)!;

    expect(parseIntentUri(uri).campos.package).toBe("com.whatsapp.w4b");
    expect(PACOTE_WHATSAPP_BUSINESS).toBe("com.whatsapp.w4b");
    // O pacote do comum não pode aparecer em lugar nenhum do URI — nem
    // solto, nem dentro da URL de reserva.
    expect(uri).not.toMatch(/package=com\.whatsapp[;&]/);
  });

  it("monta a MESMA ação e o MESMO dado da integração documentada", () => {
    const { dados, campos } = parseIntentUri(linkWhatsAppBusinessAndroid("oi", TELEFONE)!);

    expect(campos.scheme).toBe("https");
    expect(campos.action).toBe("android.intent.action.VIEW");
    expect(new URL(dados).origin + new URL(dados).pathname).toBe(
      "https://api.whatsapp.com/send",
    );
    expect(new URL(dados).searchParams.get("phone")).toBe(DIGITOS);
  });

  it("o telefone entra em DÍGITOS PUROS, sem os separadores do Google", () => {
    const { dados } = parseIntentUri(linkWhatsAppBusinessAndroid("oi", "+55 (51) 96666-0000")!);

    expect(new URL(dados).searchParams.get("phone")).toBe(DIGITOS);
  });

  it("o texto atravessa o URI byte a byte — quebras de linha inclusive", () => {
    const { dados } = parseIntentUri(linkWhatsAppBusinessAndroid(TEXTO_DIFICIL, TELEFONE)!);

    expect(new URL(dados).searchParams.get("text")).toBe(TEXTO_DIFICIL);
  });

  it("quebra de linha vira %0A, e a linha em branco do meio sobrevive", () => {
    const uri = linkWhatsAppBusinessAndroid("uma\nduas\n\nquatro", TELEFONE)!;

    expect(uri).toContain("text=uma%0Aduas%0A%0Aquatro");
  });

  it("nenhum caractere do texto escapa e corta o intent no meio", () => {
    const uri = linkWhatsAppBusinessAndroid(TEXTO_DIFICIL, TELEFONE)!;
    // Este é o teste que importa: `#` e `;` delimitam `#Intent;…;end`. Um
    // deles cru no texto e o URI vira outra coisa, sem erro visível.
    const antesDoMarcador = uri.slice(0, uri.indexOf("#Intent;"));
    expect(antesDoMarcador).not.toContain("#");
    expect(antesDoMarcador).not.toContain(";");
    // O URI inteiro também não pode ter espaço nem quebra de linha crua.
    expect(uri).not.toMatch(/[\s]/);
    // E só pode existir UM `#Intent;` — um segundo viria do texto.
    expect(uri.split("#Intent;")).toHaveLength(2);
  });

  it("texto que contém o próprio marcador não confunde o parser", () => {
    // Caso patológico de propósito: o operador colando o link no rascunho.
    const veneno = "olha isto: intent://x#Intent;package=com.whatsapp;end";
    const { dados, campos } = parseIntentUri(linkWhatsAppBusinessAndroid(veneno, TELEFONE)!);

    expect(campos.package).toBe("com.whatsapp.w4b");
    expect(new URL(dados).searchParams.get("text")).toBe(veneno);
  });

  it("sem o Business instalado, cai no wa.me — nunca na loja de aplicativos", () => {
    const { campos } = parseIntentUri(linkWhatsAppBusinessAndroid(TEXTO_DIFICIL, TELEFONE)!);

    // `Intent.parseUri` decodifica extras `S.`; a reserva vai codificada
    // para nenhum `;` dela encerrar o campo no meio da URL.
    const reserva = decodeURIComponent(campos["S.browser_fallback_url"]);
    expect(reserva.startsWith(`https://wa.me/${DIGITOS}?text=`)).toBe(true);
    expect(new URL(reserva).searchParams.get("text")).toBe(TEXTO_DIFICIL);
  });

  it("sem telefone não há conversa para abrir", () => {
    expect(linkWhatsAppBusinessAndroid("oi", "")).toBeUndefined();
    expect(linkWhatsAppBusinessAndroid("oi", "sem dígito nenhum")).toBeUndefined();
  });
});

describe("podeAbrirBusiness", () => {
  it("Android sim — é o único sistema com URI de intent", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    ]) {
      expect(podeAbrirBusiness(ua)).toBe(true);
    }
  });

  it("desktop e iPhone não — ali o botão não faria nada", () => {
    for (const ua of [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      "",
    ]) {
      expect(podeAbrirBusiness(ua)).toBe(false);
    }
  });
});
