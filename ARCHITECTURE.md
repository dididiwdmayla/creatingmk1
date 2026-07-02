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
    layout.tsx
    page.tsx                        # placeholder; dashboard fica na sessão de UI
    config/page.tsx                 # [planejado] formulário de configuração
    leads/page.tsx                  # [planejado] lista de leads com filtros
    leads/[id]/page.tsx             # [planejado] ficha do lead
    login/page.tsx                  # [planejado] formulário de senha → POST /api/login
    api/
      login/route.ts                # ✅ POST senha → cookie de sessão
      config/route.ts               # ✅ GET/PUT config
      search/route.ts               # ✅ POST busca (Text Search)
      leads/route.ts                # ✅ GET lista de leads com filtros
      leads/[id]/route.ts           # ✅ GET ficha / PATCH status
      leads/[id]/enrich/route.ts    # ✅ POST enriquecimento (Place Details)
      usage/route.ts                # ✅ GET uso do mês + custo projetado
      metrics/route.ts              # [planejado] GET métricas de prospecção
      __tests__/                    # ✅ testes das rotas (fake Firestore + fetch mockado)
  lib/
    firestore-like.ts               # ✅ interface estrutural mínima do Firestore (UsageDb/AppDb)
    errors.ts                       # ✅ erros de domínio (validação, 404, transição)
    http.ts                         # ✅ formato de erro padrão + mapa erro→HTTP status
    auth.ts                         # ✅ cookie de sessão derivado de APP_PASSWORD
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
    testing/
      fake-firestore.ts             # ✅ fake em memória com semântica de transação
  components/                       # [planejado] UI compartilhada
```

`[planejado]` = próximas sessões. Itens com ✅ existem e estão testados.

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
  "busca": { "nicho": "dentista", "regiao": "Sarandi PR", "em": "<timestamp>" },
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
- Upsert da busca **nunca rebaixa status** nem apaga `detalhes` de um lead existente — só atualiza nome/endereço e `busca`.
- Transições válidas: `novo → contactado → respondeu → fechado` (e `contactado → fechado` direto). Cada transição carimba o timestamp correspondente em `contato`, que alimenta as métricas.

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
| `/api/search` | POST | `{ nicho?, regiao? }` (default: config) | `200 { criados, existentes, leads[] }` · `429 quota_exceeded` · `502 places_error` | Text Search · **textSearch** |
| `/api/leads` | GET | query: `status`, `temSite`, `temTelefone` | `200 { leads[] }` · `400` | — |
| `/api/leads/[id]` | GET | — | `200 { lead }` · `404` | — |
| `/api/leads/[id]` | PATCH | `{ status }` | `200 { lead }` · `400` · `404` · `409 invalid_transition` | — |
| `/api/leads/[id]/enrich` | POST | — | `200 { lead }` · `404` · `429 quota_exceeded` · `502 places_error` | Place Details · **detailsPro** |
| `/api/usage` | GET | — | `200 { period, usage, caps, cotaGratis, custoProjetado: { usd, brl } }` | — |
| `/api/metrics` | GET | — | `200 { contatosHoje, contatosSemana, taxaResposta }` — [planejado] | — |

Todas as rotas implementadas estão em ✅ na estrutura de pastas; `/api/metrics` fica para a sessão do dashboard.

Semântica fixa:
- **`429 quota_exceeded`**: corpo `{ error: { code: "quota_exceeded", sku, used, cap, period, message } }`. Emitido **antes** de qualquer chamada ao Google (a reserva de cota falhou). Nenhum custo foi incorrido.
- **`502 places_error`**: o Google respondeu erro. A cota **já foi consumida** (reservamos antes de chamar) — decisão deliberada: superestimar uso é seguro, subestimar não.
- `/api/search` faz upsert em `/leads` com `status: "novo"` para novos e reporta `existentes` para os que já estavam na base. **Busca só a 1ª página** do Text Search (até 20 resultados) — cada página seria uma request cobrada.
- `/api/leads/[id]/enrich` grava `detalhes`, marca `enriquecido: true`. Lead já enriquecido **retorna do cache sempre** — re-enriquecimento não existe.
- O botão WhatsApp é montado **no cliente** a partir de dados já persistidos (`wa.me/<telefoneIntl sem símbolos>?text=<mensagemPadrao com {nome} substituído>`) — não há rota nem chamada externa.

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

Todo o app (páginas e API) exige sessão, exceto assets estáticos e `POST /api/login`. Fluxo:

1. `POST /api/login` com `{ senha }` compara com a env var `APP_PASSWORD` e grava o cookie `radar_session` (httpOnly, sameSite=lax, 30 dias, secure em produção).
2. O valor do cookie é o **SHA-256 da senha** — trocar `APP_PASSWORD` invalida todas as sessões. Sem estado no banco.
3. O proxy também aceita o header `x-app-password` (útil para curl e antes de existir a página `/login`); quando correto, já estabelece o cookie na resposta.
4. **Fail-closed**: sem `APP_PASSWORD` configurada, tudo responde `503 config_error` — o app nunca sobe aberto por engano.

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
