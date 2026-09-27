# Plano — painel "Automação" na /config

Escrito ANTES do código. Cada item vira um commit (e um push) próprio. O motor
(`src/lib/automacao/*`, `/api/automacao/{planejar,passo,finalizar}`,
`.github/workflows/automacao.yml`) já está no repo e não muda de contrato.

## Onde o painel nasce (a convenção de "Painéis colapsáveis da /config")

- `src/components/config/paineis/Automacao.tsx`, `export const PAINEL_AUTOMACAO = "automacao"`,
  devolve um `<PainelColapsavel>`; entrada `posicao: "antes"` no registro, logo depois de
  "Respostas pendentes" (antes de "Leads sem vestígio"); a cópia em `scripts/paineis-config.mjs`
  ganha o painel e os dois blocos subordinados (o teste de contrato cobra).
- Dois blocos `nivel={3}` DENTRO dele, com cabeçalho e resumo próprios, no molde dos quatro da fila:
  `automacao-aprovacao` ("Fila de aprovação", item 2) e `automacao-operador` ("O que falta", item 3).
- Painel AUTÔNOMO: busca e salva pelas próprias rotas, todas sob `/api/config/automacao/*`,
  `requireAdmin` em TODOS os verbos (GET incluso): 401 sem sessão, 403 membro. A
  `AUTOMACAO_SECRET` só abre as três rotas do laço (exceção por match exato no proxy); um
  Bearer com ela numa rota de config é 401 como qualquer requisição sem sessão — teste.

## Cabeçalho fechado — sem requisição nova, e sem varredura por enfeite

Resumo: `ligada · estoque 12/15 · 3 aguardando aprovação` (e `· última falhou` quando for o caso;
`desligada` sozinho quando desligada e sem nada pendente). Sai da MESMA resposta que o corpo usa.

O problema de custo: estoque e fila de aprovação exigem olhar `/leads` + `/filaEnvios` inteiras
(`calcularEstoque`). A convenção recusa varredura a cada abertura da /config ("Leads sem vestígio"
não busca ao montar por isso). **Solução: apurar na varredura que já existe.** `construirPool`
(o pool da fila, reconstruído a cada 10 min por `/proximo`) já passa por todo lead com
`motivoEstrutural` e o envio em mãos — é exatamente o que `classificarEstoque` precisa. Ele passa a
gravar no doc do pool, na mesma passada:

- `estoque: { prontos, aguardandoAprovacao, capturasEmAndamento, total }`;
- `aprovacaoPendentes: string[]` (ids das demos automáticas pendentes que estão no funil —
  balde `aguardandoAprovacao` OU captura em andamento com demo pendente), teto 100, ordem justa,
  e `aprovacaoPendentesTotal`.

Para não criar ciclo de import (`estoque.ts` importa `candidatos.ts`), a decisão do balde vira uma
função pura sem dependência da fila (`baldeEstoque(lead, motivo, passaNoPool)` em
`lib/automacao/balde.ts`); `classificarEstoque` passa a delegar para ela — mesmo resultado, um dono.

A rota do painel lê o pool com `lerPool` (reconstrói só se vencido — no máximo uma varredura a cada
10 min, COMPARTILHADA com o celular) e mais uma regra de invalidação: pool gerado ANTES do fim da
última execução (`/automacao/ultima.em`) é reconstruído — senão o painel mostraria a fila de ontem
logo depois do "rodar agora". Os itens da fila de aprovação são relidos POR ID (poucos) e
reconferidos contra o doc fresco — quem já foi decidido sai da lista na hora, mesmo com pool velho
(o pool OFERECE, a tela reconfere; é a regra do diagnóstico). O retrato leva `geradoEm`, mostrado.

`/proximo` e `/confirmar`: nenhum campo da resposta muda; o pool só ganha chaves que eles não leem.
Teste de contrato cobrindo os dois.

## Item 1 — Configuração e estado

`GET /api/config/automacao/painel` (admin): `{ config, estoque, ultima, ativa, aprovacao,
disparoDisponivel }`. `ultima` é um RESUMO da execução apontada por `/automacao/ultima` (estado,
disparo, início/fim, runUrl, estoque antes/depois, alvo, falta, demos criadas, buscas + leads
novos, páginas e chamadas de IA gastas vs teto, falhas, motivo de parada, erro, contagem de
unidades por estado) — nunca o doc inteiro.

Corpo do painel:
- três interruptores (automação, texto por IA, aprovação automática) e quatro campos (estoque alvo,
  teto de buscas/noite, teto de IA/noite, data de corte do legado). Salvam campo a campo no
  `PUT /api/config/automacao` que já existe (patch, validado), no molde do painel da fila:
  interruptor na hora, número/data no blur; erro reverte e aparece.
- estoque: `prontos` e `a caminho` (aguardando aprovação + capturas gerando) separados, contra o
  alvo, com a hora do retrato.
