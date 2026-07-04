# Radar — Arquitetura

Web app pessoal de prospecção de leads locais para web designer freelancer. Single-user.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Firebase Firestore · Vercel · Google Places API (New).

## Princípios inegociáveis

1. **A chave da Google Places API vive só em variável de ambiente** (`GOOGLE_PLACES_API_KEY`) e é usada exclusivamente em route handlers server-side. Nenhuma chamada ao Google parte do cliente.
2. **Todo acesso ao Firestore é server-side** via `firebase-admin` dentro de route handlers. O cliente nunca fala com o Firestore diretamente — as security rules negam tudo (`allow read, write: if false`). Como o app é single-user, isso elimina a necessidade de rules complexas e mantém um único ponto de entrada auditável para dados e custos.
3. **Todo request ao Google passa antes pelo módulo de custos** (`src/lib/costs`). Sem reserva de cota, sem request. O módulo é a única porta de saída para a API paga.
4. **Enriquecimento é sob demanda, nunca em lote.** Place Details só é chamado quando o usuário abre a ficha de um lead e pede o enriquecimento.

## Estrutura de pastas

```
src/
  proxy.ts                          # ✅ proteção por senha (Next 16: proxy.ts, ex-middleware)
  app/
    layout.tsx                      # dark fixo (sem alternância clara/escura), fontes Geist
    login/page.tsx                  # ✅ form de senha → POST /api/login
    (app)/                          # route group: páginas autenticadas, com Nav
      layout.tsx                    # ✅ header + bottom nav (Painel/Leads/Buscas/Config) + Sair
      page.tsx                      # ✅ Dashboard: uso vs teto, custo projetado, métricas
      leads/page.tsx                # ✅ lista de leads com filtros + nova busca (com auto-enriquecimento)
      leads/[id]/page.tsx           # ✅ wrapper server (extrai params.id, key={id})
      leads/[id]/LeadDetailClient.tsx # ✅ ficha: enriquecer, WhatsApp, transições de status
      buscas/page.tsx               # ✅ buscas salvas → clique filtra os leads da busca
      config/page.tsx               # ✅ formulário completo da config
    api/
      login/route.ts                # ✅ POST senha → cookie de sessão
      logout/route.ts               # ✅ POST limpa o cookie de sessão
      config/route.ts               # ✅ GET/PUT config
      search/route.ts               # ✅ POST busca (Text Search) + registra em /buscas
      buscas/route.ts               # ✅ GET buscas salvas
      leads/route.ts                # ✅ GET lista de leads com filtros
      leads/[id]/route.ts           # ✅ GET ficha / PATCH status
      leads/[id]/enrich/route.ts    # ✅ POST enriquecimento (Place Details)
      usage/route.ts                # ✅ GET uso do mês + custo projetado
      metrics/route.ts              # ✅ GET métricas de prospecção
      __tests__/                    # ✅ testes das rotas (fake Firestore + fetch mockado)
  lib/
    firestore-like.ts               # ✅ interface estrutural mínima do Firestore (UsageDb/AppDb)
    errors.ts                       # ✅ erros de domínio (validação, 404, transição)
    http.ts                         # ✅ formato de erro padrão + mapa erro→HTTP status
    auth.ts                         # ✅ cookie de sessão derivado de APP_PASSWORD
    api-client.ts                   # ✅ fetch tipado do cliente (ApiError, um método por rota)
    format.ts                       # ✅ formatBRL/USD/percent/int/dateTime (pt-BR)
    wa.ts                           # ✅ monta o link wa.me a partir de dados já persistidos
    sku-labels.ts                   # ✅ rótulos pt-BR dos SKUs (dashboard e config)
    costs/                          # ✅ ver seção "Módulo de custos"
      skus.ts                       # SKUs, field masks, cotas grátis, preços default
      period.ts                     # chave do período mensal (YYYY-MM, UTC)
      errors.ts                     # QuotaExceededError
      usage.ts                      # reserveQuota / getUsage (transação Firestore)
      cost.ts                       # projeção de custo (funções puras)
      index.ts
      __tests__/
    config/                         # ✅ config efetiva: defaults + /config/app, validação de PUT
    firebase/
      admin.ts                      # ✅ init lazy do firebase-admin (env vars)
    places/
      client.ts                     # ✅ searchText() / placeDetails(), sempre via reserveQuota
    leads/                          # ✅ repositório de leads (upsert, filtros, transições)
      types.ts
      repo.ts
      metrics.ts                    # ✅ contatosHoje/contatosSemana/taxaResposta
    buscas/                         # ✅ registro das buscas executadas
      types.ts
      repo.ts
    testing/
      fake-firestore.ts             # ✅ fake em memória com semântica de transação
  components/                       # ✅ UI compartilhada
    Button.tsx                      # variantes + estado de loading
    Nav.tsx                         # bottom nav + logout (client)
    StatusBadge.tsx                 # badge ordinal do status do lead
    UsageMeter.tsx                  # meter de uso vs teto (accent/warning/critical)
```

