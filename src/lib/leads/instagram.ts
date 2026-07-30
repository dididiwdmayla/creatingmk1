/**
 * Extrai o handle do Instagram a partir de um websiteUri, quando a URL
 * aponta pro instagram.com. Mesma tolerância a esquema ausente que
 * src/lib/site-proprio.ts (websiteUri às vezes vem sem "https://").
 */
function parseUrl(url: string): URL | undefined {
  const texto = url.trim();
  if (!texto) return undefined;
  const comEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(texto) ? texto : `https://${texto}`;
  try {
    return new URL(comEsquema);
  } catch {
    return undefined;
  }
}

export function handleInstagram(websiteUri: string | undefined): string | undefined {
  if (!websiteUri) return undefined;
  const url = parseUrl(websiteUri);
  if (!url) return undefined;

  const hostname = url.hostname.toLowerCase();
  if (hostname !== "instagram.com" && !hostname.endsWith(".instagram.com")) return undefined;

  const [handle] = url.pathname.split("/").filter(Boolean);
  return handle;
}
