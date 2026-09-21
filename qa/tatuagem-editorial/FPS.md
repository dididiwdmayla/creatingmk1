# Portão de qualidade por CÉLULA (variante × modo de cor) — `tatuagem-editorial`, efeito `grao`

A linha `nenhum` é a referência: a página sem efeito, na primeira variante. Modo que reprova é desabilitado SOZINHO (ver `SkinVariante.modosDeCorReprovados`) — a variante inteira nunca é.

# Portão de qualidade dos efeitos — celular 390×844 (dpr 2), CPU 4×, intensidade 3, rolando a página inteira

Mediana de 5 cargas independentes por célula; rolagem contínua a 1800 px/s até o fim da página (teto de 9000ms). Veredito: **45 fps** em TODO modo de cor — e só isso reprova. A superfície repintada é reportada junto e MARCADA (⚠) acima de **+40 Mpx/s** sobre a referência `nenhum`, sem reprovar.

## fps (mediana)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 59.3 | 59.7 | 59.5 | 58.5 | 59.5 |
| `sangue` | 59.5 | 59.2 | 58.8 | 58.8 | 59.0 |
| `vesperal` | 58.7 | 58.3 | 58.3 | 58.1 | 57.8 |
| `cripta` | 58.9 | 59.6 | 58.2 | 55.7 | 58.2 |
| `marfim` | 59.7 | 58.9 | 59.4 | 58.9 | 59.7 |

## superfície repintada (Mpx/s, rolando)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 33.3 | 34.1 | 30.1 | 32.1 | 33.1 |
| `sangue` | 30.2 | 32.2 | 33.7 | 30.4 | 29.9 |
| `vesperal` | 15.0 | 15.1 | 15.1 | 15.0 | 15.0 |
| `cripta` | 30.8 | 30.2 | 30.2 | 28.1 | 29.2 |
| `marfim` | 25.0 | 22.6 | 25.0 | 25.0 | 25.3 |

## veredito

Todas as células passam o piso de 45 fps.