Tudo na árvore acima está implementado e testado (testes automatizados para tudo em `lib/` e `app/api/`; as páginas em `app/(app)/` e `app/login/` foram verificadas navegando o app real — ver "Verificação da UI" abaixo — e não têm suíte de componente própria, já que é UI fina sobre rotas já testadas).

## Modelo de dados (Firestore)

### `/config/app` — documento único de configuração

```jsonc
{
  "nicho": "dentista",                          // nicho-alvo da busca
  "regiao": "Sarandi PR",                       // texto livre, vai na query do Text Search
  "filtros": {
    "temSite": "qualquer",                      // "qualquer" | "com" | "sem"
    "temTelefone": "qualquer"                   // idem
  },
  "mensagemPadrao": "Oi {nome}, tudo bem? ...", // variável {nome} → displayName do lead
  "caps": {                                     // teto mensal de requests por SKU
    "textSearch": 10000,
    "detailsEssentials": 10000,
    "detailsPro": 5000
  },
  "precos": {                                   // override dos defaults de skus.ts
    "usdPor1000": { "textSearch": 32, "detailsEssentials": 5, "detailsPro": 17 },
    "cotaGratis": { "textSearch": 10000, "detailsEssentials": 10000, "detailsPro": 5000 },
    "usdBrl": 5.50                              // câmbio para custo projetado em R$
  },
  "atualizadoEm": "<timestamp>"
}
```

Observações:
- Os **filtros "tem site/telefone" são filtros de listagem**, não de busca: o Text Search com field mask Essentials não retorna site/telefone, então o filtro só se aplica a leads já enriquecidos (leads não enriquecidos aparecem como "desconhecido").
- `caps` é o teto de segurança (hard stop). `precos.cotaGratis` é informativo (dashboard e projeção de custo). Por default o teto = cota grátis, ou seja, o app nunca gasta um centavo sem o usuário aumentar o teto conscientemente.

### `/leads/{placeId}` — um doc por lead

**O ID do documento é o Place ID do Google** → dedupe natural entre buscas repetidas.

```jsonc
{
  "placeId": "ChIJ...",
  "nome": "Clínica Sorriso",                    // displayName.text
  "endereco": "Av. Brasil, 123 - Sarandi, PR",  // formattedAddress
  "location": { "lat": -23.44, "lng": -51.87 },
  "status": "novo",                             // "novo" | "contactado" | "respondeu" | "fechado"
  "busca": {                                    // contexto da ÚLTIMA busca que retornou o lead
    "nicho": "dentista", "subNicho": "implante", "regiao": "Sarandi PR", "em": "<timestamp>"
  },
  "buscaId": ["<uuid>", "<uuid>"],              // IDs de /buscas em que apareceu — só cresce, nunca sobrescrito
  "enriquecido": false,
  "detalhes": {                                 // só existe após enriquecimento (Details Pro)
    "telefone": "(44) 3264-0000",               // nationalPhoneNumber
    "telefoneIntl": "+55 44 3264-0000",         // internationalPhoneNumber → base do link wa.me
    "site": "https://...",                      // websiteUri (ausente = lead quente!)
    "rating": 4.7,
    "totalAvaliacoes": 132,                     // userRatingCount
    "enriquecidoEm": "<timestamp>"
  },
  "contato": {                                  // carimbos das transições de status
    "primeiroContatoEm": "<timestamp>",         // status → contactado
    "respondeuEm": "<timestamp>",               // status → respondeu
    "fechadoEm": "<timestamp>"                  // status → fechado
  },
  "criadoEm": "<timestamp>",
  "atualizadoEm": "<timestamp>"
}
```

