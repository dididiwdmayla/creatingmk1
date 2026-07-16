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
    layout.tsx                      # dark fixo (sem alternância clara/escura), fontes Space Grotesk/Inter/JetBrains Mono
    icon.tsx                        # ✅ favicon gerado (ImageResponse) — tema radar
    login/page.tsx                  # ✅ form de senha → POST /api/login, identidade RADAR
    demo/
      fonts.ts                      # ✅ fontes das skins via next/font (--font-demo-*)
      [leadId]/page.tsx             # ✅ demo PÚBLICA do lead (única rota sem senha; só Firestore)
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
      search/route.ts               # ✅ POST busca (geocode + Text Search paginado/qualificado) + registra em /buscas
      geocode/route.ts              # ✅ GET região resolvida ("Buscando em: X"), cache em /geocache
      buscas/route.ts               # ✅ GET buscas salvas
      buscas/[id]/route.ts          # ✅ PATCH cor / mensagem do grupo
      leads/route.ts                # ✅ GET lista de leads com filtros
      leads/[id]/route.ts           # ✅ GET ficha / PATCH status·notas·favorito·descartado
      leads/[id]/enrich/route.ts    # ✅ POST enriquecimento (Place Details)
      leads/[id]/demo/route.ts      # ✅ PUT configuração da demo do lead (Forja de Demos)
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
    site-proprio.ts                 # ✅ classifica websiteUri: rede social/agregador ≠ site próprio
    sku-labels.ts                   # ✅ rótulos pt-BR dos SKUs (dashboard e config)
    geo/
      geocode.ts                    # ✅ geocodeRegion() com cache permanente em /geocache
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
    demos/                          # ✅ Forja de Demos (ver seção própria)
      types.ts                      # DemoData, Theme, SkinDefinition, LeadDemo
      montar.ts                     # montarDemoData: exemplo ← lead ← edições
      registry.ts                   # registro de skins (a lista canônica)
      validate.ts                   # validação do PUT /api/leads/[id]/demo
    testing/
      fake-firestore.ts             # ✅ fake em memória com semântica de transação
  components/                       # ✅ UI compartilhada
    Button.tsx                      # variantes + estado de loading
    Nav.tsx                         # bottom nav + logout (client)
    StatusBadge.tsx                 # badge ordinal do status do lead (cor + forma + marcador)
    UsageMeter.tsx                  # meter de uso vs teto (accent/warning/critical), anima ao montar
    LeadCard.tsx                    # card da lista: estrela, notas inline, dots de cor, destaque sem site
    PageTransition.tsx              # fade-in de página por troca de rota (client)
    RadarSweep.tsx                  # decoração de sweep de radar (CSS puro)
    demos/                          # ✅ skins da Forja de Demos (um pacote por skin)
      barbearia/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        themes.ts                   # default + presets de tema
        exemplo.ts                  # DemoData de exemplo (base da ficha)
        interactive/                # ✅ subcomponentes "use client" (animações/interação)
          ScrollHeader.tsx           # header que reage ao scroll
          TypewriterText.tsx         # máquina de escrever fiel ao original
          TeamCard.tsx               # card da equipe + HairParticles no hover
          HairParticles.tsx          # fios de cabelo caindo (rAF, sem lib)
          AnimatedScissors.tsx       # tesourinha animada (motion)
          CustomCursor.tsx           # cursor contextual com spring (motion)
          cursorIcons.tsx            # ícones do cursor (navalha/pente/máquina/tesoura)
          IntroExperience.tsx        # orquestra cursor + intro + sessionStorage
          IntroAnimation.tsx         # navalha corta a tela (motion)
          RazorBlade.tsx             # navalha decorativa da intro
          SparkParticles.tsx         # faíscas da intro (motion)
