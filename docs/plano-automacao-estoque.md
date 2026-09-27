# Plano — automação do estoque de leads prontos

Escrito ANTES do código. Cada item vira um commit (e um push) próprio.

## O que existe e é reusado (nada reimplementado)

| Peça | Onde | Uso aqui |
|---|---|---|
| filtros estruturais da fila | `motivoEstrutural` / `candidatoEstavel` (`lib/fila/candidatos.ts`) | "pronto" do estoque é exatamente quem vira candidato do pool |
| estado de captura | `emAndamento` (`lib/demos/capturas/estado.ts`) | "captura enfileirada ou gerando" |
| criação de demo | `saveDemo` (`lib/leads/repo.ts`) + `patchCriacaoLote` (`lib/demos/lote.ts`) + `validateLeadDemoInput` | a unidade "demo" cria a demo pelo MESMO caminho do diálogo de lote |
| texto por IA | `gerarSugestaoDemo` → `aplicarSugestaoTexto` → `montarPatch` → `saveDemo` | a mesma sequência do `GerarDemosLoteDialog` |
| rodízio | `proximaCombinacao(nicho)` (`lib/demos/rodizio.ts`) | skin × preset da demo nova |
| casamento nicho→skin | `skinsDoNicho` (`lib/demos/nicho.ts`) | lead/par sem skin não entra |
| prontidão | `pendenciasProntidao` / `pendenciasDaDemo` (`lib/demos/prontidao.ts`) | o critério da aprovação automática é um RECORTE dela |
| busca | `geocodeRegion` + `searchText` + `upsertLeads` + `registrarExecucao` + `recalcularPenetracao` | mesmo pipeline do cron (`lib/buscas/cron.ts#executarBusca`) |
| custo | `reserveQuota` (dentro de `searchText`, `geocodeRegion`, `gerarSugestaoDemo`) | nada contorna |
| capturas | `enfileirarCapturas` (`lib/demos/capturas/enfileirar.ts`) | finalizar chama, em lotes de 60 |
| disparo GitHub | `lib/github/dispatch.ts` | o "rodar agora" ganha um `event_type` novo no mesmo módulo |
| vestígio | as mesmas regras de `semVestigio.ts` (inclusive doc em `filaEnvios` = vestígio) | elegibilidade de lead existente |

## Item 1 — Estoque

`src/lib/automacao/estoque.ts`:

- `classificarEstoque(lead, envio, now, retencaoMs)` → `"pronto" | "aguardandoAprovacao" | "capturaEmAndamento" | undefined`. Pura, um lead cai em UM balde só:
  - passa em `candidatoEstavel` (os filtros do pool, inclusive retenção/tentativas esgotadas) → **pronto**;
  - demo de origem automação com `aprovacao: "pendente"` que só está parada por aprovação ou por captura → **aguardandoAprovacao** (captura em andamento tem precedência, para não contar duas vezes);
  - `capturaNaoPronta` com `capturas.estado` em `enfileirado`/`rodando` → **capturaEmAndamento** (demo manual ou automática);
  - o resto (contactado, descartado, sem telefone, sem demo, captura falhou, reprovada…) → fora.
- `calcularEstoque(db, now)` lê `/leads` + `/filaEnvios` UMA vez (a mesma varredura do pool, uma vez por noite) e devolve `{ prontos, aguardandoAprovacao, capturasEmAndamento, total }`.
- O lead fixo de teste nunca conta.

`/config/automacao` (doc próprio, mesmo padrão de `/config/fila`), `src/lib/automacao/config.ts` + `GET/PUT /api/config/automacao` (admin):

| campo | padrão | |
|---|---|---|
| `ativo` | **false** | desligada até alguém ligar — gasta cota paga |
| `alvoEstoque` | 15 | |
| `aprovacaoAutomatica` | **false** | item 2 |
| `textoIA` | **true** | nunca obrigatório |
| `corteLegado` | `"2026-08-10"` | item 3 |
| `tetoBuscasNoite` | 6 | páginas de Text Search por execução |
| `tetoIANoite` | 20 | chamadas ao Gemini por execução |
| `intervaloParHoras` | 20 | par com execução (qualquer máquina) nas últimas N horas não é buscado |
| `saturacaoExecucoes` / `saturacaoMinNovos` | 3 / 3 | ver "limiar de saturação" |