Regras de escrita:
- Upsert da busca **nunca rebaixa status** nem apaga `detalhes` de um lead existente — só atualiza nome/endereço/`busca` e **anexa** o novo id ao array `buscaId` (com dedupe).
- Transições válidas: `novo → contactado → respondeu → fechado` (e `contactado → fechado` direto). Cada transição carimba o timestamp correspondente em `contato`, que alimenta as métricas.

### `/buscas/{id}` — um doc por busca executada

**O ID do documento é um UUID gerado na rota de busca** (o mesmo valor anexado ao `buscaId` dos leads).

```jsonc
{
  "id": "<uuid>",                               // igual ao ID do doc
  "nome": "Implantes Sarandi",                  // opcional no form; default "{nicho} {DD/MM}"
  "nicho": "dentista",
  "subNicho": "implante",                       // opcional
  "regiao": "Sarandi PR",
  "criadaEm": "<ISO 8601>",
  "totalCriados": 12,                           // leads novos que esta busca criou
  "totalExistentes": 8                          // leads que já estavam na base
}
```

O doc é gravado **depois** do upsert dos leads (para ter os totais). Se a busca falhar antes (teto/erro do Google), nenhum doc de busca é criado.

### `/usage/{YYYY-MM}` — um doc por mês (contadores de custo)

```jsonc
{
  "textSearch": 42,
  "detailsEssentials": 0,
  "detailsPro": 17,
  "atualizadoEm": "<ISO 8601>"
}
```

- Período em **UTC** (`2026-07`). O reset da cota grátis do Google segue o fuso da conta de billing; algumas horas de deriva são irrelevantes para um teto de segurança, e UTC evita bugs de horário de verão.
- Incremento é **transacional** (ler → verificar teto → incrementar) — ver "Módulo de custos".

### Métricas de prospecção

Sem coleção própria no MVP: são **queries sobre `/leads`** usando os timestamps de `contato` (ex.: contatos hoje = `contato.primeiroContatoEm >= startOfDay`; taxa de resposta = leads com `respondeuEm` ÷ leads com `primeiroContatoEm`). Na escala de uso pessoal (centenas de leads) isso custa nada; se um dia doer, materializamos agregados.

## Contrato das rotas (route handlers)

Formato de erro padrão em todas as rotas:

```jsonc
{ "error": { "code": "quota_exceeded", "message": "…", /* campos extras por code */ } }
```

| Rota | Método | Entrada | Saída | Google / SKU |
|---|---|---|---|---|
| `/api/login` | POST | `{ senha }` | `204` + cookie de sessão · `401 invalid_password` · `503 config_error` | — |
| `/api/config` | GET | — | `200 { config }` (defaults se doc não existe) | — |
| `/api/config` | PUT | config parcial ou completa | `200 { config }` · `400 validation_error` | — |
| `/api/search` | POST | `{ nicho?, subNicho?, regiao?, nome? }` (nicho/regiao default: config) | `200 { criados, existentes, leads[], busca }` · `429 quota_exceeded` · `502 places_error` | Text Search · **textSearch** |
| `/api/buscas` | GET | — | `200 { buscas[] }` (mais recentes primeiro) | — |
| `/api/leads` | GET | query: `status`, `temSite`, `temTelefone`, `buscaId` | `200 { leads[] }` · `400` | — |
| `/api/leads/[id]` | GET | — | `200 { lead }` · `404` | — |
| `/api/leads/[id]` | PATCH | `{ status }` | `200 { lead }` · `400` · `404` · `409 invalid_transition` | — |
| `/api/leads/[id]/enrich` | POST | — | `200 { lead }` · `404` · `429 quota_exceeded` · `502 places_error` | Place Details · **detailsPro** |
| `/api/usage` | GET | — | `200 { period, usage, caps, cotaGratis, custoProjetado: { usd, brl } }` | — |
| `/api/metrics` | GET | — | `200 { contatosHoje, contatosSemana, taxaResposta }` | — |
| `/api/logout` | POST | — | `204` (limpa o cookie de sessão) | — |

