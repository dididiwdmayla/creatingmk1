# Portão de qualidade por CÉLULA (variante × modo de cor) — `multimarcas-vortice`, efeito `grao`

A linha `nenhum` é a referência: a página sem efeito, na primeira variante (`vortice`). Modo que reprova é desabilitado SOZINHO (ver `SkinVariante.modosDeCorReprovados`) — a variante inteira nunca é.

# Portão de qualidade dos efeitos — celular 390×844 (dpr 2), CPU 4×, intensidade 3, rolando a página inteira

Mediana de 5 cargas independentes por célula; rolagem contínua a 1800 px/s até o fim da página (teto de 9000ms). Veredito: **45 fps** em TODO modo de cor — e só isso reprova. A superfície repintada é reportada junto e MARCADA (⚠) acima de **+40 Mpx/s** sobre a referência `nenhum`, sem reprovar.

## fps (mediana)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 59.4 | 59.1 | 58.3 | 58.9 | 59.6 |
| `vortice` | 58.1 | 59.1 | 58.1 | 58.9 | 57.9 |
| `patio` | 56.9 | 57.4 | 57.4 | 56.9 | 56.6 |
| `garagem` | 59.0 | 58.9 | 57.9 | 57.7 | 58.5 |
| `campo` | 55.7 | 53.0 | 54.5 | 54.2 | 53.7 |

## superfície repintada (Mpx/s, rolando)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 53.4 | 53.7 | 52.2 | 53.2 | 54.0 |
| `vortice` | 53.8 | 54.1 | 50.1 | 53.3 | 52.9 |
| `patio` | 45.9 | 48.9 | 47.9 | 47.8 | 41.0 |
| `garagem` | 45.7 | 44.2 | 44.4 | 44.3 | 44.5 |
| `campo` | 74.9 | 78.7 | 75.5 | 76.9 | 74.5 |

## veredito

Todas as células passam o piso de 45 fps. Menor mediana: **53.0 fps**
(`campo` × `fixa`) — 8 fps acima do piso.

Nenhuma marcação de superfície (⚠, +40 Mpx/s sobre a referência ~53
Mpx/s): a `campo` repinta mais que as outras três (75–79 vs. 41–54) — a
abertura `dividida` mantém a foto emoldurada visível o tempo todo, ao
lado do texto, enquanto as outras três a escondem atrás de véu ou não a
desenham — mas ainda assim a 21–26 Mpx/s de distância do limiar.