public/
  demos/barbearia/*.svg             # ✅ placeholders locais por slot de imagem
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
    "textSearch": 5000,
    "textSearchEnterprise": 1000,
    "detailsEssentials": 10000,
    "detailsEnterprise": 1000
  },
  "precos": {                                   // override dos defaults de skus.ts
    "usdPor1000": { "textSearch": 32, "textSearchEnterprise": 35, "detailsEssentials": 5, "detailsEnterprise": 20 },
    "cotaGratis": { "textSearch": 5000, "textSearchEnterprise": 1000, "detailsEssentials": 10000, "detailsEnterprise": 1000 },
    "usdBrl": 5.50                              // câmbio para custo projetado em R$
  },
  "atualizadoEm": "<timestamp>"
}
```

Observações:
- Os **filtros "tem site/telefone" são filtros de listagem**, não de busca. O filtro de site usa a classificação **`siteProprio`** (rede social/agregador conta como SEM site próprio — ver "Classificação de site próprio"); vale para leads enriquecidos E para leads da **busca qualificada**. Telefone vale após enriquecer ou pela qualificada. Leads sem informação aparecem como "desconhecido" e ficam fora de com/sem.
- `caps` é o teto de segurança (hard stop). `precos.cotaGratis` é informativo (dashboard e projeção de custo). Por default o teto = cota grátis, ou seja, o app nunca gasta um centavo sem o usuário aumentar o teto conscientemente.
- **Migração de SKU (jul/2026)**: `detailsPro` foi renomeado para `detailsEnterprise` (a tabela do Google classifica telefone/site/rating como tier Enterprise). Docs antigos com chaves `detailsPro` em `caps`/`precos` são lidos via alias e regravados com o nome novo; PUTs novos com o nome antigo são rejeitados (400).

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
  "temSite": true,                              // o Google retornou ALGUMA URL; na qualificada é DEFINITIVO (ausente no doc = desconhecido)
  "siteUrl": "https://instagram.com/negocio",   // a URL, qualquer que seja (fica guardada mesmo sendo rede social)
  "siteProprio": false,                         // true = site próprio; false = sem URL OU URL de rede social/agregador (lead quente); ausente = desconhecido
  "temTelefone": true,                          // da busca qualificada; ausente = desconhecido
  "telefone": "(44) 3264-0000",                 // da busca qualificada (nationalPhoneNumber)
  "telefoneIntl": "+55 44 3264-0000",           // da busca qualificada → botão wa.me sem enriquecer
  "notas": "ligar depois das 18h",              // anotação curta (≤500), editável no card da lista
  "favorito": true,                             // estrela no card; filtro próprio na lista
  "descartado": false,                          // descarte suave: fim da lista, reversível — nunca deleta
  "enriquecido": false,
  "detalhes": {                                 // só existe após enriquecimento (Details Enterprise)
    "telefone": "(44) 3264-0000",               // nationalPhoneNumber
    "telefoneIntl": "+55 44 3264-0000",         // internationalPhoneNumber → base do link wa.me
    "site": "https://...",                      // websiteUri (ausente = lead quente!)
    "rating": 4.7,
    "totalAvaliacoes": 132,                     // userRatingCount
    "enriquecidoEm": "<timestamp>"
  },
  "demo": {                                     // Forja de Demos (opcional; ver seção própria)
    "skinId": "barbearia-editorial",            // do registro de skins
    "themeId": "creme",                         // preset da skin (inválido → default)
    "dados": { "slogan": "Tradição desde 1998." }, // overrides parciais de DemoData
    "atualizadoEm": "<timestamp>"
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
- Upsert da busca **nunca rebaixa status** nem apaga `detalhes`/`notas`/`favorito`/`demo` de um lead existente — só atualiza nome/endereço/`busca`, **anexa** o novo id ao array `buscaId` (com dedupe) e atualiza `temSite`/`siteUrl`/`siteProprio`/telefones quando a busca qualificada trouxer informação fresca (nunca remove).
- O enriquecimento também grava `temSite`/`siteUrl`/`siteProprio` (o mask Enterprise pede `websiteUri`, então a resposta é definitiva).
- Transições válidas: `novo → contactado → respondeu → fechado` (e `contactado → fechado` direto). Cada transição carimba o timestamp correspondente em `contato`, que alimenta as métricas.

### Classificação de site próprio (`src/lib/site-proprio.ts`)

`websiteUri` apontando para **rede social, WhatsApp ou agregador de links** (instagram.com, facebook.com, wa.me, api.whatsapp.com, linktr.ee, bio.link, tiktok.com etc. — lista fixa no módulo, comparada por hostname com subdomínios) **não conta como site próprio**: o lead recebe `siteProprio: false` e continua aparecendo no filtro "sem site próprio" — é prospect válido. A URL fica preservada em `siteUrl` (útil para contato). Estados de `siteProprio`: `true` = site próprio · `false` = sem site nenhum OU só rede social · ausente = desconhecido. Docs antigos sem o campo são derivados na leitura (de `detalhes.site` ou `temSite`/`siteUrl`); URL ilegível classifica como site próprio (lado conservador — não polui a lista de prospects).

### `/buscas/{id}` — um doc por busca executada

**O ID do documento é um UUID gerado na rota de busca** (o mesmo valor anexado ao `buscaId` dos leads).

```jsonc
{
  "id": "<uuid>",                               // igual ao ID do doc
  "nome": "Implantes Sarandi",                  // opcional no form; default "{nicho} {DD/MM}"
  "nicho": "dentista",
  "subNicho": "implante",                       // opcional
  "regiao": "Sarandi PR",
  "cor": "#2f82e0",                             // paleta fixa de 10 (BUSCA_CORES), rotação na criação, editável
  "mensagemPadrao": "Oi {nome}! ...",           // opcional (≤1000): mensagem do WhatsApp DESTE grupo; ausente = usa a global da config
  "criadaEm": "<ISO 8601>",
  "totalCriados": 12,                           // leads novos que esta busca criou
  "totalExistentes": 8                          // leads que já estavam na base
}
```

O doc é gravado **depois** do upsert dos leads (para ter os totais). Se a busca falhar por completo (teto/erro na 1ª página), nenhum doc de busca é criado; se parar no meio da paginação, o doc registra o parcial.

Sobre a **cor**: paleta fixa de 10 (validada contra a superfície escura: banda de luminância, croma e contraste ≥3:1). Com 10 hues a separação CVD de todos os pares é matematicamente inviável — por isso a cor é sempre reforço redundante: o nome da busca acompanha o badge em texto. Docs antigos sem `cor` ganham fallback estável na leitura.

### `/geocache/{regiaoNormalizada}` — cache permanente de geocoding

ID = região normalizada (minúsculas, espaços colapsados, URL-encoded). Doc: `{ regiao, endereco, location, viewport, criadoEm }`. Cada região digitada só custa **1 request de geocoding na vida** — o viewport cacheado alimenta o `locationRestriction` de todas as buscas seguintes. Sem expiração: limites geográficos de cidade não mudam em escala relevante para prospecção.

### `/usage/{YYYY-MM}` — um doc por mês (contadores de custo)

```jsonc
{
  "textSearch": 42,
  "textSearchEnterprise": 3,
  "detailsEssentials": 0,
  "detailsEnterprise": 17,
  "atualizadoEm": "<ISO 8601>"
}
```

- Período em **UTC** (`2026-07`). O reset da cota grátis do Google segue o fuso da conta de billing; algumas horas de deriva são irrelevantes para um teto de segurança, e UTC evita bugs de horário de verão.
- Incremento é **transacional** (ler → verificar teto → incrementar) — ver "Módulo de custos".
- **Migração**: docs de meses antigos podem ter o campo `detailsPro`; a leitura usa o valor legado enquanto `detailsEnterprise` não existir no doc — assim que a primeira reserva nova grava o nome atual, o legado é ignorado.

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
| `/api/search` | POST | `{ nicho?, subNicho?, regiao?, nome?, quantidade? (1–40), qualificada? }` (nicho/regiao default: config) | `200 { criados, existentes, leads[], busca, paginas, regiaoResolvida, aviso? }` · `400` · `429 quota_exceeded` · `502 places_error` | Geocoding (com cache) + Text Search · **geocoding** + **textSearch** ou **textSearchEnterprise** |
| `/api/geocode` | GET | query: `regiao` (default: config) | `200 { regiao, endereco, location, viewport, cached }` · `400` · `429` · `502` | Geocoding · **geocoding** (só em cache miss) |
| `/api/buscas` | GET | — | `200 { buscas[] }` (mais recentes primeiro) | — |
| `/api/buscas/[id]` | PATCH | `{ cor? (da paleta), mensagemPadrao? (≤1000, "" limpa) }` (≥1 campo) | `200 { busca }` · `400` · `404` | — |
| `/api/leads` | GET | query: `status`, `temSite`, `temTelefone`, `buscaId`, `favorito` | `200 { leads[] }` · `400` | — |
| `/api/leads/[id]` | GET | — | `200 { lead }` · `404` | — |
| `/api/leads/[id]` | PATCH | `{ status?, notas? (≤500), favorito?, descartado? }` (≥1 campo) | `200 { lead }` · `400` · `404` · `409 invalid_transition` | — |
| `/api/leads/[id]/enrich` | POST | — | `200 { lead }` · `404` · `429 quota_exceeded` · `502 places_error` | Place Details · **detailsEnterprise** |
| `/api/leads/[id]/demo` | PUT | `{ skinId, themeId, dados? }` | `200 { lead }` · `400` · `404` | — |
| `/api/usage` | GET | — | `200 { period, usage, caps, cotaGratis, custoProjetado: { usd, brl } }` | — |
| `/api/metrics` | GET | — | `200 { contatosHoje, contatosSemana, taxaResposta }` | — |
| `/api/logout` | POST | — | `204` (limpa o cookie de sessão) | — |

Todas as rotas do contrato estão implementadas e testadas.

Semântica fixa:
- **`429 quota_exceeded`**: corpo `{ error: { code: "quota_exceeded", sku, used, cap, period, message } }`. Emitido **antes** de qualquer chamada ao Google (a reserva de cota falhou). Nenhum custo foi incorrido.
- **`502 places_error`**: o Google respondeu erro. A cota **já foi consumida** (reservamos antes de chamar) — decisão deliberada: superestimar uso é seguro, subestimar não.
- `/api/search` faz upsert em `/leads` com `status: "novo"` para novos e reporta `existentes` para os que já estavam na base. A query enviada ao Google é **`"{nicho} {subNicho} {regiao}"`** (partes vazias omitidas). Cada busca gera um doc em `/buscas` (nome default `"{nicho} {DD/MM}"`, data em UTC) e anexa o id ao `buscaId` dos leads retornados.
- **Região geocodificada com localização dura**: antes do Text Search, a região é resolvida pela Geocoding API (SKU `geocoding`, com **cache permanente em `/geocache`** — cada região só custa 1 request na vida) e o viewport vira `locationRestriction` — sem resultados de fora da região. Região não encontrada → 400 com dica de grafia. A resposta traz `regiaoResolvida` (endereço formatado) e a UI mostra "Buscando em: X" via `GET /api/geocode` antes de confirmar.
- **`quantidade` (1–40, default 20) conta leads NOVOS**: resultados que já existem na base não abatem a quantidade pedida ("20 = 20 inéditos") — a rota pagina via `nextPageToken` até juntar os novos, **cada página reservando 1 de cota antes do fetch** (o contador reflete páginas, não buscas), até o limite de 3 páginas do Google. Se o teto (ou o Google) falhar da 2ª página em diante, a rota devolve **200 parcial** com os leads já obtidos e o campo `aviso` — a cota da 1ª página já foi paga, jogar o resultado fora seria pagar sem receber. Na 1ª página o comportamento clássico vale: 429 sem custo / 502 com custo.
- **Busca qualificada (`qualificada: true`, checkbox "Só sem site")**: field mask ganha `places.websiteUri` + telefones e a chamada passa a contar no SKU **textSearchEnterprise** (tier Enterprise, cota grátis 1.000/mês). Como o campo foi pedido no mask, a resposta é **definitiva**: todo lead volta com `temSite` e `siteProprio` preenchidos (ausência de `websiteUri` = `false`, nunca "desconhecido"). URL de rede social/agregador → `siteProprio: false` (ver "Classificação de site próprio") — o lead aparece no filtro "sem site próprio" e é destacado como quente. Sem o checkbox, a busca continua no mask básico (SKU textSearch) e site/telefone ficam desconhecidos.
- **Enriquecimento automático pós-busca é do cliente, não do servidor**: a página de leads, com o checkbox ligado, chama `POST /enrich` **em série** para os primeiros N resultados ainda não enriquecidos (N ≤ 5, default desligado). Cada chamada passa pelo `reserveQuota` normal do servidor; no primeiro `429` o loop para e a UI informa quantos foram feitos. Não existe rota de enriquecimento em lote — mantém o princípio "enriquecimento sob demanda" com um único caminho de cota.
- `/api/leads/[id]/enrich` grava `detalhes`, marca `enriquecido: true`. Lead já enriquecido **retorna do cache sempre** — re-enriquecimento não existe.
- O botão WhatsApp é montado **no cliente** a partir de dados já persistidos (`wa.me/<telefoneIntl sem símbolos>?text=<mensagem com {nome} substituído>`) — não há rota nem chamada externa. O telefone da **busca qualificada** já sustenta o botão sem enriquecer. A mensagem usada é a **do grupo** (busca mais recente do lead que tiver `mensagemPadrao` própria) e, na falta, a global da config.
- **Descarte suave** (`descartado: true` via PATCH): o lead não é deletado — vai pro fim da lista com marcação e pode ser restaurado. Reversível por design: apagar de verdade perderia o histórico de contato.
- `/api/metrics`: "hoje" usa o dia corrente em UTC (mesma convenção do período de custos); "semana" é uma janela rolante dos últimos 7 dias (não semana de calendário). `taxaResposta` é `leads com respondeuEm ÷ leads com primeiroContatoEm`, `0` (não `NaN`) sem contatos.

## Estratégia de field masks por SKU

O Google cobra a chamada pelo **campo de tier mais alto presente no field mask**. Um campo a mais pode multiplicar o preço da request. Por isso:

1. Os field masks são **constantes centralizadas em `src/lib/costs/skus.ts`** — nenhuma rota monta field mask na mão.
2. Cada field mask está **amarrado ao SKU que ele dispara**: quem chama `searchText()` passa pelo contador `textSearch` (ou `textSearchEnterprise` na qualificada); quem chama `placeDetails()` passa pelo contador `detailsEnterprise`.
3. **Adicionar um campo a um mask exige conferir o tier dele na tabela de preços vigente do Google** e, se mudar o tier, mudar o SKU contado.

| SKU (contador) | Endpoint | Field mask | Tier / preço default | Uso no app |
|---|---|---|---|---|
| `textSearch` | `POST places:searchText` | `places.id,places.displayName,places.formattedAddress,places.location,nextPageToken` | Pro · US$32/1.000 · 5.000 grátis | Busca de leads |
| `textSearchEnterprise` | `POST places:searchText` | mask do textSearch + `places.websiteUri` + telefones | Enterprise · US$35/1.000 · 1.000 grátis | Busca qualificada ("Só sem site") |
| `detailsEssentials` | `GET places/{id}` | `id,formattedAddress,location` | Essentials · US$5/1.000 · 10.000 grátis | Reservado; fora do fluxo principal |
| `detailsEnterprise` | `GET places/{id}` | `id,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount` | Enterprise · US$20/1.000 · 1.000 grátis | Enriquecimento da ficha (sob demanda) |
| `geocoding` | `GET geocode/json` | — (Geocoding API não usa field mask) | Essentials · US$5/1.000 · 10.000 grátis | Resolver a região da busca (com cache permanente em `/geocache`) |

> ⚠️ **Tiers conferidos na tabela vigente (jul/2026)**: telefone/site/rating são tier **Enterprise** (não Pro); displayName/endereço/location no Text Search são tier **Pro** (5.000 grátis/mês — não os 10k de Essentials). O SKU antigo `detailsPro` foi renomeado para `detailsEnterprise` com migração de leitura dos contadores e da config. `displayName` foi removido do mask de `detailsEssentials` (é campo Pro em Place Details). Os defaults continuam **todos sobrescrevíveis via `/config/app`** — corrigir preço/cota é mudança de configuração, não de código.

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

## Forja de Demos (`src/lib/demos` + `src/components/demos`)

Prévia de site personalizada por lead, servida pelo próprio Radar em **`/demo/{leadId}`** — o link que vai na mensagem de prospecção (variável `{demo}`). Nenhum deploy por lead, nenhuma chamada ao Google: a página é um Server Component que lê **só o Firestore**.

Contratos centrais (`src/lib/demos/types.ts`):

- **`DemoData`** — slots de conteúdo: nome, slogan, endereço, telefone, whatsapp, instagram, cidade, horários, `servicos[]` (nome/preço/descrição), `depoimentos[]` (autor/texto/nota), `secoes` (textos por seção, chaves definidas pela skin — cada `DemoSecao` tem `rotulo/titulo/texto/cta/ctaSecundaria/itens`, e cada `DemoItem` tem `titulo/subtitulo/detalhe/texto`, útil quando uma seção precisa de duas linhas de legenda com pesos visuais diferentes) e `imagens` (caminho por slot).
- **`Theme`** — tokens visuais: `paleta` (fundo/alt/elevado, destaque + ink, texto/suave, borda, e dois acentos raros `acentoSecundario`/`acentoTerciario` para detalhes decorativos que não seguem o acento principal), `fontes` (display/corpo/mono/serif/decorativa/**citacao**/**destaque** como valores CSS prontos — vars `--font-demo-*` carregadas via `next/font` em `src/app/demo/fonts.ts`), `raio` e `densidade` (compacta/confortável/arejada → espaçamento vertical das seções).
- **`SkinDefinition`** — entrada do registro: `{ id, nicho, nome, componente, themeDefault, themePresets, demoDataExemplo }`.

