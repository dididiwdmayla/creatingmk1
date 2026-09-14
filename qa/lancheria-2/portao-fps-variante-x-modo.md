# Portão de qualidade por CÉLULA (variante × modo de cor) — `lancheria-2`, efeito `grao`

A linha `nenhum` é a referência: a página sem efeito, na primeira variante. Modo que reprova é desabilitado SOZINHO (ver `SkinVariante.modosDeCorReprovados`) — a variante inteira nunca é.

# Portão de qualidade dos efeitos — celular 390×844 (dpr 2), CPU 4×, intensidade 3, rolando a página inteira

Mediana de 5 cargas independentes por célula; rolagem contínua a 1800 px/s até o fim da página (teto de 9000ms). Veredito: **45 fps** em TODO modo de cor — e só isso reprova. A superfície repintada é reportada junto e MARCADA (⚠) acima de **+40 Mpx/s** sobre a referência `nenhum`, sem reprovar.

## fps (mediana)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 58.6 | 58.6 | 58.6 | 58.6 | 58.6 |
| `lancheria-meia-noite` | 57.9 | 58.6 | 58.6 | 57.9 | 58.6 |
| `lancheria-diner` | 57.9 | 57.9 | 58.6 | 57.9 | 57.9 |
| `lancheria-pratico` | 60.0 | 60.0 | 60.0 | 60.0 | 60.0 |
| `lancheria-cantina` | 57.1 | 57.1 | 55.7 | 56.4 | 55.0 |

## superfície repintada (Mpx/s, rolando)

| variante | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` | 0.6 | 0.6 | 0.6 | 0.2 | 0.6 |
| `lancheria-meia-noite` | 0.6 | 0.2 | 0.6 | 0.6 | 0.7 |
| `lancheria-diner` | 0.5 | 0.5 | 0.5 | 0.5 | 0.5 |
| `lancheria-pratico` | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| `lancheria-cantina` | 0.8 | 0.8 | 0.8 | 0.8 | 0.8 |

## veredito

Todas as células passam o piso de 45 fps.

---

## Como reproduzir

```
npm run build
QA_CHROMIUM=/opt/pw-browsers/chromium node scripts/qa-visual.mjs --so=fps --skin=lancheria-2 --sem-build
```

A folha de contato correspondente (a mesma matriz julgada por IMAGEM, não
por número) sai de:

```
QA_CHROMIUM=/opt/pw-browsers/chromium node scripts/qa-visual.mjs --so=variante --skin=lancheria-2 --sem-build
```

Ela grava em `qa-shots/` (fora do versionamento — ver .gitignore): uma
folha por variante, com a página sem efeito e depois em cada modo de cor,
os três animados em três fases.

## Leitura desta rodada

Nenhuma célula reprovou, então `SkinVariante.modosDeCorReprovados` fica
vazio nas quatro variantes. O campo existe e está ligado ponta a ponta
(resolução, rota pública, harness e editor) — o que falta é uma medição que
justifique preencher, e esta não é.

Dois números que valem registrar mesmo passando:

- **`lancheria-pratico` marca 60,0 fps limpos nos cinco modos**, com 0,0
  Mpx/s de superfície repintada acima da referência. É a variante que
  esconde a trilha "Na prensa", não tem mascote, não tem intro e usa
  transição de 120ms: o portão está medindo o que a variante realmente é.
- **`lancheria-cantina` × `arco-iris` tem a maior dispersão da tabela**
  (33,6 / 45,7 / 55,0 / 55,0 / 57,1 — mediana 55,0, pior quadro 400ms).
  Passa, e passa pela razão certa: é exatamente o outlier de uma carga só
  que levou a mediana de cinco a existir. Se a próxima rodada medir pior,
  esta é a primeira célula a cair.