Sem painel visual neste bloco (a verificação visual pedida é só a etiqueta do funil); a config é editável pelo PUT.

## Item 2 — Origem e aprovação na demo

`LeadDemo` ganha `origem?: "manual" | "automacao"` (ausente = manual), `aprovacao?: "pendente" | "aprovada" | "reprovada"`, `aprovacaoEm?`, `aprovacaoPor?` e `execucaoAutomacao?` (a execução que a criou — é o que torna a unidade idempotente mesmo quando morre depois de gravar).

- **`saveDemo` PRESERVA os cinco campos** entre edições, como já preserva `criadoEm`/`criadoPor`. Sem isto, o operador editar uma demo pendente pelo editor (PUT, que reescreve `demo` inteira) apagaria `origem` e a demo viraria "manual" — furando o portão pela porta do editor. O PUT continua sem aceitar esses campos no corpo.
- **Portão na fila**: `motivoEstrutural` ganha `aguardandoAprovacao`, DEPOIS de `semDemo`/`capturaNaoPronta` (e do teste do print) e antes de `semFuso`. Demo automática não aprovada (pendente OU reprovada) não vira candidato; `/proximo` relê o doc fresco com a mesma função, então o pool velho também não entrega. Demo sem `origem` (todas as de hoje) passa exatamente como hoje.
- Etiqueta no funil ("demo automática aguardando aprovação") em `VisaoFila` e no rótulo do disparo de teste. Entra em `MOTIVOS_FISICOS`: um lead marcado à mão que para aqui fica visível como pendente, não some.
- **Aprovação automática** (`src/lib/demos/aprovacao.ts#passaCriterioAprovacaoAutomatica`): pura, sobre `pendenciasProntidao` — aprovada se não houver pendência `telefone`, `horario` nem `idioma`. Ignora `imagens` e `instagram`.
- **Reprovada**: `POST /api/leads/[id]/demo/aprovacao { aprovacao }` (qualquer sessão, só para demo de origem automação). Reprovar grava também `Lead.automacaoReprovada` no LEAD — o planejador lê o lead, então apagar a demo não devolve o lead à automação. A demo não é apagada; aprovar depois, à mão, continua possível.

## Item 3 — Planejador e unidades

Autenticação: `AUTOMACAO_SECRET` (Bearer, comparação em tempo constante, 503 sem a env, 401 errado). Exceção no proxy por match EXATO das três rotas (`/api/automacao/{planejar,passo,finalizar}`). `maxDuration = 300` nas três.

Documentos:
- `/automacaoExecucoes/{uuid}` — o PLANO DA NOITE e o registro da execução, o mesmo doc: estoque antes/depois, alvo, falta, `unidades[]` (cada uma com estado `pendente|rodando|feita|pulada|falhou|nao_processada`, tentativas, motivo), `demosCriadas[]`, `buscas[]`, contadores `requisicoesBusca`/`chamadasIA`, falhas por unidade, capturas, motivo de parada, início/fim.
- `/automacao/trava` — `{ execucaoId, expiraEm }`. Adquirida em transação no planejar; **renovada a cada passo** (15 min à frente); liberada no finalizar. Execução morta destrava sozinha 15 min depois do último passo; disparo manual e agendado nunca rodam juntos (o segundo recebe 409 e fica registrado como `recusada`).
- `/automacao/ultima` — ponteiro para a última execução (para um painel futuro).

`POST /api/automacao/planejar`: desligada ou `estoque >= alvo` → registra a execução com o motivo, devolve "nada a fazer". Senão calcula `falta = alvo − estoque`, monta as unidades "demo" com leads existentes (até `falta`) e, se não bastar, UMA unidade "busca"; grava o plano e trava.

Elegível para unidade "demo" (pura, `src/lib/automacao/elegivel.ts`): `status "novo"`, telefone, sem vestígio (selo, registros, `primeiroContatoEm`, **doc em `filaEnvios`**), sem `automacaoReprovada`, não descartado, `telefoneInvalido` falso, sem demo, nicho com skin, e `criadoEm` (dia em São Paulo) **≥ `corteLegado`** — o complemento exato do recorte de `semVestigio.ts` (`< corte`). Ordem justa: `criadoEm` crescente.

`POST /api/automacao/passo`: pega a primeira unidade pendente (ou uma "rodando" com mais de 310 s — morreu com a função), marca `rodando`, processa, grava. Duas tentativas por unidade. Devolve `{ temTrabalho, esperarSegundos? }`.