Regras do sistema:

1. **Skin é orientada por dados**: nenhum texto, imagem ou cor hardcoded no componente — tudo vem de `data`/`theme`, aplicado como CSS vars num wrapper (`--d-bg`, `--d-accent`, `--d-radius`, `--d-sec-y`…) que o Tailwind consome via arbitrary values. O componente de topo (`Skin.tsx`) não tem hooks e renderiza igual no server (rota pública); ele **compõe subcomponentes `"use client"`** (`src/components/demos/<nicho>/interactive/`) para as partes que precisam de interatividade real — scroll do header, máquina de escrever, cursor contextual, partículas, animação de entrada — sem que isso reintroduza conteúdo hardcoded: esses subcomponentes só recebem props (texto, imagem, cor) vindas de `data`/`theme` como qualquer outro pedaço da skin.
2. **DemoData efetivo é montado em camadas** (`montarDemoData`): exemplo do template ← dados reais do lead (nome, endereço, telefone, whatsapp) ← edições da ficha (`lead.demo.dados`). Por isso o link `/demo/{leadId}` funciona **antes de qualquer edição** — sem demo salva, renderiza a skin default com os dados que o lead já tem.
3. **Imagens são placeholders locais por slot** (`public/demos/<nicho>/*.svg`) — nunca fotos do cliente original; um override em `dados.imagens` troca slot a slot.
4. **A configuração vive no campo `demo` do doc do lead** (não em subcoleção — a interface `AppDb` não precisa crescer) e é salva por `PUT /api/leads/[id]/demo` com validação estrita (skin/preset existentes, chaves desconhecidas rejeitadas, textos ≤2000, listas ≤30).
5. **A rota pública é `force-dynamic` e `noindex`**: reflete a última edição na hora e não entra em buscador.

