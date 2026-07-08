/**
 * Classifica o websiteUri do Google como "site próprio" ou não. Perfis de
 * rede social, links de WhatsApp e agregadores de link (linktr.ee etc.)
 * NÃO contam como site próprio — para o funil, um lead cujo "site" é o
 * Instagram continua sendo lead quente.
 *
 * A comparação é pelo hostname (case-insensitive, com ou sem www/m/l e
 * qualquer outro subdomínio, http ou https). Encurtadores genéricos
 * (bit.ly etc.) ficam de fora de propósito: sem resolver o redirect não dá
 * para saber o destino, então valem como site.
 */

const DOMINIOS_NAO_PROPRIOS = [
  // Instagram / Facebook (m.facebook.com, l.instagram.com, pt-br.facebook.com…)
  "instagram.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  // WhatsApp (wa.me, wa.link, api.whatsapp.com, chat.whatsapp.com…)
  "whatsapp.com",
  "wa.me",
  "wa.link",
  // Agregadores de link
  "linktr.ee",
  "linktree.com",
  "bio.link",
  "beacons.ai",
  "taplink.cc",
  "lnk.bio",
  "linkin.bio",
  // Outras redes usadas como "site" por negócio local
  "tiktok.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "youtu.be",
  "t.me",
  "telegram.me",
] as const;

function hostnameDe(url: string): string | undefined {
  const texto = url.trim();
  if (!texto) return undefined;
  // websiteUri às vezes vem sem esquema ("instagram.com/x").
  const comEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(texto) ? texto : `https://${texto}`;
  try {
    return new URL(comEsquema).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** true = site próprio; false = rede social/agregador (lead quente). */
export function isSiteProprio(url: string): boolean {
  const hostname = hostnameDe(url);
  // URL ilegível: não dá para classificar — fica como site (lado conservador).
  if (!hostname) return true;
  return !DOMINIOS_NAO_PROPRIOS.some(
    (dominio) => hostname === dominio || hostname.endsWith(`.${dominio}`),
  );
}
