# Portão de qualidade por CÉLULA (variante × modo de cor) — `lancheria-chapa-burger`, efeito `grao`

A linha `nenhum` é a referência: a página sem efeito, na primeira variante (`chapa`). Modo que reprova é desabilitado SOZINHO (ver `SkinVariante.modosDeCorReprovados`) — a variante inteira nunca é.

# Portão de qualidade dos efeitos — celular 390×844 (dpr 2), CPU 4×, intensidade 3, rolando a página inteira

Mediana de 5 cargas independentes por célula; rolagem contínua a 1800 px/s até o fim da página (teto de 9000ms). Veredito: **45 fps** em TODO modo de cor — e só isso reprova. A superfície repintada é reportada junto e MARCADA (⚠) acima de **+40 Mpx/s** sobre a referência `nenhum`, sem reprovar.

## fps (mediana)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 58.6 | 58.2 | 58.2 | 59.1 | 58.6 |
| `chapa` | 58.2 | 57.3 | 57.7 | 57.7 | 58.7 |
| `balcao` | 55.7 | 56.4 | 55.0 | 56.4 | 57.1 |
| `sala` | 60.0 | 60.0 | 60.0 | 60.0 | 60.0 |
| `praca` | 58.1 | 58.8 | 58.8 | 60.0 | 57.5 |

## superfície repintada (Mpx/s, rolando)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 5.3 | 5.4 | 5.3 | 5.3 | 5.3 |
| `chapa` | 5.3 | 5.4 | 5.4 | 5.3 | 5.3 |
| `balcao` | 2.9 | 2.9 | 2.9 | 2.9 | 2.9 |
| `sala` | 4.0 | 4.0 | 4.0 | 4.0 | 4.0 |
| `praca` | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 |

## veredito

Todas as células passam o piso de 45 fps. Nenhuma marcação de superfície
(⚠, +40 Mpx/s sobre a referência): a `praca` repinta mais que as outras
três (16.8 vs. 2.9–5.4) — o mural de duas colunas com flutuantes tem mais
imagem em tela por quadro que a comanda de uma coluna da `balcao` — mas
ainda assim a 24.7 Mpx/s de distância do limiar.

Menor mediana: **55.0 fps** (`balcao` × `transicao`) — 10 fps acima do
piso. A `balcao` é a mais lenta das quatro (repinta menos, mas com o pior
quadro em 50ms contra 17ms da `sala`) e ainda assim folgada.