### Padrão para adicionar uma nova skin

1. Clone o material bruto em `skins-raw/<nicho>/` (fora do git/tsc/eslint — é só referência) e leia **todos** os componentes e estilos antes de converter, não só os principais — animações e interações (hover, scroll, cursor, máquina de escrever, intro) fazem parte do que precisa ser fielmente portado, não só o layout estático.
2. Crie o pacote `src/components/demos/<nicho>/`:
   - `Skin.tsx` — composição orientada por `{ data, theme }`, tokens só via CSS vars; delega interatividade a `interactive/*.tsx` (`"use client"`);
   - `themes.ts` — `themeDefault` fiel às cores do material bruto (inclusive acentos secundário/terciário se existirem) + 3–4 presets (contraste do `destaqueInk` é responsabilidade do preset);
   - `exemplo.ts` — `DemoData` completo com copy do material bruto e marca genérica.
3. Coloque os placeholders em `public/demos/<nicho>/` (locais, um por slot de `imagens`).
4. Se a skin usa fonte nova, carregue-a em `src/app/demo/fonts.ts` com var `--font-demo-*`, com o peso/estilo exatos do original (ex.: uma fonte carregada só em itálico 900 não é a mesma coisa que a mesma família em peso 400 normal).
5. Se o original usa uma lib de animação (ex.: `motion`), adicione a dependência e port fielmente o timing/easing em vez de recriar com CSS aproximado — o objetivo é a demo parecer idêntica ao original com os dados de exemplo, exceto o que é slot/tema por design.
6. Acrescente a entrada em `src/lib/demos/registry.ts` — rota pública e ficha passam a conhecê-la sem mais mudanças.
7. Rode os testes: o teste de contrato do registro (`registry.test.ts`) valida ids únicos, default entre os presets, exemplo completo e existência física dos placeholders.

