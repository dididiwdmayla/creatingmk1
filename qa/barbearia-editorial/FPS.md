# Portão de qualidade por CÉLULA (variante × modo de cor) — `barbearia-editorial`, efeito `grao`

A linha `nenhum` é a referência: a página sem efeito, na primeira variante. Modo que reprova é desabilitado SOZINHO (ver `SkinVariante.modosDeCorReprovados`) — a variante inteira nunca é.

# Portão de qualidade dos efeitos — celular 390×844 (dpr 2), CPU 4×, intensidade 3, rolando a página inteira

Mediana de 5 cargas independentes por célula; rolagem contínua a 1800 px/s até o fim da página (teto de 9000ms). Veredito: **45 fps** em TODO modo de cor — e só isso reprova. A superfície repintada é reportada junto e MARCADA (⚠) acima de **+40 Mpx/s** sobre a referência `nenhum`, sem reprovar.

## fps (mediana)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 59.6 | 59.8 | 59.6 | 59.4 | 59.8 |
| `norte` | 59.8 | 59.4 | 59.6 | 59.1 | 59.8 |
| `meia-noite` | 59.6 | 60.0 | 60.0 | 58.6 | 52.4 |
| `creme` | 59.7 | 59.7 | 59.5 | 58.1 | 60.0 |
| `vinho` | 59.0 | 53.7 | 59.1 | 59.3 | 58.4 |

## superfície repintada (Mpx/s, rolando)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| `norte` | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| `meia-noite` | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| `creme` | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| `vinho` | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |

## veredito

Todas as células passam o piso de 45 fps.

**Limite da instrumentação:** LayerTree não retornou eventos de pintura nesta execução. Os zeros de Mpx/s não demonstram ausência de repintura. O veredito usa somente FPS durante rolagem ativa.
