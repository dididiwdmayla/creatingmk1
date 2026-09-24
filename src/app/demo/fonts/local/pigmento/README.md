# Fontes locais — Tatuagem Pigmento Vivo

Arquivos WOFF2 originais, sem conversão, subset `latin` (cobre Á-ú, Ç, Ã, Õ).
Licenças OFL adjacentes. Um módulo `next/font/local` por variante
(`aquarela.ts`, `boreal.ts`, `meia-noite.ts`, `terra.ts`), importado sob
demanda por `SkinDefinition.fontesVariante` — só a fonte da variante ATIVA
chega ao HTML de uma requisição (ver `../../../lib/demos/types.ts`).

Todos conferidos no registro do npm em 2026-09-24, versão `5.3.0`:

- DM Serif Display (aquarela, display): `@fontsource/dm-serif-display@5.3.0`
- Archivo (aquarela, corpo): `@fontsource-variable/archivo@5.3.0` — reaproveita
  `public/fontes/archivo-latin-standard-normal.woff2` (já no repo, trazido
  pela `lancheria-2`); não duplicado aqui.
- Bricolage Grotesque (boreal, display): `@fontsource-variable/bricolage-grotesque@5.3.0`
- Figtree (boreal, corpo): `@fontsource-variable/figtree@5.3.0`
- Dela Gothic One (meia-noite, display): `@fontsource/dela-gothic-one@5.3.0`
- Space Grotesk (meia-noite, corpo): `@fontsource-variable/space-grotesk@5.3.0`
- Young Serif (terra, display): `@fontsource/young-serif@5.3.0`
- Karla (terra, corpo): `@fontsource-variable/karla@5.3.0`
- Anton (`anton-latin-400-normal.woff2`): fallback de contingência para o
  display da meia-noite, só se a Dela Gothic One não cobrir algum acento do
  português na conferência visual — não usado por nenhum módulo hoje.

Caveat (`@fontsource-variable/caveat`, terceira fonte da terra no plano — usada
só no manifesto "carta", na legenda da "mesa" e no "caderno") fica para a
sessão de composição visual: nenhuma dessas composições existe ainda nesta
sessão, e carregar a fonte sem uso violaria a exigência de pré-carregar só o
que a página realmente usa.