## Proteção por senha (src/proxy.ts)

Todo o app (páginas e API) exige sessão, exceto assets estáticos, a página `/login`, `POST /api/login` e a demo pública `/demo/{leadId}`. Fluxo:

1. `POST /api/login` com `{ senha }` compara com a env var `APP_PASSWORD` e grava o cookie `radar_session` (httpOnly, sameSite=lax, 30 dias, secure em produção). A página `/login` faz esse POST e redireciona para `/` no sucesso.
2. O valor do cookie é o **SHA-256 da senha** — trocar `APP_PASSWORD` invalida todas as sessões. Sem estado no banco.
3. O proxy também aceita o header `x-app-password` (útil para curl); quando correto, já estabelece o cookie na resposta.
4. `POST /api/logout` limpa o cookie (usado pelo botão "Sair" da navegação).
5. **Fail-closed**: sem `APP_PASSWORD` configurada, tudo responde `503 config_error` — o app nunca sobe aberto por engano. A exceção da demo pública fica **depois** desse check: sem config, nem a demo abre.

## UI (implementada)

Client Components (`"use client"`) que buscam dados via `fetch` no próprio cliente (não Server Components lendo o Firestore direto) — decisão deliberada: cada ação do usuário (buscar, enriquecer, mudar status, salvar config) precisa do feedback de erro específico das rotas (429/502/400/404/409), então a mesma rota HTTP serve tanto a carga inicial quanto a mutação, com um único caminho de tratamento de erro (`src/lib/api-client.ts`, classe `ApiError`).