Unidade **demo**: relê o lead; já tem demo → pulada (se a demo é DESTA execução, conta como criada — retomada idempotente); `proximaCombinacao`; `patchCriacaoLote({ imagensModo: "foto" })` sem efeito (fica o do preset); `validateLeadDemoInput` + `saveDemo` com `origem: "automacao"`, `aprovacao: "pendente"`; IA (se ligada, disponível, skin não calibrada e dentro do teto da noite): `gerarSugestaoDemo(nivel "completo")` → `aplicarSugestaoTexto` → `montarPatch` → `saveDemo`; falha da IA não derruba a unidade (demo fica no exemplo da skin, motivo registrado); por fim a aprovação conforme o item 2.

Unidade **busca**: pares (nicho, região) das buscas do OPERADOR (sem sub-nicho, normalização de `penetracao.ts`), só nicho com skin, sem execução de nenhuma máquina (cron incluso) nas últimas `intervaloParHoras`, não saturado; escolhe o par cuja última execução da automação é a mais antiga (nunca executado primeiro). Um doc de busca por par, `origem: "automacao"`, id determinístico (`automacao-<hash>`), criado no primeiro uso e reexecutado depois (`registrarExecucao` → a subcoleção `execucoes` é a série histórica). Sempre qualificada, só sem site, **só com telefone** (opção nova `soComTelefone` em `searchText`, filtro pós-resposta como `soSemSite`), `quantidade` = o que falta, `maxPaginas` = o que resta do teto da noite. Leads novos viram unidades "demo" no mesmo plano; se ainda faltar e houver teto, uma nova unidade busca tenta o próximo par.

**Limiar de saturação**: par com pelo menos 3 execuções da automação cujas 3 últimas trouxeram, SOMADAS, menos de 3 leads novos (média < 1 por noite) sai do rodízio. Configurável.

**Custo**: tetos por noite reservados NO PLANO antes da chamada (busca: `maxPaginas`; IA: 2, o pior caso com retry) e acertados depois com o real — unidade que morre no meio deixa o teto cobrado, lado seguro. Unidade de busca morta pode ser repetida e pagar de novo: aceito, limitado pelo teto por noite.

**Cotas individuais**: contadas no pseudo-usuário **`automacao`** (nome "Automação"), NUNCA admin e NUNCA um humano. Admin pula o teto global (`reserveQuota` com `isAdmin`), e a automação tem de obedecer os tetos globais; um humano teria a cota pessoal comida por trabalho que não pediu (mesmo argumento que tirou a precificação regional da cota individual). O id aparece como "Automação" nos nomes (`/api/usuarios/nomes`, `/api/metrics`, `/api/usage`) e em `criadoPor` das demos.

`POST /api/automacao/finalizar { execucaoId?, erro?, motivo? }`: `enfileirarCapturas` uma vez por lote de até 60 leads que ganharam demo; unidades não processadas marcadas; estoque depois; motivo de parada; libera a trava. Sem `execucaoId` e com `erro` (o laço morreu antes do plano) → grava uma execução `falhou` mesmo assim. Idempotente.

## Item 4 — Workflow

`.github/workflows/automacao.yml`: `schedule` 06:30 UTC (03:30 Brasília, 30 min depois do cron da Vercel), `workflow_dispatch`, `repository_dispatch` tipo `automacao-estoque`. `concurrency` serial. Sem `npm ci`: o script só usa `fetch`.

`scripts/automacao-ci.mjs laco` → planejar, passo em laço; `… finalizar --resultado=<outcome>` num passo `if: always()`. Salvaguardas: 120 iterações, para em 3 erros seguidos, timeout de 280 s por requisição, o estado (execucaoId) vai para um arquivo logo depois do planejar para o passo final achá-lo mesmo se o laço morrer.

`POST /api/config/automacao/disparar` (admin) — o "rodar agora" do painel, via `dispararAutomacao` em `lib/github/dispatch.ts`.

## Testes

FakeFirestore, `fetch` mockado (Places, Gemini, GitHub), relógio congelado — a lista do pedido, um teste por linha.

## Verificação visual

`node scripts/qa-plataforma.mjs --so=fila` com o patch `RADAR_FAKE_DB` aplicado e revertido na mesma sessão; a semeadura do funil ganha a contagem nova.