Todas as rotas do contrato estão implementadas e testadas.

Semântica fixa:
- **`429 quota_exceeded`**: corpo `{ error: { code: "quota_exceeded", sku, used, cap, period, message } }`. Emitido **antes** de qualquer chamada ao Google (a reserva de cota falhou). Nenhum custo foi incorrido.
- **`502 places_error`**: o Google respondeu erro. A cota **já foi consumida** (reservamos antes de chamar) — decisão deliberada: superestimar uso é seguro, subestimar não.
- `/api/search` faz upsert em `/leads` com `status: "novo"` para novos e reporta `existentes` para os que já estavam na base. **Busca só a 1ª página** do Text Search (até 20 resultados) — cada página seria uma request cobrada. A query enviada ao Google é **`"{nicho} {subNicho} {regiao}"`** (partes vazias omitidas). Cada busca gera um doc em `/buscas` (nome default `"{nicho} {DD/MM}"`, data em UTC) e anexa o id ao `buscaId` dos leads retornados.
- **Enriquecimento automático pós-busca é do cliente, não do servidor**: a página de leads, com o checkbox ligado, chama `POST /enrich` **em série** para os primeiros N resultados ainda não enriquecidos (N ≤ 5, default desligado). Cada chamada passa pelo `reserveQuota` normal do servidor; no primeiro `429` o loop para e a UI informa quantos foram feitos. Não existe rota de enriquecimento em lote — mantém o princípio "enriquecimento sob demanda" com um único caminho de cota.
- `/api/leads/[id]/enrich` grava `detalhes`, marca `enriquecido: true`. Lead já enriquecido **retorna do cache sempre** — re-enriquecimento não existe.
- O botão WhatsApp é montado **no cliente** a partir de dados já persistidos (`wa.me/<telefoneIntl sem símbolos>?text=<mensagemPadrao com {nome} substituído>`) — não há rota nem chamada externa.
- `/api/metrics`: "hoje" usa o dia corrente em UTC (mesma convenção do período de custos); "semana" é uma janela rolante dos últimos 7 dias (não semana de calendário). `taxaResposta` é `leads com respondeuEm ÷ leads com primeiroContatoEm`, `0` (não `NaN`) sem contatos.

## Estratégia de field masks por SKU

O Google cobra a chamada pelo **campo de tier mais alto presente no field mask**. Um campo a mais pode multiplicar o preço da request. Por isso:

1. Os field masks são **constantes centralizadas em `src/lib/costs/skus.ts`** — nenhuma rota monta field mask na mão.
2. Cada field mask está **amarrado ao SKU que ele dispara**: quem chama `searchText()` passa pelo contador `textSearch`; quem chama `placeDetails()` com o mask Pro passa pelo contador `detailsPro`.
3. **Adicionar um campo a um mask exige conferir o tier dele na tabela de preços vigente do Google** e, se mudar o tier, mudar o SKU contado.

| SKU (contador) | Endpoint | Field mask | Uso no app |
|---|---|---|---|
| `textSearch` | `POST places:searchText` | `places.id,places.displayName,places.formattedAddress,places.location,nextPageToken` | Busca de leads |
| `detailsEssentials` | `GET places/{id}` | `id,displayName,formattedAddress,location` | Reservado (refresh de dados básicos); fora do fluxo principal do MVP |
| `detailsPro` | `GET places/{id}` | `id,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount` | Enriquecimento da ficha (sob demanda) |