- **`/login`**: form de senha → `POST /api/login` → redireciona para `/`.
- **`(app)/` (route group)**: layout com nav inferior fixa (Painel/Leads/Config) + botão Sair; todas as páginas autenticadas vivem aqui.
  - **`/` (Dashboard)**: hero com custo projetado em R$, um `UsageMeter` por SKU (accent → warning → critical conforme se aproxima do teto, nunca só cor — sempre acompanhado da palavra "OK"/"Perto do teto"/"No limite") e um KPI row com `/api/metrics`.
  - **`/leads`**: form de nova busca (`POST /api/search`, trata `quota_exceeded`/`places_error`/`aviso` parcial com mensagem específica; campos nicho/sub-nicho/região/nome, quantidade 1–40, checkbox "Só sem site" e auto-enriquecimento dos primeiros N ≤ 5) + filtros (status/site/telefone/favoritos) + lista com **agrupamento colapsável por busca** (toggle, header com dot da cor + nome + contagem; lead em várias buscas aparece em cada grupo; "Sem busca" agrupa o resto). Cada card (`LeadCard`) tem estrela de favorito e notas editáveis inline — sem abrir a ficha — além dos dots de cor das buscas e destaque "sem site (lead quente)". Aceita `?buscaId=` na URL (via `useSearchParams`, com Suspense) para mostrar só os leads de uma busca (aí a lista é plana), com chip de filtro e botão limpar.
  - **`/buscas`**: buscas salvas (dot de cor, nome, nicho/sub-nicho, região, data, totais); tocar no dot cicla a cor pela paleta e persiste (`PATCH /api/buscas/[id]`); clicar no card navega para `/leads?buscaId=…`.
  - **`/leads/[id]`**: ficha do lead; a página server é só um wrapper fino que extrai `params.id` e monta `<LeadDetailClient key={id} id={id} />` — o `key={id}` força remontar o client component ao trocar de lead, resetando o estado em vez de arrastar dado do lead anterior. Inclui a seção **Demo**: escolha de skin, presets de tema (chips com amostras da paleta), campos pré-preenchidos pelo DemoData efetivo, salvar (`PUT /api/leads/[id]/demo`), abrir e copiar o link público. Campo esvaziado volta ao padrão do template ao salvar; edições avançadas feitas via API (serviços, seções, imagens) são preservadas. A mensagem do WhatsApp aceita `{demo}` além de `{nome}`.
  - **`/config`**: formulário completo (busca, filtros, mensagem padrão, tetos por SKU, preços/cota grátis/câmbio), mostra a lista de `problemas` de validação devolvida pela API.