- última execução: quando, estado, o que fez, motivo de parada. **Falha inconfundível**: faixa com
  borda e fundo de `danger`, ícone ✕ e o texto "Falhou" + erro, contra ✓ "Concluída" em `success` e
  "Nada a fazer" neutro; nunca só a cor (o rótulo muda também).
- "Rodar agora": `POST /api/config/automacao/disparar`. **Recusa (409) com execução ativa**: trava
  viva (`travaAtiva`) OU disparo pedido há menos de 10 min que ainda não virou execução — sem essa
  segunda metade, dois cliques seguidos dariam dois dispatches, e com o `concurrency` serial do
  workflow o segundo rodaria depois do primeiro liberar a trava. O pedido fica em
  `/automacao/disparo { em, por }`, gravado em transação junto com a checagem; falha do GitHub
  desfaz o registro. Sucesso avisa: "o resultado leva alguns minutos — atualize o painel". O botão
  fica desabilitado com o motivo enquanto houver execução ativa (a rota recusa mesmo assim).

## Item 2 — Fila de aprovação

Itens (da mesma resposta do painel): nome, nicho, cidade (`cidadeDoEndereco`), skin e preset (nomes
do registro), estado da captura (`estadoVisivel` — enfileirado/gerando/falhou/sem captura) e, com
captura pronta, o print do hero (a imagem crua de celular da âncora `hero`), link "abrir demo"
(`/demo/{leadId}` sem `?t=`: a pré-visualização que não conta visita).

`POST /api/config/automacao/aprovacao { leadIds: string[] (1..50), aprovacao }` (admin) — uma rota
para individual e lote; cada lead passa por `decidirAprovacaoDemo` (o mesmo caminho da rota por
lead), erro de um não derruba os outros (resposta por lead). Reprovar mostra antes a confirmação:
"o lead sai da automação e continua disponível para demo manual". Aprovar com captura em andamento
é permitido; o portão `capturaNaoPronta` segura o lead até o print ficar pronto — nada novo.

## Item 3 — O que o operador precisa saber

Bloco subordinado que busca na PRIMEIRA ABERTURA (`usePainelAberto`, a exceção de Cotas/Metas: não
entra no resumo do painel, e custa uma varredura de `/buscas` + a subcoleção `execucoes` de cada
busca da automação). `GET /api/config/automacao/operador` (admin):
- `nichosSemSkin` — a função pura que já existe (`lib/demos/nichosSemSkin.ts`), sobre `/buscas`:
  nicho, buscas, leads. "Qual template fazer em seguida e qual sinônimo falta."
- `paresSaturados` — `paresDasBuscas` + `parSaturado` sobre as execuções do doc da automação de
  cada par (só quem tem doc da automação pode estar saturado): nicho, região, as últimas execuções
  e quantos novos cada uma trouxe.

## Testes

- aprovar (lote) torna a demo elegível: `candidatoEstavel` no doc fresco e o lead no pool
  reconstruído, com captura pronta; com captura em andamento continua fora (`capturaNaoPronta`).
- reprovar tira o lead da automação: `automacaoReprovada` gravado e `leadsParaDemo` não o escolhe
  mesmo sem demo.
- lote: vários ids numa chamada, demo manual no meio dá erro só nela.
- "rodar agora" recusado (409, sem chamar o GitHub) com trava ativa e com disparo pendente; aceito
  depois que a execução começou/terminou; falha do GitHub desfaz o registro.
- membro 403 e sem sessão 401 nas quatro rotas; Bearer `AUTOMACAO_SECRET` não abre nenhuma.
- pool: `estoque`/`aprovacaoPendentes` apurados batem com `calcularEstoque`; `classificarEstoque`
  inalterado (os testes existentes continuam).
- contrato de `/proximo` e `/confirmar` inalterado (as chaves da resposta, com o pool novo).
- rotas do painel: resumo da última execução, retrato do estoque, invalidação do pool pela última
  execução.

## Verificação visual

`node scripts/qa-plataforma.mjs --so=automacao`, no molde de `--so=vestigio`/`--so=comercial`:
painel fechado (resumo legível) e aberto; automação desligada, ligada, última execução concluída e
com FALHA; fila de aprovação cheia e VAZIA; captura pronta (com o print) e em andamento —
celular e desktop, escuro e claro. Patch `RADAR_FAKE_DB` aplicado e revertido na mesma sessão,
reversão confirmada no corpo do commit, `git diff` limpo antes do push. As imagens são abertas e
olhadas antes de declarar pronto.

## Ordem dos commits

1. este plano;
2. item 1 (balde puro + pool + rota do painel + disparar com recusa + painel com config/estado);
3. item 2 (rota de aprovação em lote + bloco da fila);
4. item 3 (rota do operador + bloco);
5. verificação visual (`--so=automacao`);
6. ARCHITECTURE.md.