> ⚠️ **Conferir na tabela vigente**: o Google reestruturou os SKUs da Places API (New) em Essentials/Pro/Enterprise em março/2025 e pode reclassificar campos. Os defaults de preço e cota grátis em `skus.ts` são apenas ponto de partida e **todos são sobrescrevíveis via `/config/app`** — corrigir preço/cota é mudança de configuração, não de código.

## Módulo de custos (`src/lib/costs`) — implementado

Tudo que depende de request pago passa por aqui. API:

```ts
// Reserva 1 request do SKU no mês corrente, ou lança QuotaExceededError.
// Transacional: ler doc de uso → verificar teto → incrementar. Atômico no Firestore.
reserveQuota(db, sku, caps?, now?): Promise<{ period, usage }>

// Leitura do uso do mês (para o dashboard).
getUsage(db, now?): Promise<{ period, usage }>

// Funções puras de projeção de custo (excedente além da cota grátis).
projectedCostUSD(usage, pricing?): number
projectedCostBRL(usage, usdBrl, pricing?): number
```

Decisões de projeto:
- **Reserva antes do request**: o contador incrementa antes de chamar o Google. Se o Google falhar, o contador fica 1 acima do real — erro do lado seguro. O inverso (chamar e depois contar) poderia estourar o teto em caso de falha na gravação.
- **Teto (`cap`) = máximo de requests permitidas no mês**. `used + 1 > cap` → recusa com `QuotaExceededError` (mensagem em pt-BR com SKU, uso, teto e período). Teto `0` (ou negativo) bloqueia o SKU por completo.
- **`src/lib/firestore-like.ts`**: o app inteiro depende de uma interface estrutural mínima do Firestore (`UsageDb` para custos, `AppDb` ampliada para o resto), não do `firebase-admin` — o Firestore real satisfaz a interface por tipagem estrutural (há um static assert em `admin.ts`), e os testes usam um fake em memória que reproduz a semântica de transação (leituras veem o estado pré-transação; escritas só aplicam no commit; exceção → nada aplicado).
- Contadores malformados no doc (string, negativo, NaN) são lidos como `0` — o módulo nunca quebra por dado sujo, só fica mais conservador.
- `atualizadoEm` gravado como ISO string (evita dependência do `FieldValue` do admin dentro do módulo puro).

## Proteção por senha (src/proxy.ts)

Todo o app (páginas e API) exige sessão, exceto assets estáticos, a página `/login` e `POST /api/login`. Fluxo:

1. `POST /api/login` com `{ senha }` compara com a env var `APP_PASSWORD` e grava o cookie `radar_session` (httpOnly, sameSite=lax, 30 dias, secure em produção). A página `/login` faz esse POST e redireciona para `/` no sucesso.
2. O valor do cookie é o **SHA-256 da senha** — trocar `APP_PASSWORD` invalida todas as sessões. Sem estado no banco.
3. O proxy também aceita o header `x-app-password` (útil para curl); quando correto, já estabelece o cookie na resposta.
4. `POST /api/logout` limpa o cookie (usado pelo botão "Sair" da navegação).
5. **Fail-closed**: sem `APP_PASSWORD` configurada, tudo responde `503 config_error` — o app nunca sobe aberto por engano.

## UI (implementada)

Client Components (`"use client"`) que buscam dados via `fetch` no próprio cliente (não Server Components lendo o Firestore direto) — decisão deliberada: cada ação do usuário (buscar, enriquecer, mudar status, salvar config) precisa do feedback de erro específico das rotas (429/502/400/404/409), então a mesma rota HTTP serve tanto a carga inicial quanto a mutação, com um único caminho de tratamento de erro (`src/lib/api-client.ts`, classe `ApiError`).