- **Paleta**: sempre escura (sem alternância clara/escura — é um painel de operação pessoal), tema "radar/sonar": fundo em gradiente azul-profundo → quase-preto (`--background-2` → `--background`), surface com leve tingimento azul (`#121b24`), acento vibrante verde-radar (`--accent`, com `--accent-ink` preto para texto sobre ele — o verde não passa em contraste com texto branco). Tokens centralizados em `globals.css` como `@theme` do Tailwind v4. Validada com a skill de dataviz: status do lead é **ordinal** (posição no funil novo→fechado), não identidade — por isso um único hue em degraus de luminância (`--status-novo` … `--status-fechado`), não cores categóricas distintas, reforçado por forma (quadrado→pill) e marcador (○◐◑●); o meter de uso segue o contrato "accent → warning → critical" com a trilha em wash neutro. A paleta das 10 cores de busca (`BUSCA_CORES`) foi revalidada (mais saturada) contra a nova surface. Textos sobre `good`/`critical`/`warning` usam preto (não branco) — o contraste do branco falha nesses tons vibrantes.
- **Tipografia**: Space Grotesk (`font-display`, via `next/font/google`) para títulos e números grandes do dashboard; Inter (`font-sans`) para o corpo; JetBrains Mono (`font-mono`) para dados tabulares/valores.
- **Animações** (CSS puro, sem lib): fade-in sutil de página (`.page-transition`, disparado por `PageTransition.tsx` que troca a `key` pelo pathname), barra do `UsageMeter` cresce de 0 ao montar, pulso (`.pulse-warning`/`.pulse-critical`) no preenchimento do meter perto do teto/no limite, elevação no hover dos cards clicáveis (`.card-lift`), sweep de radar rotativo (`RadarSweep.tsx` + `.radar-sweep`) no carregamento do dashboard. Tudo respeita `prefers-reduced-motion`.
- **Favicon**: gerado via `app/icon.tsx` (`next/og`/`ImageResponse`) — círculos concêntricos + setor de varredura no verde-radar.
- **Padrão de fetch em `useEffect`**: o linter do React Compiler (`eslint-plugin-react-hooks` 7.x, via `eslint-config-next`) rejeita chamar, dentro de um efeito, qualquer função de escopo externo que (mesmo transitivamente) atualize estado — a regra é sobre o grafo de chamadas, não sobre ordem antes/depois de `await`. A cada tela, a busca é declarada **inline dentro do próprio `useEffect`** (ou via `.then/.catch/.finally` direto no corpo do efeito); quando a mesma busca precisa ser reaproveitada por um handler de evento (retry, refetch pós-mutação), extrai-se um fetcher **puro** (sem `setState`) chamado nos dois lugares.

