import { describe, expect, it } from "vitest";

import { isSiteProprio } from "../site-proprio";

describe("isSiteProprio — URLs reais dos padrões de rede social/agregador", () => {
  const naoProprios = [
    // Instagram: https/http, www, m., l. e path
    "https://www.instagram.com/clinicasorrisosarandi",
    "http://instagram.com/drfulano_odonto",
    "https://l.instagram.com/?u=https%3A%2F%2Fexemplo.com",
    "https://m.instagram.com/barbearia.central",
    "instagram.com/semesquema",
    // Facebook: m.facebook, pt-br.facebook, fb.com/fb.me
    "https://www.facebook.com/ClinicaSorriso",
    "https://m.facebook.com/pages/Odonto-Vida/113456789",
    "https://pt-br.facebook.com/pizzariabairro",
    "http://fb.com/salaodalu",
    "https://fb.me/2AbCdEfGh",
    // WhatsApp: wa.me, wa.link, api./chat.whatsapp.com
    "https://wa.me/5544999990000",
    "https://wa.link/abc123",
    "https://api.whatsapp.com/send?phone=5544999990000",
    "https://chat.whatsapp.com/EAbCdEfGh123",
    "https://www.whatsapp.com/catalog/5544999990000",
    // Agregadores
    "https://linktr.ee/clinicasorriso",
    "https://linktree.com/barbearia",
    "https://bio.link/dentista",
    "https://beacons.ai/estudio.nail",
    "https://taplink.cc/manicure",
    "https://lnk.bio/salao",
    // Outras redes
    "https://www.tiktok.com/@barbearia",
    "https://x.com/pizzaria",
    "https://twitter.com/pizzaria",
    "https://www.youtube.com/@igrejalocal",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://t.me/lojinha",
  ];

  it.each(naoProprios)("%s → NÃO é site próprio", (url) => {
    expect(isSiteProprio(url)).toBe(false);
  });

  const proprios = [
    "https://clinicasorriso.com.br",
    "http://www.odontovida.com.br/equipe",
    "https://sites.google.com/view/barbearia-central",
    // Encurtador genérico: sem resolver o redirect, fica como está (site).
    "https://bit.ly/3AbCdEf",
    // Domínio que apenas CONTÉM o nome da rede não é a rede.
    "https://minhainstagram.com",
    "https://loja-facebook.com.br",
    "https://wame.com.br",
  ];

  it.each(proprios)("%s → é site próprio", (url) => {
    expect(isSiteProprio(url)).toBe(true);
  });

  it("subdomínio profundo da rede continua não-próprio", () => {
    expect(isSiteProprio("https://business.facebook.com/loja")).toBe(false);
    expect(isSiteProprio("https://foo.bar.instagram.com/x")).toBe(false);
  });

  it("URL ilegível ou vazia fica como site (não classifica)", () => {
    expect(isSiteProprio("")).toBe(true);
    expect(isSiteProprio("   ")).toBe(true);
    expect(isSiteProprio("ht!tp://%%%")).toBe(true);
  });
});