- **`/login`**: form de senha → `POST /api/login` → redireciona para `/`.
- **`(app)/` (route group)**: layout com nav inferior fixa (Painel/Leads/Config) + botão Sair; todas as páginas autenticadas vivem aqui.
  - **`/` (Dashboard)**: hero com custo projetado em R$, um `UsageMeter` por SKU (accent → warning → critical conforme se aproxima do teto, nunca só cor — sempre acompanhado da palavra "OK"/"Perto do teto"/"No limite") e um KPI row com `/api/metrics`.
  - **`/leads`**: form de nova busca (`POST /api/search`, trata `quota_exceeded`/`places_error` com mensagem específica; campos nicho/sub-nicho/região/nome da busca + checkbox de auto-enriquecimento dos primeiros N ≤ 5) + filtros (status/site/telefone) + lista com `StatusBadge`. Aceita `?buscaId=` na URL (via `useSearchParams`, com Suspense) para mostrar só os leads de uma busca, com chip de filtro e botão limpar.
  - **`/buscas`**: buscas salvas (nome, nicho/sub-nicho, região, data, totais); clicar navega para `/leads?buscaId=…`.
  - **`/leads/[id]`**: ficha do lead; a página server é só um wrapper fino que extrai `params.id` e monta `<LeadDetailClient key={id} id={id} />` — o `key={id}` força remontar o client component ao trocar de lead, resetando o estado em vez de arrastar dado do lead anterior.
  - **`/config`**: formulário completo (busca, filtros, mensagem padrão, tetos por SKU, preços/cota grátis/câmbio), mostra a lista de `problemas` de validação devolvida pela API.
- **Paleta**: sempre escura (sem alternância clara/escura — é um painel de operação pessoal), tokens centralizados em `globals.css` como `@theme` do Tailwind v4. Validada com a skill de dataviz: status do lead é **ordinal** (posição no funil novo→fechado), não identidade — por isso um único hue em degraus de luminância (`--status-novo` … `--status-fechado`), não cores categóricas distintas; o meter de uso segue o contrato "accent → warning → critical" com a trilha em wash neutro.
- **Padrão de fetch em `useEffect`**: o linter do React Compiler (`eslint-plugin-react-hooks` 7.x, via `eslint-config-next`) rejeita chamar, dentro de um efeito, qualquer função de escopo externo que (mesmo transitivamente) atualize estado — a regra é sobre o grafo de chamadas, não sobre ordem antes/depois de `await`. A cada tela, a busca é declarada **inline dentro do próprio `useEffect`** (ou via `.then/.catch/.finally` direto no corpo do efeito); quando a mesma busca precisa ser reaproveitada por um handler de evento (retry, refetch pós-mutação), extrai-se um fetcher **puro** (sem `setState`) chamado nos dois lugares.

## Verificação da UI

Sem Firebase real neste ambiente de sessão, a verificação de ponta a ponta foi feita ligando temporariamente o `FakeFirestore` (o mesmo fake dos testes) no lugar do Firestore via uma env var (`RADAR_FAKE_DB=1`), com dados de exemplo, rodando `next build && next start` e navegando o app real com Playwright (login errado/certo, dashboard com os três estados de meter, filtros de leads, ficha enriquecida/não enriquecida, botão Enriquecer com erro real de `GOOGLE_PLACES_API_KEY` ausente, transição de status, link `wa.me` com telefone e `{nome}` corretos, salvar config, logout e bloqueio pós-logout). O patch em `admin.ts` e os dados de exemplo foram revertidos antes do commit — não fazem parte do código do app.

## Variáveis de ambiente

```
GOOGLE_PLACES_API_KEY=   # NUNCA exposta ao cliente; usada só em route handlers
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=    # com \n literais; admin.ts converte
APP_PASSWORD=            # senha única do app; sem ela tudo responde 503
```

Ver `.env.example`. Na Vercel, cadastrar as cinco em Project Settings → Environment Variables.

## Decisões tomadas

- **Proteção de acesso**: senha única comparada com `APP_PASSWORD` no proxy + cookie de sessão simples (ver seção acima). Sem Firebase Auth.
- **Paginação do Text Search**: só a 1ª página (até 20 resultados). `nextPageToken` nem é lido.
- **Re-enriquecimento**: não existe. Lead enriquecido retorna do cache sempre; um novo Place Details para o mesmo lead nunca é disparado.