## Verificação da UI

Sem Firebase real neste ambiente de sessão, a verificação de ponta a ponta foi feita ligando temporariamente o `FakeFirestore` (o mesmo fake dos testes) no lugar do Firestore via uma env var (`RADAR_FAKE_DB=1`), com dados de exemplo, rodando `next build && next start` e navegando o app real com Playwright (login errado/certo, dashboard com os três estados de meter, filtros de leads, ficha enriquecida/não enriquecida, botão Enriquecer com erro real de `GOOGLE_PLACES_API_KEY` ausente, transição de status, link `wa.me` com telefone e `{nome}` corretos, salvar config, logout e bloqueio pós-logout). O patch em `admin.ts` e os dados de exemplo foram revertidos antes do commit — não fazem parte do código do app.

A skin de barbearia da Forja de Demos foi verificada **lado a lado com o material bruto** (`skins-raw/barbearia` rodando em paralelo, `npm install && next build && next start` no diretório clonado): comparação seção a seção (header com scroll, hero com máquina de escrever, agendamento rápido, filosofia, serviços, equipe com hover de fios de cabelo e tesourinha animada, ritual, passos de agendamento, contato, footer com poste de barbeiro) e a animação de entrada (navalha cortando a tela) e o cursor contextual capturados em pleno funcionamento (motion habilitado, sem `prefers-reduced-motion`). Divergências encontradas nessa comparação (fontes trocadas, seção QuickBooking reduzida a uma faixa, animações ausentes, bio da equipe sem a segunda linha de detalhe) foram corrigidas antes do commit final.

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
