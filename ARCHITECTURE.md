# Radar — Arquitetura

Web app pessoal de prospecção de leads locais para web designer freelancer. Multiusuário SIMPLES: um punhado de usuários (`/usuarios`, papel admin/membro) sobre a mesma base compartilhada — sem Firebase Auth, sem isolamento de dados por usuário; o que é "por usuário" é atribuição (quem buscou/enriqueceu/criou demo/contactou e o uso de cota de cada um), não partição.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Firebase Firestore · Vercel · Google Places API (New).

## Princípios inegociáveis

1. **A chave da Google Places API vive só em variável de ambiente** (`GOOGLE_PLACES_API_KEY`) e é usada exclusivamente em route handlers server-side. Nenhuma chamada ao Google parte do cliente.
2. **Todo acesso ao Firestore é server-side** via `firebase-admin` dentro de route handlers. O cliente nunca fala com o Firestore diretamente — as security rules negam tudo (`allow read, write: if false`). Como o app é um time minúsculo sobre uma base compartilhada, isso elimina a necessidade de rules complexas e mantém um único ponto de entrada auditável para dados e custos.
3. **Todo request ao Google passa antes pelo módulo de custos** (`src/lib/costs`). Sem reserva de cota, sem request. O módulo é a única porta de saída para a API paga.
4. **Enriquecimento é sob demanda, nunca em lote.** Place Details só é chamado quando o usuário abre a ficha de um lead e pede o enriquecimento.
5. **Toda alteração VISUAL passa por raciocínio estendido + o laço de captura de tela.** Mudou pixel na tela (efeito, LED, transição, animação, layout de skin, painel do editor)? Duas coisas são obrigatórias, nesta ordem: (a) o trabalho é feito com **modelo de raciocínio**, porque acabamento visual é decidido por análise de trade-off (aresta, opacidade, distância de transição, custo por quadro), não por autocompletar; e (b) a verificação é o **laço de captura** (`scripts/qa-visual.mjs` + a rota-harness `/interno/demo-qa`), com as imagens de fato ABERTAS e olhadas — nenhum item visual é dado como pronto sem a captura vista, e o commit cita qual arquivo de captura confirma cada item. Teste unitário não julga "aresta dura", "faixa escura atravessando a tela" nem "some de uma vez"; ele serve pra travar a regra DEPOIS que a captura mostrou o problema. Quando um defeito é sutil, a captura vem acompanhada de **medição** (brilho por coluna, matiz médio da diferença, opacidade computada por posição de scroll, relógio das animações) — foi assim que apareceram a faixa vertical do LED dissipado, a colisão do `data-d-anim` e o piso de 0.50 da cobertura, todos invisíveis numa leitura de código. Ver "Verificação da UI".

## Estrutura de pastas

```
scripts/
  qa-visual.mjs                     # ✅ laço de verificação VISUAL: sobe o app, cunha sessão assinada, percorre a matriz efeito×intensidade×tema, LED×nível×tema, modos de cor×fase e a fronteira de seção, salva PNG + folha de contato; `--so=avulsa` compara identidade em branco × preenchida nas 8 skins (ver "Demos avulsas"); `--so=fps` é o PORTÃO: efeito × os 5 modos de cor, celular com CPU 4×, rolando a página — piso de 45 fps por CÉLULA (modo que reprova é desabilitado, não o efeito) + a superfície repintada em Mpx/s ao lado (ver "Verificação da UI")
  qa-editor.mjs                     # ✅ laço de captura do EDITOR (não da rota pública): digita num campo com o efeito ativo e reporta fps do preview + contagem de <style> antes/depois; exige o patch temporário de fake DB documentado no cabeçalho
  qa-diff.mjs                       # ✅ diferença pixel a pixel entre dois PNGs (média/máxima/% acima de 2 níveis) — o "provado pixel a pixel" das rodadas visuais, sem dependência nova
  qa-plataforma.mjs                 # ✅ laço de captura da PLATAFORMA (não das demos): tema × aba em desktop e celular, contraste lido do CSS computado, proporção de matiz do cromo e fps navegando entre as abas com CPU 4× (ver "Sistema de temas da plataforma"); `--so=listas` é o PORTÃO das duas listas longas (/leads e /buscas no celular, dirigindo os controles de verdade): nenhuma linha com altura zero, nada vazando da viewport e a compactação MEDIDA (ver "Compactação de /leads e /buscas")
  qa-perfil-blur.mjs                # ✅ mede num <canvas> o perfil radial de um gradiente recortado e borrado — como a rampa de aura/estilo.ts foi derivada
  qa-titulo.mjs                     # ✅ PORTÃO do TÍTULO HERO, com a hidratação concluída: conta os PREENCHIMENTOS de glifo (dois = título duplicado), compara as quebras de linha da caixa de texto com as da máscara da mídia, prova que o seletor de fontes alcança o título, refaz tudo com ALINHAMENTO/ESCALA/ENTRE-LETRAS trocados POR CÓDIGO (sem remontar) e mede a FAIXA ACIMA do título depois do repique da rolagem contra a mesma faixa sem vídeo — desktop e celular (ver "Título hero: uma caixa de texto, a mídia como máscara" e "O rastro na borda superior")
  capturas-ci.mjs                   # ✅ orquestrador do workflow: move o estado no doc do lead e chama o motor como processo filho (não captura nada por conta própria)
  capturas.mjs                      # ✅ MOTOR DE CAPTURA das demos (prints de prospecção): por âncora marcada × celular/desktop, enquadra a SEÇÃO inteira via `[data-d-secao]`, congela as animações (mesma técnica do qa-visual) e reprova se sobrou cromo fixo por cima do título; `--lead` captura a rota pública, `--skin`/`--skins` o harness; alvo prefixado com `avulsa:` captura uma demo sem lead (ver "Capturas por âncora de seção" e "Demos avulsas")
src/
  proxy.ts                          # ✅ proteção por sessão assinada (Next 16: proxy.ts, ex-middleware)
  app/
    layout.tsx                      # dark fixo (sem alternância clara/escura), fontes Space Grotesk/Inter/JetBrains Mono
    icon.tsx                        # ✅ favicon gerado (ImageResponse) — tema radar
    login/page.tsx                  # ✅ form usuário+senha → POST /api/login, identidade RADAR
    demo/
      fonts/                        # ✅ fontes das skins via next/font (--font-demo-*)
        core.ts                      #    sempre carregadas (default de algum preset da skin)
        registry.ts                  #    resolveExtraFontClassNames: import() dinâmico só da fonte curada escolhida
        dynamic/*.ts                 #    um módulo por fonte curada "sob demanda" (não é default de nenhum preset)
        index.ts                     #    reexporta demoCoreFontsClassName + resolveExtraFontClassNames
      comum.tsx                     # ✅ a parte COMUM das duas rotas públicas: resolverDemo + PaginaDemo + metadados + cor da barra + selo de visita
      [leadId]/page.tsx             # ✅ demo PÚBLICA do lead (só Firestore; 404 sem demo salva); casca fina sobre comum.tsx
      avulsa/[id]/page.tsx          # ✅ demo PÚBLICA AVULSA (sem lead) — gêmea da de cima, lendo /demosAvulsas (ver "Demos avulsas")
      VisitaTracker.tsx              # ✅ beacon de duração/scroll + marcador de dispositivo (ver "Visitas à demo")
      SeloVisitaInterna.tsx          # ✅ selo fixo "Vendo como membro" quando a visita é interna (decisão sempre no servidor)
    demo-preview/page.tsx           # ✅ preview do editor (iframe; estado via postMessage; protegida por senha)
    interno/
      efeitos/page.tsx              # ✅ harness de teste dos efeitos registrados: fundo claro/escuro, slider de intensidade — fora do (app) e do registro de skins, protegida por sessão (default do proxy.ts)
      demo-qa/page.tsx              # ✅ harness de AVALIAÇÃO VISUAL: mesma árvore da rota pública (Skin + efeito + LED) resolvida só por query string, sem Firestore — alvo do scripts/qa-visual.mjs
      capturas/                     # ✅ tela interna de MARCAÇÃO das âncoras de captura: as 8 skins, as seções de cada uma e a prévia do enquadramento (iframe do harness, medido pelo mesmo seletor do motor) — salva em /config, sem deploy
    leads/[id]/demo/escolher/       # ✅ passo de escolha da skin base, ANTES de criar a demo
      page.tsx                      #    wrapper server fino (params.id → client)
      EscolherSkinClient.tsx        #    cards (miniatura + nicho) de todas as skins do registro; pula se já tem demo
    leads/[id]/demo/editar/         # ✅ editor visual da demo (fora do route group (app) — tela cheia)
      page.tsx                      #    wrapper server fino (params.id → client)
      EditorClient.tsx              #    preview ao vivo + painel (estado, salvar, excluir, slot→campo); lê ?skin= no 1º save
      paineis.tsx                   #    abas Conteúdo/Imagens/Tema/Estrutura (drag-and-drop via motion, handle dedicado)
      comprimir.ts                  #    compressão client-side (canvas → WebP ≤1600px) antes do upload
    (app)/                          # route group: páginas autenticadas, com Nav
      layout.tsx                    # ✅ header + bottom nav (Hoje/Painel/Leads/Buscas/Demos/Chat/Config) + Sair
      page.tsx                      # ✅ Dashboard: uso vs teto, custo projetado, métricas, "Metas do time" (admin, só quem tem meta), widget do cron, card "Demos criadas"
      hoje/page.tsx                 # ✅ fila do dia (home pós-login): novos por score, follow-ups, demos paradas, progresso da PRÓPRIA meta de prospecção (se configurada)
      mundo/page.tsx                # ✅ "onde prospectar agora": países em faixa boa NESTE minuto para o nicho escolhido, hora local de cada um (ver seção própria); `?familia=` fixa o nicho (deep link + captura)
      leads/page.tsx                # ✅ lista de leads com filtros + nova busca (com auto-enriquecimento)
      leads/[id]/page.tsx           # ✅ wrapper server (extrai params.id, key={id})
      leads/[id]/LeadDetailClient.tsx # ✅ ficha: enriquecer, WhatsApp, transições de status
      buscas/page.tsx               # ✅ buscas salvas → clique filtra os leads da busca; mostra autor (busca.userId → nome via /api/usuarios/nomes)
      demos/page.tsx                # ✅ todas as demos ativas: skin, datas, link copiável, editar/excluir
      mensagens/page.tsx            # ✅ chat privado entre usuários: conversas, envio, polling leve
      config/page.tsx               # ✅ config completa + gestão de usuários + cotas e metas por integrante (página restrita a admin)
    api/
      login/route.ts                # ✅ POST { nome, senha } → cookie de sessão assinado (+ seed de /usuarios)
      logout/route.ts               # ✅ POST limpa o cookie de sessão
      me/route.ts                   # ✅ GET usuário logado (id, nome, papel) — a UI escopa por papel
      usuarios/route.ts             # ✅ GET lista / POST cria usuário (admin)
      usuarios/[id]/route.ts        # ✅ PATCH nome/papel/ativo/senha/limites (admin; sem DELETE — desativa)
      usuarios/[id]/zerar-dia/route.ts # ✅ POST zera o contador do dia corrente do usuário (admin)
      usuarios/cotas/route.ts       # ✅ GET uso × limite de todos os usuários (admin, tabela do painel)
      usuarios/metas/route.ts       # ✅ GET meta × progresso de prospecção de todos os usuários (admin; mesma fonte da visão consolidada do painel)
      cotas/route.ts                # ✅ GET uso × limite do PRÓPRIO usuário (indicador em /leads e na ficha)
      metas/proprio/route.ts        # ✅ GET/PUT progresso (dia/semana) + minimizada da faixa fixa do PRÓPRIO usuário (self-service, leve)
      config/route.ts               # ✅ GET config (qualquer sessão) / PUT (admin)
      search/route.ts               # ✅ POST busca (geocode + Text Search paginado/qualificado) + registra em /buscas — exige sessão (cota individual)
      geocode/route.ts              # ✅ GET região resolvida ("Buscando em: X"), cache em /geocache
      regioes/route.ts              # ✅ GET índice de mercado da região (geocodifica + gera via IA se ainda não tiver)
      regioes/regenerar/route.ts    # ✅ POST regenera o índice (admin; reaproveita cidade/país já salvos)
      regioes/ajustar/route.ts      # ✅ PATCH indiceAjustado (admin; number seta, null limpa)
      precificacao/slider/route.ts  # ✅ GET/PUT última posição do slider da calculadora (self-service, por usuário)
      preferencias/listas/route.ts  # ✅ GET/PUT preferências das listas longas (/leads e /buscas): grupos dobrados por tela + modo compacto dos leads (self-service, por usuário)
      buscas/route.ts               # ✅ GET buscas salvas
      buscas/[id]/route.ts          # ✅ PATCH cor / mensagem do grupo
      frases/route.ts               # ✅ GET conjuntos de frases por nicho (qualquer sessão) / PUT um conjunto (admin)
      frases/avancar/route.ts       # ✅ POST gira a rotação de um nicho — o único caminho que mexe no contador
      leads/route.ts                # ✅ GET lista de leads com filtros
      leads/[id]/route.ts           # ✅ GET ficha / PATCH status·notas·favorito·descartado
      leads/[id]/enrich/route.ts    # ✅ POST enriquecimento (Place Details Enterprise + Pro/horários JUNTO) — exige sessão (cota individual)
      leads/[id]/horarios/route.ts  # ✅ POST busca só o horário (SKU detailsProHours) — botão "buscar horários" — exige sessão
      leads/[id]/capturas/route.ts  # ✅ POST enfileira a geração de capturas do lead e dispara o workflow (sessão; token do GitHub só em env)
      capturas/route.ts             # ✅ GET estado por ids (acompanhamento) / POST lote a partir de um grupo
      leads/[id]/demo/route.ts      # ✅ PUT configuração da demo / DELETE exclui demo + imagens
      leads/[id]/demo/imagens/route.ts # ✅ POST upload de imagem de slot / DELETE volta ao placeholder
      leads/[id]/demo/videos/route.ts  # ✅ POST upload de vídeo-no-título / DELETE volta ao fallback (opt-in por skin)
      leads/[id]/demo/sugestao/route.ts # ✅ POST sugestão de IA da demo (Gemini; SKU aiGeneration)
      leads/[id]/demo/traduzir/route.ts # ✅ POST traduz o texto ATUAL do editor (4ª ação do botão de IA; Gemini, SKU aiGeneration, sem retry)
      ia/route.ts                   # ✅ GET disponibilidade da IA (GEMINI_API_KEY configurada?)
      ia/nivel/route.ts             # ✅ GET/PUT último nível de intervenção da IA (self-service, por usuário)
      tema/route.ts                 # ✅ GET/PUT tema da PLATAFORMA do PRÓPRIO usuário (self-service; reescreve o cookie-espelho)
      mensagens/route.ts            # ✅ GET resumo/conversa (escopado à sessão) / POST envia texto
      mensagens/nao-lidas/route.ts  # ✅ GET total de não-lidas (badge do menu, polling leve)
      hoje/route.ts                 # ✅ GET fila do dia (delta por usuário; carimba ultimaVisitaEm)
      mundo/route.ts                # ✅ GET países em faixa boa agora para uma família — DERIVADA (config + leads + /regioes cacheado), nenhuma chamada paga
      cron/route.ts                 # ✅ GET gatilho do Vercel Cron (Bearer CRON_SECRET, fora da sessão)
      cron/status/route.ts          # ✅ GET última execução do cron + recorrentes ligadas (widget)
      usage/route.ts                # ✅ GET uso do mês + custo projetado
      metrics/route.ts              # ✅ GET métricas de prospecção
      __tests__/                    # ✅ testes das rotas (fake Firestore + fetch mockado)
  lib/
    firestore-like.ts               # ✅ interface estrutural mínima do Firestore (UsageDb/AppDb)
    errors.ts                       # ✅ erros de domínio (validação, 404, transição)
    http.ts                         # ✅ formato de erro padrão + mapa erro→HTTP status (401/403 incluídos)
    auth.ts                         # ✅ token de sessão ASSINADO (HMAC c/ APP_PASSWORD): userId.papel.versao.sig
    tema.ts                         # ✅ temas da PLATAFORMA: TEMAS_APP, metadados do seletor e o contrato do cookie-espelho `radar_tema`
    idioma.ts                       # ✅ mapa país (pt-BR)→idioma BCP-47 + IDIOMAS_SUPORTADOS (ver "Idioma da IA na demo")
    usuarios/                       # ✅ multiusuário simples
      types.ts                      #    Usuario (papel admin|membro, ativo, senhaHash, versão de sessão)
      senha.ts                      #    hash PBKDF2 via Web Crypto (sem dependência nova)
      repo.ts                       #    CRUD + seed (migra APP_PASSWORD → admin) + guarda-corpo do último admin
      session.ts                    #    usuarioDaRequest (atribuição/escopo) + requireAdmin (403)
      metas.ts                      # ✅ getProgressoMetaUsuario: progresso dia/semana da meta de prospecção (lê o contador `buscas` de usage_users via getUsoUsuario)
    api-client.ts                   # ✅ fetch tipado do cliente (ApiError, um método por rota)
    format.ts                       # ✅ formatBRL/USD/percent/int/dateTime (pt-BR)
    wa.ts                           # ✅ aplicarMarcadores/linkWhatsApp/buildWhatsAppLink ({nome}/{demo}/{penetracao})
    site-proprio.ts                 # ✅ classifica websiteUri: rede social/agregador ≠ site próprio
    sku-labels.ts                   # ✅ rótulos pt-BR dos SKUs (dashboard e config)
    geo/
      geocode.ts                    # ✅ geocodeRegion() com cache permanente em /geocache
    regioes/                        # ✅ índice de mercado por cidade/região (ver "Precificação regional por IA")
      types.ts                      #    RegiaoIndice (slug = regiaoCacheKey reaproveitado do geocoding)
      ia.ts                         #    parseCidadePais + prompt/schema/validação + gerarIndiceRegiao (1 chamada, sem retry)
      repo.ts                       #    get/salvar/setIndiceAjustado em /regioes/{slug} — cache PERMANENTE
      index.ts
      __tests__/
    precificacao/                   # ✅ calculadora de precificação (card "Precificação")
      calc.ts                       #    funções puras: índice efetivo, preço sugerido, multiplicador por nicho, câmbio
      __tests__/
    costs/                          # ✅ ver seções "Módulo de custos" e "Cotas individuais por usuário"
      skus.ts                       # SKUs, field masks, cotas grátis, preços default
      period.ts                     # chave do período mensal (YYYY-MM, UTC) — teto global
      periodoUsuario.ts             # ✅ chaves de data em America/Sao_Paulo (dia/semana/mês) — cota individual
      errors.ts                     # QuotaExceededError, UserQuotaExceededError
      usage.ts                      # reserveQuota / getUsage (transação Firestore; admin bypass + cota individual)
      userQuota.ts                  # ✅ checarCotaUsuario/getUsoUsuario/zerarCotaDia (usage_users/{userId}/dias/{data})
      cost.ts                       # projeção de custo (funções puras)
      index.ts
      __tests__/
    config/                         # ✅ config efetiva: defaults + /config/app, validação de PUT
    firebase/
      admin.ts                      # ✅ init lazy do firebase-admin (env vars)
      storage.ts                    # ✅ adaptador do Firebase Storage p/ DemoStorage (bucket via env)
    ai/                             # ✅ IA na Forja (ver seção própria)
      gemini.ts                     # cliente do Gemini (flash atual, GEMINI_API_KEY só server-side)
      nivel.ts                      # ✅ NivelIA (toque-leve/equilibrado/completo) — sem dependências, usado por usuarios/
      sugestao.ts                   # prompt + schema estrito + validação (por nível) + retry 1x (via reserveQuota)
      index.ts
      __tests__/
    mensagens/                      # ✅ mensagens privadas entre usuários
      types.ts                      #    Mensagem { deUserId, paraUserId, texto, criadaEm, lidaEm? }
      repo.ts                       #    enviar/conversa/resumo/não-lidas — leitura SEMPRE escopada à sessão
      index.ts
    places/
      client.ts                     # ✅ searchText() / placeDetails(), sempre via reserveQuota
    leads/                          # ✅ repositório de leads (upsert, filtros, transições)
      types.ts
      repo.ts
      metrics.ts                    # ✅ contatosHoje/contatosSemana/taxaResposta
      score.ts                      # ✅ score de priorização por regras (ordenação + badge)
      horarios.ts                   # ✅ estadoAtual/melhorMomento: funções puras sobre lead.horarios (fuso do lead)
      janelaContato.ts              # ✅ faixas de nível (bom/razoável/ruim) por família e por dia da semana + defaults e validação (ver "Barra do dia")
      barraDoDia.ts                 # ✅ funções PURAS: faixas ∩ horário de funcionamento → trechos da barra, marcador de agora, próximo bom
      hoje.ts                       # ✅ montarFilaDoDia: seleção pura das 3 seções de /hoje
      penetracao.ts                 # ✅ calcularPenetracaoSite/argumentoPenetracao/argumentoForte (ver "Penetração de site")
    prospeccao/                     # ✅ a tela "onde prospectar agora" (ver seção própria)
      paises.ts                     #    países candidatos de /config: modelo, os 15 defaults (fuso/idioma DERIVADOS dos mapas que já existem), bandeira do ISO e validação
      mundo.ts                      #    funções PURAS: faixa boa agora por país, próxima faixa, índice do país (média de /regioes), leads não contatados e a ordenação da tela
    frases/                         # ✅ frases de prospecção por SKIN (ver seção própria)
      types.ts                      #    FrasesProspeccao (3 slots + indice), chaveada pelo skinId do registro
      rotacao.ts                    #    funções PURAS: frases efetivas, frase da vez, slot da vez, próximo índice
      repo.ts                       #    /frasesProspeccao/{skinId}: salvar textos e avançar contador, escritas disjuntas
      listagem.ts                   #    uma linha por skin do registro, com o conjunto salvo por cima (tela de admin)
      migracao.ts                   #    aproveita o texto das entradas antigas (chave por nicho digitado) nas skins
      traducao.ts                   #    funções PURAS da tradução gravada por idioma (aplicada/desatualizada/ausente)
      custoTraducao.ts              #    projeção de chamadas e custo mostrada antes de confirmar a tradução
      resolver.ts                   #    precedência skin da demo → grupo → global (usada pela ficha e por /hoje)
    buscas/                         # ✅ registro das buscas executadas
      types.ts                      #    + recorrente/qualificada/quantidade, BuscaExecucao e penetracao (cache)
      repo.ts                       #    + listBuscasRecorrentes (ordem determinística), registrarExecucao e salvarPenetracao
      cron.ts                       # ✅ executarBuscasRecorrentes: pipeline diário + resumo em /cron/ultima
      penetracao.ts                 # ✅ calcularPenetracaoGrupo/recalcularPenetracao/penetracaoParaLead (ver "Penetração de site")
    demos/                          # ✅ Forja de Demos (ver seção própria)
      types.ts                      # DemoData, Theme, SkinDefinition (+secoes), LeadDemo (+tema), TemaPatch
      montar.ts                     # montarDemoData: exemplo ← lead ← edições
      idioma.ts                     # ✅ idiomaPadraoDoLead/idiomaEfetivoDemo (ver "Idioma da IA na demo")
      patch.ts                      # montarPatch: diff mínimo que o editor salva (inverso de aplicarPatch)
      registry.ts                   # registro de skins (a lista canônica)
      validate.ts                   # validação do PUT /api/leads/[id]/demo (dados + tema + estrutura)
      fontes.ts                     # lista curada de fontes do editor (ids → CSS vars de next/font)
      tema.ts                       # aplicarTema (preset ← TemaPatch), TEMA_RAIOS, ink por contraste
      estrutura.ts                  # ordem efetiva/visibilidade de seções (skin + editor usam a mesma)
      imagens.ts                    # upload/remoção no Storage sobre interface mínima (DemoStorage)
      videos.ts                     # vídeo-no-título: upload/remoção (mesma DemoStorage, prefixo "video-", sem placeholder)
      efeitos/                      # ✅ registro de efeitos visuais (camada decorativa opcional por cima de uma skin)
        types.ts                    #    EfeitoProps (intensidade 0-3, cores do tema, pausado) + EfeitoDefinition (metadado puro)
        registry.ts                 #    EFEITOS: id/nome/nichosRecomendados + intensidadePadrao(efeito, nicho) — sem o componente (ver dynamicComponents.ts)
        useEfeitoAtivo.ts           #    hook client: pausa por IntersectionObserver + visibilitychange + prop pausado + reduced-motion
        dpr.ts                      #    devicePixelRatioClamped: limita a 2 qualquer rasterização em canvas
        dynamicComponents.tsx       #    getEfeitoComponenteDinamico(id) + EfeitoDinamico (client, resolve E renderiza — o único jeito seguro de chamar isto a partir de um Server Component, ver "Causa raiz do 500")
        corComputada.ts             #    ✅ leitura da cor da camada por quem pinta em CANVAS (getComputedStyle().color → RGB) — compartilhado por aura e ondas
        aura/Aura.tsx                #    ✅ duas esferas de fumaça em CANVAS de 256² esticado (transparência pré-calculada, sem blend); ponteiro no desktop, scroll+deriva no celular; só translate3d anima
        aura/estilo.ts               #    ✅ perfil radial MEDIDO do antigo cone+blur (por intensidade) + a rampa já com o alfa final pro canvas — testável sem DOM
        grao/Grao.tsx                #    textura de ruído via canvas (dpr clamped), gerada uma vez — sem loop de JS
        gradiente/Gradiente.tsx     #    ✅ dois radiais derivando devagar (transform); rampa de 7 stops no lugar do antigo filter: blur(80px) (ver "Nenhum filter num efeito que anima transform")
        gradiente/estilo.ts         #    ✅ estilo puro (opacidade por intensidade, animationName/PlayState, filter SEMPRE "none") — testável sem DOM
        particulas/Particulas.tsx   #    ✅ pontos subindo em loop; migrado do antigo Theme.fundoEfeito "particulas" por skin
        particulas/estilo.ts        #    ✅ contagem/opacidade por intensidade + estilo do ponto — testável sem DOM
        filotaxia/Filotaxia.tsx      #    ✅ pontos nascendo do centro pelo ângulo dourado (137,5°), cada um radial até transparente; nuvem sob máscara radial
        filotaxia/estilo.ts          #    ✅ posições em vmin (espiral não vira elipse) + opacidade por idade (teto 6%) + raio/suavidade contínuos — testável sem DOM
        ondas/Ondas.tsx              #    ✅ anéis concêntricos do centro à borda, em CANVAS (nunca SVG): banda preenchida em camadas, cor lida do `color` computado, redesenho a 30 Hz
        ondas/estilo.ts              #    ✅ ritmo (período/fase por anel), as duas rampas do percurso (espessura e opacidade), ondulação do raio e o perfil da seção — testável sem DOM
        faiscas/Faiscas.tsx          #    ✅ reaproveita particulas/estilo.ts (posições) com gravidade/vida curta/blend aditivo (mix-blend-mode screen)
        faiscas/estilo.ts            #    ✅ reinterpreta pontosParticulas como brasas de vida curta (tamanho/núcleo contínuos) + a justificativa da exceção ao teto de 6%
        varredura-de-luz/VarreduraDeLuz.tsx # ✅ brilho diagonal atravessando a viewport periodicamente (translateX), branco+destaque via color-mix + screen
        varredura-de-luz/estilo.ts   #    ✅ largura/opacidade (teto 6%)/duração do ciclo por intensidade — testável sem DOM
        camada.ts                    #    ✅ PURO: cores da camada (modo de cor ← auraCores ← paleta) — a MESMA função na rota pública, no preview e no harness
        EfeitoCamada.tsx             #    ✅ client: envolve o efeito com o <style> do modo de cor e o --d-efeito-fade por seção; div sem position/opacity (stacking context mudaria o blend)
        __tests__/registry.test.ts  #    contrato: campos obrigatórios, ids únicos, intensidade 0 não renderiza nada, raiz consumindo --d-efeito-fade, intensidadePadrao por nicho
        __tests__/EfeitoCamada.remontagem.test.tsx # ✅ regressão: 10 montar/desmontar da camada e do LED não deixam <style> órfão (máx 1 por bloco, 0 depois de desmontar)
        __tests__/camada.test.ts    #    precedência modo de cor × auraCores × paleta, e queda pro tema quando o modo não resolve
        __tests__/fita.test.ts      #    afilamento das pontas, teto de espessura, ondulação assimétrica e determinismo do gerador de fita
      animacao/
        SecaoMarcada.tsx           # ✅ marcador data-d-secao/data-d-secao-anim em volta de cada seção (elo entre estrutura e camada decorativa)
        cobertura.ts               # ✅ PURO: cobertura animada da viewport (núcleo cosseno na banda central) — a transição do efeito/LED
        medirCobertura.ts          # ✅ leitura no DOM + hook (scroll/resize throttled por rAF, escreve direto no DOM)
        __tests__/cobertura.test.ts #    monotonia, suavidade, distância de meia viewport, região neutra e o piso que travava em 0.50
      barra/                         # ✅ cor da BARRA DO NAVEGADOR na demo pública (ver "Barra do navegador na demo pública")
        srgb.ts                     #    PURO: lê hex/rgb(), mistura em LUZ LINEAR (média de bytes afunda no meio da transição)
        fundo.ts                    #    PURO: qual cor uma seção pinta — a superfície tem que COBRIR a caixa da seção
        foco.ts                     #    PURO: média ponderada das seções na banda de foco (mesmo núcleo de animacao/cobertura.ts)
        modos.ts                    #    PURO: automatico/fundo/destaque/personalizada → a cor do generateViewport e a amostra do editor
        plano.ts                    #    PURO: CSS do background-color do <body> (o caminho do Safari 26+ e do overscroll)
        medir.ts                    #    leitura no DOM: cor por seção (mount/resize) + faixas por quadro de rolagem
        BarraNavegador.tsx          #    client: escreve na meta theme-color e no plano da página; só monta no modo automático
        __tests__/{srgb,fundo,foco,modos,plano}.test.ts + BarraNavegador.test.tsx
      cores/
        hsl.ts                     # ✅ PURO: hex → HSL e deslocamento de matiz (modos iridescente/arco-íris)
        modos.ts                   # ✅ PURO: os 5 modos de cor → cores + @property/@keyframes (ver "Modos de cor")
        __tests__/{hsl,modos}.test.ts #  conversão/limites e os quadros gerados por modo (rotação, ±16°, volta de 360°, queda pro tema)
      led/                           # ✅ registro de ESTILOS de borda LED (camada de micro-interação Theme.led/ledEstilo)
        types.ts                    #    LedEstiloDefinition (id/nome/nichosRecomendados) — metadado puro
        registry.ts                 #    LED_ESTILOS: barra/dissipado/cantos/moldura + LED_ESTILO_PADRAO ("barra") + getLedEstilo(id)
        LedEdges.tsx                 #    ✅ componente ÚNICO (client) usado pelas 8 skins — todo o CSS dos 4 estilos vive aqui, sem import dinâmico por estilo
        __tests__/registry.test.ts  #    contrato do registro (ids únicos, nichos não vazios)
        __tests__/LedEdges.test.tsx #    DOM por estilo (2 barras / 4 cantos / 4 lados), fallback pro estilo padrão, pulso de clique
      titulo/                        # ✅ VÍDEO-NO-TÍTULO: mecanismo compartilhado (opt-in por skin via SkinDefinition.videoSlots)
        Wordmark.tsx                #    ✅ componente ÚNICO (client): UMA caixa de texto, a mídia é o preenchimento dela; a skin reexporta numa linha, como LedEdges
        MascaraDoTexto.tsx          #    ✅ máscara DERIVADA das linhas da caixa (nunca uma 2ª cópia do texto) + useMedidaDoTexto, a medição VIVA
        videoEmCanvas.ts            #    ✅ o vídeo pintado num <canvas> do tamanho da caixa — <video> ganha camada de composição própria e escapa da máscara (ver "O rastro na borda superior")
        useNivelMidia.ts            #    ✅ vídeo → imagem → nada (conexão lenta, prefers-reduced-motion, vídeo que falhou)
    testing/
      fake-firestore.ts             # ✅ fake em memória com semântica de transação + paridade de path de coleção
      fake-firestore.test.ts        # ✅ paridade de segmentos do path (.collection() ímpar, como o SDK real)
      fake-storage.ts               # ✅ fake em memória do DemoStorage (rotas de imagens)
  components/                       # ✅ UI compartilhada
    Button.tsx                      # variantes + estado de loading
    Nav.tsx                         # bottom nav + logout (client)
    StatusBadge.tsx                 # badge ordinal do status do lead (cor + forma + marcador)
    UsageMeter.tsx                  # meter de uso vs teto (accent/warning/critical), anima ao montar
    CotaIndicador.tsx               # ✅ "usado/limite" por janela (cota individual) + cotaEsgotada() p/ desabilitar botão
    MetaFaixa.tsx                    # ✅ faixa fixa (sticky top-0) de progresso da meta no topo do app inteiro; minimizável, estado persistido por usuário (ver "Metas de prospecção por integrante")
    MetaProgresso.tsx               # ✅ barra de progresso de UMA meta (dia OU semana) — polaridade oposta ao UsageMeter (mais uso é melhor, nunca "crítico"); só renderiza quando a janela tem `meta`
    PrecificacaoCard.tsx            # ✅ card "Precificação": slider + cálculo ao vivo + edição de índice (admin) — ver seção própria
    LeadCard.tsx                    # card da lista: estrela, notas inline, dots de cor, destaque sem site, badge "argumento forte"
    BarraDoDia.tsx                  # ✅ a barra do dia da ficha (cor + ALTURA + legenda + descrição) e a prévia das faixas em /config
    PageTransition.tsx              # fade-in de página por troca de rota (client)
    RadarSweep.tsx                  # decoração de sweep de radar (CSS puro)
    demos/                          # ✅ skins da Forja de Demos (um pacote por skin)
      barbearia/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        themes.ts                   # default + presets de tema
        exemplo.ts                  # DemoData de exemplo (base da ficha)
        interactive/                # ✅ subcomponentes "use client" (animações/interação)
          SectionReveal.tsx          # entrada de seção por scroll, intensidade = theme.animacao
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
          LedEdges.tsx               # ✅ reexporta o componente único (src/lib/demos/led/LedEdges.tsx)
      tatuagem/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        GothicLetters.tsx           # letras góticas gigantes atrás do conteúdo (chrome fixo)
        Wordmark.tsx                # ✅ reexporta o componente único (src/lib/demos/titulo/Wordmark.tsx)
        secoes.ts                   # contrato SkinSecaoDef[]
        themes.ts                   # default + presets de tema
        exemplo.ts                  # DemoData de exemplo (base da ficha)
        interactive/                # ✅ subcomponentes "use client" (animações/interação)
          SectionReveal.tsx          # entrada de seção por scroll, intensidade = theme.animacao
          FadeUp.tsx                 # stagger granular item a item (fiel ao <FadeUp> original)
          Parallax.tsx               # parallax sutil de imagem (fiel ao <Parallax> original)
          ScrollHeader.tsx           # header que reage ao scroll
          CustomCursor.tsx           # cursor de máquina de tatuagem com spring (motion)
          IntroExperience.tsx        # orquestra cursor + intro + sessionStorage
          IntroLoader.tsx            # splash letra-a-letra fiel ao original
          LedEdges.tsx               # ✅ reexporta o componente único (src/lib/demos/led/LedEdges.tsx)
      lancheria/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        secoes.ts                   # contrato SkinSecaoDef[]
        themes.ts                   # default + presets de tema
        exemplo.ts                  # DemoData de exemplo (base da ficha)
        interactive/                # ✅ subcomponentes "use client" (animações/interação)
          SectionReveal.tsx          # entrada de seção por scroll, intensidade = theme.animacao
          Header.tsx                  # header que reage ao scroll + CTA de pedido
          CategoryNav.tsx             # pills sticky de categoria (cardápio/bebidas/acompanhamentos)
          BurgerCard.tsx              # card do cardápio: lente de hover revela o "prato vazio" (motion clipPath)
          CompactSection.tsx          # lista horizontal compacta (bebidas/acompanhamentos)
          DecorativeBlob.tsx          # blob decorativo entre seções, parallax sutil no scroll
          OrderCta.tsx                # ✅ CTA de pedido neutro: WhatsApp (data.whatsapp) ou toast "disponível na versão completa"
          IntroExperience.tsx        # splash opcional (Theme.intro; o material bruto não tinha uma) + sessionStorage
          LedEdges.tsx               # ✅ reexporta o componente único (src/lib/demos/led/LedEdges.tsx)
      barbearia2/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        secoes.ts                   # contrato SkinSecaoDef[]
        themes.ts                   # default + presets de tema
        exemplo.ts                  # DemoData de exemplo (base da ficha)
        interactive/                # ✅ subcomponentes "use client" (animações/interação)
          SectionReveal.tsx          # entrada de seção por scroll, intensidade = theme.animacao
          FadeUp.tsx                  # stagger granular item a item (manifesto, ritual, hero)
          RevealLine.tsx              # linha divisória que abre da esquerda (scaleX), antes de cada etiqueta
          DragGallery.tsx             # galeria com arraste por mouse + momentum ao soltar (pointer events puros)
          IntroExperience.tsx        # splash opcional (Theme.intro; o material bruto não tinha uma) + sessionStorage
          LedEdges.tsx               # ✅ reexporta o componente único (src/lib/demos/led/LedEdges.tsx)
      tatuagem2/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        secoes.ts                   # contrato SkinSecaoDef[]
        themes.ts                   # default + presets de tema
        exemplo.ts                  # DemoData de exemplo (base da ficha)
        interactive/                # ✅ subcomponentes "use client" (animações/interação)
          SectionReveal.tsx          # entrada de seção por scroll, intensidade = theme.animacao
          FadeUp.tsx                 # stagger granular item a item
          Parallax.tsx               # parallax sutil de imagem/blob (fiel ao <Parallax> original)
          Nav.tsx                    # header translúcido fixo + ponto de pigmento da seção + CTA com gradiente no hover
          CustomCursor.tsx           # ponto sólido mix-blend-multiply, cor = pigmento da seção atual
          PigmentTracker.tsx         # observa a seção em foco e escreve a cor dela em --d-pigment (nav dot + cursor)
          SplashTitle.tsx            # título com hover letra-a-letra + última palavra em itálico na cor de acento
          ManifestoReveal.tsx        # manifesto que "acende" palavra a palavra conforme o progresso do scroll
          ScrollGallery.tsx          # portfólio em trilha horizontal pinada (scroll vertical → translateX); scroll nativo em touch
          LineDraw.tsx               # traço SVG que se desenha ao entrar no viewport (rabiscos de artista, linha do processo)
          FaqAccordion.tsx           # acordeão com um item aberto por vez (primeiro já aberto, fiel ao original)
          IntroExperience.tsx        # splash opcional (Theme.intro; o material bruto não tinha uma) + sessionStorage
          LedEdges.tsx               # ✅ reexporta o componente único (src/lib/demos/led/LedEdges.tsx)
      imobiliaria/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        secoes.ts                   # contrato SkinSecaoDef[]
        themes.ts                   # default + presets de tema
        exemplo.ts                  # DemoData de exemplo (base da ficha)
        propriedade.ts              # parseImovel (convenção "Selo • especificações") + formatarPreco ("Sob consulta")
        interactive/                # ✅ subcomponentes "use client" (animações/interação)
          SectionReveal.tsx          # entrada de seção por scroll, intensidade = theme.animacao (+ className p/ item de grid)
          Reveal.tsx                  # stagger fino fiel ao data-reveal original (fade+translateY, atraso em ms)
          Nav.tsx                     # nav fixa que troca claro/escuro conforme a seção sob ela (data-nav-theme)
          ParallaxHero.tsx            # parallax sutil da imagem do hero no scroll, gateado por theme.animacao
          ManifestoReveal.tsx        # manifesto que "acende" palavra a palavra no scroll (roda mesmo com animacao "nenhuma", fiel ao original)
          Carousel.tsx                # vitrine de bairros arrastável por pointer events puros
          CustomCursor.tsx           # ponto na cor de destaque que cresce sobre card de imóvel, gateado por theme.animacao
          ContatoForm.tsx             # captação de e-mail com submit fake (sem request de verdade, fiel ao original)
          IntroExperience.tsx        # splash opcional (Theme.intro; o material bruto não tinha uma) + sessionStorage
          LedEdges.tsx               # ✅ reexporta o componente único (src/lib/demos/led/LedEdges.tsx)
      multimarcas/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        secoes.ts                   # contrato SkinSecaoDef[]
        themes.ts                   # default + presets de tema
        exemplo.ts                  # DemoData de exemplo (base da ficha)
        interactive/                # ✅ subcomponentes "use client" (animações/interação)
          logic.ts                    # funções puras (parse de número formatado, wa.me, categorias) — testadas isoladamente
          SectionReveal.tsx          # entrada de seção por scroll, intensidade = theme.animacao
          LedEdges.tsx               # ✅ reexporta o componente único (src/lib/demos/led/LedEdges.tsx)
          introContext.tsx           # sinaliza pro Hero quando o preloader terminou (revelação escalonada do título)
          Preloader.tsx              # velocímetro que sobe -120°→120° com mola simples, fiel ao original
          IntroExperience.tsx        # orquestra cursor + preloader + sessionStorage
          CustomCursor.tsx           # ponto + anel com spring, cresce sobre link/botão/card de veículo
          Nav.tsx                    # nav fixa (fundo ao rolar) + burger fullscreen; links a partir das seções visíveis
          Hero.tsx                   # título revelado palavra a palavra + velocímetro decorativo reage à velocidade do scroll
          ProgressBar.tsx            # barra de progresso de leitura no topo
          ThemeColorSync.tsx         # sincroniza <meta theme-color> com a seção mais próxima do topo
          CarFilterGrid.tsx          # pills de filtro (pílula ativa desliza via layoutId) + grid com reflow animado
          CarCard.tsx                # card do veículo: imagem do slot, chips, painel "detalhes", preço com contagem
          StatCounter.tsx            # contador do zero ao alvo no viewport (prefixo/sufixo na cor de destaque)
          Simulador.tsx              # calculadora de financiamento com odômetro de dígitos
          Marquee.tsx                # faixa de marcas em loop, pausa no hover/touch
          TestimonialCarousel.tsx    # carrossel de depoimentos arrastável + autoplay
          WhatsAppFloat.tsx          # botão flutuante que aparece após o hero, pulsa a cada 8s
          FooterEgg.tsx              # easter egg: 3 cliques na marca do rodapé
      petshop/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        secoes.ts                   # contrato SkinSecaoDef[]
        themes.ts                   # default + presets de tema
        exemplo.ts                  # DemoData de exemplo (base da ficha)
        interactive/                # ✅ subcomponentes "use client" (animações/interação)
          SectionReveal.tsx          # entrada de seção por scroll, intensidade = theme.animacao
          Header.tsx                 # header translúcido fixo ao rolar + CTA de agendamento
          IntroExperience.tsx        # splash "au au / miau miau" fiel ao original + sessionStorage
          OrderCta.tsx               # CTA de agendamento neutro: WhatsApp (data.whatsapp) ou toast "disponível na versão completa"
          Counter.tsx                # contagem animada ao entrar no viewport (números da seção "Números")
          contador.ts                # parser puro do texto do contador (prefixo/alvo/casas decimais/sufixo) — testado
          LedEdges.tsx               # ✅ reexporta o componente único (src/lib/demos/led/LedEdges.tsx)
public/
  demos/barbearia/*.svg             # ✅ placeholders locais por slot de imagem + thumb.svg (passo de escolha de skin)
  demos/tatuagem/*.svg              # ✅ placeholders locais por slot de imagem + thumb.svg (passo de escolha de skin)
  demos/lancheria/*.svg             # ✅ placeholders locais por slot de imagem + thumb.svg (passo de escolha de skin)
  demos/barbearia2/*.svg            # ✅ placeholders locais por slot de imagem + thumb.svg (passo de escolha de skin)
  demos/tatuagem2/*.svg             # ✅ placeholders locais por slot de imagem + thumb.svg (passo de escolha de skin)
  demos/imobiliaria/*.svg           # ✅ placeholders locais por slot de imagem + thumb.svg (passo de escolha de skin)
  demos/multimarcas/*.svg           # ✅ placeholders locais por slot de imagem + thumb.svg (passo de escolha de skin)
  demos/petshop/*.svg               # ✅ placeholders locais por slot de imagem + thumb.svg (passo de escolha de skin)
```

Tudo na árvore acima está implementado e testado (testes automatizados para tudo em `lib/` e `app/api/`; as páginas em `app/(app)/` e `app/login/` foram verificadas navegando o app real — ver "Verificação da UI" abaixo — e não têm suíte de componente própria, já que é UI fina sobre rotas já testadas).

## Modelo de dados (Firestore)

### `/usuarios/{id}` — um doc por usuário

```jsonc
{
  "id": "admin",                    // = ID do doc: "admin"/"membro-1"/"membro-2" no seed, UUID nos criados depois
  "nome": "admin",                  // nome de login (único, comparado sem caixa)
  "papel": "admin",                 // "admin" | "membro"
  "ativo": true,
  "senhaHash": "pbkdf2:100000:<salt>:<hash>", // ausente = senha não definida (não loga)
  "sessao": 0,                      // versão de sessão: redefinir senha/desativar/trocar papel incrementa
  "ultimaVisitaEm": "<ISO 8601>",   // última carga de /hoje DESTE usuário (o delta de "novos" é por usuário)
  "limites": {                      // ✅ opcional: cotas individuais (ver "Cotas individuais por usuário")
    "buscasDia": 30, "buscasSemana": 150, "buscasMes": 500,
    "enriquecimentosDia": 20, "enriquecimentosSemana": 100, "enriquecimentosMes": 300
  },
  "metas": {                        // ✅ opcional: meta de prospecção (ver "Metas de prospecção por integrante")
    "prospeccoesDia": 5, "prospeccoesSemana": 25
  },
  "ultimoPrecoBaseSlider": 2500,     // ✅ opcional: última posição do slider da calculadora de precificação (self-service)
  "ultimoNivelIA": "equilibrado",    // ✅ opcional: último nível de intervenção da IA na Forja (self-service, ver "IA na Forja")
  "tema": "escuro",                  // ✅ opcional: tema da PLATAFORMA deste usuário (self-service, ver "Sistema de temas da plataforma")
  "preferenciasListas": {            // ✅ opcional: compactação das listas longas (self-service, ver "Compactação de /leads e /buscas")
    "leadsCompacto": true,           //    lista de leads em modo linha (uma linha por lead)
    "gruposFechados": { "leads": ["<buscaId>"], "buscas": ["mes:2026-08", "<buscaId>"] }
  },
  "criadoEm": "<ISO 8601>",
  "atualizadoEm": "<ISO 8601>"
}
```

- **Seed/migração da senha única**: na primeira tentativa de login com a coleção vazia, o app cria `admin` (senha = `APP_PASSWORD` atual — quem já usava continua entrando igual) + `membro-1`/`membro-2` **sem senha** (o admin define em /config antes de eles conseguirem logar). Depois do seed, o doc é a fonte da verdade: trocar a senha do admin em /config faz a `APP_PASSWORD` valer só como segredo de assinatura.
- **Sem DELETE**: desativar preserva a atribuição histórica (buscas/demos/contatos apontam para o id). Guarda-corpo: o último admin ativo não pode ser desativado nem rebaixado.
- Hash de senha: PBKDF2 (Web Crypto, 100k iterações, salt aleatório) — sem dependência nova, roda em Node e Edge.
- `limites`: cada campo é opcional e independente (ausente = sem limite naquela janela); editável só via `PATCH /api/usuarios/[id]` (admin) — nunca pelo próprio usuário, nenhum caminho client-side escreve nele. Não revoga sessão (não é credencial).
- `preferenciasListas`: preferência de UI **self-service** (o próprio usuário grava, via `PUT /api/preferencias/listas`) — como `tema`, `ultimoNivelIA` e `metaFaixaMinimizada`, não mexe em `atualizadoEm` nem em `sessao`: compactar uma lista não é edição administrativa e não derruba sessão nenhuma. Ver "Compactação de /leads e /buscas".
- `metas`: mesma semântica de edição de `limites` (só admin, `PATCH /api/usuarios/[id]`, não revoga sessão) mas indicador puro — nunca bloqueia uma busca. Ver "Metas de prospecção por integrante".

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
  "followUpDias": 4,                            // /hoje: contactado sem resposta há mais de N dias vira follow-up
  "maxBuscasRecorrentes": 3,                    // teto de buscas recorrentes simultâneas (cron diário)
  "caps": {                                     // teto mensal de requests por SKU
    "textSearch": 5000,
    "textSearchEnterprise": 1000,
    "detailsEssentials": 10000,
    "detailsEnterprise": 1000,
    "detailsProHours": 5000
  },
  "precos": {                                   // override dos defaults de skus.ts
    "usdPor1000": { "textSearch": 32, "textSearchEnterprise": 35, "detailsEssentials": 5, "detailsEnterprise": 20, "detailsProHours": 17 },
    "cotaGratis": { "textSearch": 5000, "textSearchEnterprise": 1000, "detailsEssentials": 10000, "detailsEnterprise": 1000, "detailsProHours": 5000 },
    "usdBrl": 5.50                              // câmbio para custo projetado em R$
  },
  "precificacao": {                             // ✅ calculadora de precificação regional (ver seção própria)
    "multiplicadoresNicho": { "dentista": 1.4 }, // chave-valor livre; nicho ausente → multiplicador 1.0
    "pisoPrecificacao": 900,                    // preço sugerido nunca abaixo disto (R$)
    "fatorMinimoIndice": 0.7,                   // índice efetivo nunca abaixo disto (regiões caras sobem sem teto)
    "presets": [                                // atalhos que reposicionam o slider (700–10.000, passo 100)
      { "nome": "Vitrine", "valorBRL": 1000 },
      { "nome": "Presença", "valorBRL": 2000 },
      { "nome": "Autoridade", "valorBRL": 3500 },
      { "nome": "Sistema", "valorBRL": 5000 }
    ]
  },
  "capturas": {                                 // ✅ âncoras de captura por skin (ver "Capturas por âncora de seção")
    "ancoras": {                                // skinId → até 3 ids de SEÇÃO, na ordem em que as capturas saem
      "barbearia-editorial": ["hero", "servicos", "depoimentos"]
    }
  },
  "janelasContato": {                           // ✅ faixas de nível por família e por dia (ver "Barra do dia")
    "barbearia": {
      "dias": {                                 // 0=domingo…6=sábado; dia ausente/vazio = DESMARCADO
        "2": [                                  // terça
          { "inicio": { "hora": 9, "minuto": 0 },  "fim": { "hora": 11, "minuto": 30 }, "nivel": "bom" },
          { "inicio": { "hora": 16, "minuto": 30 }, "fim": { "hora": 20, "minuto": 0 },  "nivel": "ruim" }
        ]
      }
    }
  },
  "paisesProspeccao": [                         // ✅ países candidatos da tela /mundo (ver "Onde prospectar agora")
    { "codigo": "PT", "nome": "Portugal", "utcOffsetMinutos": 0, "idiomas": ["pt-PT"], "indice": 1.6 },
    { "codigo": "CH", "nome": "Suíça", "utcOffsetMinutos": 60, "idiomas": ["de-CH", "fr-CH", "it-CH"], "indice": 3.5 }
  ],
  "atualizadoEm": "<timestamp>"
}
```

Observações:
- Os **filtros "tem site/telefone" são filtros de listagem**, não de busca. O filtro de site usa a classificação **`siteProprio`** (rede social/agregador conta como SEM site próprio — ver "Classificação de site próprio"); vale para leads enriquecidos E para leads da **busca qualificada**. Telefone vale após enriquecer ou pela qualificada. Leads sem informação aparecem como "desconhecido" e ficam fora de com/sem.
- `caps` é o teto de segurança (hard stop). `precos.cotaGratis` é informativo (dashboard e projeção de custo). Por default o teto = cota grátis, ou seja, o app nunca gasta um centavo sem o usuário aumentar o teto conscientemente.
- `janelasContato` é editado em /config, com merge **por família** (mesma ideia de `capturas.ancoras`). Só o que é opinião fica gravado: minuto aberto que nenhuma faixa cobre vale `razoavel`. Família gravada no formato ANTIGO (a janela ideal/alternativa que a barra do dia substituiu) é descartada na leitura em favor do padrão novo — ver "Barra do dia por família".
- `paisesProspeccao` é editado em /config e **substituído por inteiro** no merge (como `precificacao.presets`, e ao contrário do merge por chave de `janelasContato`/`capturas.ancoras`): sem substituir não haveria como REMOVER um país — a entrada removida voltaria do default a cada save. País repetido é 400, porque a tela mostraria a linha e a contagem de leads em dobro.
- `capturas.ancoras` é marcado em `/interno/capturas`, não em /config: o merge é **por skin** (marcar uma não apaga as outras), lista vazia significa "não capturar esta skin", e skin/seção fora do registro são rejeitadas com 400. Skin ausente do doc cai no padrão do código.
- **Migração de SKU (jul/2026)**: `detailsPro` foi renomeado para `detailsEnterprise` (a tabela do Google classifica telefone/site/rating como tier Enterprise). Docs antigos com chaves `detailsPro` em `caps`/`precos` são lidos via alias e regravados com o nome novo; PUTs novos com o nome antigo são rejeitados (400).

### `/frasesProspeccao/{skinId}` — um doc por SKIN do registro

**O ID do documento é o id da skin** (`barbearia2-sul`, `petshop-focinho-feliz` — os ids de `lib/demos/registry.ts`), não o texto do nicho digitado na busca. A chave anterior era o nicho normalizado, e texto livre não é chave: "Barbearia", "barbearia old school" e "barbería" viravam três conjuntos distintos, e a tela enchia de duplicata e erro de digitação. Id de skin é um slug do próprio código — não precisa de normalização nenhuma, e o conjunto de valores possíveis é fechado pelo registro.

```jsonc
{
  "frases": [                                   // SEMPRE 3 slots; slot vazio é legítimo e não entra na rotação
    "Oi {nome}, montei uma prévia do site de vocês: {demo}",
    "Olá {nome}! Fiz uma demonstração rápida: {demo}",
    ""
  ],
  "indice": 1,                                  // contador da rotação — ÚNICO por skin, compartilhado pelo time
  "traducoes": {                                // derivado e opcional; as frases acima são SEMPRE em português
    "es-AR": {                                  // idioma BCP-47 COM variante regional (nunca só "es")
      "frases": ["Hola {nome}, ...", "", ""],   // MESMOS slots das frases (slot vazio continua vazio)
      "origem": ["Oi {nome}, ...", "", ""],     // o português que gerou cada slot — muda o de cima, a tradução vira desatualizada
      "em": "<timestamp>"
    }
  },
  "atualizadoEm": "<timestamp>"
}
```

Observações:
- **O `skinId` não é gravado como campo**: ele é o id do doc, e duplicá-lo dentro só criaria a chance de os dois divergirem. `getConjunto`/`listConjuntos` preenchem `FrasesProspeccao.skinId` a partir do id lido.
- As frases usam os **mesmos marcadores** da mensagem global e da mensagem por grupo (`{nome}`, `{demo}`, `{penetracao}`) — não existe marcador exclusivo das frases.
- **As três escritas são disjuntas, todas com `merge`**: o PUT do admin grava `frases`/`atualizadoEm` e nunca toca em `indice`; o POST de avanço grava `indice`/`atualizadoEm` e nunca toca em `frases`; a tradução grava só `traducoes`. O mapa `traducoes` é lido-mesclado-gravado inteiro em vez de depender do merge profundo do Firestore em mapas aninhados — assim o fake dos testes e o banco real se comportam igual. Editar um texto não reinicia a rotação, e girar a rotação não desfaz uma edição salva no mesmo segundo.
- **Guarda-corpo**: `skinId` fora do registro é rejeitado no PUT e no avanço (400) — é o que impede a coleção de voltar a acumular doc por texto livre.
- Skin sem doc, ou com doc de três slots vazios, **não participa da precedência** (ver "Frases de prospecção por skin"). O avanço de uma skin sem doc devolve 0 e **não cria doc**: um clique não cadastra nada.
- **Docs legados** (chaveados pelo texto do nicho, incluindo o antigo `__genericas__`) continuam na coleção até a migração rodar, mas não casam com nenhum id de skin e por isso não viram linha na tela nem entram em precedência nenhuma.

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
    "enriquecidoEm": "<timestamp>",
    "enriquecidoPor": "<userId>"                // quem enriqueceu (ausente em docs antigos)
  },
  "horarios": {                                 // só existe após buscar (SKU detailsProHours, contador PRÓPRIO)
    "faixas": [                                 // dias/faixas estruturados, hora LOCAL do lugar (0=domingo…6=sábado)
      { "diaAbre": 1, "horaAbre": 9, "minAbre": 0, "diaFecha": 1, "horaFecha": 18, "minFecha": 0 }
    ],
    "utcOffsetMinutes": -180,                   // deslocamento UTC do lugar — sem ele não dá pra calcular "agora"
    "obtidoEm": "<timestamp>"
  },
  "demo": {                                     // Forja de Demos (opcional; ver seção própria)
    "skinId": "barbearia-editorial",            // do registro de skins
    "themeId": "creme",                         // preset da skin (inválido → default)
    "dados": {                                  // overrides parciais de DemoData (diff mínimo do editor)
      "slogan": "Tradição desde 1998.",
      "ordemSecoes": ["servicos", "equipe"],    // ordem das seções NÃO-fixas (drag-and-drop)
      "secoes": { "ritual": { "oculta": true }, "filosofia": { "alinhamento": "centro", "animacaoEntrada": "deslizar-esquerda" } },
      "imagens": { "hero": "https://storage.googleapis.com/<bucket>/demos/<leadId>/hero-<ts>.webp" }
    },
    "tema": {                                   // ajustes por cima do preset (opcional)
      "fonteDisplay": "playfair",               // id da lista curada (lib/demos/fontes.ts)
      "fonteCorpo": "lora",
      "destaque": "#8c4a2b",                    // cor primária; ink recalculado por contraste
      "raio": "8px",                            // um de TEMA_RAIOS
      "densidade": "arejada",
      "animacao": "marcante",                   // um de ANIMACOES: nenhuma | sutil | marcante
      "intro": false,                           // toggle da splash de abertura do template
      "hover": "brilho",                        // estilo do hover de cards/botões: lift | zoom | brilho
      "clique": "pressao",                      // animação de clique: nenhum | pressao | pulso
      "fundoEfeito": "particulas",               // efeito sutil de fundo: "nenhum" ou id do registro de efeitos (efeitos/registry.ts)
      "barraCor": { "modo": "automatico" },      // cor da barra do navegador; ausente = automatico (acompanha a seção)
      "fundoEfeitoIntensidade": 2,               // opcional (0-3); ausente = default do nicho recomendado do efeito
      "auraCores": { "primaria": "#ff3ec8" }     // opcional; só efeito quando fundoEfeito é "aura" — ver "Cor da aura"
    },
    "criadoEm": "<timestamp>",                  // 1º save; preservado nas edições seguintes (ver saveDemo)
    "criadoPor": "<userId>",                    // usuário do 1º save; preservado nas edições (métricas por usuário)
    "atualizadoEm": "<timestamp>"
  },
  "contato": {                                  // carimbos das transições de status
    "primeiroContatoEm": "<timestamp>",         // status → contactado
    "primeiroContatoPor": "<userId>",           // quem contactou (métricas por usuário; ausente em docs antigos)
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

### Penetração de site por nicho e cidade

100% sobre dados já salvos — **nenhum request novo ao Google**. `src/lib/leads/penetracao.ts` tem a agregação pura: `calcularPenetracaoSite(leads)` classifica cada lead pelo `siteProprio` já existente (com site próprio / só rede social — `siteProprio: false` com `temSite: true` / sem nada — `siteProprio: false` com `temSite` falso) e soma. Leads com `siteProprio` indefinido (nunca enriquecidos nem de busca qualificada) ficam de fora do "total conhecido" e voltam à parte em `desconhecidos`. Com menos de `PENETRACAO_BASE_MINIMA` (5) leads conhecidos, `percentuais` fica `undefined` — a UI mostra a contagem, nunca um percentual sobre base pequena demais pra significar algo.

`src/lib/buscas/penetracao.ts` faz a parte com Firestore: **"neste nicho nesta cidade" é o grupo lógico de TODAS as buscas com o mesmo nicho+região** (normalizado: minúsculas, espaços colapsados), não só a busca corrente — `calcularPenetracaoGrupo` reúne os leads de todas elas. `recalcularPenetracao(db, buscaId)` recalcula e cacheia o agregado no campo `penetracao` do doc da busca (ver `/buscas/{id}`); é chamado **toda vez que a busca roda de novo** — em `POST /api/search` (logo após criar o doc) e no cron (`executarBusca`, logo após `registrarExecucao`). Cada busca doc reflete o agregado de quando ELA rodou por último — buscas irmãs (mesmo nicho+região) que não rodaram desde então ficam com o cache defasado até rodarem de novo; é uma leitura, não uma fonte de verdade em tempo real.

Onde aparece:
- **Grupo de busca** (`/leads?buscaId=`): card "Penetração de site" com `buscaAtual?.penetracao` — "Neste nicho nesta cidade: X% têm site próprio · Y% só rede social · Z% sem presença (base: N estabelecimentos)"; base pequena mostra só a contagem.
- **Ficha do lead sem site próprio** (`siteProprio === false`): `argumentoPenetracao(nicho, regiao, penetracao, nome)` monta a linha pronta ("X% dos estabelecimentos de {nicho} em {regiao} que mapeamos já têm site — a {nome} está entre os que ainda não têm.") com botão copiar; usa "estabelecimentos de {nicho}" (em vez de flexionar o nicho em gênero/plural) porque o texto do nicho é livre e imprevisível. `penetracaoParaLead(lead, buscas)` escolhe, entre as buscas em que o lead apareceu (mais recente primeiro), a primeira que já tem `penetracao` cacheada.
- **Variável `{penetracao}`** na mensagem padrão do WhatsApp (`src/lib/wa.ts`, `buildWhatsAppLink`): mesma linha de argumento, substituída só quando calculada (ausência não apaga a variável em silêncio) — mesmo padrão de `{nome}`/`{demo}`.
- **Badge "argumento forte"** (`argumentoForte(penetracao)`, `percentuais.comSiteProprio > 60`) em `/hoje` e no `LeadCard` da lista de leads — discreto, não bloqueia nada, só sinaliza que o argumento é forte.

O campo **`capturas`** do lead guarda a última geração de prints (estado, `execucaoId`, `pedidoEm`/`iniciadoEm`/`geradoEm`, `runUrl`, `erro` e as `imagens` com âncora/tela/URL/dimensões) — ver "Disparo pela plataforma" na Forja de Demos.

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
  "recorrente": true,                           // opcional: o cron diário re-executa esta busca (ausente/false = só manual)
  "qualificada": true,                          // opcional: parâmetros da execução original, reusados pelo cron
  "quantidade": 20,                             //   ("mesmo pipeline" — ausentes em docs antigos = defaults da rota)
  "criadaEm": "<ISO 8601>",
  "totalCriados": 12,                           // leads novos que esta busca criou (o cron SOMA os deltas aqui)
  "totalExistentes": 8,                         // leads que já estavam na base
  "userId": "admin",                            // quem executou (ausente em docs pré-multiusuário)
  "penetracao": {                               // ✅ opcional: penetração de site do GRUPO nicho+região (ver seção própria)
    "total": 14, "comSiteProprio": 9, "soRedeSocial": 3, "semNada": 2, "desconhecidos": 4,
    "percentuais": { "comSiteProprio": 64, "soRedeSocial": 21, "semNada": 14 } // ausente se total < 5
  }
}
```

O doc é gravado **depois** do upsert dos leads (para ter os totais). Se a busca falhar por completo (teto/erro na 1ª página), nenhum doc de busca é criado; se parar no meio da paginação, o doc registra o parcial.

### `/buscas/{id}/execucoes/{uuid}` — resumo de cada re-execução do cron

Subcoleção da busca recorrente, um doc por rodada do cron: `{ em, novos, existentes }`. O `registrarExecucao` grava o doc E soma o delta aos totais do doc da busca (os leads novos do cron entram no MESMO grupo — o `buscaId` deles recebe o id da busca recorrente). Buscas manuais não têm execuções: o histórico só existe para o que o cron fez.

### `/cron/ultima` — resumo da última rodada do cron (doc único, sobrescrito)

```jsonc
{
  "em": "<ISO 8601>",                 // início da rodada
  "concluidaEm": "<ISO 8601>",
  "recorrentes": 3,                   // buscas marcadas como recorrentes (antes do teto)
  "buscas": [                         // uma entrada por busca executada, na ordem da fila
    { "buscaId": "<uuid>", "nome": "Implantes Sarandi", "novos": 2, "existentes": 5,
      "erro": "Google Places respondeu 500: …" }  // só quando o Google falhou NESTA busca
  ],
  "totalNovos": 2,
  "totalExistentes": 5,
  "interrompida": {                   // presente se a COTA estourou no meio: a fila parou aqui
    "buscaId": "<uuid>", "nome": "…", "motivo": "Teto mensal atingido para \"textSearch\" …"
  }
}
```

Alimenta o widget "Buscas recorrentes" do dashboard via `GET /api/cron/status`. Só a última rodada interessa no painel — o histórico por busca fica nas subcoleções `execucoes`.

Sobre a **cor**: paleta fixa de 10 (validada contra a superfície escura: banda de luminância, croma e contraste ≥3:1). Com 10 hues a separação CVD de todos os pares é matematicamente inviável — por isso a cor é sempre reforço redundante: o nome da busca acompanha o badge em texto. Docs antigos sem `cor` ganham fallback estável na leitura.

### `/mensagens/{uuid}` — uma mensagem privada por doc

```jsonc
{
  "deUserId": "admin",              // remetente (id de /usuarios)
  "paraUserId": "membro-1",         // destinatário
  "texto": "Fechei o lead da barbearia!", // texto simples, ≤2000
  "criadaEm": "<ISO 8601>",
  "lidaEm": "<ISO 8601>"            // ausente = ainda não lida pelo destinatário
}
```

- **Privacidade por construção**: toda leitura no repositório (`src/lib/mensagens/repo.ts`) recebe o userId da SESSÃO e só devolve mensagens em que ele é remetente ou destinatário. **Admin não tem acesso especial** — papel administra usuários, não lê conversa alheia; pedir a conversa de terceiros devolve vazio.
- `lidaEm` é carimbada quando o destinatário abre a conversa (o `GET ?com=` marca as recebidas) — e o polling da conversa aberta mantém isso atualizado.
- Docs malformados são ignorados na leitura (mesma postura do módulo de custos: dado sujo nunca quebra listagem).

### `/geocache/{regiaoNormalizada}` — cache permanente de geocoding

ID = região normalizada (minúsculas, espaços colapsados, URL-encoded). Doc: `{ regiao, endereco, location, viewport, criadoEm }`. Cada região digitada só custa **1 request de geocoding na vida** — o viewport cacheado alimenta o `locationRestriction` de todas as buscas seguintes. Sem expiração: limites geográficos de cidade não mudam em escala relevante para prospecção.

### `/regioes/{slug}` — índice de mercado por cidade/região (ver "Precificação regional por IA")

**O `slug` é a MESMA chave normalizada do `/geocache`** (`regiaoCacheKey`, reaproveitada de `src/lib/geo/geocode.ts`) — uma região só é geocodificada uma vez na vida e o índice de precificação usa exatamente essa identidade, sem geocodificar de novo.

```jsonc
{
  "slug": "zurique",                            // = ID do doc; regiaoCacheKey(regiaoTexto)
  "regiaoTexto": "Zurique",                     // texto original (mesmo valor salvo no geocache)
  "cidade": "Zürich",                           // cidade ESPECÍFICA (extraída do endereço do geocoding, não o país)
  "pais": "Suíça",
  "indice": 3.5,                                // índice RELATIVO gerado por IA (cidade média do interior do Brasil = 1.0)
  "indiceAjustado": 2.8,                        // ✅ opcional: edição manual do admin — quando presente, VENCE `indice`
  "moedaLocal": "CHF",
  "cambioAproxBRL": 6.1,                        // ✅ opcional: estimativa (1 unidade da moeda local ≈ N reais)
  "faixaMercadoLocal": "300–800 CHF",           // faixa típica local de um site simples
  "justificativa": "Zurique tem alto custo de vida e forte poder aquisitivo.",
  "confianca": "alta",                          // "alta" | "media" | "baixa"
  "geradoEm": "<ISO 8601>"
}
```

- **Cache PERMANENTE**: gerado sob demanda na primeira vez que a calculadora abre para aquela região (`GET /api/regioes?regiao=`) e nunca expira — só regenera por clique explícito do admin (`POST /api/regioes/regenerar`), que reaproveita `cidade`/`pais`/`regiaoTexto` já salvos (não geocodifica de novo).
- **`indiceAjustado` é preservado na regeneração**: regenerar só atualiza a base sugerida pela IA; a edição manual do admin (`PATCH /api/regioes/ajustar`, só na UI da região) é uma decisão separada, limpa apenas com `indiceAjustado: null`.
- Docs sem índice gerado ainda simplesmente não existem — não há doc "vazio" de placeholder.

### `/usage/{YYYY-MM}` — um doc por mês (contadores de custo)

```jsonc
{
  "textSearch": 42,
  "textSearchEnterprise": 3,
  "detailsEssentials": 0,
  "detailsEnterprise": 17,
  "porUsuario": {                               // quebra por usuário (mesmos SKUs); atribuição, NÃO cota individual
    "admin": { "textSearch": 30, "detailsEnterprise": 17 },
    "<uuid>": { "textSearch": 12 }
  },
  "atualizadoEm": "<ISO 8601>"
}
```

- Período em **UTC** (`2026-07`). O reset da cota grátis do Google segue o fuso da conta de billing; algumas horas de deriva são irrelevantes para um teto de segurança, e UTC evita bugs de horário de verão.
- Incremento é **transacional** (ler → verificar teto → incrementar) — ver "Módulo de custos". Quando a rota identifica a sessão, a mesma transação incrementa a quebra `porUsuario` (o objeto inteiro é reescrito dentro da transação). **O teto continua um só, agregado** — a quebra é atribuição de uso, não cota por usuário.
- **Migração**: docs de meses antigos podem ter o campo `detailsPro`; a leitura usa o valor legado enquanto `detailsEnterprise` não existir no doc — assim que a primeira reserva nova grava o nome atual, o legado é ignorado.

### `/usage_users/{userId}/dias/{YYYY-MM-DD}` — cota individual, um doc por usuário por dia

```jsonc
{ "buscas": 3, "enriquecimentos": 1, "atualizadoEm": "<ISO 8601>" }
```

- Chave de data em **America/Sao_Paulo** (não UTC) — ver "Cotas individuais por usuário". Semana/mês são somas puras dos docs diários dentro da janela; não existe doc de semana/mês próprio, então "zerar dia" (zera só o doc de hoje) já reduz a soma de quebra.
- Existe (é escrito) sempre que a sessão é identificável, mesmo sem nenhum limite configurado — é o que permite ao painel admin mostrar "usado" mesmo antes de qualquer limite existir. Nunca escrito para reservas do admin (ele não tem cota individual).
- **O path tem 3 segmentos (`usage_users` / `{userId}` / `dias`), nunca 2**: toda coleção do Firestore precisa de um número ÍMPAR de segmentos (`collection`, `collection/doc/collection`, ...) — `usage_users/{userId}` sozinho tem 2 (par) e o SDK real recusa com "must point to a collection... does not contain an odd number of components". Esse exato bug chegou a produção (a seção "Cotas por usuário" de `/config` quebrava com 500) porque o `FakeFirestore` dos testes não validava a paridade do path — corrigido dos dois lados: o path ganhou o terceiro segmento (`dias`) e o fake agora recusa paths de coleção com número par de segmentos, igual ao SDK real (`src/lib/testing/fake-firestore.test.ts`).

### Métricas de prospecção

Sem coleção própria no MVP: são **queries sobre `/leads`** usando os timestamps de `contato` (ex.: contatos hoje = `contato.primeiroContatoEm >= startOfDay`; taxa de resposta = leads com `respondeuEm` ÷ leads com `primeiroContatoEm`). `demosCriadas` (card "Demos criadas" do dashboard) conta leads com o campo `demo` presente na mesma passada. Na escala de uso pessoal (centenas de leads) isso custa nada; se um dia doer, materializamos agregados.

**Escopo por papel**: membro recebe as métricas escopadas aos carimbos DELE (`primeiroContatoPor`/`demo.criadoPor`); admin recebe o agregado E um rollup `porUsuario` (buscas via `/buscas.userId`, demos, contatos — com nome do usuário). Ações antigas sem carimbo aparecem só no agregado.

## Contrato das rotas (route handlers)

Formato de erro padrão em todas as rotas:

```jsonc
{ "error": { "code": "quota_exceeded", "message": "…", /* campos extras por code */ } }
```

| Rota | Método | Entrada | Saída | Google / SKU |
|---|---|---|---|---|
| `/api/login` | POST | `{ nome?, senha }` (nome default "admin") | `204` + cookie de sessão assinado · `401 invalid_credentials` · `503 config_error` | — |
| `/api/me` | GET | — | `200 { usuario }` (sem hash) · `401` | — |
| `/api/usuarios` | GET | — (admin) | `200 { usuarios[] }` · `401` · `403 forbidden` | — |
| `/api/usuarios` | POST | `{ nome, papel?, senha? }` (admin) | `200 { usuario }` · `400` · `401` · `403` | — |
| `/api/usuarios/[id]` | PATCH | `{ nome?, papel?, ativo?, senha?, limites?, metas? }` (≥1 campo, admin) | `200 { usuario }` · `400` · `401` · `403` · `404` | — |
| `/api/usuarios/[id]/zerar-dia` | POST | — (admin) | `204` (zera o contador do dia corrente do usuário) · `401` · `403` · `404` | — |
| `/api/usuarios/cotas` | GET | — (admin) | `200 { usuarios: [{ id, nome, papel, ativo, limites, buscas, enriquecimentos }] }` · `401` · `403` | — |
| `/api/usuarios/metas` | GET | — (admin) | `200 { usuarios: [{ id, nome, papel, ativo, metas, prospeccao: { dia, semana } }] }` · `401` · `403` | — |
| `/api/cotas` | GET | — (qualquer sessão) | `200 { buscas, enriquecimentos }` (uso × limite do PRÓPRIO usuário; admin sempre sem limite) · `401` | — |
| `/api/config` | GET | — | `200 { config }` (defaults se doc não existe) | — |
| `/api/config` | PUT | config parcial ou completa (admin) | `200 { config }` · `400 validation_error` · `401` · `403` | — |
| `/api/search` | POST | `{ nicho?, subNicho?, regiao?, nome?, quantidade? (1–40), qualificada? }` (nicho/regiao default: config; exige sessão identificável) | `200 { criados, existentes, leads[], busca, paginas, regiaoResolvida, aviso? }` · `400` · `401` · `429 quota_exceeded` · `429 user_quota_exceeded` · `502 places_error` | Geocoding (com cache) + Text Search · **geocoding** + **textSearch** ou **textSearchEnterprise** |
| `/api/geocode` | GET | query: `regiao` (default: config) | `200 { regiao, endereco, location, viewport, cached }` · `400` · `429` · `502` | Geocoding · **geocoding** (só em cache miss) |
| `/api/regioes` | GET | query: `regiao` (default: config) | `200 { regiao, cached }` · `400` · `429 quota_exceeded` · `502 places_error` · `502 ai_error` · `503 ai_unavailable` | Geocoding (cache) + Gemini na 1ª vez · **geocoding** + **aiGeneration** (só em cache miss) |
| `/api/regioes/regenerar` | POST | `{ regiao }` (admin) | `200 { regiao }` · `400` · `401` · `403` · `404` (sem índice gerado ainda) · `429 quota_exceeded` · `502 ai_error` · `503 ai_unavailable` | Gemini generateContent · **aiGeneration** (reaproveita cidade/país já salvos, não geocodifica de novo) |
| `/api/regioes/ajustar` | PATCH | `{ regiao, indiceAjustado }` (number seta, `null` limpa; admin) | `200 { regiao }` · `400` · `401` · `403` · `404` | — |
| `/api/precificacao/slider` | GET | — (exige sessão identificável) | `200 { precoBase }` (`null` = ainda não mexeu) · `401` | — |
| `/api/precificacao/slider` | PUT | `{ precoBase }` (inteiro 700–10.000) | `200 { precoBase }` · `400` · `401` | — |
| `/api/preferencias/listas` | GET | — (exige sessão identificável) | `200 { preferencias: { leadsCompacto, gruposFechados: { leads[], buscas[] } } }` (doc ausente/sujo cai no padrão) · `401` | — |
| `/api/preferencias/listas` | PUT | `{ preferencias }` (o objeto INTEIRO, não patch; normalizado no servidor: chave inválida cai, teto de 200 chaves por tela) | `200 { preferencias }` · `400` · `401` | — |
| `/api/buscas` | GET | — | `200 { buscas[] }` (mais recentes primeiro) | — |
| `/api/buscas/[id]` | PATCH | `{ cor? (da paleta), mensagemPadrao? (≤1000, "" limpa), recorrente? }` (≥1 campo; ligar recorrente respeita o teto `maxBuscasRecorrentes`) | `200 { busca }` · `400` · `404` | — |
| `/api/frases` | GET | — (qualquer sessão) | `200 { conjuntos[] }` — UMA entrada por skin do registro (vazia inclusive), com `skinNome`/`nicho` resolvidos · `401` | — |
| `/api/frases` | PUT | `{ skinId, frases[] }` (skin do registro; ≤3 frases de ≤1000 caracteres; admin) | `200 { conjunto }` · `400 validation_error` (inclui `skinId` fora do registro) · `401` · `403` | — |
| `/api/frases/avancar` | POST | `{ skinId }` (qualquer sessão) | `200 { indice }` (skin sem conjunto salvo → `0`, sem gravar) · `400` · `401` | — |
| `/api/frases/traduzir` | POST | `{ leadId }` (qualquer sessão) | `200 { conjunto, idioma }` — traduz as frases da skin da demo do lead para o idioma DELE (SKU `aiTraducao`) · `400` (lead do Brasil, sem demo ou skin sem frase) · `404` · `429 quota_exceeded` · `429 user_quota_exceeded` (cota individual `geracoesIA`) · `502 ai_error` · `503 ai_unavailable` | Gemini (1 chamada, até 2 com retry) |
| `/api/frases/migrar` | GET | — (admin) | `200 { legados, relatorio }` — prévia da migração das entradas antigas, sem escrever nada · `401` · `403` | — |
| `/api/frases/migrar` | POST | — (admin) | `200 { relatorio }` — executa; apaga só o legado aproveitado · `401` · `403` | — |
| `/api/frases/migrar` | DELETE | — (admin) | `200 { apagadas }` — descarta as entradas antigas restantes · `401` · `403` | — |
| `/api/hoje` | GET | — (exige sessão identificável) | `200 { novos[], followUps[], demosParadas[], novosDesde, followUpDias, mensagemPadrao, metaProspeccao: { dia, semana }, buscas[] }` · `401` | — |
| `/api/mundo` | GET | query: `familia` (chave de `janelasContato`; ausente/desconhecida → a primeira) | `200 { familia, familias[], agora, paises: [{ codigo, nome, idiomas, horaLocal, faixa, indice: { indice, fonte, cidades }, totalLeads, leads[] }], emBreve? }` | — (**derivada**: nenhuma) |
| `/api/cron` | GET | header `Authorization: Bearer ${CRON_SECRET}` (fora da sessão — exceção no proxy) | `200 { execucao }` · `401` · `503 config_error` (sem CRON_SECRET) | mesmo pipeline de `/api/search`, por busca recorrente |
| `/api/cron/status` | GET | — | `200 { ultima, recorrentes }` | — |
| `/api/leads` | GET | query: `status`, `temSite`, `temTelefone`, `buscaId`, `favorito` | `200 { leads[] }` · `400` | — |
| `/api/leads/[id]` | GET | — | `200 { lead }` · `404` | — |
| `/api/leads/[id]` | PATCH | `{ status?, notas? (≤500), favorito?, descartado? }` (≥1 campo) | `200 { lead }` · `400` · `404` · `409 invalid_transition` | — |
| `/api/leads/[id]/enrich` | POST | — (exige sessão identificável) | `200 { lead }` · `401` · `404` · `429 quota_exceeded` · `429 user_quota_exceeded` · `502 places_error` | Place Details · **detailsEnterprise** + **detailsProHours** (horário, chamado junto — falha nele não derruba o enriquecimento; nunca conta pra cota individual) |
| `/api/leads/[id]/horarios` | POST | — (exige sessão identificável) | `200 { lead }` · `401` · `404` · `429 quota_exceeded` · `502 places_error` | Place Details · **detailsProHours** (só o horário — botão "buscar horários" de leads já enriquecidos; nunca conta pra cota individual) |
| `/api/leads/[id]/demo` | PUT | `{ skinId, themeId, dados?, tema? }` | `200 { lead }` · `400` · `404` | — |
| `/api/leads/[id]/demo` | DELETE | — | `200 { lead }` (idempotente; apaga demo + imagens do Storage) · `404` | — |
| `/api/buscas/[id]/demos` | DELETE | — (admin) | `200 { apagadas, busca }` (idempotente; apaga demo + imagens de TODO lead do grupo que tem uma) · `401` · `403` · `404` | — |
| `/api/demos-avulsas` | GET | — (exige sessão) | `200 { avulsas[] }` (self-heal do token de envio na leitura) · `401` | — |
| `/api/demos-avulsas` | POST | identidade (`nome` obrigatório, `pais?`, `cidade?`, `endereco?`, `telefone?`, `whatsapp?`, `horarios?`, `instagram?`) + config (`skinId`, `themeId`, `dados?`, `tema?`) | `201 { avulsa }` · `400` (nome ausente, chave desconhecida, skin/preset inválidos, conteúdo inválido) · `401` | — |
| `/api/demos-avulsas/[id]` | GET | — (exige sessão) | `200 { avulsa }` · `401` · `404` | — |
| `/api/demos-avulsas/[id]` | PATCH | `{ pais }` (vazio apaga) | `200 { avulsa }` · `400` · `401` · `404` | — |
| `/api/demos-avulsas/[id]` | DELETE | — (exige sessão) | `200 { ok }` (apaga o doc INTEIRO + imagens no Storage) · `401` · `404` | — |
| `/api/demos-avulsas/[id]/demo` | PUT | `{ skinId, themeId, dados?, tema?, idioma? }` (mesma validação do PUT do lead) | `200 { avulsa }` · `400` · `401` · `404` | — |
| `/api/demos-avulsas/[id]/demo/imagens` | POST/DELETE | igual à rota de imagens do lead | `200 { slot, url }` / `200 { avulsa }` · `400` · `401` · `404` | — |
| `/api/demos-avulsas/[id]/demo/videos` | POST/DELETE | igual à rota de vídeos do lead | `200 { slot, url }` / `200 { avulsa }` · `400` · `401` · `404` | — |
| `/api/demos-avulsas/[id]/demo/traduzir` | POST | `{ skinId, idioma, dados }` | `200 { traducao, idioma }` · `400` · `401` · `404` · `429` · `502` · `503` | Gemini · **aiGeneration** (1 chamada) |
| `/api/demos-avulsas/[id]/capturas/arquivo` | GET | `?tela=&ancora=&versao=` | `200` (PNG, `Content-Disposition`) · `400` · `401` · `404` | — |
| `/api/leads/[id]/demo/imagens` | POST | multipart `slot` + `arquivo` (+`skinId?`) | `200 { slot, url }` · `400` (formato/tamanho/slot) · `404` | — |
| `/api/leads/[id]/demo/imagens` | DELETE | `{ slot }` | `200 { lead }` (apaga arquivos do slot + override salvo) · `400` · `404` | — |
| `/api/leads/[id]/demo/videos` | POST | multipart `slot` + `arquivo` (+`skinId?`) | `200 { slot, url }` · `400` (formato/tamanho/slot fora de `videoSlots`) · `404` | — |
| `/api/leads/[id]/demo/videos` | DELETE | `{ slot, skinId? }` | `200 { lead }` (apaga arquivos do slot + override salvo) · `400` · `404` | — |
| `/api/ia` | GET | — | `200 { disponivel, modelo }` (nunca expõe a chave) | — |
| `/api/ia/nivel` | GET | — (exige sessão) | `200 { nivel }` (default `"equilibrado"`) · `401` | — |
| `/api/ia/nivel` | PUT | `{ nivel }` (`toque-leve`\|`equilibrado`\|`completo`) | `200 { nivel }` · `400` · `401` | — |
| `/api/leads/[id]/demo/sugestao` | POST | `{ skinId, nivel? }` (`nivel` default `"equilibrado"`) | `200 { sugestao }` · `400` · `404` · `429 quota_exceeded` · `429 user_quota_exceeded` (cota individual `geracoesIA`) · `502 ai_error` · `503 ai_unavailable` | Gemini generateContent · **aiGeneration** (1 por tentativa; retry de resposta inválida = 2) |
| `/api/mensagens` | GET | query opcional `com` | sem `com`: `200 { usuarios[], conversas[], totalNaoLidas }` · com `com`: `200 { mensagens[] }` (marca recebidas como lidas) · `401` | — |
| `/api/mensagens` | POST | `{ paraUserId, texto (≤2000) }` | `200 { mensagem }` · `400` · `401` · `404` (destinatário) | — |
| `/api/mensagens/nao-lidas` | GET | — | `200 { total }` · `401` | — |
| `/api/usage` | GET | — | `200 { period, usage, caps, cotaGratis, custoProjetado, porUsuario? }` — membro: `usage` = SÓ o dele; admin: agregado + `porUsuario[]` com nomes | — |
| `/api/metrics` | GET | — | `200 { contatosHoje, contatosSemana, taxaResposta, demosCriadas, porUsuario? }` — membro: escopado a ele; admin: agregado + `porUsuario[]` (buscas/demos/contatos) | — |
| `/api/logout` | POST | — | `204` (limpa o cookie de sessão) | — |

Todas as rotas do contrato estão implementadas e testadas.

Semântica fixa:
- **Atribuição de usuário**: as rotas de ação-chave (`/api/search`, `/api/leads/[id]/enrich`, PATCH de status "contactado", PUT da demo) identificam a sessão via `usuarioDaRequest` e carimbam o `userId` (busca, `enriquecidoPor`, `primeiroContatoPor`, `criadoPor`) e a quebra `porUsuario` de cada reserva de cota. A identificação é *best-effort* dentro da rota (o proxy é quem bloqueia anônimos): sessão irreconhecível → a ação funciona sem carimbo, nunca quebra. **Exceção**: `/api/search`, `/api/leads/[id]/enrich` e `/api/leads/[id]/horarios` exigem sessão identificável (401 sem ela) — a cota individual (ver "Cotas individuais por usuário") não existe sem saber quem é o usuário.
- **`429 quota_exceeded`**: corpo `{ error: { code: "quota_exceeded", sku, used, cap, period, message } }`. Emitido **antes** de qualquer chamada ao Google (a reserva de cota falhou). Nenhum custo foi incorrido. Nunca se aplica ao admin.
- **`429 user_quota_exceeded`**: corpo `{ error: { code: "user_quota_exceeded", tipo, janela, used, limite, resetaEm, message } }` — limite INDIVIDUAL (dia/semana/mês de buscas ou enriquecimentos) do usuário logado, também emitido antes de qualquer chamada ao Google. Nunca se aplica ao admin.
- **`502 places_error`**: o Google respondeu erro. A cota **já foi consumida** (reservamos antes de chamar) — decisão deliberada: superestimar uso é seguro, subestimar não.
- `/api/search` faz upsert em `/leads` com `status: "novo"` para novos e reporta `existentes` para os que já estavam na base. A query enviada ao Google é **`"{nicho} {subNicho} {regiao}"`** (partes vazias omitidas). Cada busca gera um doc em `/buscas` (nome default `"{nicho} {DD/MM}"`, data em UTC) e anexa o id ao `buscaId` dos leads retornados.
- **Região geocodificada com localização dura**: antes do Text Search, a região é resolvida pela Geocoding API (SKU `geocoding`, com **cache permanente em `/geocache`** — cada região só custa 1 request na vida) e o viewport vira `locationRestriction` — sem resultados de fora da região. Região não encontrada → 400 com dica de grafia. A resposta traz `regiaoResolvida` (endereço formatado) e a UI mostra "Buscando em: X" via `GET /api/geocode` antes de confirmar.
- **`quantidade` (1–40, default 20) conta leads NOVOS**: resultados que já existem na base não abatem a quantidade pedida ("20 = 20 inéditos") — a rota pagina via `nextPageToken` até juntar os novos, **cada página reservando 1 de cota antes do fetch** (o contador reflete páginas, não buscas), até o limite de 3 páginas do Google. Se o teto (ou o Google) falhar da 2ª página em diante, a rota devolve **200 parcial** com os leads já obtidos e o campo `aviso` — a cota da 1ª página já foi paga, jogar o resultado fora seria pagar sem receber. Na 1ª página o comportamento clássico vale: 429 sem custo / 502 com custo.
- **Busca qualificada (`qualificada: true`, checkbox "Só sem site")**: field mask ganha `places.websiteUri` + telefones e a chamada passa a contar no SKU **textSearchEnterprise** (tier Enterprise, cota grátis 1.000/mês). Como o campo foi pedido no mask, a resposta é **definitiva**: todo lead volta com `temSite` e `siteProprio` preenchidos (ausência de `websiteUri` = `false`, nunca "desconhecido"). URL de rede social/agregador → `siteProprio: false` (ver "Classificação de site próprio") — o lead aparece no filtro "sem site próprio" e é destacado como quente. Sem o checkbox, a busca continua no mask básico (SKU textSearch) e site/telefone ficam desconhecidos.
- **Enriquecimento automático pós-busca é do cliente, não do servidor**: a página de leads, com o checkbox ligado, chama `POST /enrich` **em série** para os primeiros N resultados ainda não enriquecidos (N ≤ 5, default desligado). Cada chamada passa pelo `reserveQuota` normal do servidor; no primeiro `429` o loop para e a UI informa quantos foram feitos. Não existe rota de enriquecimento em lote — mantém o princípio "enriquecimento sob demanda" com um único caminho de cota.
- `/api/leads/[id]/enrich` grava `detalhes`, marca `enriquecido: true`. Lead já enriquecido **retorna do cache sempre** — re-enriquecimento não existe. **Horário de funcionamento é buscado JUNTO** (2 requests distintos ao Google, um por SKU: `detailsEnterprise` para `detalhes`, `detailsProHours` — tier Pro, cota grátis própria de 5.000/mês — para `horarios`). Falha no 2º request (teto do Pro estourado, erro do Google) não derruba o enriquecimento principal, já persistido — o lead fica sem `horarios` e o botão dedicado "buscar horários" da ficha cobre depois. `/api/leads/[id]/horarios` é a rota desse botão: busca só o SKU novo (idempotente — lead com `horarios` retorna do cache), pensada para leads enriquecidos ANTES desta feature (têm `detalhes`, não têm `horarios`).
- **Estado atual e "melhor momento pra contatar"** (`src/lib/leads/horarios.ts`, funções puras `estadoAtual`/`melhorMomento` sobre `lead.horarios` + um `now`): os períodos do Google vêm em hora LOCAL do lugar, então o cálculo desloca `now` por `utcOffsetMinutes` em vez de depender do fuso da máquina — sem `utcOffsetMinutes` ou sem `faixas`, as duas funções devolvem `null` (nada é mostrado). `estadoAtual` monta "Aberto agora · fecha Xh" / "Fechado · abre Xh" (ficha e `LeadCard`); `melhorMomento` sugere **agora** se aberto (destaque verde no botão WhatsApp da ficha) ou a **próxima abertura + 1h** se fechado, com prefixo "hoje"/"amanhã"/dia da semana conforme a distância ("amanhã ~10h") — exibido na ficha e ao lado de cada item da fila em `/hoje`. Faixas que cruzam a meia-noite (madrugada) são representadas com o dia de fechamento podendo ser o seguinte; a implementação testa fusos diferentes, madrugada e fechamento num dia específico (domingo). **O destaque de "hora boa" no botão de WhatsApp não é mais dele**: passou para o nível da barra do dia quando o fuso do lead é conhecido (ver "Barra do dia por família") — `melhorMomento` só sabe dizer "está aberto", e ao lado de uma barra dizendo "agora: ruim" isso se contradizia.
- O botão WhatsApp é montado **no cliente** a partir de dados já persistidos (`wa.me/<telefoneIntl sem símbolos>?text=<mensagem com os marcadores substituídos>`) — não há rota nem chamada externa. O telefone da **busca qualificada** já sustenta o botão sem enriquecer. A mensagem usada segue a precedência **frases da skin da demo → mensagem do grupo → mensagem global** (ver "Frases de prospecção por skin"): sem demo, ou sem nenhuma frase cadastrada naquela skin, o comportamento é exatamente o antigo — a do grupo (busca mais recente do lead que tiver `mensagemPadrao` própria) e, na falta, a global da config.
- **Descarte suave** (`descartado: true` via PATCH): o lead não é deletado — vai pro fim da lista com marcação e pode ser restaurado. Reversível por design: apagar de verdade perderia o histórico de contato.
- `/api/metrics`: "hoje" usa o dia corrente em UTC (mesma convenção do período de custos); "semana" é uma janela rolante dos últimos 7 dias (não semana de calendário). `taxaResposta` é `leads com respondeuEm ÷ leads com primeiroContatoEm`, `0` (não `NaN`) sem contatos.
- `/api/hoje` é a única rota de leitura que **exige** sessão identificável (401 sem ela): o delta de "novos" depende do `ultimaVisitaEm` do usuário. A rota calcula a fila com o carimbo **anterior** e grava o novo ao responder — recarregar a página zera o delta por design ("novos desde a última visita" é literal).
- `/api/cron` fica **fora da sessão** (exceção exata no proxy) e se protege sozinha com `Authorization: Bearer ${CRON_SECRET}` — exatamente o header que o Vercel Cron envia. Fail-closed: sem a env, 503 e nada roda. `/api/cron/status` é rota comum atrás da sessão.

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
| `detailsProHours` | `GET places/{id}` | `regularOpeningHours,utcOffsetMinutes` | Pro · US$17/1.000 · 5.000 grátis | Horário de funcionamento — contador PRÓPRIO, chamado junto do enriquecimento (2 requests) ou sozinho pelo botão "buscar horários" |
| `geocoding` | `GET geocode/json` | — (Geocoding API não usa field mask) | Essentials · US$5/1.000 · 10.000 grátis | Resolver a região da busca (com cache permanente em `/geocache`) |
| `aiGeneration` | `POST models/gemini-3.5-flash:generateContent` (Gemini, não Places) | — | Free tier do Flash · US$0 default · teto 50/mês | Sugestões de IA da Forja (ver "IA na Forja") |
| `aiTraducao` | `POST models/gemini-3.5-flash:generateContent` (Gemini, não Places) | — | Free tier do Flash · US$0 default · teto 30/mês | Tradução das frases de prospecção para o idioma do lead estrangeiro — contador PRÓPRIO (ver "Frases de prospecção por skin") |

> ⚠️ **Tiers conferidos na tabela vigente (jul/2026)**: telefone/site/rating são tier **Enterprise** (não Pro); displayName/endereço/location no Text Search são tier **Pro** (5.000 grátis/mês — não os 10k de Essentials). O SKU antigo `detailsPro` foi renomeado para `detailsEnterprise` com migração de leitura dos contadores e da config. `displayName` foi removido do mask de `detailsEssentials` (é campo Pro em Place Details). Os defaults continuam **todos sobrescrevíveis via `/config/app`** — corrigir preço/cota é mudança de configuração, não de código.

## Módulo de custos (`src/lib/costs`) — implementado

Tudo que depende de request pago passa por aqui. API:

```ts
// Reserva 1 request do SKU no mês corrente, ou lança QuotaExceededError
// (teto global) / UserQuotaExceededError (limite individual do usuário).
// Transacional: ler doc(s) → verificar teto(s) → incrementar. Atômico no
// Firestore — a reserva global e a individual são a MESMA transação.
reserveQuota(db, sku, caps?, now?, opts?: { userId?, isAdmin?, userQuota? }): Promise<{ period, usage }>

// Leitura do uso do mês (para o dashboard).
getUsage(db, now?): Promise<{ period, usage }>

// Funções puras de projeção de custo (excedente além da cota grátis).
projectedCostUSD(usage, pricing?): number
projectedCostBRL(usage, usdBrl, pricing?): number
```

Decisões de projeto:
- **Reserva antes do request**: o contador incrementa antes de chamar o Google. Se o Google falhar, o contador fica 1 acima do real — erro do lado seguro. O inverso (chamar e depois contar) poderia estourar o teto em caso de falha na gravação.
- **Teto (`cap`) = máximo de requests permitidas no mês**. `used + 1 > cap` → recusa com `QuotaExceededError` (mensagem em pt-BR com SKU, uso, teto e período). Teto `0` (ou negativo) bloqueia o SKU por completo. **Exceto para admin** (`opts.isAdmin`): a checagem é pulada, mas o contador ainda incrementa — ver "Cotas individuais por usuário" abaixo.
- **`src/lib/firestore-like.ts`**: o app inteiro depende de uma interface estrutural mínima do Firestore (`UsageDb` para custos, `AppDb` ampliada para o resto), não do `firebase-admin` — o Firestore real satisfaz a interface por tipagem estrutural (há um static assert em `admin.ts`), e os testes usam um fake em memória que reproduz a semântica de transação (leituras veem o estado pré-transação; escritas só aplicam no commit; exceção → nada aplicado).
- Contadores malformados no doc (string, negativo, NaN) são lidos como `0` — o módulo nunca quebra por dado sujo, só fica mais conservador.
- `atualizadoEm` gravado como ISO string (evita dependência do `FieldValue` do admin dentro do módulo puro).

## Cotas individuais por usuário (`src/lib/costs/{periodoUsuario,userQuota}.ts`)

Além do teto global mensal (segurança contra a fatura, UTC), cada usuário pode ter limites PRÓPRIOS de **buscas** (cada página do Text Search conta), **enriquecimentos** (só o clique em "Enriquecer" — Place Details do enriquecimento principal; o horário de funcionamento, avulso ou embutido no enrich, nunca conta contra essa cota) e **gerações de IA** (`geracoesIA` — ver abaixo), em três janelas independentes e opcionais: dia, semana (começa segunda) e mês. Campo ausente = sem limite naquela janela.

Decisões:
- **Admin nunca é bloqueado** — nem pelo teto global, nem pelo limite individual. A trava absoluta de fatura passa a ser só a cota configurada no console do Google; `caps`/limites individuais são "para todo mundo, menos quem loga como admin". O uso do admin continua incrementando os contadores GLOBAIS (dashboard/projeção corretos), mas **nunca ganha doc de cota individual** — `checarCotaUsuario` só roda quando `!isAdmin`, então `usage_users/{adminId}/dias` simplesmente não é escrito nas reservas dele.
- **Fuso de Brasília, nunca UTC** (`periodoUsuario.ts`): chaves de data via `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` (não offset fixo) — 23h59 em Brasília ainda é o dia corrente mesmo já sendo o dia seguinte em UTC. Reset por composição de chave com a data, **sem cron**: semana/mês são somas puras dos docs diários dentro da janela.
- **Contador por usuário/dia**: `usage_users/{userId}/dias` (coleção — 3 segmentos, nunca 2, ver nota de paridade acima) → doc `{YYYY-MM-DD}` → `{ buscas, enriquecimentos, geracoesIA }`. Mapa aberto de propósito — um quarto tipo (ex.: item 2 do roadmap, fotos/reviews) encaixa sem redesenho.
- **Atomicidade**: a checagem/incremento do limite individual (`checarCotaUsuario`) roda na MESMA transação Firestore do `reserveQuota` global — ou os dois passam, ou nenhum conta. Só busca os docs de semana/mês quando aquela janela tem limite configurado (evita até 31 leituras à toa).
- **Sessão obrigatória**: `/api/search`, `/api/leads/[id]/enrich` e `/api/leads/[id]/horarios` passam a exigir sessão identificável (401 sem ela) — diferente do resto do app, que é best-effort (ver "Proteção por sessão" abaixo). Sem saber quem é o usuário não dá pra aplicar o limite dele. As três rotas de IA (abaixo) continuam best-effort: sem sessão identificável, a ação funciona sem cota individual, só o teto global se aplica.
- **Cron**: a busca recorrente conta no usuário que a marcou como recorrente (`busca.userId`, resolvido por id, sem sessão HTTP). Dono sem cota individual pula **só aquela busca** (`pulada`, fila continua) — diferente do teto global, que interrompe a fila inteira (mesmo espírito de "erro do Google não trava as demais").
- `UserQuotaExceededError` (código `user_quota_exceeded`, HTTP 429) carrega `tipo`/`janela`/`used`/`limite`/`resetaEm` — distinto do `QuotaExceededError` do teto global.

Rotas novas:

| Rota | Método | Quem | Devolve |
|---|---|---|---|
| `/api/cotas` | GET | qualquer sessão | uso × limite (dia/semana/mês) do PRÓPRIO usuário, buscas + enriquecimentos + geracoesIA |
| `/api/usuarios/cotas` | GET | admin | o mesmo, de todos os usuários (tabela do painel) |
| `/api/usuarios/[id]/zerar-dia` | POST | admin | `204`; zera o contador do dia corrente daquele usuário (as três cotas de uma vez — o doc do dia é um só) |
| `/api/usuarios/[id]` | PATCH | admin | ganhou o campo `limites` (number seta, `null` limpa uma janela) |

UI: `/config` ganhou a seção "Cotas por usuário" (resumo do teto global relevante + um cartão por usuário com edição inline dos limites e botão "Zerar dia"); `/leads` e a ficha do lead mostram `CotaIndicador` (componente compartilhado em `src/components/CotaIndicador.tsx`) — permanente, atualizado após cada busca/enriquecimento, com o botão desabilitado como cortesia quando a cota esgota (o bloqueio real é sempre do servidor).

### Cota individual de gerações de IA (`geracoesIA`)

Um QUARTO tipo de cota individual (mesmo módulo `userQuota.ts`, mesmo padrão de três janelas/fuso de Brasília/admin nunca bloqueado/`429 user_quota_exceeded` de buscas e enriquecimentos), mas com uma diferença: **um único contador cobre QUATRO ações distintas**, cada uma reservando um SKU global diferente:

1. **Geração de texto da demo** — `POST /api/leads/[id]/demo/sugestao` (SKU global `aiGeneration`).
2. **Tradução de frase de prospecção por skin** — `POST /api/frases/traduzir` (SKU global `aiTraducao`).
3. **Análise interna do grupo** (Radar/`gerarAnaliseBusca`) — `POST /api/buscas/[id]/analise` (SKU global `aiGeneration`).
4. **Tradução do CONTEÚDO ATUAL do editor de demo** (4ª ação do botão de IA, ver "Idioma da IA na demo") — `POST /api/leads/[id]/demo/traduzir` (SKU global `aiGeneration`).

O teto GLOBAL mensal continua por SKU (`aiGeneration`/`aiTraducao` contados separadamente, como sempre); a cota INDIVIDUAL é que soma as quatro ações num contador só (`geracoesIA` em `usage_users/{userId}/dias`) — a pessoa que gera 2 sugestões de demo e traduz 1 frase já gastou 3 unidades do limite diário dela, não 2 e 1 em cotas separadas. Implementado via `src/lib/ai/ctx.ts` (`CtxIA`/`reserveQuotaOptsIA`): as quatro funções de geração (`gerarSugestaoDemo`, `traduzirFrases`, `gerarAnaliseBusca`, `traduzirConteudoDemo`) recebem `ctx.limites` (o `Usuario.limites` de quem chamou) e montam a mesma opção `userQuota: { tipo: "geracoesIA", limites }` para TODA chamada real ao Gemini — `traduzirConteudoDemo` nunca tenta de novo sozinha (sem retry, ver "Idioma da IA na demo"), mas as outras três ainda gastam uma segunda unidade da cota individual quando o retry de resposta inválida dispara, igual ao teto global.

**Precificação regional** (`gerarIndiceRegiao`) e **tradução de termo de nicho** (`gerarTermoLocal`) também usam o SKU global `aiGeneration`, mas ficam DE FORA da cota individual `geracoesIA` de propósito: são geradas uma vez por região/termo e cacheadas PERMANENTEMENTE para o time inteiro (ver "Precificação regional por IA") — cobrar do primeiro operador a abrir uma cidade nova do bolso da cota pessoal dele seria injusto, já que o benefício é de todo mundo.

Testes: `src/lib/costs/__tests__/{usage,userQuota}.test.ts` cobrem o contador isolado; `src/app/api/__tests__/cota-geracoes-ia.route.test.ts` cruza as três rotas de verdade (sugestão → tradução → análise) para provar que dividem o mesmo contador do usuário, que a 3ª ação do dia estoura com `429 user_quota_exceeded` quando as duas primeiras já bateram o limite, e que o admin nunca é bloqueado nem ganha doc de cota individual.

## Metas de prospecção por integrante (`src/lib/usuarios/metas.ts`)

O admin define, por integrante, uma meta de prospecção diária e/ou semanal (`Usuario.metas.prospeccoesDia`/`prospeccoesSemana`) — mesmo fuso/convenção de semana das cotas individuais (America/Sao_Paulo, semana começa segunda), mas só duas janelas (sem mês: é indicador de ritmo, não teto de custo) e **nunca bloqueia nada**, nem pra quem está zerado.

- **"Prospecção" reaproveita o contador `buscas` de `usage_users`** (o mesmo que as cotas individuais já leem) — cada busca executada é uma prospecção nova. Não é um contador novo: `getProgressoMetaUsuario` (`src/lib/usuarios/metas.ts`) chama o mesmo `getUsoUsuario(db, userId, "buscas", …)` das cotas, só que compara contra `metas` em vez de `limites`. Decisão deliberada: enriquecimento qualifica um lead que já existe, não é a ação que abre prospect novo; leads contactados também foram cogitados, mas não vivem em `usage_users` — usá-los exigiria um contador novo, contra a instrução de reaproveitar o que já existe.
- **Opcional e sem efeito colateral**: campo ausente numa janela = sem meta ali; `getProgressoMetaUsuario` sempre devolve `usado` (mesmo sem meta) e `meta` só quando configurada — é quem consome (UI) que decide não renderizar a janela sem meta. Um usuário sem NENHUMA meta configurada não aparece na visão consolidada do painel (filtrada), nem mostra a seção em `/hoje`.
- Editável só via `PATCH /api/usuarios/[id]` (admin, campo `metas`, mesma semântica de `limites`: number seta, `null` limpa uma janela) — nunca revoga sessão (não é credencial).

Rotas novas:

| Rota | Método | Quem | Devolve |
|---|---|---|---|
| `/api/usuarios/metas` | GET | admin | meta × progresso (dia/semana) de todos os usuários — mesma fonte de dados da seção de edição em `/config` e da visão consolidada do painel |
| `/api/hoje` | GET | qualquer sessão | ganhou `metaProspeccao: { dia, semana }` — progresso do PRÓPRIO usuário logado |
| `/api/usuarios/[id]` | PATCH | admin | ganhou o campo `metas` (number seta, `null` limpa uma janela) |
| `/api/metas/proprio` | GET/PUT | qualquer sessão | progresso (dia/semana) + `minimizada` do PRÓPRIO usuário (GET) / persiste `minimizada` (PUT) — self-service, sem os efeitos colaterais de `/api/hoje` (não carimba visita nem carrega a fila), pensada para ser chamada em toda navegação |

UI: `/config` ganhou a seção "Metas por integrante" (mesmo padrão de edição inline de "Cotas por usuário" — `LimiteInput` reaproveitado, salva no blur); `/hoje` mostra a barra de progresso da PRÓPRIA meta do usuário logado (some por completo se ele não tem meta); o painel (`/`, dashboard) mostra "Metas do time" pro admin — só os integrantes com pelo menos uma janela configurada aparecem. `MetaProgresso` (`src/components/MetaProgresso.tsx`) é a barra de progresso compartilhada entre `/hoje` e o painel — polaridade oposta ao `UsageMeter` das cotas (aqui mais uso é melhor; o preenchimento nunca vira crítico, só fica verde ao bater a meta).

**Faixa fixa de metas (`src/components/MetaFaixa.tsx`)**: além do card em `/hoje`, a PRÓPRIA meta aparece como faixa fixa (`sticky top-0`) no topo de TODO o app autenticado (`(app)/layout.tsx`, antes do `<Nav />`) — não só em `/hoje`. Busca `/api/metas/proprio` no mount e a cada troca de rota (`usePathname`); sem NENHUMA janela configurada, o componente devolve `null` (nada renderiza, nem o espaço vazio). Botão de minimizar reduz a faixa a um indicador de uma linha (bolinha + números compactos); o estado (`Usuario.metaFaixaMinimizada`) é self-service, gravado via `PUT /api/metas/proprio` (`salvarMetaFaixaMinimizada` no repo, mesmo espírito de `salvarNivelIA`/`salvarPrecoBaseSlider` — não mexe em `atualizadoEm`/`sessao`) e persiste entre sessões/dispositivos; o refetch de progresso ao trocar de rota preserva a escolha local de minimizada (não sobrescreve com a resposta do servidor) para não "piscar" de volta enquanto o PUT do toggle ainda está em voo.

## Forja de Demos (`src/lib/demos` + `src/components/demos`)

Prévia de site personalizada por lead, servida pelo próprio Radar em **`/demo/{leadId}`** — o link que vai na mensagem de prospecção (variável `{demo}`). Nenhum deploy por lead, nenhuma chamada ao Google: a página é um Server Component que lê **só o Firestore**. **A demo pública só existe depois de salva no editor**: lead sem campo `demo` (ou com skin removida do registro) responde 404 — nada é publicado sem intenção explícita, e "Excluir demo" devolve exatamente esse estado.

Contratos centrais (`src/lib/demos/types.ts`):

- **`DemoData`** — slots de conteúdo: nome, slogan, endereço, telefone, whatsapp, instagram, cidade, horários, `servicos[]` (nome/preço/descrição, + `categoria`/`destaques[]` opcionais — ex.: filtro e chips do catálogo de veículos da skin de multimarcas), `depoimentos[]` (autor/texto/nota, + `contexto` opcional — segunda linha curta sob o autor, ex.: "Toyota Hilux SRX 2021"), `secoes` (textos por seção, chaves definidas pela skin — cada `DemoSecao` tem `rotulo/titulo/texto/cta/ctaSecundaria/itens`, e cada `DemoItem` tem `titulo/subtitulo/detalhe/texto`, útil quando uma seção precisa de duas linhas de legenda com pesos visuais diferentes), `imagens` (caminho por slot), `videos` (opcional — URL por slot de **vídeo-no-título**, ver seção própria) e a **estrutura editável**: `ordemSecoes` (ordem das seções não-fixas) e, por seção, `oculta`, `alinhamento` e `animacao` (liga/desliga a animação DAQUELA seção — ver "Animação por seção" abaixo).
- **`Theme`** — tokens visuais: `paleta` (fundo/alt/elevado, destaque + ink, texto/suave, borda, e dois acentos raros `acentoSecundario`/`acentoTerciario` para detalhes decorativos que não seguem o acento principal), `fontes` (display/corpo/mono/serif/decorativa/**citacao**/**destaque** como valores CSS prontos — vars `--font-demo-*` carregadas via `next/font` em `src/app/demo/fonts/`), `raio`, `densidade` (compacta/confortável/arejada → espaçamento vertical das seções), `animacao` (`nenhuma`/`sutil`/`marcante` → intensidade de entrada de seção, hover e transição; ver "Animação" abaixo), as **micro-interações**: `intro` (splash de abertura ligada?), `hover` (`lift`/`zoom`/`brilho`), `clique` (`nenhum`/`pressao`/`pulso`), `fundoEfeito` (`nenhum`/`aura`/`grao`/`gradiente`/`particulas`/`filotaxia`/`ondas`/`faiscas`/`varredura-de-luz`), `led` (`desligado`/`sutil`/`marcante` — o NÍVEL) e `ledEstilo` (`barra`/`dissipado`/`cantos`/`moldura` — o ESTILO visual, independente do nível; ver "Micro-interações" abaixo), e `heroTitulo` (`{ fonte, escala, alinhamento }` — estilo do título principal, ver "Título hero" abaixo; o **texto** continua em `dados.secoes.hero.titulo`/`dados.nome`, que é conteúdo, não tema).
- **`TemaPatch`** (`LeadDemo.tema`) — ajustes por cima do preset: `fonteDisplay`/`fonteCorpo` (ids da **lista curada** em `fontes.ts`, ~16 fontes via `next/font`, cada uma com os papéis onde funciona — só as fontes que são default de algum preset são carregadas sempre; as demais entram **sob demanda**, via `import()` dinâmico, só quando o editor escolhe uma delas — ver `src/app/demo/fonts/registry.ts`), `destaque` (cor primária hex; `destaqueInk` é **recalculado por contraste** em `tema.ts`), `raio` (um de `TEMA_RAIOS`), `densidade`, `animacao`, `intro`, `hover`, `clique`, `fundoEfeito` (id de um efeito do **registro de efeitos**, `src/lib/demos/efeitos/registry.ts`, ou `"nenhum"`), `fundoEfeitoIntensidade` (0-3; ausente = default do nicho recomendado do efeito, ver `intensidadePadrao`), `auraCores` (cores do efeito "aura" — ver "Cor da aura" logo abaixo de "Efeitos visuais"), `efeitoCores`/`ledCores` (**modo de cor** da camada decorativa — ver "Modos de cor" abaixo), `barraCor` (**cor da barra do navegador** — ver "Barra do navegador na demo pública" abaixo), `led`, `ledEstilo` e `heroTitulo` (`{ fonte?, escala?, alinhamento? }`, todos opcionais). `aplicarTema(preset, patch, heroEscalaLimites?)` é puro e usado pela rota pública E pelo preview — o editor nunca mostra algo diferente do publicado; o 3º argumento (default de `tema.ts` se omitido) recorta `heroTitulo.escala` aos limites da skin. `aplicarTema` só resolve o **id** de `fundoEfeito` (contra o registro de efeitos); a intensidade efetiva é resolvida à parte por `resolverEfeitoFundo` (ver "Efeitos visuais" abaixo), que já recebe o patch bruto — não faz parte do `Theme` resolvido, já que depende do nicho da skin, não do preset.
- **`SkinDefinition`** — entrada do registro: `{ id, nicho, nome, componente, themeDefault, themePresets, demoDataExemplo, secoes, heroEscalaLimites, thumbnail, videoSlots? }`. **`secoes`** é o contrato do editor: lista ordenada de `SkinSecaoDef` (`{ id, nome, fixa?, alignOptions?, entradaOptions? }`) — `fixa` não reordena nem oculta (ex.: hero); `alignOptions` diz onde a skin aceita alinhamento (validado no PUT; a primeira opção é o natural da skin); `entradaOptions` diz quais animações de entrada por seção a skin aceita ali (validado no PUT; ausente = sem seletor). `heroEscalaLimites` (`{ min, max }`) delimita o slider de tamanho do título hero no editor. `thumbnail` (caminho local em `/public`) alimenta o passo de escolha de skin. `videoSlots` (opcional, **opt-in por skin**) lista os slots de `dados.videos` que a skin suporta — ausente/vazio = a skin não oferece vídeo-no-título. Sem posicionamento livre por pixel: o template continua responsivo.

Regras do sistema:

1. **Skin é orientada por dados**: nenhum texto, imagem ou cor hardcoded no componente — tudo vem de `data`/`theme`, aplicado como CSS vars num wrapper (`--d-bg`, `--d-accent`, `--d-radius`, `--d-sec-y`…) que o Tailwind consome via arbitrary values. O componente de topo (`Skin.tsx`) não tem hooks e renderiza igual no server (rota pública); ele **compõe subcomponentes `"use client"`** (`src/components/demos/<nicho>/interactive/`) para as partes que precisam de interatividade real — scroll do header, máquina de escrever, cursor contextual, partículas, animação de entrada — sem que isso reintroduza conteúdo hardcoded: esses subcomponentes só recebem props (texto, imagem, cor) vindas de `data`/`theme` como qualquer outro pedaço da skin.
2. **DemoData efetivo é montado em camadas** (`montarDemoData`): exemplo do template ← dados reais do lead (nome, endereço, telefone, whatsapp) ← edições do editor (`lead.demo.dados`). O editor pré-preenche tudo com essa mesma montagem; o que ele salva é o **diff mínimo** contra exemplo←lead (`montarPatch` em `patch.ts` — campo esvaziado/igual ao template volta a segui-lo).
3. **A estrutura é dado, não código**: a skin renderiza suas seções pela **ordem efetiva** (`estrutura.ts`: `ordemSecoes` filtrado contra o contrato `SkinDefinition.secoes`, fixas no lugar, ids desconhecidos ignorados, seções não listadas no fim) e pula as `oculta`. Numeração de seção ("01 / FILOSOFIA") é recalculada pela ordem visível — reordenar/ocultar nunca deixa número furado. Cada texto/imagem da skin carrega **`data-demo-slot="<caminho do slot>"`** (ex.: `secoes.hero.titulo`, `servicos.0.preco`, `imagens.hero`) — atributo inerte na demo pública que o editor usa para o mapa clique-no-preview → campo-do-painel.
4. **Imagens: placeholder local por slot, upload por lead no Firebase Storage.** Os placeholders (`public/demos/<nicho>/*.svg`) nunca são fotos do cliente original; o editor troca slot a slot subindo para `demos/{leadId}/{slot}-{ts}.{ext}` (jpg/png/webp, ≤2MB, comprimido client-side via canvas antes do envio — ver `comprimir.ts`). Objetos são públicos (a demo é pública) com cache imutável — trocar imagem gera caminho novo, e o upload apaga as versões velhas do slot. A URL vai em `dados.imagens[slot]` no PUT normal; "Remover" apaga os arquivos e o override (volta ao placeholder). "Excluir demo" apaga o registro e **todas** as imagens (e vídeos) do lead; upload órfão de edição abandonada é limpo no próximo upload do slot ou na exclusão.
5. **A configuração vive no campo `demo` do doc do lead** (não em subcoleção — a interface `AppDb` não precisa crescer) e é salva por `PUT /api/leads/[id]/demo` com validação estrita (skin/preset existentes, chaves desconhecidas rejeitadas, textos ≤2000, listas ≤30, `tema` contra a lista curada/`TEMA_RAIOS`/hex/`heroTitulo`/`led`, `ordemSecoes` só com seções reordenáveis da skin, `oculta` proibido em seção fixa, `alinhamento` só onde a skin declara `alignOptions`, `dados.videos` só com slots de `SkinDefinition.videoSlots` da skin).
6. **A rota pública é `force-dynamic` e `noindex`**: reflete a última edição na hora e não entra em buscador.

### Animação (`Theme.animacao` + `DemoSecao.animacaoEntrada`)

Três níveis globais — `nenhuma` / `sutil` / `marcante` — definidos no contrato (`Theme.animacao`, override em `TemaPatch.animacao`) e resolvidos por `aplicarTema` como qualquer outro token. Cada preset da skin tem um default (`themes.ts`); o editor pode sobrescrever na aba Tema. A skin de barbearia consome o nível em três pontos:

- **Entrada de seção**: `interactive/SectionReveal.tsx` (por `whileInView`, `once: true`, distância/duração maiores em `marcante`) envolve cada seção na renderização (`Skin.tsx`), com o **tipo** vindo do override por seção. A seção Serviços sem override fica sem wrapper — tem uma sidebar `position: sticky` por dentro, e o `transform` residual que o `motion` deixa mesmo em repouso (`translateY(0px)`) cria um containing block que quebraria o sticky; por isso o contrato dela só oferece opções SEM transform.
- **Hovers e transições**: `Skin.tsx` deriva `--d-anim-duration`/`--d-anim-ease`/`--d-hover-scale`/`--d-hover-lift` do nível e injeta como CSS vars no wrapper; elementos com hover (CTA `.d-cta`, cards de depoimento `.d-card-hover`, `TeamCard`, título/borda das linhas de serviço) consomem essas vars em vez de valores fixos — em `nenhuma`, duração 0ms e escala/deslocamento neutros fazem o hover não animar (a mudança de cor/borda em si continua).
- `nenhuma` e `prefers-reduced-motion` pulam o wrapper de `SectionReveal` por completo (sem elemento extra no DOM, sem custo) e desligam o typewriter.

**Animação de entrada POR SEÇÃO** (`DemoSecao.animacaoEntrada`, aba Estrutura do editor): `nenhuma` / `fade` / `deslizar-esquerda` / `deslizar-direita` / `typewriter` — ausente = padrão do template (slide de baixo + typewriter nos títulos das seções que o material bruto animava). O valor é **estrutura, não tema** (vive em `dados.secoes.{id}`, como `oculta`/`alinhamento`) e só é aceito onde a skin declara `entradaOptions` (validação do PUT). `typewriter` liga a máquina de escrever no título da seção (na citação, no Ritual) com fade no bloco; a **intensidade/duração continua vindo do nível global**, e `nenhuma` global ou `prefers-reduced-motion` desliga tudo, inclusive os overrides.

### Micro-interações do tema (`intro`, `hover`, `clique`, `fundoEfeito`)

Opcionais, escolhidas na aba Tema, todas CSS puro (transform/opacity/box-shadow — custo baixo em mobile) e resolvidas por `aplicarTema`:

- **`intro`** — liga/desliga a splash de abertura do template (na barbearia, a navalha de `IntroAnimation`; o cursor contextual continua). Default `true` em todos os presets (fiel ao original).
- **`hover`** (`lift` default / `zoom` / `brilho`) — estilo do hover de cards/botões, aplicado por atributo `data-d-hover` no wrapper + seletores no `<style>` da skin; a intensidade escala com `--d-hover-*` do nível global (em `nenhuma`, zoom/lift neutralizam; o brilho vira mudança instantânea de sombra, coerente com "cor/borda continuam").
- **`clique`** (`nenhum` default / `pressao` / `pulso`) — animação de clique em links/botões (`:active`), via `data-d-clique`; suprimida por completo em nível global `nenhuma` e em `prefers-reduced-motion`.
- **`fundoEfeito`** (`"nenhum"` default, ou id de um efeito do **registro de efeitos** — ver "Efeitos visuais" abaixo) — camada decorativa opcional resolvida por `resolverEfeitoFundo` (intensidade persistida ou default do nicho) e renderizada na rota pública/preview por import dinâmico sem SSR, como sibling da skin (não é mais um componente por skin — ver histórico: até esta feature cada skin tinha seu próprio `BackgroundEffect.tsx` em CSS puro, fixo em "gradiente"/"partículas" sem intensidade).
- **`led`** (`desligado` default / `sutil` / `marcante`) — bordas com luz na cor de destaque do tema. CSS puro (opacity/box-shadow, sem transform de layout): a posição do ponto mais brilhante acompanha o progresso do scroll via uma custom property (`--d-led-scroll`, 0–1) escrita **direto no DOM por um ref** dentro de um listener de scroll passivo throttled por `requestAnimationFrame` — nenhum estado React por frame, custo baixo em mobile por design. Clique em qualquer lugar da página dispara um pulso (`.d-led-pulse`, `filter: brightness()` reiniciado por toggle de classe). `desligado` nem monta o componente; `prefers-reduced-motion` mantém tudo estático (sem listener de scroll/click).
- **`ledEstilo`** (`barra` default / `dissipado` / `cantos` / `moldura` — registro em `src/lib/demos/led/registry.ts`, mesmo padrão do registro de efeitos: metadado `{ id, nome, nichosRecomendados }`) — a FORMA do LED, independente do nível acima (`led` continua controlando se aparece e o quanto). Componente ÚNICO (`src/lib/demos/led/LedEdges.tsx`, client) usado pelas 8 skins — cada `interactive/LedEdges.tsx` de skin só reexporta este componente (era um arquivo idêntico duplicado 8x antes desta migração; o CSS de cada estilo também estava duplicado inline no `<style>` de cada `Skin.tsx` e agora vive todo dentro do componente, como `efeitos/gradiente/Gradiente.tsx` já fazia). A lógica de scroll/clique (JS) é 100% compartilhada e não muda por estilo — só o `data-d-led-estilo` no elemento raiz troca qual bloco de CSS pinta:
  Os três estilos abaixo de `barra` compartilham a MESMA rampa de alfa (`--d-led-a1..a4`, quatro custom properties que o nível `marcante` redefine) e o mesmo princípio, fixado na revisão de qualidade visual: **a queda é perpendicular à borda e o vínculo com o scroll vive numa MÁSCARA ao longo dela** — as duas direções se multiplicam e nenhuma termina em aresta. Antes da revisão os três pintavam superfície chapada e cortavam seco (ver "Revisão de qualidade visual" em Verificação da UI).

  - **`barra`** — o estilo original: barra fina (3–4px) nas laterais, ponta nítida com `box-shadow`. **Deliberadamente intocado pela revisão visual**: é o `ledEstilo` declarado por TODO preset existente, então mexer nele mudaria a aparência de toda demo já publicada — e a captura mostrou que ele não tinha o defeito (a 3–4px não existe superfície pra ler como chapada).
  - **`dissipado`** — halo PEQUENO (40/62px) colado na borda, com queda longa até transparente: gradiente perpendicular à borda + máscara (`--d-led-perfil-v`) que carrega o ponto mais brilhante em `--d-led-scroll` e apaga as duas pontas.
  - **`cantos`** — luz sangrando NA DIAGONAL a partir de cada canto, com queda longa (46/58vmin): gradiente linear dá a direção, máscara radial ancorada no canto mata a aresta da caixa que o carrega. Não são quatro pontos. O par de cima/baixo cruza a opacidade conforme `--d-led-scroll` (o par mais próximo da seção atual fica mais aceso).
  - **`moldura`** — perímetro completo (4 lados fixos), cada um uma banda estreita (24/36px) com a mesma queda perpendicular: `--d-led-scroll` (0–1) é dividido em 4 quartos, um por lado (topo → direita → baixo → esquerda, via `calc()`/`clamp()` em `--d-led-perfil-q1..q4`) — o ponto mais brilhante viaja ao redor do frame conforme a página inteira é rolada, sem `@keyframes`/JS extra nenhum. A máscara apaga as pontas de cada lado, então os cantos não fecham num contorno contínuo (era isso que fazia o estilo ler como retângulo desenhado por cima da página).
  - Todo estilo respeita os mesmos 3 níveis (`led`) e o mesmo vínculo de scroll/clique — só a pintura CSS muda. Cada estilo declara `nichosRecomendados` (ids de `SkinDefinition.nicho`), mesmo padrão do registro de efeitos.

### Modos de cor da camada decorativa (`src/lib/demos/cores`)

Cinco modos de cor, aplicáveis a **qualquer** efeito do registro e a
**qualquer** estilo de LED — não é um controle por efeito. Persistidos em
`TemaPatch.efeitoCores` e `TemaPatch.ledCores` (namespaces separados: o
efeito pode estar num modo e o LED em outro) e resolvidos por `aplicarTema`
para `Theme.efeitoCores`/`Theme.ledCores`:

- **`tema`** (default e ausência de valor) — deriva da paleta, exatamente
  como antes deste controle existir. Nenhuma demo publicada muda.
- **`fixa`** — uma cor escolhida ocupa os três papéis de cor, estática.
- **`transicao`** — 2 ou 3 cores escolhidas girando LENTAMENTE entre os
  papéis (14s por cor: 28s com duas, 42s com três).
- **`iridescente`** — as cores DO TEMA com o matiz deslizando ±16° em ciclo
  de 20s. A paleta continua reconhecível; é o modo discreto.
- **`arco-iris`** — percurso completo de matiz (0→360° em passos de 45°,
  28s) com a saturação elevada (piso de 62%). O modo deliberadamente
  chamativo.

**Teto de luminância dos dois modos que giram o matiz** (`iridescente` e
`arco-iris`, `TETO_LUMINANCIA_MATIZ = 0,45` em `cores/modos.ts`): o ciclo
de matiz passa OBRIGATORIAMENTE pelos amarelos e verdes, que são os
matizes de luminância alta, e a camada decorativa é desenhada por cima do
conteúdo. Sem teto, a passagem por eles levanta a tela inteira — medido no
preset escuro com a aura na intensidade 3: luminância média da viewport de
0,031 (sem efeito) para 0,054, contraste (desvio da luminância) de 0,106
para 0,088, com o pico de luminância da cor batendo em **0,55**. Com o
teto, o pico medido cai para **0,438**.

O teto é em **luminância RELATIVA (WCAG)**, não no `l` do HSL, e essa
distinção é o ponto: `hsl(60 80% 60%)` e `hsl(240 80% 60%)` têm o MESMO
`l` e luminâncias de 0,64 e 0,09 — sete vezes. Um teto escrito em `l` (o
que o arco-íris tinha, `L_MAX = 0,72`) deixa passar exatamente a cor que
apaga o conteúdo. `limitarLuminancia(cor, teto)` (`cores/hsl.ts`, puro e
testado) baixa SÓ o `l`, por busca binária, mantendo matiz e saturação —
cor que já cabe volta intacta, então o teto corta o pico sem achatar a
paleta, e o arco-íris continua com o piso de 62% de saturação. A conta é
feita sobre a cor **como ela sai no CSS** (`hslCss` imprime uma casa
decimal): arredondar depois de cortar devolveria ao navegador uma cor um
fio acima do teto. Vale para os TRÊS papéis de cor e, por tabela, para o
LED e para todo efeito do registro — nenhum precisa saber que existe.

**Por que nenhum efeito precisou aprender o que é modo de cor**: um efeito
já recebe `cores: ThemePaleta` como *strings CSS* que ele interpola em
`background`/`stop-color`, e o LED já lê `var(--d-accent)` do DOM. Basta
entregar, no lugar do hex do tema, uma referência a uma custom property
ANIMADA — `var(--d-efeito-c1, <cor do tema>)` — e declará-la com
`@property … syntax:"<color>"`. É o registro que permite **interpolar**
custom property entre quadros de `@keyframes` (sem `@property`, custom
property anima em degrau); o fallback do `var()` é sempre a cor do tema,
então navegador sem suporte mostra a demo de sempre. Nada de
`filter: hue-rotate` animado — o contrato dos efeitos proíbe animar
`filter`, e uma camada que cobre a viewport inteira é o pior lugar
possível pra isso.

- **`cores/hsl.ts`** — hex → HSL e deslocamento de matiz, puro (matiz não
  se manipula a partir de uma referência a CSS var, daí o LED receber
  também a `corBase` em hex). Cor não-hex (uma paleta com `rgba()` num dos
  papéis) devolve `undefined` e o modo cai em `tema` — nunca quebra.
- **`cores/modos.ts`** — `resolverModoCores(valor, base, prefixo)` devolve
  `{ efetivo, cores, css, animacao }`: as três cores prontas (literais ou
  `var(...)`), o bloco `@property`+`@keyframes` a injetar e a animação a
  aplicar no elemento que CARREGA as custom properties. `efetivo` é o modo
  que de fato valeu (`"tema"` também quando o pedido caiu de volta nele por
  dado insuficiente) — é como quem chama sabe se o controle anterior da
  aura ainda vale.
- **`efeitos/camada.ts`** — resolução única da camada (cores + CSS),
  chamada pela rota pública, pelo preview do editor e pelo harness, pra os
  três nunca divergirem. Precedência: `efeitoCores` != "tema" vence
  `auraCores` (o controle específico da aura, anterior a este), que vence a
  paleta.
- **`efeitos/EfeitoCamada.tsx`** — client, envolve o efeito. A div dela é
  DELIBERADAMENTE sem `position`/`opacity`/`transform`: qualquer um dos três
  criaria stacking context, e um stacking context novo em volta dos efeitos
  mudaria como o `mix-blend-mode` de aura/faíscas/varredura se compõe com a
  página (confirmado por diff pixel a pixel: com a div crua, o `faiscas`
  antes/depois bate exatamente).
- **LED** — `LedEdges` resolve o modo dele e redefine `--d-accent`
  LOCALMENTE na própria raiz. Os quatro estilos de LED não mudam uma linha
  de CSS por causa disso.
- **Nenhum efeito SVG sobrou**: `Veios` e `GeometricoPulsante`, os dois que
  precisavam escrever `stop-color` no `style` (atributo de apresentação não
  resolve `var()`), saíram do registro. Hoje todo efeito consome a cor por
  string CSS interpolada no markup ou lendo o `color` computado num canvas
  (`efeitos/corComputada.ts`).

### Animação por seção (`DemoSecao.animacao`) e a transição da camada

**O controle** (aba Estrutura do editor, ao lado de ordenar/ocultar):
`DemoSecao.animacao` — ausente/`true` = ligada, o que toda demo publicada
já tem. Vale inclusive para as seções **fixas** (que não reordenam nem
ocultam, mas animam). É estrutura, não tema: vive em `dados.secoes.{id}`,
entra no diff mínimo só quando é `false` e é validado no PUT como qualquer
outro campo de seção. Desligada, a seção não monta wrapper de entrada
nenhum (nem o typewriter do título) — o mesmo que o nível global
`"nenhuma"` faz — e a camada decorativa se apaga enquanto ela ocupa a tela.

**O marcador**: cada skin envolve suas seções com `SecaoMarcada`
(`lib/demos/animacao/SecaoMarcada.tsx`), uma `<div>` CRUA (sem classe, sem
position, sem transform — qualquer um quebraria o `sticky` interno de
Serviços) que publica `data-d-secao` + `data-d-secao-anim`. É o único elo
entre a estrutura da demo e a camada decorativa, que é IRMÃ da skin e
portanto não tem como saber onde uma seção começa. O nome do atributo não
é `data-d-anim`: esse já existe na raiz de cada skin, com o nível global de
animação (ver o defeito registrado em "Verificação da UI").

**A transição** (`lib/demos/animacao/cobertura.ts`, puro + testado): a
opacidade da camada é uma COBERTURA medida a cada quadro de scroll — cada
seção marcada é integrada contra um núcleo cosseno (`w(t) = 1 - cos(2πt)`,
primitiva fechada, sem laço de amostragem) sobre a **metade central da
viewport**, e o resultado é `animado / marcado`. Três propriedades caem do
formato, em vez de virem de constantes ajustadas na mão:

- **nunca surge nem some de uma vez**: a transição ocupa meia tela de
  rolagem e a curva chega suave nas duas pontas (a derivada do peso também
  vai a zero lá, então não existe "quina" no início nem no fim);
- **cabeçalho e rodapé são NEUTROS**: como a normalização é pelo que está
  marcado, região que nenhuma skin marca não puxa a opacidade pra baixo —
  sem isso o efeito apagaria sozinho no fim de TODA demo, inclusive nas que
  nunca desligaram animação nenhuma. Viewport inteira em região neutra
  mantém o valor anterior, em vez de piscar;
- **a banda de foco é meia viewport, não a viewport inteira**: com a
  viewport inteira como núcleo, uma seção de meia tela de altura nunca
  passava de 0.50 apagada (medido no laço) — e, como a pausa só liga em
  cobertura 0, o motor também nunca chegava a pausar. É o único número de
  calibração do arquivo, e ele arbitra "distância generosa" contra "uma
  seção conseguir apagar a camada de verdade".

**Consumo**: `EfeitoCamada` escreve `--d-efeito-fade` DIRETO no DOM por um
ref (nenhum estado React por quadro, mesmo padrão do `LedEdges`) e cada uma
das 9 raízes de efeito multiplica `var(--d-efeito-fade, 1)` na própria
opacidade — o fade mora numa custom property, e não em `opacity` na div da
camada, de novo porque `opacity < 1` criaria stacking context. O teste de
contrato do registro de efeitos cobra essa multiplicação de efeito novo. O
LED usa a mesma medição na opacidade da própria raiz.

**Motor VIVO e pausado**: em cobertura 0 a camada passa `pausado` ao efeito
— `animation-play-state: paused` e rAF congelado, NUNCA desmontagem. É o
que faz partícula e traço voltarem de onde pararam em vez de reiniciarem
embaralhados (medido: `running` t=1633ms → `paused` t=1817ms depois de 2,5s
parado fora → `running` t=2167ms na volta, sem nunca voltar a zero).

**`prefers-reduced-motion`**: a medição continua rodando. Ela não é
movimento autônomo — a opacidade só muda quando a pessoa rola a página,
como um `position: sticky`. Desligá-la faria a demo ignorar a escolha "sem
animação nesta seção" justamente para quem pediu menos movimento.

### Barra do navegador na demo pública (`src/lib/demos/barra`)

A cor da barra do navegador (`<meta name="theme-color">`) na rota pública
deixa de ser fixa: no modo default ela **acompanha a seção em foco**
enquanto a página rola, interpolando entre as cores. `TemaPatch.barraCor`
(`{ modo, cor? }`, aba Tema) tem quatro modos — `automatico` (default,
ausência de valor), `fundo`, `destaque` e `personalizada`. Só o
`automatico` monta componente cliente; os três fixos são apenas a cor que
o `generateViewport` já emitiu.

**A transição não é um efeito à parte — é o resultado da conta.** A cor é
a **média ponderada** das faixas que pesam na banda de foco, com o peso
saindo do MESMO núcleo que a camada decorativa usa (`pesoNaBanda` em
`animacao/cobertura.ts`, agora exportado). Enquanto a fronteira entre duas
faixas atravessa a banda, o peso escorre de uma pra outra e a cor caminha
junto: a interpolação sai de graça, dura meia viewport de rolagem, é suave
nos dois extremos e é função da POSIÇÃO, não do tempo — parou de rolar,
parou a cor; rolou de volta, desfez pelo mesmo caminho. Duas leis de
transição diferentes na mesma página (uma pra camada, outra pra barra)
seriam visíveis lado a lado; é uma só, e `BANDA_FOCO` calibra as duas. O
peso que sobra vai pro plano da página, que é o que faz cabeçalho e rodapé
devolverem a barra à cor do tema em vez de congelá-la na última seção.

**A mistura é em LUZ LINEAR** (`barra/srgb.ts`), não nos bytes do sRGB: a
média byte a byte entre `#1A1411` e `#F5F0E8` dá um cinza visivelmente
mais escuro que a cor a meio caminho de verdade (128 contra 188 no canal),
e numa transição de meia tela isso lê como "escurece e clareia no meio" —
exatamente o defeito que a interpolação deveria evitar.

**A cor de cada seção é LIDA do DOM, não declarada por skin.** A
alternativa era um mapa `seção → token` por `Skin.tsx`: 8 mapas à mão que
ficam errados no dia em que alguém troca `bg-[var(--d-bg)]` por
`bg-[var(--d-bg-alt)]`, e o erro só aparece na moldura de um celular. A
multimarcas TINHA esse mapa (o `data-themec` inline, com `avaliacao →
destaque`) e ele saiu nesta feature — junto com o `ThemeColorSync.tsx`
dela, um rAF em laço permanente que competiria com o componente novo pela
mesma tag. Mesma migração que o `LedEdges` fez.

**A unidade não é a seção, é a FAIXA** (`barra/fundo.ts`, pura). A
primeira versão respondia "qual a cor DESTA seção", uma cor por marcador,
e o laço mostrou que isso é grosso demais: o rodapé da imobiliária é um
`<footer>` creme de 1510px com um bloco verde-escuro de 901px dentro —
mais alto que a tela inteira de um celular — e a barra ficava creme
durante toda a travessia do verde. Hoje cada superfície full-bleed vira
uma faixa, e as de dentro RECOBREM as de fora no trecho em que se
sobrepõem, que é o que o navegador faz na tela. O que sobra sem faixa
(seção transparente, ou o pedaço acima/abaixo de um bloco colorido) usa o
plano da página.

O filtro de "full-bleed" é geométrico, não calibrado: largura igual à da
seção, com piso e TETO (99%–101%). A versão anterior usava percentagens
frouxas ("≥90% da largura, ≥50% da altura") e o laço reprovou duas vezes
na mesma skin — um painel arredondado de 358px numa seção de 390 (91,8%)
punha o laranja do destaque na barra de uma seção creme, e um círculo
decorativo de 560×560 transbordando o hero (144% da largura) punha o
lilás do `--d-bg-alt`. O teto é o que barra o segundo: fundo de verdade
tem a largura da caixa, decoração que vaza é mais larga.

**Duas saídas, porque os navegadores leem de dois lugares** (levantamento
completo em `docs/temas/barra-demo.md`): o `content` da meta tag que o
servidor já emitiu (Chrome/Brave/Edge no Android, Samsung Internet, Safari
≤ 18) e o `background-color` do `<body>` (Safari 26+, que passou a
amostrar o body com observador ao vivo e a ignorar a meta em aba normal).
O plano do body **também corrige um erro anterior a esta feature**: o
`<body>` vem do layout raiz com o `bg-background` do RADAR, então no iOS
26 a demo de um lead tintava a barra com a cor do tema da plataforma. É
`!important` porque uma rota aninhada não reescreve o `className` do body
do layout raiz e um seletor de elemento perde de uma classe.

**Degradação**: a cor certa sai no HTML servido em todos os modos —
inclusive no automático, onde é a cor do topo. Onde a meta é ignorada
(Firefox, Opera, Chrome/Edge/Brave no desktop fora de PWA), as duas saídas
são um atributo que ninguém lê e a cor de um plano que as seções cobrem
por inteiro: nenhum pixel de conteúdo muda e não existe ramo de código por
navegador.

**No editor a cor não dá pra conferir no preview** — ele roda em iframe e
a barra pertence ao documento de cima. O painel mostra então uma
**amostra** da cor (`amostraDaBarra`): uma faixa sólida nos modos fixos e
o degradê entre as duas cores da paleta no automático, que é literalmente
o caminho que a barra vai percorrer.

**Custo**: um `getBoundingClientRect` por seção (~10) por quadro de
rolagem, em listener passivo throttled por rAF, sem estado React por
quadro e sem rAF em laço — o mesmo orçamento e o mesmo padrão do
`LedEdges`. As faixas são guardadas em offsets RELATIVOS ao topo da
seção justamente para isso: por quadro basta somar o `top` atual dela, em
vez de medir cada faixa. A varredura cara (`getComputedStyle` da
subárvore de cada seção) roda no mount, num beat de 400ms e no resize. `prefers-reduced-motion`
não desliga nada, pela mesma razão da cobertura animada: a cor só muda
quando a pessoa rola.

Verificação: `node scripts/qa-visual.mjs --so=barra` (ver "A barra do
navegador, medida" em Verificação da UI) e `docs/temas/barra-demo.md`.

### Vídeo-no-título (`DemoData.videos` + `SkinDefinition.videoSlots`)

Slot de conteúdo **opt-in por skin** (hoje só a tatuagem, slot `"titulo"`): vídeo rodando dentro das letras do wordmark, com o **texto como máscara** — fiel ao efeito do material bruto original (que usava um vídeo com máscara SVG; a conversão inicial da skin havia trocado isso por um efeito 100% CSS pra manter a Forja livre de assets binários — ver `Wordmark.tsx`). Ao contrário de `imagens`, **`videos` nunca tem placeholder**: a Forja não versiona vídeo de terceiros, e a ausência é o estado normal.

- **Técnica** (`src/lib/demos/titulo/`, "use client" — MECANISMO COMPARTILHADO, não da tatuagem: cada skin reexporta `Wordmark` numa linha, como já faz com `LedEdges`): UMA caixa de texto (`.d-wordmark-text`) e a mídia é o PREENCHIMENTO dela. No nível `imagem`, a foto entra por `background-image` da própria caixa, que já tem `background-clip: text`. No nível `video`, um `<svg>` com `<mask>` — cujas linhas são MEDIDAS da caixa, uma `<text>` por linha renderizada — recorta um `<foreignObject>` com um `<canvas>` no qual o vídeo é pintado quadro a quadro. A máscara herda `font-family`/tamanho do `.d-wordmark` por CSS normal (é inline no DOM), sem casar métricas na mão.
  - **Por que `<canvas>` e não o `<video>` direto no `<foreignObject>`** — ver "O rastro na borda superior" abaixo: `<video>` ganha camada de composição PRÓPRIA e a `<mask>` é operação de PINTURA, que não faz parte do estado dessa camada.
- **Três níveis de fallback, do mais rico ao mais seguro**: 1) vídeo mascarado, se houver `dados.videos.titulo`, a conexão não for lenta (`navigator.connection.saveData`/`effectiveType`, quando suportado) e `prefers-reduced-motion` não estiver ativo; 2) imagem mascarada (`dados.imagens.hero`) se o vídeo faltar, falhar (`onError`/`onStalled`) ou a conexão for lenta; 3) nada — a base CSS (gradiente + contorno multicor) da própria caixa de texto continua visível. A decisão roda num `useEffect` deferido (`setTimeout(…, 0)`, mesmo padrão de `CustomCursor.tsx`) pra não chamar `setState` sincronamente no corpo do efeito.
- **Upload**: `POST /api/leads/[id]/demo/videos` (multipart `slot` + `arquivo` + `skinId?`), mp4/webm, **~15MB** de teto (bem maior que o de imagem — o editor avisa do peso e do fallback automático). Grava em `demos/{leadId}/video-{slot}-{ts}.{ext}` (prefixo `video-` nunca colide com uma imagem do mesmo nome de slot) via `src/lib/demos/videos.ts` (mesma interface `DemoStorage` de `imagens.ts`). `DELETE` aceita `skinId` opcional no corpo (cobre remover antes do primeiro save, quando `lead.demo` ainda não existe). "Excluir demo" já cobre a limpeza: apaga todo o prefixo `demos/{leadId}/`, vídeos inclusos.
- Sem compressão client-side (ao contrário de imagem): vídeo não é reencodado no browser: o teto e o aviso de peso são a defesa contra upload gigante.

### Título hero (aba Tema do editor)

O título principal (hero) ganha controles próprios, separados do resto da tipografia — persistidos em **`DemoData`** (texto) e **`Theme`/`TemaPatch`** (estilo):

- **Texto**: `dados.secoes.hero.titulo`, com fallback pro nome do negócio (`s.hero?.titulo ?? data.nome`) em TODAS as skins que têm título hero. Quem preenche esse campo é `dadosDoLead` (`montarDemoData`), com o nome do lead já quebrado em duas linhas por `quebrarTitulo` — então na prática ele existe em toda demo salva e é sempre ele que aparece. **Nenhum `demoDataExemplo` declara `secoes.hero.titulo`**, de propósito: copy de exemplo estática aí apareceria no lugar do nome real de um lead novo. Como o painel Conteúdo só monta os campos de seção presentes no exemplo, o campo do título ficava de fora — e o título não tinha como ser editado (ver "Título hero: uma caixa de texto, a mídia como máscara"); hoje ele é uma exceção explícita do painel (`campoSempre` em `paineis.tsx`), coberta por `__tests__/hero-titulo.test.tsx` para todas as skins do registro. Esvaziar o campo devolve o título ao nome do lead — campo de seção vazio sai do patch e volta à base (ver `diffSecao` em `lib/demos/patch.ts`).
- **Fonte**: `tema.heroTitulo.fonte`, id da lista curada (papel `"display"`); ausente = acompanha `fonteDisplay`/`fontes.display` do preset (permite trocar SÓ o título hero sem afetar os outros títulos da skin).
- **Tamanho**: `tema.heroTitulo.escala` (slider, passo 0.05) multiplica o `clamp()` de tamanho da skin via `calc()`; recortado por `SkinDefinition.heroEscalaLimites` em `aplicarTema`. O teto PADRÃO (`ESCALA_LIMITES_PADRAO`, para quem não declara os próprios) e o da `tatuagem-editorial` são **1.70**; as demais skins mantêm o teto que declararam.
- **Entre-letras**: `tema.heroTitulo.espacamento`, em `em` e **somado** ao que a skin já usa (`calc(0.04em + var(--d-hero-espacamento, 0em))` na tatuagem), nunca no lugar dele — `0` mantém a assinatura do material bruto intocada. Em `em` e não em px para acompanhar a escala em vez de apertar as letras quando o título cresce; recortado em `[-0.05, 0.3]` (`ESPACAMENTO_HERO_LIMITES`) porque acima disso o título vira letras soltas. Campo OBRIGATÓRIO de `HeroTituloTema` (os 12 presets das 8 skins declaram `espacamento: 0`) e não opcional: `aplicarTema` devolve o preset intocado quando não há patch, então um campo opcional sairia `undefined` no caminho mais comum de todos.
- **Alinhamento**: `tema.heroTitulo.alinhamento` (esquerda/centro/direita) — `text-align` (tatuagem, bloco centralizado por padrão) ou `self-*`/`text-align` (barbearia, bloco à esquerda por padrão) no elemento do título, sem afetar o resto do hero.
- **Escala, entre-letras, fonte, alinhamento e texto disparam a MESMA recontagem da máscara do vídeo** — ver "A medição tem de ser viva" abaixo. Nenhum deles precisa avisar a máscara: ela é derivada da caixa medida, e a medição é que acompanha.

### Título hero: uma caixa de texto, a mídia como máscara

**Relato** (skin `tatuagem-editorial`): o título do herói aparece em duas
camadas sobrepostas com quebras de linha diferentes, o campo do editor não
altera o texto visível, e o seletor de fontes de títulos não afeta esse
título. O HTML servido tem UMA camada só (`span.d-wordmark` com
`data-demo-slot="secoes.hero.titulo"`), então nada disso se enxerga lendo a
resposta do servidor: a segunda camada nasce na HIDRATAÇÃO. A medição é o
`scripts/qa-titulo.mjs` — ele espera a hidratação, varre o wordmark inteiro
e conta os **preenchimentos de glifo** (superfícies de letra pintadas), as
quebras de linha REAIS de cada camada (`Range.getClientRects` na caixa
HTML, `getBBox` no `<text>` da máscara) e a `font-family` computada.

**O que a medição achou** (`--marca=antes`, viewport 1100×700, preset
`sangue`; PNGs em `qa-shots/titulo-*-antes.png`):

| caso | caixa de texto (HTML) | máscara da mídia (SVG) | preenchimentos |
|---|---|---|---|
| nome curto (`ÓSSEA`) | 1 linha | 1 linha | **2** |
| nome longo COM quebra manual | **3 linhas** (`ÓSSEA STUDIO` / `DE TATUAGEM` / `AUTORAL`) | **2 linhas** (`ÓSSEA STUDIO` / `DE TATUAGEM AUTORAL`, 1194px numa caixa de 1052px) | **2** |
| nome longo SEM quebra | **2 linhas** | **1 linha** (1954px numa caixa de 1052px) | **2** |

As três causas, distintas e independentes:

1. **A segunda camada é a máscara do vídeo-no-título, e ela desenha a
   própria cópia do texto.** `VideoNoTitulo` monta por cima do wordmark e
   põe um `<text>` de SVG dentro de um `<mask>` pra recortar o vídeo/imagem
   — mas **não substitui** a caixa de texto do servidor, que continua
   pintando o gradiente por baixo. Duas superfícies pintadas = duas cópias.
   E como `<text>` de SVG **não quebra linha sozinho** (só nos `\n`, virando
   `<tspan>`), enquanto a caixa HTML quebra por `white-space: pre-line` +
   largura do container, as duas divergem assim que o nome é longo — a
   máscara transborda a caixa (1954px contra 1052px) e sobra desenhada por
   cima do texto de baixo. O nível `imagem` (fallback) **está sempre ativo**
   — `imagemFallback` é `data.imagens.hero`, que toda demo tem —, então o
   defeito não depende de ninguém ter subido vídeo nenhum.
2. **O campo do editor não alcança o título porque esse campo não é
   renderizado.** As duas camadas leem o MESMO valor (`s.hero?.titulo ??
   data.nome`) — a hipótese de a camada do vídeo ler outro campo não se
   confirmou. O que acontece é outra coisa: `montarDemoData` grava
   `secoes.hero.titulo = quebrarTitulo(lead.nome)` para todo lead, e a aba
   Conteúdo do editor só monta os campos de uma seção que existem no
   `demoDataExemplo` dela (`CAMPOS_SECAO.filter(({ chave }) => exemplo[chave]
   !== undefined)`) — e **nenhuma** das 8 skins declara `secoes.hero.titulo`
   no exemplo. Resultado: o único campo que a pessoa acha é "Nome do
   negócio" (`dados.nome`), que o título nunca lê porque
   `secoes.hero.titulo` sempre vence o `??`; e clicar no título no preview
   pede foco em `campo-secoes.hero.titulo`, que não existe. Vale para todas
   as skins, não só a tatuagem.
3. **`.d-wordmark` fixava `font-family: var(--d-deco)`.** A tatuagem
   calculava `--d-hero-font` como todas as outras skins e não a usava em
   lugar nenhum — o seletor "Título principal (hero) → Fonte" não tinha por
   onde chegar. Medido: `heroFonte=bebas` e `heroFonte=cinzel` saíram os
   dois em `Pirata One`.

**A correção**, na mesma ordem:

1. **Uma caixa de texto só, e a mídia é o preenchimento dela.** `Wordmark`
   virou client component e resolve o nível (vídeo → imagem → nada) ele
   mesmo. No nível `imagem`, a foto entra como `background-image` da
   PRÓPRIA `.d-wordmark-text`, que já tinha `background-clip: text` — a foto
   sai recortada pelos glifos por construção, com a quebra de linha do CSS,
   sem SVG, sem segunda caixa e sem nada pra alinhar. No nível `video`, o
   preenchimento da caixa é desligado (`background-image: none`; o contorno
   multicor fica) e o `<video>` é recortado por um `<mask>` cujas linhas são
   **medidas da própria caixa** (uma `<text>` por linha renderizada, na
   posição medida) — a máscara é derivada do texto, não uma segunda
   composição dele. Sem medição possível (fonte ainda carregando, caixa de
   altura zero), o nível vídeo simplesmente não sobe: a base continua.
2. **`secoes.hero.titulo` virou campo de verdade.** O painel Conteúdo passa
   a montar o "Título" da seção hero mesmo sem ele no exemplo da skin (é o
   slot que TODAS as skins marcam e que `dadosDoLead` sempre preenche) — o
   campo que o clique no preview foca agora existe, e editar muda o título.
3. **`.d-wordmark` usa `var(--d-hero-font)`**, e a tatuagem passou a
   derivá-la da `decorativa` (`theme.heroTitulo.fonte || fontes.decorativa`)
   em vez da `display`: o padrão da skin continua sendo a Pirata One do
   material bruto, e o seletor do editor passa a valer.

**Portão** (`node scripts/qa-titulo.mjs`, `--sem-portao` desliga): reprova
se algum caso tiver mais de um preenchimento de glifo, se a máscara
divergir da caixa de texto (número de linhas ou centro de linha > 3px), se
as camadas mostrarem textos diferentes ou se a fonte escolhida não chegar
ao título. A matriz é **2 telas × (3 nomes × 2 níveis de mídia + 3
fontes)**, mais uma captura do hero inteiro por tela. As duas telas
importam: no desktop (1100×700) o título cabe folgado — é o caso que
ESCONDE o defeito —, e é no celular (390×844, dpr 2) que `pre-line` quebra
de verdade (o nome longo vira 3 linhas ali). O vídeo de teste é gravado
pelo próprio Playwright em `public/qa-tmp/` **antes** de subir o servidor
(o `next start` monta o índice de `public/` na inicialização; arquivo
criado depois responde 404) e é apagado no fim — a Forja não versiona
vídeo. Duas armadilhas de MEDIÇÃO que a primeira rodada caiu e o script
hoje evita: `getBoundingClientRect()` num `<tspan>` devolve 0×0 no
Chromium, e `getBBox()` devolve a caixa de TINTA enquanto o `Range` da
caixa HTML devolve a de AVANÇO — comparar as duas acusa "desalinhamento"
de vários px onde o glifo só tem lateral negativa. A comparação é avanço
com avanço (`getStartPositionOfChar` + `getComputedTextLength`).

**Verificação da correção** (`qa-shots/_titulo-depois.md`, PNGs
`titulo-*-depois.png`): **1 preenchimento de glifo nos 12 casos** (2 telas
× 3 nomes × imagem/vídeo), com as linhas da máscara batendo com as da
caixa no avanço — no celular, `ÓSSEA STUDIO DE TATUAGEM AUTORAL` vira 3
linhas e a máscara acompanha as 3 (`x`/largura idênticos:
13/316, 74,5/193, 90,7/160,6). Fonte: padrão = Pirata One,
`heroFonte=bebas` = Bebas Neue, `heroFonte=cinzel` = Cinzel (antes os três
saíam Pirata One nas duas telas). Nada mais se mexeu: `qa-cls.mjs
--so=skins` dá **0,0000 na tatuagem** (as 8 skins passam) e `qa-visual.mjs
--so=colapso` checa os 90 slots de imagem das 8 skins sem colapso.

#### O rastro na borda superior, e a medição que tem de ser viva

Dois defeitos relatados DEPOIS da correção acima, no mesmo mecanismo — e o
primeiro já tinha tido uma tentativa de conserto que não pegou.

**A — "no celular, ao rolar até o topo do hero, o vídeo vaza para fora do
recorte das letras e aparece como rastro claro na borda superior; acontece
no repique da rolagem".** Não reproduz em Chromium headless: quatro
condições foram tentadas (repique por roda, fling por toque,
`ElasticOverscroll` ligado, CPU 6×, `UseSurfaceLayerForVideo` forçado) e em
todas a cobertura clara dentro da caixa fica em 23,0–23,2% (a área dos
glifos) com **0 px claros na faixa acima da caixa em todo quadro**. É a
classe de defeito que só aparece onde o vídeo vai para um plano de
hardware. O que a máquina do laço CONSEGUE medir é a árvore de camadas de
composição (`LayerTree` do CDP), e ela dá a causa:

| camada | o quê | tamanho |
|---|---|---|
| 41 | `SPAN.d-wordmark` | 342×167 (167 = a ink do `drop-shadow`) |
| 42 | `foreignObject mask=…` | 342×152 |
| 43 | `VIDEO` | 342×152 |
| **39** | **`VIDEO`** | **342×192** |

**A `<mask>` do SVG é operação de PINTURA, mas o `<video>` é o elemento que
o navegador entrega a uma SUPERFÍCIE DE COMPOSIÇÃO própria.** As camadas do
vídeo estavam penduradas na RAIZ (`pai=7`), não aninhadas na camada
mascarada, e a de conteúdo media **342×192 numa caixa de 342×152**: o
`object-fit: cover` de um vídeo mais alto que a caixa sobra 40px, **20
acima e 20 abaixo**. A máscara não faz parte do estado dessas camadas —
todo redesenho independente delas desenha a sobra, e os 20px de cima são
exatamente a faixa clara na borda superior.

**Por que a tentativa anterior não pegou.** Ela diagnosticou o artefato de
rolagem como duas camadas irmãs do TEXTO (preenchimento e contorno)
promovidas a compositor layers independentes e dessincronizadas por um
quadro, e fundiu as duas num elemento só. A mudança é real, mas atua
inteira sobre `.d-wordmark-text`: os pixels que vazam são de VÍDEO, de uma
terceira superfície que a fusão nunca tocou — levou 2 camadas de texto a 1
e deixou as do vídeo como estavam. Passou despercebida porque o portão só
media geometria ESTÁTICA (quantos preenchimentos existem, se os avanços
batem); uma máscara que deixa de valer na COMPOSIÇÃO não muda nenhum desses
números.

**A correção tira a causa em vez de cercá-la.** Quem entra no grupo
mascarado é um `<canvas>` do tamanho EXATO da caixa; o `<video>` sai do
grupo, reduzido a 1px transparente, e serve só de decodificador. O recorte
do `cover` passa a ser feito no `drawImage`, na ORIGEM, então **não existe
sobra para vazar**, com ou sem máscara. Canvas não é superfície de vídeo: é
pintado pelo caminho normal, dentro do grupo. É a mesma decisão que a
"Regra de superfície" já impõe aos efeitos de fundo ("quem pinta é o código
do efeito, num bitmap do tamanho que ELE escolher"). **Cercar com `overflow:
hidden` + `isolation: isolate` no envelope foi tentado ANTES e medido: a
camada de conteúdo continuava com os mesmos 342×192** — por isso não ficou.
Nada de `mix-blend-mode`, que multiplicaria a superfície repintada por ~25×
(ver "Custo por quadro dos efeitos").

Depois: nenhuma camada sobre o wordmark passa de 342×152 (a de 342×192
sumiu, as do `<video>` são 1×1) e a imagem é a mesma — 11.954–11.959 px
claros na caixa contra 11.961 antes. Custo: um `drawImage` por quadro do
VÍDEO (`requestVideoFrameCallback`, não rAF), em bitmap de no máximo 2× a
caixa — 0,21 Mpx por quadro, ~6 Mpx/s a 30 Hz, contra os 9,6 Mpx/s da
própria página e o limiar de marcação de +40 Mpx/s do portão.

**B — "com vídeo aplicado, trocar o alinhamento não reposiciona a camada do
vídeo; mudar o tamanho da fonte conserta".** A geometria da máscara é
MEDIDA da caixa de texto, e a medição rodava uma vez só: o efeito de layout
tinha deps `[remedir, texto]` e o único observador vivo era um
`ResizeObserver` na própria caixa. `.d-wordmark-text` é `inline-block` —
trocar `text-align` **move** a caixa sem **redimensioná-la**, o observador
não acorda e a máscara fica onde estava; mudar o tamanho da fonte
redimensiona a caixa, o observador dispara e a medição se corrige sozinha.
Era literalmente o "conserta" do relato. Medido no celular, alinhamento
trocado por código: larguras de linha idênticas (257,9 / 251 / 160,6) e só
o `x` divergindo — máscara parada em 42 / 45,5 / 90,7 contra 0 / 0 / 0 à
esquerda e 84,1 / 91 / 181,4 à direita, até **90,7px de desvio numa caixa
de 342px**.

**A medição tem de ser VIVA**, e são três gatilhos porque nenhum sozinho
pega as seis coisas que movem os glifos (alinhamento, texto, tamanho,
fonte, entre-letras, largura do contêiner):

1. o **efeito de layout SEM lista de dependências** — roda a cada commit,
   que é por onde passa toda mudança vinda do editor;
2. **`ResizeObserver` na caixa E no bloco que a envolve** — largura do
   contêiner e rotação de tela não passam por render nenhum;
3. **`MutationObserver` em `class`/`style`** do wordmark e do bloco — o
   alinhamento é a troca que não redimensiona nada, e pode chegar sem
   render.

Medir a cada commit não realimenta render porque só um valor DIFERENTE vira
estado (`mesmaMetrica`, tolerância de 0,05px). O `MutationObserver` é **sem
`subtree` de propósito**: com ele, o canvas do vídeo sendo redimensionado
realimentaria a medição.

**O portão cresceu junto**, porque a geometria estática não enxergava nem um
nem outro. `qa-titulo.mjs` passou a cobrir, nas duas telas: (a) alinhamento
trocado POR CÓDIGO (estilo inline no bloco, sem passar por render nenhum do
React — o caso mais duro, que cobre também o caminho do editor), (b) escala
em 1,70/0,70 e entre-letras em 0,30em/-0,05em pelas custom properties, e (c)
**a faixa de 70px ACIMA do título depois do repique da rolagem**, comparada
com a MESMA faixa no nível `imagem`: o que o vídeo acrescenta ali é o
vazamento. Antes da correção de B, (a) reprovava nas duas telas com desvios
de 42 a 299,5px.

### Editor visual (`/leads/{id}/demo/editar`)

A seção Demo da ficha virou só um resumo + atalho; a edição acontece nesta página em tela cheia (fora do route group `(app)`, sem o chrome do painel).

**Antes de criar** (lead sem `demo` salva), o botão "Criar demo" da ficha leva primeiro a **`/leads/{id}/demo/escolher`** — cards com miniatura (`SkinDefinition.thumbnail`) e nome do nicho de **todas** as skins do registro, em vez de assumir a primeira (`DEFAULT_SKIN`) como o editor fazia antes. Escolher um card navega para `/leads/{id}/demo/editar?skin={skinId}`; o editor lê essa query só na carga inicial e só quando o lead ainda não tem demo (`EscolherSkinClient`/`EditorClient`, via `useSearchParams`) — uma demo já salva ignora o parâmetro e mantém a skin dela (a troca continua disponível na aba Tema). Lead que já tem demo pula `/escolher` direto pro editor.

- **Preview ao vivo num iframe** apontando para `/demo-preview` (rota protegida por senha, como tudo). O editor manda o estado completo — `skinId` + `DemoData` efetivo + `Theme` já com `aplicarTema` + o `TemaPatch` bruto (`tema`, usado só para saber qual fonte curada buscar sob demanda) — por `postMessage` (mesma origem) a cada tecla; o iframe só renderiza a skin. Nada é lido do banco no preview, então o que se vê é exatamente o que o PUT publicará. Toggle desktop/celular muda a largura do iframe.
- **Edição por slot**: clique em qualquer elemento com `data-demo-slot` no preview → o iframe devolve o caminho por `postMessage` → o editor abre a aba/grupo certo e foca o campo (`campo-{slot}`). Links/CTAs não navegam dentro do preview (capture + preventDefault).
- **Painel em abas**: Conteúdo (negócio, serviços, depoimentos e cada seção do contrato da skin, com listas add/remove), Imagens (trocar/remover por slot de imagem + seção "Vídeo no título" quando a skin declara `videoSlots`, com aviso de peso/fallback), Tema (skin, presets, cor primária com amostra do ink calculado, fontes display/corpo da lista curada, raio, densidade, animação, toggle da Intro, hover, animação de clique, efeito de fundo, **cor do efeito** e **cor do LED** (os cinco modos — ver "Modos de cor"), **LED** e o bloco **Título principal (hero)** — fonte/escala/alinhamento) e Estrutura (drag-and-drop via `Reorder` do `motion`, ocultar/exibir, alinhamento, **animação de entrada** onde a skin oferece e o liga/desliga de **animação por seção**, presente também nas seções fixas).
- **Persistência explícita**: "Salvar" faz o PUT (diff mínimo + tema); "Excluir demo" pede confirmação inline, chama o DELETE e volta pra ficha. Aviso de alterações não salvas no header + `beforeunload`.
- **Mobile**: o painel vira um drawer inferior (72dvh) com botão flutuante "Editar"; as mesmas abas funcionam por toque. Na aba Estrutura, o `Reorder.Item` usa `dragListener={false}` + `dragControls` — o drag só inicia pelo handle dedicado (ícone ⠿, `touch-action: none`); o resto do item não tem listener de drag nenhum, então o toque rola a lista normalmente (scroll do painel) em vez de competir com o gesto de arrastar.

### Padrão para adicionar uma nova skin

1. Clone o material bruto **fora da árvore do repositório** (ex.: `~/skins-raw/<nicho>/`, nunca `creatingmk1/skins-raw/<nicho>/`). Se por qualquer motivo o clone cair dentro da árvore, rode `rm -rf` no `.git` aninhado **imediatamente após o clone**, antes de qualquer outro comando (`git clone <url> skins-raw/<nicho> && rm -rf skins-raw/<nicho>/.git`) — um `.git` aninhado virar gitlink (`mode 160000`) no índice do repo principal quebra merge/rebase de quem clonar depois. `skins-raw/` está no `.gitignore` e **nunca é commitada**: é só referência de leitura durante a conversão, descartável ao final. Leia **todos** os componentes e estilos antes de converter, não só os principais — animações e interações (hover, scroll, cursor, máquina de escrever, intro) fazem parte do que precisa ser fielmente portado, não só o layout estático.
2. Crie o pacote `src/components/demos/<nicho>/`:
   - `Skin.tsx` — composição orientada por `{ data, theme }`, tokens só via CSS vars; delega interatividade a `interactive/*.tsx` (`"use client"`); renderiza as seções pela **ordem efetiva** (`secoesVisiveis` de `lib/demos/estrutura.ts`) e marca cada texto/imagem editável com `data-demo-slot`;
   - `secoes.ts` — o contrato `SkinSecaoDef[]` (ordem default, `fixa`, `alignOptions` onde o layout aguenta);
   - `themes.ts` — `themeDefault` fiel às cores do material bruto (inclusive acentos secundário/terciário se existirem) + 3–4 presets (contraste do `destaqueInk` é responsabilidade do preset). **Regra dos 4 mundos**: todo preset novo nasce com **um preset escuro, um preset claro e dois autorais em direções cromáticas distintas entre si e distintas dos dois primeiros** — quatro mundos visuais (fundo + matiz de `destaque`), não quatro tons do mesmo. Não basta variar o brilho do fundo mantendo o mesmo matiz de `destaque` entre presets (esse foi o erro histórico corrigido em 2026-08: várias skins tinham 3 presets no mesmo matiz e só 1 realmente distinto). Valide contraste texto/fundo (≥4.5:1) e `destaque`/`destaqueInk` (≥4.5:1, mínimo 3:1 se só usado em elemento grande/UI) com a mesma fórmula WCAG de `tema.ts` (`luminancia`/razão de contraste) em cada preset antes de considerar a skin pronta;
   - `exemplo.ts` — `DemoData` completo com copy do material bruto e marca genérica.
3. Coloque os placeholders em `public/demos/<nicho>/` (locais, um por slot de `imagens`) e uma miniatura `thumb.svg` (usada no passo de escolha de skin).
4. Se a skin usa fonte nova, carregue-a em `src/app/demo/fonts/core.ts` (fontes que são default de algum preset — sempre carregadas) com var `--font-demo-*`, com o peso/estilo exatos do original (ex.: uma fonte carregada só em itálico 900 não é a mesma coisa que a mesma família em peso 400 normal). Fontes só alcançáveis por escolha explícita do editor entram como módulo próprio em `src/app/demo/fonts/dynamic/` + entrada no loader de `registry.ts` (carregadas sob demanda — ver "Fontes" acima).
5. Se o original usa uma lib de animação (ex.: `motion`), adicione a dependência e port fielmente o timing/easing em vez de recriar com CSS aproximado — o objetivo é a demo parecer idêntica ao original com os dados de exemplo, exceto o que é slot/tema por design. `interactive/LedEdges.tsx` é sempre o mesmo reexport de uma linha (`export { LedEdges } from "@/lib/demos/led/LedEdges"`, ver "Micro-interações do tema"); se o original tinha vídeo-no-texto/logo, considere declarar `videoSlots` (opt-in — ver "Vídeo-no-título" acima) e REEXPORTAR `lib/demos/titulo/Wordmark` numa linha, do mesmo jeito (`export { Wordmark } from "@/lib/demos/titulo/Wordmark"`). Não porte a técnica de novo: o mecanismo é compartilhado, e o que a skin fornece é só o CSS de `.d-wordmark`/`.d-wordmark-text` (o contrato está escrito no topo do módulo).
6. Acrescente a entrada em `src/lib/demos/registry.ts` (incluindo `heroEscalaLimites` e `thumbnail`, obrigatórios) — rota pública, ficha e editor passam a conhecê-la sem mais mudanças.
7. Rode os testes: o teste de contrato do registro (`registry.test.ts`) valida ids únicos, default entre os presets, exemplo completo, existência física dos placeholders e da miniatura, `heroEscalaLimites` coerentes, `heroTitulo`/`led` resolvidos em todo preset, `videos` ausente no exemplo (vídeo nunca tem placeholder) e o contrato de seções (ids únicos, presentes no exemplo, `alignOptions` válidos, ao menos uma seção reordenável).

### Capturas por âncora de seção (`src/lib/demos/capturas` + `scripts/capturas.mjs` + `/interno/capturas`)

Prints das demos para a prospecção por WhatsApp, gerados sem ninguém abrir o navegador e sem nenhum request pago. Este bloco é a **marcação** e o **motor**; a composição em moldura vem depois.

**A âncora aponta para uma SEÇÃO, nunca para pixel.** O enquadramento sai da caixa de `[data-d-secao="<id>"]` — o marcador que `lib/demos/animacao/SecaoMarcada.tsx` já punha no DOM para a camada decorativa, reaproveitado inteiro. Como ele envolve a `<section>` completa, "a seção do início ao fim" é a caixa dele, e mudar a skin não recalibra nada: a seção continua se anunciando sozinha. (O hero da multimarcas era a única seção das 8 skins sem o marcador — renderizado fora do `visiveis.map` — e ganhou o dele nesta feature.)

- **Marcação** (`capturas.ancoras` em `/config/app`, até 3 seções por skin, editável sem deploy pelo `PUT /api/config`): o merge é **por skin** (marcar uma não apaga as outras sete) e **lista vazia é marcação legítima** ("não capturar esta skin"). Validação estrita: skin fora do registro e seção fora do contrato da skin são erro, não silêncio — uma âncora com typo que simplesmente não captura nada só apareceria na hora de mandar o print pro lead. `ancorasEfetivas` ainda descarta seção aposentada do contrato, pelo mesmo motivo que `ordemEfetiva` tolera `ordemSecoes` velha.
- **Padrão inicial** (`capturas/padrao.mjs`): sempre o mesmo trio — **identidade** (o hero, único em toda skin), **oferta** (o que o negócio vende) e **prova/fecho** (depoimento, galeria, CTA). Ficam de fora as seções decorativas (`faixa`, `marquee`) e as que só fazem sentido em movimento.
- **Tela de marcação** (`/interno/capturas`): as 8 skins, as seções de cada uma como chips numerados na **ordem de escolha** (que é a ordem das capturas) e a **prévia do enquadramento**. A prévia carrega a skin no harness `/interno/demo-qa` dentro de um `<iframe>` de mesma origem e mede pelo MESMO seletor do motor — não tem como prometer um enquadramento diferente do que a captura entrega. Sem pixel e sem rolagem para o operador.
- **`capturas/dom.mjs`**: a lógica que roda DENTRO da página, compartilhada pela prévia (que a chama no `contentWindow` do iframe) e pelo motor (que a passa para `page.evaluate`). É `.mjs` porque o script de laço não compila TypeScript, e cada função é **autossuficiente** (nada de escopo de módulo — `page.evaluate` avalia noutro realm) e recebe a **janela alvo** como último parâmetro, com default `window`.

**ALVO, não "lead"**: a fila serve as duas famílias de demo. Um id cru é a demo de um lead; `avulsa:<uuid>` é uma demo AVULSA (ver "Demos avulsas"). `src/lib/demos/capturas/alvo.mjs` é a única definição do formato, e dele saem a coleção do doc, a rota pública e a rota de leitura em todos os quatro processos da fila. O nome dos parâmetros (`placeIds`, `--leads`) ficou como estava porque é o que a UI e o `client_payload` já mandam — o conteúdo é que virou lista de alvos.

**Motor** (`node scripts/capturas.mjs --lead=<placeId>`, `--lead=avulsa:<id>`, ou `--skin=<id>`/`--skins`; `--subir` publica no Storage). Reaproveita `subirServidor`, o Chromium do ambiente e o congelamento de animação do `qa-visual.mjs` (WAAPI, `pause()` + `currentTime` na fase em que o efeito está aceso — a faísca vive menos de 1s e a varredura ocupa 14% do ciclo). Captura em celular (390, dpr 2) e desktop (1440, dpr 1), uma imagem por âncora. `--lead` bate na rota pública; `--skin` no harness, que é como o motor é verificável sem Firestore.

Duas defesas da imagem que vai pro lead: o contexto **não carrega cookie de sessão nem `radar_device`** (com eles a demo estampa o selo "Vendo como membro" na foto) e a URL **não leva `?t=`** (token é de envio; captura interna não pode entrar na timeline de visitas do lead).

**O `vh` é a armadilha central desta feature, e apareceu três vezes.** Toda skin tem o hero em `min-h-screen`, então qualquer coisa que estique a viewport redefine o que `100vh` significa, incha o hero e empurra o resto da página para baixo:

1. Esticar o iframe até a altura do documento (o jeito óbvio de ter tudo "em vista" e disparar as revelações `whileInView`) fez a prévia medir um hero de **7737px** em vez de 900.
2. `page.screenshot({ fullPage: true, clip })` refaz o render com a viewport esticada pela mesma razão — a captura de "Imóveis em destaque" saiu **mostrando o manifesto**. Por sonda: sem `fullPage`, o `clip` é **relativo à viewport**; com ele, o recorte deixa de bater com o que foi medido.
3. Crescer a viewport para caber uma seção alta faz a seção medida em `vh` **crescer junto** — laço sem fim (o hero da barbearia no celular ia de 1300 para 1463px a cada tentativa).

Daí a sequência do motor, cada passo com um defeito por trás: `prepararPagina` (varre a página — dispara revelações e lazy-load — e espera fontes e imagens decodificadas) → `forcarRevelacaoDasSecoes` → `fixarUnidadesDeTela` (converte as alturas em `vh` para pixel **com a viewport ainda na altura real da tela**, que é o único momento em que elas valem o que devem) → `forcarImagensDaSecao` (rolar resolve o lazy-load só no eixo vertical; galeria e cardápio saíam com 2/5 e 7/13 fotos, então varre também os trilhos de rolagem horizontal) → mede → cresce a viewport se preciso, iterando até estabilizar → `neutralizarCromo` → `congelarAnimacoes` → `rolarAteSecao` (com `behavior: "instant"`: skins com nav de âncora ligam `scroll-behavior: smooth`, e a caixa era lida na posição antiga) → `forcarRevelacaoDasSecoes` de novo → `assentarLed` → `revelacaoPendente` → `caixaNaViewport` → recorte.

- **`neutralizarCromo`**: header/nav fixos pousariam por cima do começo da seção, que é onde mora o título. Some com o que é `fixed`/`sticky` **fora** da seção — na PRIMEIRA seção o cromo fica, porque ali ele é parte da abertura, e o que é grudado **dentro** da seção é conteúdo (a sidebar de Serviços da barbearia é `position: sticky`, e escondê-la deixava metade do enquadramento vazio). Decoração (`[data-d-efeito-camada]`, `[data-d-led-estilo]`) nunca sai.
- **`scroll-behavior: smooth` é a MESMA armadilha do `rolarAteSecao`, e a varredura caiu nela.** `prepararPagina` rolava com `win.scrollTo(0, y)`; em `imobiliaria` e `multimarcas` (as duas que declaram `html { scroll-behavior: smooth }` por causa do nav de âncora) isso ANIMA, cada passo do laço reiniciava a animação do anterior, a varredura mal saía do topo e o `scrollTo(0, 0)` do fim cancelava o resto. Resultado medido nas duas skins: tudo abaixo das primeiras telas ficava em `opacity: 0; translateY(56px)` — a revelação por entrada na viewport **nunca disparava**. A seção capturada saía com pedaço apagado, e as vizinhas, em branco, na prévia de enquadramento de `/interno/capturas` (que chama esta MESMA função dentro do iframe — foi lá que o defeito ficou visível). A varredura agora rola com `behavior: "instant"`.
- **`forcarRevelacaoDasSecoes` IMPÕE o estado final, em vez de esperá-lo.** A varredura *dispara* a revelação; o resultado dela depende de um IntersectionObserver e de uma animação de até 0,75s, e o motor ainda mexe na viewport entre um passo e outro — basta a foto sair no meio do caminho. Reconhece a revelação presa pelo que `motion` pinta INLINE (opacidade inline abaixo de 1, em zero ou acompanhada de transform) e deixa de fora, de propósito: opacidade de desenho sem transform (o degradê a 0.9 sobre o card de imóvel), transform sem opacidade (carrossel, parallax, barra de progresso, contador rolante — medidos em `translateX(-680px)`, `scaleX(0.4)`, `translateY(-2.2em)`) e a camada decorativa. Roda duas vezes: uma antes das medidas da trilha (seção presa mede uma caixa que não é a que vai ser fotografada) e outra como ÚLTIMO passo antes do disparo. **Só no contexto de captura** — tudo por `page.evaluate`; nenhuma linha da demo muda e quem abre o link continua vendo as seções entrarem por scroll.
- **O portão**: `tituloCoberto` reprova a captura se sobrou qualquer elemento fixo por cima do primeiro título da seção — é o que transforma "nunca cortando título" de intenção em medida. A contagem de imagens é a **da seção**: uma pendente noutro canto do documento não entra no enquadramento; uma pendente aqui vira buraco.
- **O segundo portão**: `revelacaoPendente` reprova a rodada se sobrou alguma coisa presa no estado inicial, e reparte o resultado em **acima / dentro / abaixo** do recorte. A repartição é o ponto: buraco DENTRO é pedaço apagado na foto que vai pro lead; ACIMA ou ABAIXO é a página vizinha em branco, que é o que a prévia de enquadramento e a moldura mostram em volta da seção. Medido com a rolagem animada devolvida à mão: multimarcas no celular acusa 10 elementos presos; com a varredura instantânea, zero nas três âncoras.
- **`assentarLed`**: o LED é `position: fixed` e o ponto mais brilhante viaja com `--d-led-scroll` (a posição do scroll na página). Numa captura isso não sobrevive — pra enquadrar uma seção alta o motor CRESCE a viewport, e a barra passa a se espalhar por uma altura que nenhum visitante tem. Medido na tatuagem-editorial: `--d-led-scroll` 0,67 em "investimento" e 0,81 em "depoimentos", com a viewport esticada de 844 para 1457 e 1330px, o que dava uma **faixa acesa no meio do recorte com as duas pontas apagadas** — o LED deixando de ler como luz de borda. A fase é presa na metade antes do disparo, mesma decisão de `congelarAnimacoes` e pelo mesmo motivo. Último passo de todos: o LED reage a scroll/resize, então fixar antes de qualquer um dos dois seria fixar e perder.
- **Estado da última rodada**: 46 de 48 aprovadas. As 2 reprovadas são a `portfolio` da tatuagem2 nas duas telas — galeria rolada por scroll cuja altura é calculada em JS e **recomputada a cada resize** (9580px no desktop, 11608 no celular), então nenhum congelamento de CSS a segura. O motor reprova em vez de gerar imagem errada; a saída é remarcar a âncora em `/interno/capturas`, sem deploy.

**Onde rodar** (decidido antes de implementar, com os custos na mesa): laço local/CI em lote, custo R$ 0, ~25–40s por lead, nenhum request pago e zero risco pro deploy do app. As alternativas avaliadas foram Vercel sob demanda (exige `@sparticuz/chromium`, ~170MB contra o teto de 250MB do bundle, `maxDuration` apertado no Hobby) e GitHub Actions (sem limite, mas latência de minutos). O motor foi escrito com o miolo em `capturas/dom.mjs`, então ligar a rota serverless depois é escrever o adaptador, não reescrever o motor.

#### Disparo pela plataforma (GitHub Actions + `lead.capturas`)

A geração deixou de ser só laço local: a ficha do lead tem **"Gerar capturas"** e o grupo de busca tem a ação equivalente em lote. O motor NÃO mudou de dono — quem enquadra continua sendo `scripts/capturas.mjs`, chamado como processo filho pelo orquestrador.

**As três partes não se falam diretamente**, e o contrato entre elas é `lead.capturas` (`lib/demos/capturas/estado.ts`): a ROTA enfileira, o WORKFLOW executa e escreve o resultado, a FICHA mostra. Estado é dado persistido no doc do lead, não memória de servidor — quem abrir a ficha no meio do caminho, de outro aparelho, vê o mesmo.

- **Rota** (`POST /api/leads/[id]/capturas` e `POST /api/capturas` para o lote; `GET /api/capturas?ids=` para acompanhar): restrita a usuário logado, qualquer papel — gerar print é trabalho de prospecção, não de administração. O **token do GitHub vive só em `GITHUB_CAPTURAS_TOKEN`** e é usado exclusivamente em `lib/github/dispatch.ts`, dentro de route handler; o corpo aceita apenas `{ forcar }`. Sem token, 503 dizendo qual variável falta, e a UI desabilita o botão em vez de deixá-lo falhar no clique.
- **Ordem gravar-antes-de-disparar**: o estado é escrito ANTES do `repository_dispatch` (é o que faz o pedido sobreviver a fechar a aba, e é o `execucaoId` que o workflow carrega de volta). Se o disparo falhar, o estado é **desfeito para `falhou`** com o motivo — lead "enfileirado" esperando um workflow que ninguém chamou é o estado que mente.
- **Workflow** (`.github/workflows/capturas.yml`): instala o Chromium (o projeto depende de `playwright-core`, que não baixa navegador), roda o motor com `--leads` — **um `next build` e um Chromium para o lote inteiro** — e publica em `capturas/{leadId}/`. Escreve o resultado **direto no Firestore com a mesma credencial do Storage**: um callback HTTP de volta pro Radar exigiria endpoint público novo e segredo compartilhado só pra dizer "terminei". `concurrency` serial (duas rodadas brigariam pela mesma porta e pelo mesmo caminho no Storage) e passo `if: failure()` que marca a falha na hora quando o job quebra ANTES do motor.
- **`escritaAindaVale`**: o workflow só escreve se o `execucaoId` ainda for o vigente. Cobre pedir, achar demorado e clicar em "Refazer" — o run antigo termina depois e enterraria o resultado do novo, ou marcaria "falhou" por cima de um "pronto".
- **`semNoticia` / `estadoVisivel`**: um `repository_dispatch` responde 204 e pronto. Workflow desabilitado, arquivo fora do branch default ou runner que nunca pegou a fila — **ninguém avisa**. Passado o limite de silêncio (10 min na fila, 30 rodando, contados de marcos diferentes), o estado vira FALHA explícita com a causa provável. É a mesma doença do botão que volta ao normal sem confirmação: um estado que mente.
- **Acompanhamento sem recarregar** (`useEstadoCapturas`): pergunta de tempos em tempos enquanto houver algo em andamento (4s no primeiro minuto, 12s depois) e para sozinho no estado terminal. O relógio de `estadoVisivel` é o **instante da última resposta**, nunca `Date.now()` no render — além de manter o render puro (o linter do React Compiler recusa impureza ali), faz o estado envelhecer junto com a informação, não com a pintura.
- **Galeria na ficha** (ver "Galeria em duas seções, e as duas ações" abaixo): duas seções, celular e desktop, com alternância entre a versão crua e a composta, e duas ações — compartilhar pela folha nativa e baixar arquivo a arquivo — para uma imagem, para as três de um grupo e para as seis. Tela que não saiu vira vão explícito, e rodada parcial mostra qual âncora reprovou.
- **As defesas do motor continuam valendo**: o contexto abre a demo **sem cookie de sessão, sem `radar_device` e sem `?t=`** — com sessão a demo estampa "Vendo como membro" na foto, e com token a captura entraria na timeline de visitas do lead. O `next start` do runner sobe com um `APP_PASSWORD` sorteado por rodada (`subirServidor`), então o cookie que o motor usa pra ler `/api/leads` e `/api/config` nada tem a ver com a senha de produção.
- **Marcadores do selo de estado**: `⋯` (na fila) e `↻` (gerando) em vez dos `◔`/`◑` do `StatusBadge` — nesta fonte os círculos parciais saem como lascas sem contorno e a 12px leem como cisco. No `StatusBadge` funcionam porque aparecem numa sequência que dá contexto; aqui o marcador aparece sozinho.

**Tempo medido** (local, fake DB, 3 leads × 3 âncoras × 2 telas = 18 capturas, 18 aprovadas): **164s no total**, sendo ~31s de `next build` + `next start` e ~133s de captura; um lead sozinho leva ~31s. No runner, somar `npm ci`, a instalação do Chromium e um build mais lento — a primeira imagem de um pedido individual sai em ~3–4 min. É por isso que o lote paga o build uma vez só, e por que o `timeout-minutes` do job é generoso.

**Custo**: nenhum request pago em nenhum ponto — a demo é Server Component que lê só o Firestore, e o workflow gasta minutos de Actions (2000/mês grátis em repo privado) e armazenamento no Storage.

**Para funcionar em produção, três coisas fora do código**: o workflow precisa estar no **branch default** (o GitHub só registra dispatch de lá — antes disso `actions/workflows` lista zero e o disparo responde 404), os secrets `FIREBASE_*` precisam existir no repositório, e `GITHUB_CAPTURAS_TOKEN` precisa estar na Vercel.

#### Composição em moldura (`src/lib/demos/capturas/moldura.mjs`)

A captura crua é conteúdo puro: começa e termina no pixel da seção, sem nada em volta. Numa conversa de prospecção ela parece um recorte de imagem qualquer — **não se lê como "um site num aparelho"**. O compositor gera uma SEGUNDA versão de cada captura: celular dentro de um aparelho desenhado, desktop dentro de uma janela de navegador desenhada. **As duas ficam guardadas** (`CapturaImagem.url` e `CapturaImagem.composta`), porque servem a coisas diferentes: a composta é a que se manda inteira, a crua é a que se recorta, monta em carrossel e manda como detalhe.

- **Quem desenha é o Chromium que o motor já tem aberto.** A moldura é uma página HTML com a captura dentro; "compor" é tirar um screenshot dela. Nenhuma dependência de rasterização (`sharp`, `canvas`) entrou no projeto por causa disto, e a moldura virou código de layout — verificável em teste e olhável em captura, como o resto da feature.
- **dpr 1 nas dimensões em PIXEL do PNG cru.** É o que faz a captura entrar 1:1: qualquer outro fator reamostraria a imagem e o texto da demo chegaria borrado do outro lado. O contexto do compositor é separado justamente por isso (o de captura roda em dpr 2 no celular).
- **O HTML é escrito ao lado do PNG e aberto por `file://`, com `src` relativo** — embutir a captura como `data:` URI custaria uma string base64 do tamanho do arquivo a cada imagem, sem ganho nenhum.
- **A moldura de celular é borda e canto, nada mais** — ver "Moldura de celular" logo abaixo, que é onde a proporção e o mínimo estão explicados.
- **O celular não exibe endereço em canto nenhum** (é aparelho, não navegador) e **o navegador exibe o endereço REAL da demo** — `${APP_PUBLIC_URL}/demo/{leadId}`, sem `?t=` (token é de envio; estampado na foto viraria link circulando fora da timeline a que pertence). `APP_PUBLIC_URL` é variável nova e OPCIONAL: não dá pra deduzir (no runner o app roda em `127.0.0.1:3123`, e o `window.location.origin` que o resto do app usa não existe fora do navegador). **Sem ela a pastilha sai vazia** — uma janela sem endereço é honesta, um domínio inventado não. No modo `--skin`, que não tem lead, sai vazia pelo mesmo motivo.
- **Borda, raio e margem saem da LARGURA, nunca da altura.** Encolher a captura até caber numa proporção deixaria o texto ilegível, que é o contrário do que a imagem existe para fazer — a captura entra sempre em tamanho natural.
- **O fundo da composição é a paleta da PRÓPRIA demo** (`paletaDaPagina` em `dom.mjs` lê `--d-bg`/`--d-bg-alt`/`--d-bg-elev`/`--d-accent`/`--d-text` do elemento da seção — propriedade customizada é herdada, e a skin declara as variáveis na raiz do seu componente, não no `<html>`). Compor sobre uma cor da plataforma seria carimbar o Radar na imagem que vai pro lead. O **cromo** (grafite do aparelho, claro/escuro da janela) decide-se pela luminância desse fundo: janela clara sobre demo clara — ou escura sobre a tatuagem, que é quase preta — some, e aí a moldura deixa de ser moldura.
- **…mas com AFASTAMENTO GARANTIDO do fundo do site** (`corDaComposicao`, `moldura.mjs`). Sair da paleta da demo não bastava: o fundo era um degradê da própria `--d-bg`, então a moldura ficava creme sobre creme (petshop) e quase-preto sobre quase-preto (tatuagem) — a borda sumia e a composta voltava a parecer um recorte solto. Agora o fundo do site é empurrado **na direção da TINTA da própria demo** (`--d-text`, que é clara em tema escuro e escura em tema claro, então a direção do afastamento se resolve sozinha) até o afastamento chegar a `AFASTAMENTO_MIN`. A **menor** mistura que resolve é a escolhida — o objetivo é a moldura existir, não a composição chamar atenção. Nada de branco ou preto fixos em lugar nenhum: são as duas cores que transformam a demo de qualquer lead no mesmo slide genérico.
- **A medida do afastamento é L\*, não luminância relativa** (`claridade`, mesmo arquivo). Y é energia, não percepção: perto do preto anda devagar demais (a tatuagem, quase preta, tem Y ≈ 0,003) e perto do branco, depressa demais — um afastamento fixo medido em Y sairia enorme numa demo escura e invisível numa clara, que é exatamente o defeito que ele existe pra evitar. L\* é uniforme, e `AFASTAMENTO_MIN` (10 pontos) é o mesmo degrau para o olho nos dois extremos. O teste percorre **todo preset das 8 skins** e cobra o afastamento em cada um.
- **A sombra sob a moldura também sai da paleta**: um tom escuro da cor do PRÓPRIO site, em duas camadas (uma curta e fechada, uma longa e aberta), pra a moldura pousar no papel em vez de ganhar um contorno borrado. Preto neutro debaixo de uma demo quente lê como sujeira cinza, e o alfa acompanha o papel — mais pesado no escuro, onde uma sombra fraca simplesmente não existe. O fio de 1px em volta era `rgba(0,0,0,.22)`/`rgba(255,255,255,.14)` fixos e passou a ser a tinta da demo, quase apagada.
- **A composta é derivada, nunca substituta.** Só existe se a crua saiu; uma falha na composição (ou uma altura que passa do teto de textura do Chromium) não invalida a imagem que já está no disco — a entrada fica sem `composta` e a galeria mostra vão explícito. Trocar calada pela crua seria mentira pequena.
- **`fullPage` aqui é seguro**, ao contrário do outro lado: a página da moldura é toda em pixel fixo, sem nenhuma unidade de tela, então não existe a armadilha do `vh` que proíbe `fullPage` na captura da demo.

#### Moldura de celular: proporção real, e o que fazer com seção alta

A primeira versão da moldura **esticava o aparelho para caber a seção inteira**. Numa seção de quatro telas isso dava um corpo de celular em 1:4 — proporção que não existe em aparelho nenhum, e que denuncia a montagem antes de qualquer outra coisa. O aparelho também tinha corpo em gradiente grafite, ilha, faixa de status e botões laterais: retrato de um objeto, quando o que a imagem precisa dizer é "este site num celular".

A correção seguinte trocou o esticado por dois modos: `aparelho` para quem cabe numa tela, e um **cartão** — corpo alongado sem chrome nenhum — para quem não cabe. O cartão resolveu a proporção impossível, mas trocou um problema por outro: um retângulo vertical de 1:3,7 não lê como nada reconhecível numa conversa, e a galeria de `/interno/capturas` (ver abaixo) não tinha como avisar que uma seção ia sair assim antes de gerar — só se descobria olhando o resultado. O cartão **não existe mais**.

**Agora são dois modos, decididos pela altura da captura**, e a altura de uma tela não é inventada — vem da viewport de celular do próprio motor (390×844 em dpr 2), que já é a de um aparelho de verdade:

- **`aparelho`** — a captura cabe em uma tela. A tela da moldura tem **sempre uma tela de altura**, em proporção real. Sem isso, uma seção de 0,6 tela produzia um celular atarracado de 1:1,5 — a mesma proporção impossível do esticado, só do outro lado.

  **E a sobra deixou de ser cor chapada.** A ideia era "a página continua acima e abaixo da seção", e o preenchimento com o `--d-bg` da demo era um substituto para isso — só que, na imagem, duas faixas lisas exatamente onde o visitante veria as seções vizinhas leem como **seção vizinha em branco**, não como página continuando (e o LED, que é fixo na viewport, aparecia só na faixa do meio, reforçando a leitura). Agora **quem enquadra é o motor**: seção de celular mais curta que a tela é centrada na viewport (`centralizarSecao`) e o recorte passa a ser **a tela inteira** (`caixaDaTela`), com a página de verdade acima e abaixo. `folga` cai a zero, e o **portão** em `comporMoldura` reprova a captura em que ela não for — região vazia acima ou abaixo do recorte é reprovação, não detalhe. Quando não dá pra centrar (seção perto do começo ou do fim do documento) o scroll fica no limite e o quadro continua sendo uma tela REAL da página, que é o que um aparelho mostraria ali também.

  Isto só valeu depois da correção da revelação (ver "Capturas por âncora de seção"): mostrar a vizinhança de uma seção cuja entrada nunca disparou seria trocar a faixa lisa por uma faixa lisa com outro nome.
- **`aparelho` também cobre "um pouco mais alta que uma tela"**: até `LIMITE_FATIA_UNICA` (1,15×), a seção continua num quadro só — encolhida (as duas dimensões, pra não distorcer) até a altura bater com a tela, com a sobra nas LATERAIS preenchida pelo fundo da demo em vez de virar duas fatias quase idênticas. `escala` no retorno de `medidasMoldura` cobre os dois lados: 1 no caso comum, menor que 1 aqui.
- **`fatiado`** — a captura passa de `LIMITE_FATIA_UNICA` telas. Em vez de um corpo esticado (proporção impossível) ou um cartão sem chrome (proporção reconhecível, mas nada), a seção é **cortada em telas consecutivas**, cada uma dentro do MESMO aparelho de proporção real do modo acima, **lado a lado, na ordem de leitura** (a primeira tela da seção fica à esquerda). A composição final fica **deitada**. No máximo `FATIAS_MAX` (3) quadros — seção maior que isso mostra só as primeiras telas, e `cortada: true` registra que sobrou conteúdo de fora. Tecnicamente é sprite-sheet: um `<img class="captura">` por quadro, todos com o MESMO `src` (a captura crua inteira), cada um deslocado por `top: -topo` dentro de uma janela `overflow: hidden` de uma tela de altura — uma imagem só no disco, N recortes dela na composição.

  **O `topo` de cada quadro não é `i × umaTela` puro** — foi, e era bug: isso só bate com o fim do conteúdo quando a altura da seção é múltiplo EXATO da tela, e os casos comuns (2,4 telas, 1,3 telas) não são. A última janela sobrava com uma faixa vazia no final — a "cor de fundo" (posta atrás da imagem pra cobrir a folga legítima do aparelho de seção curta) vazando onde deveria haver conteúdo. `calcularToposFatias` (`moldura.mjs`) resolve com `topo(i) = i × (altura − umaTela) / (n − 1)`: a primeira fatia começa no topo, a ÚLTIMA termina EXATAMENTE no fim do conteúdo, e a sobreposição entre todas fica distribuída por igual em vez de empurrada pra última. Só quando a seção é **truncada** (mais telas do que `FATIAS_MAX` mostra, `cortada: true`) o espaçamento volta a ser `i × umaTela` — aí não tem "fim" a alcançar, a decisão já foi mostrar só as primeiras telas e parar.

  **Portão automático** (`vazioNaFatia`, mesmo arquivo): mede quantos pixels de área vazia uma fatia teria ao final, usando a altura REAL da seção (já medida pelo motor, nunca inferida de cor de pixel) — não "esta cor parece fundo?", e sim "esta janela vai além do que existe?". `medidasMoldura` chama esse portão pra toda fatia não-truncada antes de devolver e **lança** se algum dia der diferente de zero. Como `comporMoldura` já envolve a chamada num `.catch()`, isso vira reprovação automática de verdade no motor — mesmo espírito de `tituloCoberto` — não um teste que alguém precisa lembrar de rodar.

**Por que fatiar em vez de cortar na primeira tela ou esticar:** a âncora aponta para uma `<section>`, e o motor inteiro existe para capturar "a seção do início ao fim" — o `vh` preso, a viewport que cresce, as imagens forçadas em trilho horizontal. Cortar na primeira tela jogaria fora até 80% de uma seção como `estoque` da multimarcas (4,9 telas) só na versão que é a enviada, desfazendo esse trabalho. Fatiar mantém cada tela **em proporção real de aparelho** (a coisa que se reconhece "site num celular" numa conversa) sem prometer que a seção inteira é um aparelho só.

**A versão crua continua sendo a seção inteira**, sem nada em volta — é ela que alimenta tanto o `aparelho`/`fatiado` quanto o carrossel de detalhe da galeria. A ÚNICA exceção é a seção de **celular mais curta que a tela**, que sai enquadrada como uma tela inteira com a seção centrada (ver `aparelho` acima): ali "a seção inteira" e "uma tela" descrevem quadros diferentes, e o que a composição precisa mostrar é o segundo. Não existem duas capturas — é um arquivo só, e o recorte é o mesmo dos dois lados.

**Verificado por captura, com o conteúdo real que reproduzia o bug** (`--skin=tatuagem-pigmento-vivo --so=celular`, harness, sem lead): `investimento` mede 1,5 tela — 2 fatias, o caso "2 fatias" do relato. `estilos` mede 2,4 telas — 3 fatias, o caso "2,4 telas" citado como exemplo da fórmula. Nas duas composições a ÚLTIMA janela termina no último elemento de conteúdo real (o card "Blackwork" em `estilos`, a linha "Sob consulta" em `investimento`), sem faixa vazia — o defeito que a fórmula antiga (`i × umaTela`) deixava passar nesses dois casos exatos.

#### Prévia do link (`src/lib/demos/capturas/previa.mjs` + `og:*` em `/demo/{leadId}`)

O cartão que aparece quando alguém cola o endereço da demo numa conversa. Três restrições mandam no desenho, e **todas vêm de fora do nosso código**:

1. **O buscador de prévia do WhatsApp não executa JavaScript e desiste depressa.** A imagem tem que existir pronta num arquivo, num endereço direto. Por isso ela é composta pelo motor junto com as capturas, sobe pro Storage, e o `og:image` aponta **direto pra `storage.googleapis.com`** — arquivo pronto na CDN, sem nenhum salto pelo app. Um endereço do Radar que redirecionasse seria um salto a mais que o buscador pode não esperar.
2. **O cartão é pequeno**: a imagem chega com uns 340px de largura num celular. Daí a regra central: **o nome do negócio é TEXTO da composição, não pixel do print.** O nome dentro do screenshot vira borrão nessa escala, e "o nome legível em miniatura" é o ponto todo. O tamanho do tipo cai conforme o nome cresce, com **piso** — abaixo dele o nome deixa de se ler, e a imagem perde a única coisa que precisa entregar.
3. **É deitada** (1200×630) e mostra **o topo do site**: janela de navegador à direita, sangrando pela borda, nome e linha de apoio à esquerda. A janela é a MESMA de `moldura.mjs`, reduzida — duas implementações de cromo divergiriam no primeiro ajuste, e a galeria passaria a mostrar um navegador diferente do do cartão.

- **A captura do topo tem duas diferenças deliberadas** em relação à captura por âncora: o cromo **não** é neutralizado (cabeçalho e nav fixos são parte do topo de um site; escondê-los entregaria uma página decapitada) e o recorte é a viewport inteira, não a caixa de uma seção. E ela **volta ao topo** antes do disparo: `prepararPagina` termina a varredura no fim da página, e capturar dali mostraria o rodapé.
- **JPEG, não PNG.** O WhatsApp descarta prévia grande, e 1200×630 de screenshot em PNG passa de 1MB com folga. Sobe com `Content-Disposition: inline` (e não `attachment`, como as capturas): marcado como anexo, parte dos clientes recusa a imagem do cartão.
- **`og:title` e `og:description` saem do próprio lead** (nome + slogan, e o texto do hero da demo dele), com `twitter:card = summary_large_image` — sem isso o cartão sai com miniatura quadrada e o nome fica pequeno demais para ler. A **linha de apoio** da composição é a MESMA descrição, lida do `<head>` da página pelo motor (`identidadeDaPagina`) em vez de remontada: recalcular abriria a porta pra a prévia dizer uma coisa e a página dizer outra.
- **Recurso de reserva, nunca nada** (`/demo/{leadId}/previa`): enquanto as capturas não rodaram, o `og:image` aponta pra uma rota que desenha o nome do negócio sobre a cor da marca com `ImageResponse` (Satori + Resvg, **nenhum JS no cliente**; a fonte padrão vem embutida no pacote do Next, então não há busca de fonte na rede atrasando a primeira resposta). Um cartão de conversa sem imagem é pior que um cartão simples. Ela **não** imita o layout da prévia composta: sem o print do topo, imitar renderizaria uma janela de navegador vazia, que promete um site e mostra um retângulo. Cache curto (5 min), porque ela vale só até a prévia de verdade existir.
- **Mora sob `/demo/`, não sob `/api/`**: `/demo/` é o único prefixo público do app (ver `src/proxy.ts`), e debaixo de `/api/` o buscador de prévia levaria 401 — ele não tem cookie de sessão nenhum.
- **`?v={carimbo}` em toda URL gravada no lead.** Os objetos sobem com cache imutável de um ano, mas o caminho de cada captura é determinístico: sem uma versão na URL, o "Refazer" trocaria o arquivo no Storage enquanto navegador e buscador de prévia continuariam servindo o antigo — a ficha mostrando a rodada passada e o WhatsApp, um cartão que já não existe. O nome do arquivo da prévia carrega o carimbo também.

#### Galeria em duas seções, e as duas ações (`GaleriaCapturas` + `capturas/acoes.ts` + `/api/leads/[id]/capturas/arquivo`)

A galeria agrupava por ÂNCORA, com as duas telas lado a lado. Agora agrupa por **TELA**, em duas seções — é o que casa com o uso: quem manda print no WhatsApp manda a sequência de celular OU a de desktop, nunca uma de cada.

- **Alternância crua ↔ com moldura**, uma para a galeria inteira, começando na composta (é a versão que se manda; a crua fica a um clique, para quem vai recortar). Captura que não tem a versão pedida vira **vão explícito** — "saiu sem moldura nesta rodada" — e nunca a outra versão no lugar sem avisar: entregar a crua onde se pediu moldura é uma mentira pequena que só aparece depois de a imagem já ter sido enviada.
- **As miniaturas são ladrilhos de altura fixa.** Miniatura na proporção de uma moldura de celular de 2500px empurra o vizinho e enche a grade de buracos. Celular é cortado a partir do topo; desktop cabe inteiro com tarja, porque cortar as laterais comeria a borda da janela, que é o que faz a imagem se ler como um site.

**Duas ações distintas e explícitas**, nas três escalas — uma imagem, as três de um grupo, as seis:

- **Compartilhar** abre a folha nativa do aparelho (`navigator.share({ files })`) com as imagens anexadas. **Não salva nada no aparelho**, e isso é dito na interface, ao lado de onde se decide: o arquivo vai direto para o app escolhido e some. Sem esse aviso, a descoberta acontece pelo caminho ruim — procurando na galeria do celular uma imagem que nunca foi salva.
- **Baixar** salva os arquivos, **um por imagem, sem compactar**. A pausa de ~350ms entre eles não é enfeite: disparar vários downloads no mesmo instante faz o navegador descartar todos menos o primeiro.
- **Onde a folha nativa não anexa arquivo, a ação de compartilhar não aparece.** Não há reserva empacotada: botão que não funciona é pior que botão nenhum, e cair num formato que ninguém pediu é pior ainda. A sonda usa um `File` de verdade — `canShare({ files: [] })` responde `true` em navegador que não anexa nada — e é lida por `useSyncExternalStore` (snapshot de servidor `false`), não por estado somado a efeito: no servidor não existe `navigator`, e responder no primeiro render divergiria da hidratação.
- **Zip não existe mais.** Era a saída para a mesma restrição que hoje a rota resolve, e um pacote é pior que os arquivos: obriga a descompactar antes de mandar qualquer coisa.

**As duas passam por `/api/leads/[id]/capturas/arquivo`, e não pelo endereço do Storage, por causa de CORS**: os objetos são públicos, mas o bucket não manda cabeçalho de CORS, e sem ele o `fetch` do navegador para outra origem é bloqueado — sem `fetch` não há `File`, e sem `File` não há folha nativa. A mesma rota serve o download: mesma origem faz o atributo `download` valer, e o `Content-Disposition` de lá carimba um nome legível (`barbearia-norte-celular-01-hero.png`) no lugar do nome no Storage, que começa com o `placeId` e não diz nada a quem abre a pasta depois — e agora o operador vê esse nome seis vezes seguidas.

**O gesto do Safari**: `share` precisa ser chamado ainda dentro do toque, e buscar as imagens antes consome esse crédito (`NotAllowedError`). Os arquivos buscados ficam guardados, então a interface pede "toque de novo" em vez de dizer que falhou — no segundo toque o `share` sai na hora, com os arquivos já em mãos. Fechar a folha é `AbortError`: não é erro, não vira aviso.

**A prévia do link aparece na galeria**, no tamanho aproximado do cartão de conversa. Não é enfeite: é a única forma de conferir, antes de mandar, que o nome do negócio continua legível quando a imagem encolhe — que é a coisa que a composição existe pra garantir.

#### Verificação por captura da composição e da prévia

Laço local com o app real e um lead semeado (arranque de banco falso, patch temporário não commitado — o mesmo dos outros laços de QA), skin `barbearia-editorial`, `APP_PUBLIC_URL=https://radar.exemplo.com`. **6 capturas, 6 compostas, 1 prévia.** Três coisas que só apareceram olhando:

1. **A moldura do celular estava sendo montada em px de CSS, não em pixel.** A caixa medida vem de `getBoundingClientRect` (390px de largura no celular), mas o PNG sai com o dobro disso — a captura é em dpr 2, de propósito, pra imagem vista num celular não chegar serrilhada. A composição em 390px encolhia a captura à metade dentro da moldura e jogava fora exatamente essa nitidez. A composta do celular saía 480px de largura; agora sai 960.
2. **A máquina de escrever do hero da barbearia entregava o nome do negócio pela metade.** `TypewriterText` é `setTimeout` + estado do React, não WAAPI, então `congelarAnimacoes` não a alcança — a captura de desktop saiu com "BARBEARIA DOM AUR|" no lugar do nome, que é justamente o que a imagem existe pra mostrar. No celular passava **por acidente**: a seção é mais alta que a tela, o motor cresce a viewport e prepara a página de novo, e esse tempo a mais dava pro texto terminar. Corrigido com `esperarTextoEstavel` (dom.mjs), genérico: espera o texto parar de mudar, com teto, e a captura sai com ressalva se ele nunca parar. **Defeito antigo, das capturas cruas — não veio da composição.**
3. **A galeria virava uma tira de meio metro.** Miniatura na proporção de uma moldura de celular de 2500px empurra o vizinho e enche a grade de buracos. Viraram ladrilhos de altura fixa: celular cortado a partir do topo, desktop inteiro com tarja (cortar as laterais comeria a borda da janela, que é o que faz a imagem se ler como um site).

**A prévia no cartão de conversa** (bolha de 302px num celular de 390, imagem em 296×155 — a largura real do cartão): o nome sai em ~16px na tela e se lê sem esforço; o topo do site se reconhece como site. É a medida que importa, porque o nome dentro do print, nessa escala, é borrão.

**O recurso de reserva** responde em **162ms na primeira chamada e 26ms na segunda**, PNG de 29KB — bem dentro da paciência de um buscador de prévia. Só o nome sai em peso regular: a única face embutida no pacote do Next é a regular, então quem carrega a legibilidade é o corpo do tipo, não o peso.

**Segunda rodada — moldura nova e as duas ações.** As 6 compostas do mesmo lead, e cada uma vista em bolha de mensagem num celular de 390px (imagem em 294px, teto de 400px de altura, dpr 1 — o pixel do PNG sendo o pixel da tela). No tamanho de conversa as três de celular se leem como página em cartão, sem nada que sugira aparelho de proporção impossível, e as três de desktop se leem como janela de navegador já pelo formato. Duas coisas apareceram só aqui:

- **Seção mais curta que uma tela virava celular atarracado.** Não estava no pedido, mas é o mesmo defeito do esticado invertido — corrigido junto (ver "Moldura de celular" acima).
- **O rótulo "as 6" mentia.** Com a moldura escolhida e uma composição que não saiu, o botão dizia "Compartilhar as 6" e mandaria 5. Passou a contar o que a ação de fato leva — as seções já contavam certo, só o topo não. O caminho sem folha nativa também foi conferido: nenhuma ação de compartilhar aparece, nem o aviso, e sobra só "Baixar".

O vão de `servicos/celular` nessa rodada era **deliberado** — semeado sem `composta` de propósito, pra olhar o ladrilho tracejado "saiu sem moldura nesta rodada" na galeria de verdade, não só no teste unitário. **Fechado depois**: reexecutado `scripts/capturas.mjs --lead=...` do zero (sem seed manual), e a rodada real saiu com as 6 imagens **e as 6 molduras**, `servicos/celular` incluída (`cartao 900×3344`, os 6 serviços inteiros, sem corte — confirma que "não é um defeito do motor" não era só afirmação: o compositor gera essa composição igual às outras quando ninguém a exclui na mão). Reseeded a galeria com o resultado real e confirmado por captura: zero ladrilhos de vão, e "Baixar as 6" (não mais "5").

**Nota à parte, sobre este próprio arquivo**: um script de edição do commit "Compartilhar e Baixar" corrompeu `ARCHITECTURE.md` para 1,2GB (substituição em fatia vazia, inserindo texto entre cada caractere) — o push foi recusado pelo limite de tamanho do GitHub antes de qualquer coisa chegar ao remoto. Restaurado com `git checkout HEAD~1 -- ARCHITECTURE.md` e reaplicado por âncora de texto (não por número de linha, que teria mudado). Verificado depois: `git diff` entre o commit anterior e o corrigido mostra só as duas edições pretendidas; todo cabeçalho de seção anterior à sessão (65 de 65) segue presente, palavra por palavra, sem duplicata; nenhuma linha passa de 3000 caracteres (o sintoma do bug); e o commit corrompido ficou **inalcançável** por qualquer branch — nunca foi ao remoto, é lixo local que o `git gc` eventualmente recolhe.

### Efeitos visuais (`src/lib/demos/efeitos`) — camada decorativa opcional

Registro **separado** do registro de skins (mesmo padrão: metadado central + contrato + testes), pra uma camada decorativa opcional que uma skin pode somar por cima de si. Alimenta o seletor "Efeito de fundo" da aba Tema do editor (`Theme.fundoEfeito`/`TemaPatch.fundoEfeito`, ver "Micro-interações do tema" acima) e é renderizado como sibling da skin (não por dentro dela) tanto na rota pública quanto no preview.

**Cobertura de viewport** — todo efeito monta o próprio elemento-raiz com `position: fixed; inset: 0` (nunca `absolute`: um `absolute inset-0` sem ancestral posicionado fica preso à altura do bloco inicial do documento — na prática, some depois do primeiro scroll) e `pointer-events: none` (nunca bloqueia clique).

  **Bug histórico (corrigido) — z-index negativo era invisível em toda skin**: até esta correção, Aura e Grão usavam `z-index` **negativo** (`-z-10`), com a intenção de ficar atrás do conteúdo normal da demo. Na prática isso escondia o efeito por completo, em TODA skin: toda seção da demo tem fundo sólido próprio (`--d-bg`/`--d-bg-alt`/`--d-bg-elev`, cobrindo 100% da largura, sem gaps entre seções) e o `Skin.tsx` de cada skin também pinta seu próprio `bg-[var(--d-bg)]` na raiz. Como `position: fixed` sempre cria stacking context próprio, um z-index negativo só precisa vencer o stacking context RAIZ — mas isso o coloca ANTES (mais atrás) de qualquer descendente não-posicionado (ou posicionado com `z-index: auto`) desse mesmo nível na ordem de pintura do CSS, ou seja, atrás do próprio fundo opaco do `Skin.tsx` e de toda seção — nunca visível através dele, em nenhum tema. Reproduzido renderizando `/demo-preview` com `next dev` + Playwright (screenshot com o efeito ligado vs. desligado, mesmo estado, sem `prefers-reduced-motion`): diff de pixels zero para Aura e Grão. `gradiente`/`particulas` (abaixo) já usavam `z-40` **positivo** — por isso eram os únicos dois realmente visíveis (confirmado pelo mesmo diff), inconsistência introduzida durante a migração do `Theme.fundoEfeito` antigo. **Correção**: os 4 efeitos agora usam a MESMA convenção — `z-index` positivo (`z-40`), por CIMA do conteúdo, não atrás dele. Isso não é um comprometimento visual: todo efeito já é desenhado com opacidade baixa por design (ver `estilo.ts` de cada pacote) — pensados desde o início pra tingir por cima sem atrapalhar legibilidade, o que só faz sentido estando de fato por cima do conteúdo. Confirmado visualmente em tema claro e escuro (screenshot comparando ligado/desligado em intensidade 3, `/demo-preview` com a skin `barbearia-editorial`, presets escuro "norte" e claro "creme").

- **Contrato do componente** (`types.ts`): `EfeitoProps { intensidade: 0|1|2|3, cores: ThemePaleta, pausado? }` — `0` desliga por completo (sem nada no DOM); `cores` é a paleta do tema vigente (nunca cor hardcoded); `pausado` é o sinal externo (ex.: o editor esconde o preview) somado às pausas automáticas do próprio efeito. Regras fixas pra todo efeito: renderiza **estático** (sem listener/rAF de movimento) em `prefers-reduced-motion`; pausa via `IntersectionObserver` fora da viewport e via `visibilitychange` com a aba oculta (`useEfeitoAtivo.ts` implementa as três fontes de pausa + a leitura de reduced-motion, reutilizado por todo efeito); `devicePixelRatioClamped` (`dpr.ts`) limita a 2 qualquer rasterização em canvas; a propriedade `filter` **nunca** é animada (blur/etc. é fixo no elemento — só `transform`/`opacity` mudam por frame). **O elemento-raiz de todo efeito multiplica `var(--d-efeito-fade, 1)` na própria opacidade** — é assim que a camada apaga o efeito por interpolação nas seções com animação desligada (ver "Animação por seção"); o teste de contrato do registro cobra isso de efeito novo. Todo efeito reage à mudança de `intensidade` na MESMA instância, sem depender de remontagem: o efeito do `IntersectionObserver` em `useEfeitoAtivo` roda a cada commit (não só no mount) pra (re)observar o elemento-raiz assim que ele aparece no DOM — necessário porque um efeito que nasce com `intensidade: 0` não renderiza elemento nenhum no primeiro commit, então um `useEffect` preso a `[ref]` (identidade estável, nunca muda) nunca chegaria a observar o elemento real depois que a intensidade sobe (ver `grao/__tests__/Grao.test.tsx`, que cobre 0→2/2→0 na mesma instância).
**Regras de acabamento visual** (fixadas na revisão de qualidade — ver "Revisão de qualidade visual dos efeitos e do LED" em Verificação da UI; valem para TODO efeito novo):

- **Nenhuma borda dura.** Toda forma termina em gradiente/máscara até transparente — inclusive nas pontas do traço e na borda da viewport. Isso vale também para o que "parece" suave: uma rampa de dois stops até `transparent` tem inclinação constante e o olho lê o fim dela como contorno, mesmo sob blur.
- **Teto de 6% de opacidade para forma geométrica.** O efeito é renderizado POR CIMA do conteúdo (ver "Cobertura de viewport"), então a opacidade é a única coisa entre a decoração e a legibilidade do texto. Cada `estilo.ts`/`geometria.ts` tem teste do próprio teto. A única exceção é `faiscas`, com justificativa registrada no arquivo: fonte de luz PONTUAL (16 brasas de ~10px ≈ 0,16% da viewport) não é a superfície que o teto existe pra conter, e a 6% ela deixaria de existir.
- **Espessura e brilho variáveis ao longo do traço, nunca uniformes.** É por isso que o `ondas` desenha uma banda preenchida em vez de um `stroke`, com a espessura variando com o ângulo.
- **Nenhuma figura reconhecível como polígono na intensidade 3.** Foi o que reprovou a primeira versão de `geometrico-pulsante`.
- **REGRA DE SUPERFÍCIE: efeito animado é renderizado em `<canvas>`, ou é estático. Nenhum efeito pode animar um `<svg>` do tamanho da viewport.** É a regra mais dura do contrato, e a mais barata de verificar. Um `<svg>` é uma árvore VETORIAL RETIDA que o navegador mantém e re-rasteriza: mexer em qualquer coisa dentro dele — geometria de um `path`, `stop-color` de um gradiente (é o que o modo de cor animado faz, a 60 Hz), opacidade de um nó — invalida a superfície INTEIRA, que é repintada no tamanho da tela a cada quadro. Num canvas, quem pinta é o código do efeito, num bitmap do tamanho que ELE escolher (`ondas` rasteriza a 0,4 px por px CSS), e a cor animada é LIDA uma vez por desenho em vez de aplicada a centenas de nós.
  - **O teste operacional da regra é "o navegador REPINTA a superfície a cada quadro?"** — não "existe animação?". Animar `transform`/`opacity` de um elemento composto (as manchas da `aura`, do `gradiente` e da `varredura-de-luz`, os pontos de `particulas`/`faiscas`) é trabalho de COMPOSIÇÃO, não de repintura: o navegador reaproveita a camada já rasterizada. Por isso esses efeitos são "estáticos" no sentido da regra mesmo tendo movimento, e por isso medem 55–60 fps na condição de celular abaixo. O que a regra proíbe é a superfície do tamanho da tela que precisa ser DESENHADA DE NOVO todo quadro.
  - **Corolário medido, que a letra da regra não pega:** uma nuvem de elementos cujo `background` depende de uma cor ANIMADA é a mesma doença em outra superfície — cada elemento regenera a imagem de gradiente dele e repinta, e a soma cobre a viewport. É exatamente o caso da `filotaxia` (93 spans com `radial-gradient` na cor da camada): **24,6 fps** no modo arco-íris contra **59,0 fps** com a cor do tema, atribuído desligando só o modo de cor. Efeito novo com muitos elementos pintados por gradiente cai aqui, mesmo sem um `<svg>` à vista.
  - **Cobrado por teste** (`efeitos/__tests__/registry.test.ts`): cada efeito é renderizado na intensidade 3 e o markup não pode conter `<svg>`. A regra vale hoje **sem exceção** — a lista de dívida que existia no teste tinha uma entrada só, `veios`, e ela saiu junto com o efeito.

**Auditoria dos 8 efeitos do registro** (inventário levantado no navegador real, celular 390×844, intensidade 3, modo arco-íris: contagem de nós da camada, tamanho do maior elemento em relação à viewport, quantos elementos animados e quais propriedades):

| efeito | superfície | o que muda por quadro | veredito |
|---|---|---|---|
| `aura` | 2 `<canvas>` de 256² esticados para 199%/168% da viewport | `transform: translate3d` por rAF; o bitmap só é redesenhado quando a COR muda (≤10 Hz) | **passa** — composição; a repintura é de 65 mil pixels, não de 2,6 milhões |
| `grao` | 1 div com `background-image` (tile de canvas gerado 1×) | nada (só a opacidade em transição) | **passa** — estático |
| `gradiente` | 2 divs com `radial-gradient` (225%) | `transform` por `@keyframes` | **passa** — composição |
| `particulas` | 21 spans de 2–3px | `transform`/`opacity` por `@keyframes` | **passa** — composição, elementos minúsculos |
| `filotaxia` | 93 spans com `radial-gradient` na cor da camada | `transform` por `@keyframes` + a cor animada, que repinta o background de todos | **passa na letra, REPROVA no fps** (24,6) |
| `ondas` | 1 `<canvas>` rasterizado a 0,4 px por px CSS | o próprio código repinta o bitmap a ~30 Hz | **passa** — a repintura é do tamanho que o efeito escolheu |
| `faiscas` | 17 spans pequenos | `transform`/`opacity` | **passa** — composição |
| `varredura-de-luz` | 1 div de 219% com `mix-blend-mode: screen` | `transform: translateX` | **passa** — composição (blend de uma camada, não repintura) |

- **`veios` era o único violador da regra escrita, e SAIU do registro** (sem substituto — ver `EFEITOS_MIGRADOS`). Era 1 `<svg>` de 100% da viewport com 93 nós, 8 animados, mais `stop-color` de 6 gradientes repintados a cada quadro nos modos de cor animados. Estava registrado como dívida porque passava no piso de fps (54,1 contra 59,9 com a cor do tema). A rodada da aura mostrou que o piso de fps **não enxerga custo de repintura** nesta máquina, que é exatamente o custo que o `<svg>` de viewport tem — a dívida deixou de ter defesa medida, e o efeito saiu.
- **`filotaxia` é o achado que a auditoria não esperava**: não tem `<svg>` nenhum e mesmo assim é o efeito mais lento do registro por uma distância enorme. Reprova o piso de 45 fps.
- **A linha da `aura` mudou de dono nesta rodada**: a auditoria anterior dizia "passa — composição, sem repintura", e isso era verdade só na cor do TEMA (ver "A aura no celular" em Verificação da UI).

- **Nenhum `filter` num efeito que anima `transform`** — nem fixo. "Não animar `filter`" (a regra antiga, no contrato acima) **não basta**: um elemento com `filter` não composita a transformação, então o navegador re-rasteriza E re-filtra a superfície inteira a cada quadro. No `gradiente` isso custava 5/6 dos quadros da página (10 fps contra 55 fps sem o filtro, medido — ver "Custo por quadro dos efeitos" em Verificação da UI). Quando o efeito precisa de suavidade, ela vem da RAMPA (mais paradas de gradiente, cauda mais longa), que é repintura barata; blur gaussiano de mancha radial é, para essa forma, a mesma coisa. O contrato do registro (`efeitos/__tests__/registry.test.ts`) renderiza cada efeito nas intensidades 1–3 e cobra que **nenhum** produza `filter:` no markup — é a rede que pega isso em efeito novo, e não só nos dois que tinham o defeito.

- **`fita.ts` FOI REMOVIDO** junto com o `veios`: era o gerador de path SVG de traço afilado, compartilhado por `veios` e `geometrico-pulsante`, e os dois saíram do registro. O problema que ele resolvia (um `stroke` tem espessura constante e ponta reta, começa e termina em aresta) continua valendo como regra de acabamento — quem desenha traço hoje é o `ondas`, e resolve o mesmo problema em canvas, com banda preenchida em vez de `stroke`.

- **`corComputada.ts`** — `corParaRgb`/`rgba`, a leitura da cor da camada por quem pinta em CANVAS. Um efeito recebe a cor como STRING CSS, e nos modos animados essa string é um `var(--d-efeito-cN, #hex)` que o navegador interpola a 60 Hz. Quem desenha em CSS interpola a string no `background` e paga o repinte da superfície inteira; quem desenha em canvas põe a string no `color` do próprio canvas, LÊ o valor computado de vez em quando e desenha com números. Compartilhado por `aura` e `ondas` — se a conversão divergisse entre os dois, um deles ficaria sem cor sem ninguém perceber.
- **`registry.ts`** guarda só metadado (`{ id, nome, nichosRecomendados }`) — **sem** o componente, pra quem só precisa listar efeitos (ex.: o seletor "Efeito de fundo" do editor) nunca puxar código de nenhum. `getEfeito(id)` resolve por id (ou `"nenhum"`/desconhecido → `undefined`); `intensidadePadrao(efeito, nicho)` devolve 2 se o nicho da skin está entre os recomendados do efeito, 1 caso contrário; `resolverEfeitoFundo(fundoEfeitoId, intensidadePersistida, nicho)` combina os dois (mais a intensidade persistida em `TemaPatch.fundoEfeitoIntensidade`) num resultado pronto pra render (`undefined` = nada a mostrar). O componente em si é resolvido por `getEfeitoComponenteDinamico(id)` (`dynamicComponents.ts`), sempre via `next/dynamic(() => import(...), { ssr: false })` — nunca bloqueia o first paint da demo nem entra no HTML pré-renderizado (confirmado em `next build`: `/interno/efeitos` gera estático sem nenhum efeito no HTML).
- **`aura/Aura.tsx`** — duas esferas de fumaça colorida que derivam para os cantos ao longo do scroll, desenhadas em **`<canvas>`**, movidas só por `transform: translate3d` com interpolação (lerp) em direção a um alvo: no desktop (`pointer: fine`) o alvo segue o ponteiro; no celular o alvo é o CENTRO da viewport, deslocado pelo progresso de scroll e somado a uma deriva lenta autônoma (senoidal), pra não morrer parado. Matemática do alvo isolada em `alvo.ts` (testável sem DOM, `__tests__/alvo.test.ts`). Nenhum `filter` — nem fixo (ver a regra de acabamento acima: um elemento filtrado não composita a transformação, e com o `transform` novo a cada quadro isso media **12,7 fps**).
  - **Por que canvas, e não uma `<div>` com `radial-gradient`** (rodada "a aura trava no celular", ver Verificação da UI): a rampa em CSS custava barato na cor do TEMA e caríssimo nos modos de cor ANIMADOS. Uma custom property de cor que muda a 60 Hz REGENERA a imagem de gradiente e repinta o elemento — e cada esfera tem ~2× a viewport de lado. Medido no celular 390×844 com CPU 4×, rolando a página inteira: **10,5 Mpx/s repintados com a cor do tema contra 83,6 Mpx/s no iridescente e 82,6 no arco-íris**, ~1,4 Mpx por quadro só de decoração. É o mesmo corolário da regra de superfície que reprovou a `filotaxia`, com 2 superfícies gigantes no lugar de 93 pequenas. Hoje o bitmap tem **256×256** (esticado pelo CSS; a ampliação é interpolada pelo navegador e a mancha não tem detalhe fino — mesma decisão do `ondas`) e só é redesenhado quando a cor MUDA, no máximo a 10 Hz: nos modos `tema`/`fixa` o efeito desenha uma vez e nunca mais. Depois da correção, o arco-íris marca 120,7 pinturas/s contra 220 — e o que sobra acima da referência são os dois bitmaps de 65 mil pixels, não superfície de viewport.
  - **A transparência é PRÉ-CALCULADA, e o `mix-blend-mode` caiu** (`paradasMancha` em `aura/estilo.ts`): cada parada da rampa já traz o alfa final (perfil medido × `opacidadeAura`), o canvas composita normal (source-over) e não existe mais `opacity` no elemento nem blend nenhum. O blend, aliás, **nunca fez o que o comentário dizia**: a raiz do efeito é `position: fixed; z-index: 40`, que é um stacking context, e stacking context ISOLA blending — as duas esferas faziam `screen` entre si e nunca com a página. Medido: no preset claro o efeito ABAIXA a luminância média da viewport (0,806 → 0,650), o oposto de "soma luz, nunca escurece". A troca é visualmente neutra: diferença média de **1,0 a 2,0/255** (máx 9) entre as folhas `_folha-efeito-aura-{antes,depois}.png`, nas 6 combinações de preset × intensidade — para escala, a presença do próprio efeito contra "sem efeito" é da mesma ordem de grandeza.
  - **O visual é o mesmo, e é ele que manda**: duas esferas de fumaça colorida que se deslocam para os cantos ao longo do scroll. Tamanho aparente, rampa, opacidade final, caminho e ritmo não mudaram — o que mudou foi a superfície em que isso é pintado.
  - **Cor da aura** (`aura/cores.ts`) — os dois blobs (`paleta.destaque`/`paleta.acentoSecundario`) são editáveis via `TemaPatch.auraCores` (aba Tema do editor, só aparece com "aura" selecionado): `{ primaria?, secundaria? }` (cada campo cai no default do tema quando ausente) ou o preset fixo `"fumaca-colorida"` (`FUMACA_COLORIDA`, deliberadamente independente da paleta de qualquer tema). Ausente = deriva 100% do tema, igual a antes deste controle existir. `paletaParaAura(paleta, auraCores)` devolve uma CÓPIA da paleta do tema com só `destaque`/`acentoSecundario` substituídos — os dois únicos campos que `Aura.tsx` lê — então o contrato `EfeitoProps.cores: ThemePaleta` fica igual pros outros 3 efeitos, sem prop especial. Resolvido no mesmo ponto que `resolverEfeitoFundo` (`loadDemo` da rota pública e o postMessage do preview), persistido em `LeadDemo.tema.auraCores` como qualquer outro campo de `TemaPatch` (validado em `validaTema`).
- **`grao/Grao.tsx`** — textura de ruído: um tile é desenhado num `<canvas>` **uma única vez** (`devicePixelRatioClamped(2)` no tamanho), virado data URL e usado como `background-image` repetido — sem loop de JS nenhum a partir daí, opacidade baixa escalada pela intensidade.
- **`gradiente/Gradiente.tsx`** — **não usa `filter` nenhum** (ver a regra de acabamento acima e "Custo por quadro dos efeitos" em Verificação da UI): as duas manchas caem por uma rampa de 7 paradas com cauda longa (`PARADAS_PRIMARIA`/`PARADAS_SECUNDARIA`), que é o que o `filter: blur(80px)` anterior fazia por cima delas — só que sem re-rasterizar 150% de viewport a cada quadro da animação de deriva. É o resto do parágrafo abaixo em tudo mais.
- **`gradiente/Gradiente.tsx`** e **`particulas/Particulas.tsx`** — migrados do antigo `Theme.fundoEfeito` fixo por skin (cada skin tinha seu próprio `BackgroundEffect.tsx` em CSS puro, sem intensidade nem pausa automática): mesma técnica visual (dois radiais derivando devagar / pontos subindo em loop, posições determinísticas por índice), agora um componente único por efeito que só depende de `cores` e escala com `intensidade` (contagem/opacidade). Estilo separado em `estilo.ts` por pacote — puro, testável sem DOM (`__tests__/estilo.test.ts`), inclusive o fallback estático de `prefers-reduced-motion` (`animationName: "none"`, não só pausado). **Fallback estático de partículas** (`particulas/estilo.ts#PontoParticula.topEstatico`): sem `@keyframes` rodando, a posição CSS de partida da subida animada (`bottom: -10px`, sempre FORA da viewport) ficaria parada lá pra sempre — `prefers-reduced-motion` some com o efeito inteiro (achado durante a correção acima, mesmo método de captura). `topEstatico` (determinístico por índice, igual a `left`) dá uma posição própria, dentro da viewport, só usada nesse fallback.
- **Os 5 efeitos da leva "veios/filotaxia/geometrico-pulsante/faiscas/varredura-de-luz"** passaram por uma reescrita de acabamento (a primeira versão foi reprovada na revisão visual — ver Verificação da UI). Estado atual:
  - **`veios` e `geometrico-pulsante` FORAM REMOVIDOS** — o geométrico virou `ondas`; o `veios` saiu **sem substituto**. Ver `EFEITOS_MIGRADOS` logo abaixo para o que acontece com as demos já publicadas que os escolheram.
  - **`filotaxia`** — mesma matemática de ângulo dourado; cada ponto virou gradiente radial com queda até transparente, com raio e suavidade contínuos por índice, e a nuvem inteira passa por máscara radial. O raio máximo é medido em **`vmin`**, não em `%`: com percentagem, `left` e `top` medem eixos diferentes e a espiral virava elipse em toda tela não-quadrada.
  - **`faiscas`** — brasa com núcleo claro e queda radial (era cor chapada num `rounded-full`), tamanho contínuo por índice. Mantém o motor de posições de `particulas` e o blend aditivo. **No tema CLARO as faíscas são quase imperceptíveis** — `mix-blend-mode: screen` de um dourado sobre creme quase não soma luz; é o comportamento desde sempre, e trocar o blend resolveria a visibilidade escurecendo o preset claro, que é pior.
  - **`varredura-de-luz`** — máscara no COMPRIMENTO do feixe (sem ela as duas pontas cruzam a tela em linha reta) e perfil assimétrico na largura: núcleo estreito fora do centro com cauda longa atrás, em vez de uma rampa simétrica com o meio marcado.

- **`ondas` (`ondas/Ondas.tsx` + `ondas/estilo.ts`) — anéis concêntricos em CANVAS**, o substituto do `geometrico-pulsante`. Anéis nascem no centro e se expandem até a borda (o percurso vai até METADE DA DIAGONAL, então o anel só termina depois de passar pelos cantos), com espessura e opacidade decaindo ao longo do caminho: nasce gordo e invisível, engorda a opacidade numa rampa curta de ataque e vai afinando e apagando até sumir na borda. Decisões, cada uma com o defeito que ela evita:
  - **Canvas, nunca SVG** — é a "Regra de superfície" abaixo, e este efeito é a razão dela existir. Um `<svg>` do tamanho da viewport é uma árvore retida: mexer em qualquer coisa dentro dele (geometria, `stop-color` do modo de cor animado) repinta a superfície inteira a cada quadro. No canvas quem repinta é este código, num bitmap, e a cor do modo animado é **lida** (`getComputedStyle(canvas).color`, a cada 3 desenhos) em vez de aplicada a centenas de nós — é assim que um efeito em canvas respeita os 5 modos de cor sem saber que eles existem (medido: matiz da diferença 39° no tema → 179° em `fixa` → 332°/165°/48° em `transicao` → 39°/57°/28° em `iridescente` → 39°/159°/273° no `arco-iris`).
  - **Banda preenchida, não `stroke`** — `stroke` tem espessura constante em todo o caminho; a banda é construída com contorno externo e interno próprios, então a espessura varia com o ÂNGULO. Junto com a ondulação do raio (dois harmônicos por anel, que ainda giram devagar com o tempo), é o que garante que **nenhum anel se leia como circunferência perfeita** na intensidade 3 — a regra que reprovou os hexágonos do efeito anterior. Testado: ≥5% de variação de raio na volta, em todo anel, em qualquer instante.
  - **Seção em camadas, com degraus IGUAIS** — a banda é preenchida de 3 a 6 vezes, da mais larga e quase transparente à mais estreita e mais cheia, e as larguras seguem um sino `(1−u²)²` em vez de espaçamento linear (rampa reta tem quina onde encontra o zero, e o olho lê quina como contorno). Os alfas são calculados pra cada camada acrescentar o MESMO degrau (`a_k = c/(1−k·c)`): a primeira tabela, escrita à mão como 0,1/0,2/0,3/0,8, concentrava 42% de salto na camada de dentro — uma borda dura no meio da fita, medida no canvas como 63/255 de alfa entre pixels vizinhos, hoje 28/255 (≈1 nível de 255 na tela). Anel fraco usa menos camadas (o degrau já sai pequeno multiplicado pelo alfa dele) — metade do preenchimento de um quadro sai dessa economia, e o PICO composto é igual nas três tabelas, então nada pisca ao trocar.
  - **Disparo escalonado e irregular** — cada anel tem período próprio (7,0–12,4s) e fase própria (passo áureo, que espalha, mais um empurrão de ruído determinístico, que tira a cadência). Períodos incomensuráveis: dois anéis nunca voltam a nascer juntos.
  - **Teto de 6%** no elemento (dentro do canvas tudo é alfa relativo), com pico REAL medido de 4,4% na tela.
  - **O custo, que quase reprovou o efeito**: a primeira versão marcou **7,3 fps** na condição de celular com CPU 4× (ver "fps por efeito"). Duas correções, as duas medidas: rasterizar a 0,4 px por px CSS (a ampliação é interpolada pelo navegador e a mancha não tem detalhe fino: 7,3 → 28 → 37 fps conforme a escala caiu) e **preencher com gradiente só a camada de dentro** — gradiente é avaliado pixel a pixel pelo rasterizador, e trocar as camadas de fora por tinta chapada levou de 45 a 59 fps sozinho. Some-se o redesenho limitado a ~30 Hz (o anel mais rápido cresce 1,8px entre um desenho e outro; a página fica com o resto do quadro pra rolagem): **57,1 fps**.

**Efeito removido do registro (`EFEITOS_MIGRADOS` em `registry.ts`)**: uma demo publicada guarda o id do efeito em `LeadDemo.tema.fundoEfeito` (Firestore), então apagar um efeito sem mais nada deixaria o id morto no banco — recusado pela validação do PUT ("chave desconhecida") e, pior, com o efeito do PRESET ressuscitando no lugar do que a pessoa escolheu. O mapa é a migração, e ela vive no REGISTRO, não no banco: `idEfeitoAtual`/`getEfeito`/`getEfeitoComponenteDinamico` resolvem o id antigo para o destino, `fundoEfeitoAceito` mantém válido o PUT de uma demo antiga, e o editor abre já com o destino selecionado (`migrarTemaPatch` em `demos/tema.ts`, aplicado ao carregar o rascunho — é o que faz o PRÓXIMO save gravar o id novo). Nenhuma migração de dados, nenhum job. `aplicarTema` PRESERVA o id salvo (é o que está no banco); quem traduz é sempre a resolução.

O destino pode ser outro efeito ou **`"nenhum"`** — removido sem substituto, e aí a demo simplesmente passa a não ter camada decorativa:

- **`geometrico-pulsante` → `ondas`**: saiu por dois motivos independentes — formava figura legível (hexágonos concêntricos de linha contínua) e animava um `<svg>` do tamanho da viewport, o que travava o celular. O substituto tem a mesma leitura.
- **`veios` → `nenhum`**: era o último violador da regra de superfície. Saiu **sem substituto**: nenhum efeito do registro tem a mesma leitura de traço, e inventar um não estava no pedido. Junto com ele saíram `veios/geometria.ts` e o `fita.ts` compartilhado, que ficou sem nenhum consumidor. Uma demo publicada com `veios` renderiza sem camada decorativa (o teste cobra que ela **não** herde o efeito do preset), o PUT dela continua válido e o editor abre com "Nenhum" marcado.

- **Teste de contrato** (`__tests__/registry.test.ts`): ids únicos, campos obrigatórios (`nome`/`nichosRecomendados`) e — renderizando cada componente RAW direto via `react-dom/server` (fora do wrapper `next/dynamic`, que sempre devolve `null` no server) — intensidade `0` não renderiza nada, intensidade `1` renderiza o overlay; mais `intensidadePadrao`/`resolverEfeitoFundo` (inclusive o caso de compatibilidade: id antigo sem intensidade persistida cai no default do nicho, nunca em "nada").
- **Teste de compatibilidade** (`__tests__/compat.test.ts`): o preset "ouro-da-meia-noite" da barbearia sul tinha `fundoEfeito: "particulas"` hardcoded desde antes deste registro existir — roda o pipeline real (`aplicarTema` ← preset/patch, depois `resolverEfeitoFundo`) sem `TemaPatch`/intensidade nenhuma (o formato mais antigo possível) e confirma que ainda resolve pro mesmo efeito.
- **Harness de teste** (`/interno/efeitos`, fora do `(app)` e fora do passo de escolha de skin, protegida por sessão como o resto do app): cada efeito registrado sobre fundo claro e escuro, com slider de intensidade (0–3) e toggle do sinal `pausado`, pra avaliação visual no celular e no desktop.
- **Render na demo** (`src/app/demo/[leadId]/page.tsx` e `src/app/demo-preview/page.tsx`): `resolverEfeitoFundo` roda no `loadDemo`/postMessage (mesmo dado que resolve `theme`), e `<EfeitoCamada>` (que resolve o componente dinâmico por dentro, mais o modo de cor e o fade por seção — ver "Modos de cor" e "Animação por seção") é renderizado como **sibling** de `<Skin>`, nunca por dentro dela; as cores vêm de `resolverCamadaEfeito`, a mesma função nos três pontos de render. Import dinâmico sem SSR: não atrasa o first paint (a skin já está visível quando o chunk do efeito carrega) e não toca no `VisitaTracker` (componente separado, sem overlap de listeners/DOM). Nenhum dos dois pontos de render precisa saber de posicionamento — `fixed`/`z-index` é sempre do próprio efeito (ver "Cobertura de viewport" acima), então preview e rota pública ficam automaticamente fiéis um ao outro.

## IA na Forja (`src/lib/ai`) — sugestões de demo via Gemini

Botão "✨ Gerar com IA" no editor de demos (e checkbox "Começar com sugestões de IA" no passo de escolha de skin): o Gemini sugere um ponto de partida de tema + textos calibrado pelo nicho. Princípios:

1. **Chave só em env** (`GEMINI_API_KEY`), chamadas exclusivamente server-side (`src/lib/ai/gemini.ts` é o único ponto que fala com `generativelanguage.googleapis.com`). Modelo: `gemini-3.5-flash` (o flash mais atual, GA em jul/2026 — constante `GEMINI_MODEL`).
2. **Sem a chave, nada quebra**: `GET /api/ia` devolve `{ disponivel: false }`, o editor oculta o botão, o passo de escolha troca o checkbox por um aviso e a rota de sugestão responde `503 ai_unavailable`.
3. **Mesma mecânica de custos das APIs pagas**: cada chamada real ao Gemini passa por `reserveQuota(sku "aiGeneration")` ANTES do fetch. Teto default 50/mês (configurável em /config como qualquer SKU), preço default US$0 (free tier do flash) — o meter aparece no dashboard como os demais.
4. **Nível de intervenção escolhido ANTES da chamada** (`src/lib/ai/nivel.ts`, `NivelIA`): clicar em "Gerar com IA" (ou marcar "Começar com sugestões de IA" no passo de escolha) abre um seletor com 3 opções ANTES de qualquer request ao Gemini —
   - **Toque leve**: só `themeId`/`destaque`/`fonteDisplay`/`animacao`, nenhum texto.
   - **Equilibrado** (default, comportamento histórico): tudo do toque leve + `slogan`/`descricao` (hero) + `titulosSecoes` (título de cada seção não-fixa).
   - **Completo**: tudo do equilibrado + `textosSecoes` — rótulo/título/texto/CTAs de CADA seção não-fixa, reescritos no tom do nicho e no idioma da região do lead (`textosSecoes` substitui `titulosSecoes` neste nível; nunca os dois juntos).

   O nível entra tanto na INSTRUÇÃO (`montarPromptSugestao`) quanto no SCHEMA (`schemaSugestao`) enviados ao Gemini — o modelo só recebe/devolve os campos daquele nível (chave de nível mais largo na resposta é sempre "chave desconhecida", rejeitada igual a qualquer desvio de schema). **Persistido por usuário**: `Usuario.ultimoNivelIA` (`GET`/`PUT /api/ia/nivel`, self-service — mesmo espírito de `ultimoPrecoBaseSlider`), lido para pré-selecionar o seletor e salvo a cada troca.
5. **JSON validado com schema estrito, retry 1x**: a rota envia `responseMimeType: application/json` + `responseJsonSchema` (orientação ao modelo) e valida localmente contra o contrato da skin E o nível escolhido (`validarSugestao`): preset entre os `themePresets` da skin (paleta dentro dos tokens do Theme), `destaque` hex (o único token de cor patchável via `TemaPatch`), fonte da lista curada (papel display, recomendadas da skin primeiro), `animacao` de `ANIMACOES`, e textos curtos pt-BR (slogan ≤120, descrição ≤400, título ≤80, rótulo ≤40, CTA ≤60 — comprimento é recortado, não motivo de rejeição). Chave desconhecida/enum inválido/seção fora do contrato → UM retry com os problemas anexados ao prompt (nova reserva de cota); inválido de novo → `502 ai_error`.
6. **Só as seções NÃO-fixas recebem texto novo** — o título da fixa (hero) é o nome/wordmark do negócio, nunca tocado; a `descricao` (equilibrado/completo) vai para `secoes.hero.texto` (apresentação, não identidade) e o `slogan` para `dados.slogan`. No nível completo, o mesmo limite vale para `textosSecoes`: hero fica de fora, só ganha slogan/descrição como nos outros níveis. **O schema é montado DINAMICAMENTE a partir dos slots de CONTEÚDO da SKIN ATIVA** (`schemaSugestao(skin, nivel, idioma)`), nunca uma união hardcoded de todas as skins: `textosSecoes` cobre rótulo/título/texto/CTA/CTA secundária de toda seção não-fixa do contrato (incluindo o rodapé, quando a skin o modela como seção comum — a nav de cada skin deriva o rótulo do link do MESMO `rotulo` da seção, então também sai traduzida); no nível completo, `servicos`/`depoimentos` entram como arrays de tamanho FIXO (igual à quantidade de exemplo — `skin.demoDataExemplo.servicos/depoimentos` — nunca inventa nem remove item), nome+descrição e autor+texto respectivamente (preço nunca entra: é dado do lead). Skin sem depoimentos de exemplo (lancheria, barbearia2) simplesmente não ganha a propriedade `depoimentos` no schema — nada a gerar. **Nenhum campo de identidade do lead entra no schema em nenhum nível** (nome, endereço, cidade, telefone, whatsapp, horários, instagram e o título do hero) — testado para as 8 skins do registro.
7. **Nunca sobrescreve sem confirmar**: a rota só GERA — quem escreve é o usuário. O editor mostra a sugestão num preview (preset, amostra da cor, fonte, animação, textos, serviços, depoimentos) com **Aplicar/Descartar**; aplicar muda apenas o rascunho em memória (servicos/depoimentos aplicados por índice — só nome/descrição ou autor/texto mudam, preço/categoria/destaques/nota/contexto do item atual são preservados) e nada é publicado sem o "Salvar" normal (PUT com a validação estrita de sempre). O fluxo `?ia=1` da criação usa o MESMO preview — a demo nova "começa com sugestões" no nível já escolhido no passo de escolha (`?nivel=` na URL), mas ainda atrás de um Aplicar explícito. Slot que volta vazio ou fora do schema é rejeitado pela validação (retry/erro) — nunca esvazia um campo já preenchido.
8. **Prompt** (`montarPromptSugestao`): nicho (da busca do lead, fallback no nicho da skin), sub-nicho, nome, endereço e rating/total de avaliações JÁ salvos (nunca dispara busca/enriquecimento novo), mais as escolhas permitidas do nível escolhido. Dados públicos do lead, nenhum dado sensível.

## Idioma da IA na demo (`src/lib/idioma.ts` + `src/lib/demos/idioma.ts`)

A IA da Forja (acima) gera TUDO no idioma do prospect, não em pt-BR fixo — a IA de análise interna do Radar (Radar de leads/`gerarAnaliseBusca`) continua em pt-BR, sem relação com isto.

1. **País do endereço do PRÓPRIO lead, não da região da busca**: `cidadeDoEndereco` (`src/lib/leads/cidade.ts`) extrai cidade E país do `Lead.endereco` (o último segmento do endereço formatado — Places API sempre chamada com `languageCode=pt-BR`). `src/lib/idioma.ts` centraliza o mapa país (pt-BR) → idioma BCP-47 (`idiomaDoPais`) — compartilhado com `lib/geo/geocode.ts` (idioma da REGIÃO geocodificada da busca, `lead.busca.idioma`, uma aproximação de mercado usada só como contexto de busca) para não duplicar a lista. `src/lib/demos/idioma.ts#idiomaPadraoDoLead` deriva o idioma-alvo do endereço do lead — mais específico que o da região. Sem país reconhecido (ou Brasil) → `IDIOMA_PADRAO` ("pt-BR"). **Suíça, Bélgica e Canadá são plurilíngues** — o país sozinho não decide (Genebra não é alemão, Antuérpia não é francês, Montreal não é inglês): `idiomaDoPaisECidade` cruza país+cidade contra um mapa de cidades por país (`IDIOMA_POR_CIDADE`, normalizado sem acento/maiúscula) e só cai no default do país (`de-CH`/`fr-BE`/`en-CA`) quando a cidade não bate com nada — as variantes extras que essa derivação produz (`fr-CH`/`it-CH`/`nl-BE`/`fr-CA`) ganham entrada própria em `IDIOMA_REGIONAL_EXTRA` pra `idiomaLabelRegional` rotular certo e `IDIOMAS_SUPORTADOS` as oferecer no seletor manual.
2. **Seletor no editor, sobrescrita persistida**: a aba Tema tem um select "Idioma dos textos" (`IDIOMAS_SUPORTADOS`, curada a partir do mapa país→idioma) com o valor derivado do endereço como default (marcado "do endereço do lead" na opção); trocar e Salvar persiste em `LeadDemo.idioma` (ausente = segue o default derivado, não precisa persistir o caso comum) — mesmo padrão de patch mínimo do resto da demo.
3. **Passado ao Gemini em toda geração de conteúdo** (níveis equilibrado/completo): `gerarSugestaoDemo` resolve o idioma-alvo (override escolhido AGORA no seletor, ainda não salvo → `LeadDemo.idioma` persistido → derivado do endereço → `IDIOMA_PADRAO`) e instrui o prompt ("escreva os TEXTOS em {idioma}") + fixa o campo `idioma` do schema como enum de 1 valor (reforço). UMA chamada por geração, mesmo preview aplicar/descartar e degradação sem `GEMINI_API_KEY` de sempre.
4. **A MESMA derivação vale para as frases de prospecção**: o botão de traduzir na ficha (ver "Frases de prospecção por skin") usa `idiomaEfetivoDemo`, e o rótulo/prompt usam `idiomaLabelRegional` — o mapa país→idioma invertido, para o alvo ser "espanhol (Argentina)" e não "espanhol". Nenhuma tabela de idioma nova entrou no projeto por causa da tradução.

5. **`resumirHorarios` localizado, sem IA** (`src/lib/leads/horarios.ts`): recebe o mesmo idioma-alvo e troca só a APRESENTAÇÃO — abreviação de dia (SEG-SEX → MO-FR) e formato de hora (9h/9h30 → 09:00, 24h) por raiz do BCP-47 (`pt`, `de`, `en`, `es`, `fr`, `it`, `nl` — idioma sem entrada cai no padrão pt-BR); os dados (horário de funcionamento em si) não mudam, só como aparecem escritos. `estadoAtual`/`melhorMomento` (UI interna do operador) continuam sempre pt-BR — não são conteúdo da demo pública.

6. **4ª ação do botão "Gerar com IA": Traduzir** (`src/lib/ai/traducaoDemo.ts` + `POST /api/leads/[id]/demo/traduzir`). Ao lado dos 3 níveis de intervenção (toque-leve/equilibrado/completo, que GERAM um ponto de partida) o escolhedor ganha um 4º radio mutuamente exclusivo: TRADUZIR, que nunca reescreve, melhora ou muda o tom — verte para o idioma-alvo exatamente o texto que já está no editor.
   - **Entrada é o `DemoData` EFETIVO em memória, não os slots da skin nem o que já está salvo**: o corpo do POST leva `dados` (o estado atual do editor, com as edições do usuário ainda não salvas) — nada do que o operador escreveu pode ser substituído por texto de exemplo. `extrairConteudoTraduzivel` lê esse objeto e monta um schema DINÂMICO (não fixo por skin/nível como `schemaSugestao`) que espelha só os campos que de fato têm valor — campo vazio nunca é "traduzido".
   - **Escopo estritamente CONTEÚDO**: `slogan`, texto de cada seção (rótulo/título/texto/CTA/CTA secundária/itens — título da seção FIXA/hero fica de fora, é o nome do negócio), nome/descrição/`precoPrefixo` de cada serviço e o TEXTO de cada depoimento. Nenhum campo de identidade do lead entra (nome, endereço, cidade, telefone, whatsapp, horários, instagram, título do hero) nem o valor numérico do preço (`precoValor`/`preco` livre) — só o prefixo (`precoPrefixo`, "A partir de"), que é conteúdo como `lib/demos/precos.ts` já documentava. O AUTOR de um depoimento também fica de fora — é dado da pessoa, não texto a traduzir.
   - **A variante regional é o ponto, mostrada ANTES de confirmar**: o idioma-alvo é o mesmo que a aba Tema já resolve (sobrescrita manual → default derivado do endereço, com a derivação por cidade em países plurilíngues acima) — o rótulo usa `idiomaLabelRegional` ("francês (Canadá)", não "francês genérico") e o prompt reforça a variante explicitamente. Rádio desabilitado quando o idioma efetivo já é `pt-BR` (nada a traduzir).
   - **1 chamada por tradução, sem retry**: `reserveQuota(sku "aiGeneration")` antes do request, mesma cota INDIVIDUAL `geracoesIA` das outras duas ações que já usam esse SKU (ver "Cota individual de gerações de IA") — resposta fora do formato já é `AiError`/502 direto, mesma postura de `gerarIndiceRegiao` (sem tentar de novo sozinha). O custo (`custoIncrementalUSD` de 1 chamada, `lib/demos/custoTraducaoDemo.ts`) e o uso do mês (`GET /api/usage`) aparecem no próprio radio antes do clique — sem eles em mãos, o texto avisa em vez de inventar número.
   - **Preview aplicar/descartar, igual às outras ações**: a rota só GERA (nunca escreve na demo); o editor mostra o resultado (slogan/seções/serviços/depoimentos traduzidos) e `aplicarTraducaoDemo` (`lib/demos/traducaoTexto.ts`) mescla só os campos que a tradução trouxe sobre o `DemoData` do rascunho — por ÍNDICE em serviços/depoimentos/itens, preservando preço numérico/categoria/destaques/nota/contexto/autor que a tradução nunca tocou. Nada publica sem o "Salvar" normal.

## Geração de demos em lote (`src/lib/demos/lote.ts` + `GerarDemosLoteDialog`)

Botão "🧩 Gerar demos em lote" em `/leads?buscaId=` (só existe na página de um grupo de busca): cria a demo de N leads sem demo do grupo de uma vez, com skin/preset de tema/efeito/modo de imagem escolhidos UMA vez no diálogo para o lote inteiro. Duas ações DISTINTAS, cada uma com botão e confirmação próprios — nunca combinadas num botão só:

1. **Criar demos (grátis)**: `patchCriacaoLote` (`src/lib/demos/lote.ts`, puro, testado) monta `{dados, tema}` a partir da config do diálogo (efeito "nenhum"/modo "foto" — os defaults — não escrevem nada no patch). Cada lead selecionado recebe um `PUT /api/leads/[id]/demo` normal — a mesma rota que o editor usa, Firestore puro, nenhum request pago. Não existe endpoint de lote no servidor: o "lote" é inteiramente orquestração no cliente. **Lead com demo já salva é PULADO por padrão, sempre**: a lista de candidatos (`leads.filter(lead => !lead.demo)`) nem oferece esses leads no checklist — rodar o lote de novo sobre um grupo já processado nunca cria duplicata nem sobrescreve edição manual; sem opção de "forçar sobrescrever" (rota de edição individual, pela ficha, continua sendo o caminho pra mudar uma demo já existente).
2. **Gerar textos com IA (opcional, consome cota)**: opera só sobre os leads que a etapa 1 acabou de criar com sucesso, nunca sobre o lote inteiro por padrão. Antes de confirmar (via `ConfirmModal`), mostra o número EXATO de chamadas (`projecaoChamadasIA`: 1 por lead no caso normal, até 2× se algum precisar do retry de resposta inválida que `gerarSugestaoDemo` já faz) e a projeção da cota de IA do mês (`projecaoCotaIA` sobre `GET /api/usage`, o teto GLOBAL com quebra `porUsuario` — a tela não projeta a cota INDIVIDUAL `geracoesIA`, ver "Cota individual de gerações de IA"; cada `POST /demo/sugestao` do loop passa por ela normalmente, então um lote pode parar no meio com `429 user_quota_exceeded` mesmo com o teto global longe do limite). Por lead: `POST /demo/sugestao` (gera, não salva) → `aplicarSugestaoTexto` (abaixo) mescla só os campos de TEXTO sobre o `DemoData` efetivo atual → `montarPatch` reduz ao diff mínimo → `PUT /demo` salva. **Nunca aplica `themeId`/`destaque`/`fonteDisplay`/`animacao` da sugestão** — o tema do lote é o escolhido no diálogo, não o que a IA sugeriria lead a lead.

**`src/lib/demos/sugestaoTexto.ts`** (puro, testado) extrai a parte de mesclagem de texto de uma `SugestaoDemo` que antes vivia só dentro de `EditorClient.handleAplicarSugestao` — o editor foi refatorado para chamar a mesma função (`aplicarSugestaoTexto`/`sugestaoTemTexto`), uma única fonte de verdade entre a geração individual (editor) e a em lote.

**Processamento resiliente — sem rota de lote no servidor**: as duas etapas são um loop SERIAL no cliente (mesmo padrão de `autoEnrichSerial`, já usado no auto-enriquecimento pós-busca) — N chamadas pequenas e independentes a rotas de UM lead, nunca uma chamada de servidor que processe o lote inteiro. Isso resolve as três exigências de uma vez, por construção, não por caso especial:

- **Nunca estoura timeout de função serverless**: cada request individual (um `PUT`/`POST` de um lead) é tão rápido quanto já é hoje pelo editor; não existe uma única invocação de servidor cujo tempo cresça com o tamanho do lote.
- **Nunca deixa estado pela metade**: cada `PUT /demo` é uma escrita completa e independente por lead (mesma garantia de `saveDemo`) — um lead processado está com a demo pronta (ou com o texto aplicado); um lead ainda não alcançado pelo loop simplesmente não mudou. Não há transação abrangendo o lote.
- **Falha em um lead não para o resto**: try/catch por lead em ambas as etapas — erro vira uma entrada de falha no relatório e o loop segue pro próximo. Exceção deliberada: `quota_exceeded` na etapa de IA é um bloqueio GLOBAL (não daquele lead específico), então o restante do lote é marcado "não tentado" de uma vez em vez de repetir a mesma falha lead a lead até o fim.

**Relatório final por lead** (`RelatorioLote` — `sucessos`/`falhas`/`cancelado`): cada linha do checklist mostra ✓/✗ com o motivo assim que aquele lead é processado (não só um resumo agregado no fim). Fechar o diálogo ou clicar "Cancelar" durante o processamento marca o loop como cancelado no próximo lead (nunca aborta uma chamada já em voo) — o mesmo sinal cobre tanto o clique explícito quanto a desmontagem do componente.

**Confirmação clara ao concluir, nunca "volta ao normal" em silêncio**: o botão "Criar N demos" nunca reaparece clicável depois que um relatório existe — vira um cartão fixo "✓ Lote concluído — X criadas · Y puladas · Z falharam" (`mensagemResultadoLote`, puro/testado; "puladas" = leads do grupo inteiro nunca tentados, já tivessem demo ou tivessem ficado desmarcados) com um botão "Fechar" explícito. Enquanto processa, o botão vira "Criando…" desabilitado (`loading`) ao lado do "Cancelar" — nunca clicável de novo por engano. O diálogo fecha SOZINHO ao concluir só quando não há passo de IA a seguir (IA indisponível ou nenhuma demo criada); quando há, ele permanece aberto com a confirmação + a seção de IA visíveis, e a mesma mensagem também é repassada por `onConcluido` pra um aviso persistente na página-mãe (`/leads`) — o diálogo pode fechar antes do operador ter tempo de ler algo DENTRO dele (o fechamento é uma atualização de estado no mesmo commit do relatório), então a confirmação "de verdade" sobrevive fora dele.

## Página /demos (`src/app/(app)/demos/page.tsx`)

Lista todas as demos ativas — as de LEAD (leads com `demo` salva) e as AVULSAS (coleção própria, sem lead — ver "Demos avulsas"). Reaproveita `GET /api/leads` (sem filtro) + `GET /api/demos-avulsas` e unifica client-side em `ItemDemo`, mesma escala de "centenas" do resto do app. Agrupamento por busca (opcional, "Agrupar por busca") e filtro por autor combinam com estes controles:

- **Filtro por origem** ("Todas / Só de lead / Só avulsas") + **selo "avulsa"** em cada linha avulsa, e um grupo próprio "Demos avulsas" quando o agrupamento está ligado (nunca o pseudo-grupo "Sem busca", que é o das demos de LEAD órfãs). Os três existem pelo mesmo motivo: uma avulsa não pertence a grupo de busca nenhum e não conta em métrica nenhuma do funil — confundi-la com uma demo de prospecção seria ler o funil errado.
- **"+ Demo avulsa"**: abre o diálogo de criação (ver "Demos avulsas") e leva direto ao editor.

- **Ordenação por `LeadDemo.criadoEm`**: select "Mais recentes primeiro" / "Mais antigas primeiro" (default recentes). Ordena a lista ANTES de agrupar/filtrar — com o agrupamento ligado, a ordem escolhida vale DENTRO de cada grupo; a ordem dos GRUPOS em si é a de `agruparPorBusca` (mais recente primeiro) e não muda com o seletor.
- **"Apagar todas do grupo"** (botão no cabeçalho de cada grupo com pelo menos uma demo, `DELETE /api/buscas/[id]/demos`): apaga a demo (config + imagens no Storage) de todo lead do grupo que tem uma, numa passada.
  - **Admin apenas, recusado no SERVIDOR**: a rota chama `requireAdmin` antes de tocar em qualquer lead (401 sem sessão, 403 pra membro) — o botão só fica oculto na tela pra quem não é admin, mas mesmo que alguém force o request a trava real está na rota.
  - **Confirmação com contagem EXATA e frase obrigatória**: o clique abre `ConfirmModal` (ganhou um slot `filhos` + `confirmarDesabilitado` genéricos nesta feature) mostrando o nome do grupo e `grupo.itens.length` — já em mãos no estado local, sem round-trip extra pro servidor. O botão "Apagar todas" só habilita depois de digitar exatamente `"apagar todos"` num campo de texto controlado (`FRASE_CONFIRMACAO_LOTE`); qualquer outro texto mantém desabilitado, sem checagem "parecido o bastante".
  - **Mesma semântica do DELETE individual, lead a lead**: a rota resolve o grupo (`getBusca` + `listLeads(db, { buscaId })`, filtra quem tem `demo`) e chama `deleteDemo` + limpeza best-effort do Storage pra cada um — nenhum código novo de exclusão, só o loop. Como consequência direta, **NUNCA apaga o lead, não mexe em `status` nem em `contato`, e não remove `Lead.demoVisitas`** (o histórico de envio/visita — cada entrada já carrega `canal`/`envioEm` junto de `em`/`duracaoSegundos`/`geo`, e vive FORA de `demo`, então sobrevive à exclusão da config da demo). Confirmado por teste: `src/lib/leads/__tests__/deleteDemo.test.ts` (invariante no caso individual) e `src/app/api/__tests__/busca-demos.route.test.ts` (mesma coisa cruzando o grupo inteiro, mais 401/403/404/idempotência/isolamento entre grupos).
  - Idempotente (grupo sem nenhuma demo → `200 { apagadas: 0 }`) e não existe pro pseudo-grupo "Sem busca" nem pro grupo "Demos avulsas" (sem `busca.id` real, o botão nem aparece — apagar em lote é uma ação de GRUPO DE BUSCA, mesmo espírito de "🧩 Gerar demos em lote" só existir em `/leads?buscaId=`).

## Demos avulsas — sem lead associado (`src/lib/demos/avulsas` + `/demo/avulsa/{id}`)

Uma demo é uma prévia de site. Quase sempre ela existe **para** um lead da
prospecção, mas nem sempre: às vezes o negócio chegou por indicação, por
conversa de balcão, por uma feira — e não há (nem deve haver) um doc em
`/leads` só pra pendurar uma demo nele. A demo avulsa é essa demo.

**É o mesmo produto, sem a camada `dadosDoLead`.** Skin, tema, efeito,
editor visual, rota pública, tokens de envio, capturas, prévia do link e
rastreio de abertura são os MESMOS — literalmente o mesmo código, não uma
variante paralela (ver "O que é compartilhado", abaixo).

### Coleção própria, nunca um lead com bandeirinha

`/demosAvulsas/{uuid}` — coleção separada, e isso é a decisão central da
feature:

```jsonc
{
  "id": "<uuid>",                    // id do doc E da rota pública
  "pais": "Portugal",                // opcional: de onde saem IDIOMA e MOEDA
  "demo": { /* LeadDemo — o MESMO contrato do campo `demo` do lead */ },
  "demoVisitas": [ /* DemoVisita — mesmo formato, mesma regra de token */ ],
  "capturas": { /* LeadCapturas — mesmo contrato */ },
  "criadoEm": "<timestamp>", "criadoPor": "<userId>", "atualizadoEm": "<timestamp>"
}
```

Uma avulsa **não entra em contagem nenhuma do funil**: não é lead, não
conta em meta, não entra na penetração por nicho/cidade, não aparece em
`/leads` nem na fila de `/hoje`. Numa coleção separada isso vale **por
construção** — nenhuma query de lead a alcança, hoje ou depois de qualquer
refatoração. Como flag dentro de `/leads`, valeria só enquanto todo mundo
lembrasse do filtro, e bastaria um `listLeads` novo pra vazar. Provado
dos dois lados: `src/lib/demos/avulsas/__tests__/fora-do-funil.test.ts`
(as funções puras) e `src/app/api/__tests__/avulsas-fora-do-funil.route.test.ts`
(as respostas que as telas de fato consomem, com sessão de ADMIN — a
visão mais ampla do funil).

### A camada de identidade ZERA, não preenche (`avulsas/identidade.ts`)

Onde a demo de lead tem `dadosDoLead` (nome, endereço, telefone, whatsapp,
horários, cidade, instagram vindos do Google), a avulsa tem
`identidadeEmBranco()` — um patch que **apaga** esses slots do exemplo da
skin. A montagem fica `exemplo ← identidade em branco ← o que foi
digitado`.

Zerar é necessário, não decorativo. Os `exemplo.ts` das oito skins já não
trazem telefone/whatsapp/instagram/cidade/horários (viraram "ausente fica
ausente" — ver `legado.ts`), mas **todos trazem `endereco`** ("Av.
Principal, 100 — Centro"): sem a camada em branco, uma avulsa sem endereço
publicaria o endereço do template como se fosse do negócio. Zerar a lista
inteira também imuniza contra uma skin nova que volte a encher qualquer um
desses slots no exemplo.

**Campo de identidade deixado vazio some da página** — exatamente como
acontece hoje com um lead sem o dado. Nada de cair em texto de template.

`baseDemoDataAvulsa` é a BASE do diff mínimo do editor, e usa a MESMA
montagem da leitura. Sem isso, ou o editor grava patch pra dizer o que a
base já diz, ou perde o campo vazio e o texto do template volta no save
seguinte (`__tests__/identidade.test.ts` cobre a ida e volta).

### Idioma e moeda vêm do país DIGITADO

`DemoAvulsa.pais` (texto livre, com `datalist` dos países mapeados) ocupa o
lugar do país extraído do endereço que o Google devolveu. A derivação é a
mesma de sempre (`idiomaDoPaisECidade`/`moedaDoPais`), inclusive a regra de
país plurilíngue (Suíça/Bélgica/Canadá usam a CIDADE pra escolher a
variante). O país é editável na aba Tema do editor e **persiste sozinho**,
fora do PUT da demo: não é `LeadDemo`, e o PUT recusa chave desconhecida —
como deve continuar recusando.

### O que é compartilhado, e como

| Peça | Como as duas famílias dividem |
| --- | --- |
| Montagem do conteúdo | `montarDemoData` — o parâmetro `lead` já era opcional |
| Rota pública | `src/app/demo/comum.tsx`: `resolverDemo` + `PaginaDemo` + metadados + cor da barra + selo de visita interna. As duas páginas são cascas finas que só dizem de onde vem o dado |
| Editor visual | `DemoEditorClient` recebe um `ClienteDemo` (`app/leads/[id]/demo/editar/cliente.ts`) e não menciona lead nem avulsa. Todo o que difere cabe nesse adaptador |
| Validação do PUT | `validateLeadDemoInput`, a mesma do editor de lead |
| Envio e visita | `lib/demos/envio.ts` (`garantirEnviosCanais`) e `lib/demos/visitas.ts` (`aplicarVisita`/`completarVisita`) — a regra é do campo `demo`, não de quem o hospeda |
| Prontidão | `pendenciasDaDemo` sobre o `DemoData` EFETIVO; `SeloProntidao` recebe a lista pronta |
| Capturas | alvo prefixado, ver abaixo |
| Storage | mesmo prefixo `demos/{id}/` — id de avulsa é UUID e não colide com Place ID |

**Rota pública**: `/demo/avulsa/{id}` (+ `/previa` para o cartão de
conversa). O segmento estático `avulsa` tem precedência sobre o `[leadId]`
irmão. O beacon de visita (`POST /api/demo-visita`) passa a aceitar
`leadId` **OU** `avulsaId`; mandar os dois (ou nenhum) é 400 — adivinhar
qual vale seria gravar no lugar errado em silêncio.

**Sem sugestão de texto por IA, de propósito**: `gerarSugestaoDemo` monta o
prompt a partir do LEAD (nicho da busca, endereço, avaliações, site) — sem
lead não há contexto pra alimentar, e uma sugestão sobre o nada seria só o
texto do template reescrito. O botão de IA da avulsa mostra só
**Traduzir**, que depende apenas do conteúdo já na tela do editor, com o
motivo escrito na própria tela.

### Capturas: a família viaja no id (`capturas/alvo.mjs`)

A fila de capturas atravessa quatro processos que não se falam — a rota do
Radar, o `repository_dispatch` do GitHub, o orquestrador do workflow e o
motor — e o payload entre eles é uma **lista de strings separada por
vírgula** (o `client_payload` chega como expressão de template no YAML;
qualquer coisa estruturada viraria `[object Object]` na linha de comando).

Então a família viaja no próprio id, como prefixo: **`avulsa:<uuid>`**. Sem
prefixo é lead — que é como todo alvo já gravado se parece, então não houve
migração nem payload novo. `src/lib/demos/capturas/alvo.mjs` é a ÚNICA
definição desse formato (`.mjs` pelo mesmo motivo de `dom.mjs`: os scripts
do laço não compilam TypeScript) e dele saem a coleção do doc, a rota
pública e a rota de leitura. A seção de capturas usa só a rota de LOTE
(`POST /api/capturas`), que já recebe alvos — um caminho, em vez de duas
rotas fazendo a mesma coisa. Na avulsa ela aparece como **aba própria do
editor**, que é o único lugar onde a avulsa existe (não há ficha).

### Criação e listagem

**"+ Demo avulsa"** em `/demos` abre um diálogo com duas metades: os MESMOS
quatro seletores do diálogo de geração em lote (`ConfigDemoCampos` —
componente compartilhado; duas cópias divergiriam no primeiro efeito novo
que entrasse no registro) e os campos de identidade digitados à mão. Só o
nome é obrigatório. Criar leva direto ao editor.

Em `/demos`, as duas famílias entram unificadas em `ItemDemo`: mesmo card,
mesma prontidão, mesmo link — `origem` decide só o **selo "avulsa"**, os
caminhos e o que o botão de excluir faz (na avulsa a demo É o registro, e
apagar tira o doc inteiro; na de lead some só o campo `demo`). Um **filtro
por origem** ("Todas / Só de lead / Só avulsas") e um grupo próprio "Demos
avulsas" existem pelo mesmo motivo do selo: uma avulsa não pertence a grupo
de busca nenhum e não conta em métrica nenhuma do funil, e confundi-la com
uma demo de prospecção seria ler o funil errado.

### Verificação visual (`qa-visual.mjs --so=avulsa`)

Nenhum teste unitário julga o resultado de uma identidade em branco — eles
provam que o campo está vazio, não que a PÁGINA continua de pé sem ele. O
laço captura cada skin em duas colunas (em branco × preenchida), duas
bandas (topo e rodapé, que é onde quase toda a identidade mora) e duas
larguras. O harness `/interno/demo-qa` ganhou `avulsa=1` pra montar pelo
mesmo caminho da rota pública.

A primeira rodada achou dois defeitos reais — os dois valendo também pra
lead sem telefone/Instagram, só que a avulsa os torna o caso comum:

1. **`imobiliaria-curada` publicava rótulo órfão**: "FALE COM A GENTE" e
   "REDES" saíam como cabeçalhos de coluna com nada por baixo. O rótulo
   agora acompanha o conteúdo — sem itens, a coluna inteira sai.
2. **`multimarcas-vortice` montava link morto**: `waHref` devolvia
   `https://wa.me/?text=…` sem número, o que abre o WhatsApp em branco —
   inclusive num botão flutuante FIXO na tela. Agora devolve `undefined`
   sem dígitos e cada CTA some junto, mesmo princípio do `orderWaHref` da
   lancheria (que já fazia certo). O teste que afirmava o link morto virou
   o contrário.

As outras seis skins já degradavam bem: barbearia/tatuagem caem numa
âncora da própria página, lancheria/petshop mostram o toast "disponível na
versão completa".

## Precificação regional por IA (`src/lib/regioes` + `src/lib/precificacao` + card "Precificação")

Calculadora interativa na ficha do lead e no grupo de busca: quanto cobrar por um site, ajustado pelo mercado LOCAL da cidade do lead (não a média do país) e pelo nicho. Dois módulos separados — geração/cache do índice (`src/lib/regioes`, precisa de Firestore/Gemini) e a matemática da calculadora (`src/lib/precificacao/calc.ts`, 100% puro, testado isoladamente):

1. **Slug reaproveita o cache de geocoding**: `/regioes/{slug}` usa a MESMA `regiaoCacheKey` de `/geocache` (`src/lib/geo/geocode.ts`) — uma região só é geocodificada uma vez na vida, e o índice de mercado é da **cidade/região específica** que o geocoding resolveu (`cidade`/`pais`, extraídos do `endereco` formatado — `parseCidadePais`), nunca a média do país (Zurique ≠ interior da Suíça).
2. **Geração: 1 chamada Gemini, sem retry** (`gerarIndiceRegiao`, mesmo SKU `aiGeneration` e mesma postura de `gerarAnaliseBusca` — resposta fora do schema já é `502 ai_error` direto, sem tentar de novo sozinho). O prompt pede: índice relativo do mercado de sites para pequenos negócios NAQUELA cidade (referência explícita: cidade média do interior do Brasil = 1.0), moeda local, câmbio aproximado para BRL (rotulado como estimativa — omitido se a moeda local já for o Real), faixa típica local de um site simples, justificativa (1-2 frases) e confiança (`alta`/`media`/`baixa`).
3. **Cache PERMANENTE, regenera só por clique do admin**: `GET /api/regioes?regiao=` geocodifica (cache de geocoding) e, se `/regioes/{slug}` ainda não existir, gera e salva — chamadas seguintes de QUALQUER usuário vêm do cache, sem custo. `POST /api/regioes/regenerar` (admin) força uma nova geração reaproveitando `cidade`/`pais`/`regiaoTexto` já salvos (não geocodifica de novo) e **preserva** `indiceAjustado` — regenerar só atualiza a base sugerida pela IA.
4. **`indiceAjustado`** (`PATCH /api/regioes/ajustar`, admin, só na UI da região onde o card aparece): number seta e VENCE `indice` nos cálculos; `null` limpa. A UI sempre mostra os dois quando o ajustado existe.
5. **Cálculo (funções puras, `src/lib/precificacao/calc.ts`)**:
   - `calcularIndiceEfetivo(indice, indiceAjustado, fatorMinimoIndice)` — `indiceAjustado` vence `indice` quando presente; depois aplica o piso do fator mínimo (`Math.max(base, fatorMinimoIndice)`): regiões baratas reduzem o preço em no máximo `1 − fatorMinimoIndice` (default 0.7 → no máximo 30%), regiões caras (índice > 1) sobem sem teto.
   - `multiplicadorParaNicho(nicho, multiplicadoresNicho)` — chave-valor livre da config (normalizado minúsculas/espaços, mesmo padrão de `src/lib/buscas/penetracao.ts`); nicho sem entrada → 1.0 (neutro).
   - `calcularPrecoSugerido(precoBase, indiceEfetivo, multiplicadorNicho, piso)` — `precoBase × indiceEfetivo × multiplicadorNicho`, nunca abaixo do `piso` (default R$900).
   - `converterMoedaLocal(precoBRL, cambioAproxBRL)` — `precoBRL / cambioAproxBRL` (mesma convenção de `precos.usdBrl`: 1 unidade da moeda local ≈ N reais); câmbio ausente/inválido → `undefined`, a UI mostra só BRL.
6. **Config admin** (`/config/app`, campo `precificacao`): `multiplicadoresNicho` (lista chave-valor editável, default vazio), `pisoPrecificacao` (default 900), `fatorMinimoIndice` (default 0.7), `presets` (atalhos do slider, default Vitrine 1000 / Presença 2000 / Autoridade 3500 / Sistema 5000 — editáveis, nome + valor em BRL).
7. **Card "Precificação"** (`src/components/PrecificacaoCard.tsx`, na ficha do lead e no grupo de busca — `/leads?buscaId=`): slider 700–10.000 BRL (passo 100) posiciona o preço-base; botões de preset reposicionam o slider; abaixo, ao vivo: preço sugerido em BRL e (quando há câmbio) na moeda local rotulado "≈ estimado", faixa de mercado local, confiança e justificativa. Membros veem e usam a calculadora; só o admin vê os controles de editar/regenerar o índice. Todos os membros disparam a geração inicial (primeira vez que a região é aberta) — regenerar é ação exclusiva do admin.
8. **Última posição do slider é por usuário** (`GET`/`PUT /api/precificacao/slider`, self-service — qualquer sessão lê/grava a PRÓPRIA posição): persistida em `usuarios/{id}.ultimoPrecoBaseSlider`, carregada ao abrir o card. Debounce de 500ms no cliente evita gravar a cada pixel arrastado do slider.

## Frases de prospecção por skin (`src/lib/frases` + seção em /config)

Abordagem que varia pela SKIN da demo em vez de um texto único para todo mundo, e que gira sozinha entre três frases para a mesma skin não chegar sempre com a mesma primeira linha. Editável na tela de administração, **sem deploy** — mesma escolha do `capturas.ancoras` e dos `multiplicadoresNicho`.

1. **Onde mora** — `/frasesProspeccao/{skinId}`, um doc por skin do registro (ver "Modelo de dados"). Três slots de frase e o contador no mesmo doc, com as duas escritas disjuntas por `merge`. Firestore, nunca `localStorage`: o contador é compartilhado entre membros, e preferência de tela guardada no navegador já vazou entre colegas na mesma máquina uma vez (ver "Sistema de temas da plataforma").

2. **A chave é a SKIN REGISTRADA, nunca o texto da busca.** A primeira versão chaveava pelo nicho digitado no campo de busca; como o campo é texto livre, "Barbearia", "barbearia old school" e "barbería" viraram entradas distintas e a tela virou uma lista de duplicatas e erros de digitação. O registro de skins é um conjunto fechado, versionado no código e com id estável: uma skin, um conjunto, sempre. **Skin nova aparece na tela sozinha ao ser registrada** — a listagem é montada a partir de `SKINS`, não de dado digitado, e não existe cadastro manual de conjunto em lugar nenhum.

3. **Precedência do envio individual** (`resolverMensagem`, função pura em `lib/frases/resolver.ts`, a MESMA na ficha e em `/hoje` — antes cada tela tinha a sua cópia de `mensagemParaLead`):

   1. frases da **skin da demo do lead**, se aquela skin tiver alguma preenchida;
   2. mensagem do **grupo** (a busca mais recente do lead que tenha uma);
   3. mensagem **global** da config — continua sendo o último caso, sempre.

   **Lead sem demo entra direto no passo 2** — exatamente o que ele já usava antes das frases existirem, letra por letra. Não existe conjunto genérico nem conjunto por família de skins: se a skin do lead não tem frase, ninguém adivinha por ela. Por consequência, **a frase mostrada muda sozinha quando o lead ganha demo**: antes dela, a do grupo ou a global; depois, a da skin escolhida — a resolução lê `lead.demo.skinId` a cada render, não há estado a sincronizar.

4. **Skins irmãs do mesmo nicho são conjuntos independentes** (`barbearia-editorial` e `barbearia2-sul` etc.): cada uma com o seu texto e o seu contador. Era justamente o que a chave por nicho não conseguia expressar — a frase que combina com uma skin editorial escura não é a mesma que combina com a minimalista.

5. **Rotação 1→2→3→1** — sobre as frases EFETIVAS (slots preenchidos): com duas preenchidas ela alterna entre as duas, em vez de gastar um turno num slot vazio. O módulo é aplicado também na LEITURA, porque o admin pode apagar uma frase depois de o contador já ter passado dela e o índice guardado ficaria fora da faixa.

6. **O contador anda no ENVIO, e só nele.** O incremento vive dentro de `registrar()`, em `src/lib/useWhatsAppContato.ts` — o único ponto por onde os dois caminhos de envio passam (o direto e o de depois do modal de "já contatado"), exatamente uma vez cada. Por consequência ele vale para os dois botões de WhatsApp da plataforma (ficha e fila do dia) sem o gancho ser repetido em nenhum deles, e abrir a ficha, copiar o link ou editar o texto — que não passam por ali — não giram nada. Falhar no avanço é **cortesia**, como o selo de contato: não desfaz nem bloqueia o envio.

7. **Incremento otimista, sem trava** (`avancarRotacao`): lê, calcula o próximo e grava. Dois envios no mesmo instante podem repetir uma frase — irrelevante para o uso, e uma transação custaria mais do que resolve.

8. **A caixa editável da ficha** — abre com a frase da vez e os marcadores JÁ substituídos, ou seja, exatamente o texto que vai ser enviado; editar à mão vale **só para aquele envio** e não gira nada. Depois do disparo a caixa volta para a frase da vez seguinte. `wa.ts` foi separado em `aplicarMarcadores` + `linkWhatsApp` para isso (o link precisa ser remontado a partir do texto já editado); `buildWhatsAppLink` continua existindo com a mesma assinatura, agora como a composição dos dois.

9. **O token de envio não mudou em nada.** Continua emitido no GET (`garantirEnvioToken` em `/api/leads/[id]` e `/api/hoje`), e o `{demo}` da frase continua levando o token vigente do canal `whatsapp` — o rastreio de abertura funciona igual, venha o texto de uma frase da skin ou da mensagem global.

10. **Migração das entradas antigas** (`lib/frases/migracao.ts` + `/api/frases/migrar`, admin): as entradas chaveadas por texto de busca já somem da tela sozinhas (não casam com id de skin nenhum), então a migração existe só para **não perder o texto já escrito**. O nicho antigo é comparado, normalizado, com o `nicho` das skins do REGISTRO: casando com mais de uma (skins irmãs), o texto é COPIADO para cada uma — cópia de partida, editável separadamente, não um conjunto por família (nada em tempo de execução consulta "as skins do nicho X"). Skin que já tem frase própria nunca é sobrescrita, e o `indice` antigo não é herdado. O que não casa com skin nenhuma ("barbearia old school", "barbería", o antigo `__genericas__`) vira **pendência listada na tela com as frases inteiras**, para copiar à mão. `GET` é prévia pura (não escreve), `POST` executa e apaga só os docs aproveitados (e os que estavam vazios), `DELETE` é o "já copiei, pode limpar" das pendências — sempre atrás de confirmação, nunca embutido no POST. Rodar duas vezes é inofensivo: na segunda não sobra legado a aproveitar.

11. **Tradução para o lead estrangeiro, sempre atrás de um clique** (`lib/frases/traducao.ts` + `lib/ai/traducaoFrases.ts` + `/api/frases/traduzir`). As frases são SEMPRE escritas em português; o que existe por idioma é um texto DERIVADO, gravado e reusado:

    - **O idioma vem da derivação que a demo já usa** (`idiomaEfetivoDemo`: sobrescrita salva no editor → país do endereço do PRÓPRIO lead → pt-BR). Nenhum mapa paralelo — a mesma fonte que faz a demo do argentino sair em espanhol faz a frase sair em espanhol.
    - **A variante regional é o ponto**: o alvo é `es-AR`, e o prompt recebe "espanhol (Argentina)" com pedido explícito de vocabulário e tratamento daquele país (`idiomaLabelRegional`, o mapa país→idioma de `lib/idioma.ts` invertido — sem lista nova a manter). Espanhol genérico não é o que se manda para um lead argentino.
    - **Gravada e reusada, nunca refeita ao abrir**: `traducoes[idioma]` no doc da skin, endereçada por SLOT (não pela posição na rotação — com o slot 2 vazio, a segunda frase mora no slot 3). Junto vai a `origem`: o português que gerou cada slot. Editar o português depois deixa aquele slot **desatualizado**, e aí vale o português — mandar a versão antiga de uma frase reescrita seria pior — com o botão voltando a aparecer. Retraduzir é decisão de gasto, então nunca acontece sozinho.
    - **Uma tradução serve todos os leads daquele idioma naquela skin**, para sempre. É por isso que o SKU tem contador próprio e cota menor que o de sugestões.
    - **Chamada paga, com o preço na tela antes do OK** (SKU `aiTraducao`, `reserveQuota` antes do request como todo request pago): o botão na ficha abre um `ConfirmModal` com o número de chamadas (1, até 2 se a resposta vier fora do formato), o custo em BRL (`custoIncrementalUSD` — o custo REAL daquele clique, 0 dentro da cota grátis) e o uso do mês. Sem o `/api/usage` em mãos, o texto diz isso em vez de inventar número. **Nenhum caminho traduz automaticamente.**
    - **Os marcadores são intocáveis**: a validação exige que `{nome}`/`{demo}`/`{penetracao}` cheguem íntegros e na mesma quantidade da frase original — um `{demo}` perdido na tradução quebraria o link da demo e o token de rastreio junto. Falhou, é retry; insistiu, é `502` e nada é gravado.
    - As três frases vão numa chamada só (dá contexto ao modelo e custa 1 request em vez de 3).

12. **A tela de administração** (seção em `/config`, PUT restrito ao admin) lista **uma linha por skin do registro**, com os conjuntos já salvos por cima — skin nova aparece sozinha na próxima carga. O nome e o nicho da skin vêm resolvidos do SERVIDOR (`montarConjuntos`), porque importar `SKINS` numa tela do app arrastaria os componentes das 8 skins para o bundle de `/config` só pra escrever um título. Cada conjunto salva sozinho e mostra em que ponto da rotação o time está ("na vez: frase 2 de 3") ou avisa que aquela skin não participa. É o ÚLTIMO bloco da página de propósito: a lista tem tamanho variável e chega depois do primeiro desenho — no meio da página empurraria o formulário inteiro a cada carga (ver "Deslocamento de layout").

## Barra do dia por família (`src/lib/leads/{janelaContato,barraDoDia}.ts` + `src/components/BarraDoDia.tsx`)

"Qual a hora de falar com este lead" era UMA janela por família (ideal + alternativa opcional) e um rótulo por dia da semana (recomendado / pouco indicado / não abordar). O defeito era estrutural: a recomendação mostrava uma janela só, e quando ela passava saltava direto para o dia seguinte — o resto do dia do lead simplesmente não existia na tela. No lugar dela entra a **barra do dia**: o expediente inteiro, pintado em três níveis.

1. **Três níveis, e só três** — `bom`, `razoavel`, `ruim`. A tabela (`/config/app.janelasContato`, editável em /config **sem deploy**) guarda faixas de nível ao longo do dia, **por família de negócio e por dia da semana**. Tudo determinístico: nenhuma IA gera horário aqui, como em `multiplicadoresNicho` (precificação) e nas âncoras de captura.

2. **A tabela só guarda o que é OPINIÃO.** Minuto aberto que nenhuma faixa cobre vale `razoavel` (`NIVEL_PADRAO`) — o neutro. É isso que deixa "fim de semana desmarcado" ser representável sem inventar um quarto nível: dia com lista vazia é dia sobre o qual a tabela não opina, não dia proibido. O modelo antigo precisava de um `indisponivel` justamente porque não sabia dizer "não tenho opinião".

3. **O padrão por família** (`DEFAULT_JANELAS_CONTATO`): barbearia boa de manhã e ruim no fim de tarde; lancheria ruim nos picos de almoço e janta, boa no meio da tarde; tatuagem boa no início da tarde; imobiliária boa em meados de manhã e no meio da tarde; petshop e multimarcas bons no meio da tarde. **Sexta** sai do padrão de segunda a quinta com todo `bom` rebaixado a `razoavel` (vale menos, mas não é dia ruim inteiro — rebaixar os `ruim` também pintaria a sexta de vermelho e diria uma coisa mais forte do que "menos indicada"). **Fim de semana desmarcado**, com UMA exceção deliberada: o **sábado da barbearia é `ruim` o dia inteiro**, porque é o movimento deles — a instrução específica vence a regra geral, e ela é editável como qualquer outra.

4. **A barra cobre apenas o intervalo ABERTO** (`barraDoDia`, função pura, `now` sempre vem de fora): as faixas da família são recortadas pelo horário de funcionamento já salvo (`lead.horarios`, SKU `detailsProHours`) e o que sobra são os trechos abertos, cada um com o seu nível. Fechado pro almoço vira **buraco** na trilha, não faixa vermelha — **vermelho quer dizer "aberto, mas hora ruim"**, e pintar o fechado repetiria com cor o que a ausência já diz. Dia inteiro fechado não desenha faixa nenhuma, só "fechado hoje" em palavras. Faixa que cruza a meia-noite entra recortada nos dois dias que toca (mesma convenção de `horarios.ts`).

5. **Sem fuso, sem barra.** O deslocamento vem de `horarios.utcOffsetMinutes` ou, na falta dele, do país do endereço (`utcOffsetDoLead`); sem nenhum dos dois, `barraDoDia` devolve `undefined` e a ficha não desenha nada — melhor faltar do que mostrar hora errada. **Sem horário de funcionamento** (mas com fuso), a barra usa o intervalo comercial 9h-18h e a linha de texto avisa "horário estimado".

6. **Cor nunca é o único canal** (a regra de legibilidade do projeto vale aqui): cada nível tem também uma **altura** dentro da trilha — bom preenche inteiro, razoável pouco mais da metade, ruim uma tira baixa —, a legenda repete os três em palavras com a mesma escada de altura, cada trecho tem `title` com hora e nível, a barra inteira tem `aria-label` descrevendo a sequência, e a **linha curta abaixo** (`linhaEstadoContato`) diz o estado atual e o próximo momento bom sem depender de nada visual: "Hora do lead 17h · agora: ruim · próximo bom amanhã 9h". Nenhum gradiente entra na barra — os retângulos são cor chapada, e o `globals.css` não ganhou seletor nenhum (o teste de legibilidade continua com a mesma lista).

7. **Altura reservada desde o primeiro desenho.** Eixo, trilha, legenda e a linha de texto (duas linhas reservadas) têm altura fixa, e o bloco na ficha reserva o espaço **sempre que o horário de funcionamento ainda pode chegar** — isto é, enquanto o botão "buscar horários" existe. Assim a resposta dessa busca troca o CONTEÚDO da barra (estimativa → expediente real, ou nada → barra) sem empurrar o que está abaixo. Sem fuso e sem horário por vir, o bloco nem existe. Ver "Deslocamento de layout".

8. **"É hora boa?" passou a sair das faixas.** O anel do botão de WhatsApp e a linha ao lado dele (ficha e `/hoje`) usavam `melhorMomento`, que só sabe dizer "está aberto" — ao lado de uma barra dizendo "agora: ruim" isso vira contradição na mesma tela. Agora, quando a barra existe, quem decide o destaque é `nivelAgora === "bom"` e a linha é a MESMA frase da barra; sem fuso conhecido, tudo volta ao comportamento anterior (`melhorMomento` intacto, ele continua sendo o dono de "Aberto agora · fecha 18h").

9. **`/hoje` não ganhou barra**, de propósito: a fila é uma lista compacta de cards, e uma barra por item viraria ruído. Cada item mostra a mesma **linha de texto** — uma verdade só sobre "é hora?", nas duas telas.

10. **A tela de edição** (seção "Faixas de contato por família" em /config): os 7 dias como abas por família (o chip mostra quantas faixas o dia tem, ou "—" quando desmarcado), a prévia da barra daquele dia sobre as 24h com as MESMAS cores e alturas da ficha, e cada faixa com início, fim e o nível em três botões. "Aplicar a seg–qui" copia o dia editado para os outros dias úteis. A validação recusa hora fora de faixa, fim ≤ início, nível desconhecido e **faixas sobrepostas no mesmo dia** — com sobreposição, "qual nível vale às 15h" passaria a depender da ordem da lista e a barra deixaria de ser determinística.

11. **Doc antigo não derruba a barra** (`mesclarJanelasContato`): o `/config/app` gravado antes desta troca guarda o formato da janela ideal/alternativa. O merge é por família e **descarta a família que não bate com o modelo atual**, caindo no padrão novo. Sem essa peneira, a família velha substituiria a nova e a ficha ficaria sem barra até alguém reabrir /config e salvar.

12. **O registro do disparo continua igual** (`Lead.registrosEnvio` + `horarioLocalNoDisparo`): cada clique no botão de WhatsApp grava a hora e o dia da semana LOCAIS do lead. Nada disso é analisado ainda — é o material para comparar taxa de resposta **por faixa** mais adiante, que é justamente o que a barra passa a tornar comparável.

13. **Hora dupla quando o lead está em outro fuso** (`horaParaExibicao`/`linhaEstadoContato` em `barraDoDia.ts`, prop `offsetUsuarioMinutos` em `<BarraDoDia>`): todo lugar que recomenda hora de contato — a linha abaixo da barra, o `title` do marcador de agora, o `title` do botão de WhatsApp (ficha e `/hoje`) e a linha da fila — passa a mostrar as DUAS horas, a local do lead e a equivalente no fuso de quem está logado, sempre rotuladas ("19h em Zurique · 15h aqui", cidade de `cidadeDoEndereco(lead.endereco)`; sem cidade reconhecível, "lá"). **Fusos que coincidem mostram uma hora só** — comparação é pelo `offsetMinutos` exato (agora um campo do próprio `BarraDoDia`), não por string, então nunca repete o mesmo número. O fuso de quem está logado vem do NAVEGADOR, agora (`offsetUsuarioMinutos` em `lib/fusoUsuario.ts`, `-Date.getTimezoneOffset()`) — sem tabela paralela, o runtime já resolve sozinho a virada de horário de verão de onde quer que o navegador esteja. `linhaEstadoContato`/`<BarraDoDia>` recebem esse offset como parâmetro OPCIONAL, default = o próprio offset do lead: quem chama sem ele (nenhum outro ponto do código chama) nunca vê a hora duplicada, e o cálculo continua puro e testável (nada aqui lê `Intl`/relógio). Sem `utcOffsetMinutes` nem fuso derivável do lead, `barraDoDia` continua devolvendo `undefined` como antes — nenhum comportamento novo nesse caso.

14. **A régua ganha marcas de hora entre os dois extremos** (`marcasDaBarra` em `barraDoDia.ts`), porque só rotular abertura e fechamento não dizia onde cada faixa começava e terminava. Duas fontes, sempre em hora local do LEAD (nunca a dupla — essa continua só no `title` do marcador de agora e na linha de texto abaixo, ver item 13): **regular**, hora cheia alinhada ao RELÓGIO (10h, 12h…, não ao início do expediente) de 2 em 2h — expediente com mais de 12h passa a ser de 3 em 3h, senão mais de ~5-6 marcas apertariam sem sobrepor numa régua de ~390px (celular); e **transição**, a hora exata de toda fronteira de `segmentos` que não coincide com um extremo já rotulado — nível mudando ou a barra entrando/saindo de um buraco (fechado no meio do expediente). Perto demais pra caber (menos de ~30px de distância, numa régua de 390px) **a transição vence**: ela é fato, a regular só aproxima "que horas são". Marca de transição também sai com peso de fonte diferente (`font-medium`), não só cor. Verificado com `qa-plataforma.mjs --so=listas` (fixtures "lead-nacional", expediente curto 9h-19h, e "lead-suico", aberto 24h — ver `semear()`) e o portão de CLS `qa-cls.mjs --so=app`: os dois lados do corte (2h × 3h) confirmados em captura real de 390px.

## Onde prospectar agora (`src/lib/prospeccao` + `/api/mundo` + tela `/mundo`)

A pergunta da madrugada brasileira: **em que lugar do mundo AGORA é hora boa de abordar**. A barra do dia responde isso para UM lead que já existe; esta tela responde antes de existir lead — escolhido um nicho, ela lista os países em que este minuto cai numa faixa boa daquela família, **em hora local de cada país**.

1. **É uma tela DERIVADA, e isso é o projeto dela.** Fuso, faixas por família e índice de mercado já existem no app; montá-la não gera nada e não chama nada pago — nem Places, nem Geocoding, nem IA. `GET /api/mundo` lê `/config/app`, `/leads` e `/regioes` e devolve tudo pronto. O único caminho que gasta continua sendo o de sempre: o botão "Buscar" em `/leads`, com `reserveQuota` no servidor. Por isso **tocar num país nunca dispara busca** (item 5).

2. **A lista de países vive em `/config`** (`paisesProspeccao`, `lib/prospeccao/paises.ts`), editável sem deploy como `janelasContato`. O critério de entrada é UM: **WhatsApp ser canal padrão de contato comercial** por lá — é por isso que **Estados Unidos e Canadá ficam de fora** mesmo com mercado caro, e não por falta de fuso ou de idioma. Cada país guarda só o que não dá pra derivar de um lead que ainda não existe: código ISO, nome em pt-BR, fuso, idioma(s) e o índice base. Os 15 defaults saem prontos, com **fuso e idioma DERIVADOS de `utcOffsetPais.ts` e `idioma.ts`** — nenhuma tabela paralela a manter; o que é opinião nova é só o índice base e a escolha dos países.

3. **O nome do país em pt-BR é a chave de tudo.** É a mesma chave dos mapas de fuso/idioma e o mesmo texto que o Places devolve no fim de `Lead.endereco` (as duas APIs são sempre chamadas com `language=pt-BR`). É essa igualdade que deixa casar lead → país com `cidadeDoEndereco`, sem nenhum campo novo no doc do lead e sem migração.

4. **"Faixa boa" é a MESMA tabela da barra do dia** (`janelasContato`), sem nada exclusivo desta tela. A diferença é o que se sabe: a barra tem um lead com horário de funcionamento e recorta as faixas por ele; aqui existe só o país, então "faixa boa agora" é exatamente a faixa `bom` da família na hora local dele. **`razoavel` e `ruim` não entram** — o minuto neutro não é motivo pra acordar ninguém —, e **país fora de faixa boa não aparece**: a tela é uma resposta, não um painel de 15 linhas para o operador filtrar com os olhos às 3h da manhã. Como a sexta rebaixa todo `bom` a `razoavel` (ver "Barra do dia"), sexta é naturalmente uma tela curta.

5. **O toque num país tem duas saídas, e a primeira é a de graça**: havendo lead **não contatado** daquele país e nicho (status `novo`, sem `seloContato`, não descartado), a linha ABRE com eles, melhores por score primeiro — o que já foi pago vem antes de pagar de novo. Não havendo nenhum, o toque leva ao formulário de `/leads` **já preenchido** com nicho e país (`?nicho=&regiao=`), que continua esperando o clique de confirmação. Os dois params entram como valor INICIAL dos campos e são apagados da URL logo em seguida: descrevem uma chegada, não estado da lista, e ficariam grudados no `QUERY_KEY` de `/leads` (repreenchendo o formulário em toda visita futura).

6. **A ordem é idioma e depois preço** — português, inglês, espanhol, depois os demais; dentro do mesmo idioma, índice de preço decrescente. Falar a língua sem esforço vale mais do que o mercado ser caro; empatados no idioma, ganha quem paga melhor. País multi-idioma (a Suíça) vale pelo MELHOR idioma dele. Empate nos dois desempata por nome, só para a ordem ser estável entre cargas.

7. **O índice prefere a cidade real ao chute** (`indiceDoPais`): havendo região daquele país já cacheada em `/regioes`, vale a MÉDIA dessas cidades (com `indiceAjustado` vencendo `indice`, a mesma precedência da calculadora); sem nenhuma, vale o número base da config. A tela mostra qual das duas fontes está usando ("1,9 · base" vs "2,4 · 3 cid."), porque a diferença entre um chute editável e um índice gerado para uma cidade específica é grande demais pra ficar implícita. Nada aqui GERA índice: gerar é chamada paga.

8. **Tela vazia continua respondendo.** Quando nenhum país está em faixa boa — o caso comum às 2h da manhã —, a tela diz qual país entra em faixa boa primeiro e em quanto tempo ("🇪🇸 Espanha abre hoje às 9h — em 3h43"). "E quando, então?" é a mesma pergunta, e uma folha em branco às 3h da manhã não a responde.

9. **Sem polling.** A aba fica aberta a madrugada inteira; ficar relendo a coleção de leads em segundo plano seria custo por nada. A tela recarrega quando o foco volta pra ela (`visibilitychange`) e quando o nicho muda. O nicho escolhido é lembrado por ABA (`sessionStorage`), e `?familia=` na URL vence a lembrança — é o que torna a tela linkável e o que dá estado fixo aos laços de captura.

10. **A barra do dia da ficha não mudou em nada.** Esta tela é um acréscimo: lê a mesma tabela, reusa `horaDoMinuto` (uma formatação de hora só no app inteiro) e não toca em `barraDoDia.ts`.

11. **Verificação** (`qa-plataforma --so=abas` e o portão de CLS `qa-cls --so=app`, ambos com a aba nova): a tela depende do RELÓGIO — a mesma rodada sairia cheia às 5h e vazia às 2h —, então os laços abrem `/mundo?familia=imobiliaria` e o seed dá A ESSA família uma faixa larga; `barbearia`, que é a família das FICHAS capturadas, fica com o padrão e continua mostrando a escada de níveis de verdade na barra. Foi a primeira captura de celular que reprovou a **oitava aba da nav**: em 390px, `text-sm` deixava "Buscas"/"Demos" encostados e "Config" pela metade fora da tela — o rótulo caiu para `text-xs` até `sm` (e 10px abaixo de 360px), medido em 320/360/390/430px. Nada disso aparece em teste unitário.

## Mensagens entre usuários (`src/lib/mensagens` + `/mensagens`)

Chat interno de texto simples entre os usuários do time (coleção `/mensagens` — ver modelo de dados). Decisões:

- **Privacidade no repositório, não só na rota**: toda leitura exige o userId da sessão e filtra por participação. Admin gerencia usuários mas NÃO lê conversas alheias — não existe rota/flag que devolva mensagem de terceiros.
- **Polling leve, sem websocket** (escala de 3 usuários): conversa aberta a cada 5s, lista de conversas a cada 10s, badge do menu a cada 30s (+ refetch ao trocar de rota). O `GET ?com=` já marca as recebidas como lidas — manter a conversa aberta é "ler".
- **Página `/mensagens`** (route group `(app)`, protegida por sessão como tudo): lista de conversas (um card por colega, com última mensagem, horário e badge de não-lidas; usuário desativado aparece marcado, histórico preservado) e a conversa aberta (bolhas minhas/dele, carimbo "lida" nas minhas já vistas). Envio otimista simples: o POST devolve a mensagem e ela entra na lista local.
- **Badge no menu**: a Nav ganhou a aba "Chat" (`/mensagens`) com contador de não-lidas via `GET /api/mensagens/nao-lidas` (resposta mínima `{ total }`).
- **Layout da conversa aberta, estilo WhatsApp — sem `position:fixed`**: o header e a barra inferior do app (`Nav.tsx`, ambos com altura fechada `h-14`, expostas como `--app-header-h`/`--app-nav-h` em `globals.css`) continuam visíveis e intocados; o bloco da conversa só ocupa, dentro do `<main>` do `AppLayout`, a altura exata que sobra entre os dois — `calc(100dvh - var(--app-header-h) - var(--app-nav-h) - env(safe-area-inset-bottom))` (viewport **dinâmica**, nunca `100vh`, que em mobile inclui a barra de endereço e sub/superestima o espaço real). Margens negativas cancelam o padding do `<main>` (`px-4 pt-4 pb-20`) pra esse cálculo não ficar com padding contado duas vezes — era exatamente esse descompasso que colapsava a área de mensagens a zero de altura. Dentro do bloco: mini-header da conversa (`shrink-0`) → lista de mensagens (`flex-1 overflow-y-auto`, `justify-end` — histórico curto fica ancorado embaixo, histórico longo estoura o topo e scrolla) → formulário de envio (`shrink-0`, **fluxo normal, não fixed**: sendo o último item de uma coluna de altura fechada, ele naturalmente encosta no fim do bloco, que é o topo da nav). `scrollIntoView` no fim da lista roda sempre que o número de mensagens cresce (abrir a conversa ou enviar), sem forçar o scroll durante o polling se nada mudou (não atrapalha quem rolou pra ler o histórico).
- **Teclado mobile**: `viewport.interactiveWidget = "resizes-content"` (`app/layout.tsx`) faz o navegador **encolher de verdade** a viewport dinâmica quando o teclado abre — como o bloco da conversa é dimensionado via `dvh` e vive em fluxo normal (não `fixed`), o encolhimento reflui pra cá sozinho: o input continua colado no fim da coluna, agora mais curta, sem cobrir as últimas mensagens. `viewport.viewportFit = "cover"` dá efeito real ao `env(safe-area-inset-*)` já usado em Nav/editor (sem isso os valores são sempre 0). Verificado com Playwright (viewport 390×844 → 390×400, simulando o resize real do teclado): input permanece dentro da viewport reduzida, última mensagem visível acima dele, nav inferior nunca coberta.

## Operação diária — buscas recorrentes (cron) + fila do dia (/hoje)

O Radar como rotina, não só ferramenta: o cron reabastece a base de madrugada e a fila do dia diz o que trabalhar de manhã.

### Buscas recorrentes (`src/lib/buscas/cron.ts` + `/api/cron`)

1. **Toggle "recorrente" por busca** (página /buscas → `PATCH /api/buscas/[id]`). Ligar respeita o teto `config.maxBuscasRecorrentes` (default 3) — a quarta recebe 400 com a dica de desligar outra ou subir o teto. Religar uma já recorrente é idempotente; desligar nunca esbarra no teto.
2. **Vercel Cron 1x/dia de madrugada** (`vercel.json`: `0 6 * * *` UTC = ~3h em Brasília) chama `GET /api/cron` com `Authorization: Bearer ${CRON_SECRET}`.
3. **Mesmo pipeline da busca manual**: geocode com cache permanente, `searchText` com `reserveQuota` ANTES de cada página, upsert que **não rebaixa** status nem apaga nada, leads novos anexados ao MESMO grupo (`buscaId` da busca recorrente). Os parâmetros originais (`qualificada`, `quantidade`) são gravados no doc da busca na criação e reusados aqui. Sem usuário: o cron não carimba `userId` nem quebra `porUsuario` — o uso conta só no agregado.
4. **Ordem determinística**: `criadaEm` asc (desempate por id), recortada ao teto — se o teto de cota estourar no meio, param sempre as MESMAS buscas do fim da fila, nunca aleatoriamente.
5. **Cota estourada no meio → para e registra**: `QuotaExceededError` (1ª página) interrompe a fila com `interrompida: { buscaId, nome, motivo }` no resumo; teto a partir da 2ª página registra o parcial daquela busca (já pago) e também interrompe. Erro do **Google** numa busca só marca `erro` naquela entrada e segue — uma região com problema não trava as demais.
6. **Cada re-execução grava** `{ em, novos, existentes }` em `/buscas/{id}/execucoes` (e soma os deltas aos totais do grupo); a rodada inteira sobrescreve `/cron/ultima`, que o dashboard mostra no widget "Buscas recorrentes" via `GET /api/cron/status`.

### Fila do dia (`src/lib/leads/hoje.ts` + `/api/hoje` + página /hoje)

- **Home pós-login** (o login redireciona para `/hoje`; o Painel continua em `/`, primeira aba "Hoje" na nav). Contadores no topo: "7 novos · 3 follow-ups · 2 demos paradas".
- **(a) Leads novos desde a última visita** — `criadoEm` posterior ao `ultimaVisitaEm` do usuário (primeira visita = tudo), ordenados pelo score de priorização (`calculaScore`, desc), com badge da **busca de origem** (a primeira do array `buscaId`).
- **(b) Follow-ups** — status `contactado` sem `respondeuEm` há mais de `config.followUpDias` dias (default 4), o mais antigo primeiro, com "Xd sem resposta".
- **(c) Demos paradas** — lead com `demo` salva e status ainda `novo` (demo criada e não enviada), demo mais antiga primeiro.
- Descartados ficam fora de todas as seções (a fila é "o que trabalhar"; descartar é tirar do caminho). Cada item tem ação direta: **WhatsApp** (link `wa.me` com a mensagem do grupo ou a global, `{demo}` → link público quando houver demo), **abrir ficha** e **abrir demo** — além de "melhor momento pra contatar" (`melhorMomento` de `lib/leads/horarios.ts`) quando o lead tem horário de funcionamento salvo.
- A seleção é pura (`montarFilaDoDia`) e testada isolada; a rota só orquestra (config + leads + buscas + carimbo de visita).

## Proteção por sessão multiusuário (src/proxy.ts + lib/auth.ts + lib/usuarios)

Todo o app (páginas e API) exige sessão, exceto assets estáticos, a página `/login`, `POST /api/login`, a demo pública `/demo/{leadId}` e o gatilho do cron `GET /api/cron` (match exato; protegido por `CRON_SECRET` na própria rota — ver "Operação diária"). Como a demo, a exceção do cron fica DEPOIS do check de `APP_PASSWORD` (fail-closed vale para ele igual). Fluxo:

1. `POST /api/login` com `{ nome, senha }` identifica o usuário em `/usuarios` (PBKDF2) e grava o cookie `radar_session` (httpOnly, sameSite=lax, 30 dias, secure em produção). Antes de conferir, a rota roda o **seed se a coleção estiver vazia** (migração da senha única — ver `/usuarios` acima). `nome` ausente cai em "admin" (compat com o fluxo antigo via curl).
2. O cookie é um **token assinado sem estado no banco**: `userId.papel.versao` + HMAC-SHA256 com `APP_PASSWORD` como segredo. Trocar `APP_PASSWORD` invalida todas as sessões; redefinir a senha/desativar/trocar o papel de um usuário incrementa a `versao` (campo `sessao` do doc) e derruba só as sessões dele.
3. **Verificação em duas camadas**: o proxy (Edge, sem Firestore) só valida a assinatura — e é quem barra anônimos; as rotas API que atribuem ações ou escopam resposta (`usuarioDaRequest`) ainda conferem o doc (existe, `ativo`, `versao` bate). Rotas de admin usam `requireAdmin` (401 sem sessão, `403 forbidden` para membro).
4. **Página sem sessão redireciona para `/login`** (acesso direto por URL cai no form, nunca num JSON de erro); rota `/api/*` sem sessão responde `401` JSON. A página `/config` é restrita ao admin — membro com sessão válida é redirecionado ao painel pelo próprio proxy (o papel está no token).
5. `POST /api/logout` limpa o cookie (usado pelo botão "Sair" da navegação).
6. **Fail-closed**: sem `APP_PASSWORD` configurada, tudo responde `503 config_error` — o app nunca sobe aberto por engano. A exceção da demo pública fica **depois** desse check: sem config, nem a demo abre.
7. O header `x-app-password` do fluxo antigo **foi removido** (não há mais senha única para comparar sem tocar no banco); para scripts, faça o POST de login e reutilize o cookie.

## Visitas à demo: classificação interna/externa (src/lib/device.ts + demo/[leadId]/page.tsx)

Toda visita à demo pública com `?t=` reconhecido (ver "Forja de Demos") vira um registro em `lead.demoVisitas` (só cresce). `interna` distingue "alguém do time abrindo o link pra conferir" de uma visita real do lead — usado pra excluir ruído da timeline "Visitas à demo" da ficha e da fila "abriram e não responderam".

- **Causa raiz de um bug diagnosticado nesta sessão**: `interna` dependia só do cookie `radar_session` estar presente na exata request que carrega `/demo/{leadId}`. Isso falha sempre que o navegador que abre o link não é o mesmo (ou não manda esse cookie httpOnly) do que está logado no Radar — ex.: o navegador embutido de um app (como o do WhatsApp, ao tocar no link {demo} dentro da própria conversa) normalmente não compartilha cookies com o navegador padrão do aparelho, mesmo sendo o mesmo dispositivo/pessoa do time; sessão expirada ou uma segunda aba/perfil sem login também caem nesse buraco. Reproduzido batendo direto em `/demo/{leadId}?t=…` com e sem o cookie de sessão: com sessão válida a classificação SEMPRE funcionou (`interna: true`) — o mecanismo em si não tinha bug de leitura —, mas não existia NENHUM sinal alternativo pra quando a sessão simplesmente não vinha junto. `proxy.ts` não é a causa: excluir `/demo` e `/api/demo-visita` do gate de sessão não descarta cookies da request, só pula o redirect/401; e o beacon (`sendBeacon`) já manda credenciais (POST same-origin, `SameSite=Lax` não bloqueia isso).
- **Marcador de dispositivo** (`lib/device.ts`): id opaco de 32 hex gravado em cookie de primeira parte `radar_device` (NÃO-httpOnly, 5 anos, `sameSite=lax`) no `POST /api/login` — mantém o mesmo id em logins seguintes no mesmo navegador — e espelhado em `localStorage` (`radar:device`) pelo próprio `login/page.tsx` logo após o login (o cookie é legível por JS de propósito, já que precisa ir pro localStorage e pro beacon). Sobrevive bem além da sessão.
- **Classificação** (`classificarVisitaInterna`, pura e testada): sessão válida OU cookie `radar_device` com o formato esperado — computada no carregamento SSR de `/demo/{leadId}` (`visitanteInterno`, que também resolve o nome de quem está logado — ver "Selo 'Vendo como membro'" abaixo). **Reforço via beacon**: o `VisitaTracker` também lê o marcador do `localStorage` e manda como `deviceId` no `POST /api/demo-visita`; se válido, promove a visita já registrada pra `interna: true` (só PRA CIMA — nunca derruba uma visita que a sessão já classificou como interna) — cobre o caso do cookie não chegar no carregamento inicial (ex.: bloqueio de cookie de terceiros num navegador embutido) mas o localStorage sobreviver.
- **Token continua sendo o portão de entrada**: sem `?t=` reconhecido, nada é registrado — só o "Abrir demo" do EDITOR (preview durante a edição) usa a URL sem token de propósito, pra não virar ruído a cada refresh. Uma visita com token, sem sessão e sem marcador ainda é registrada — só fica `interna: false`. Ver "Token de envio por canal" logo abaixo: "Copiar link" (ficha, `/demos` e da própria tela do editor) e o botão de WhatsApp EMITEM token, cada um do seu próprio canal.
- **Geolocalização por IP** (`x-vercel-ip-country`/`-country-region`/`-city`, só existem em produção na Vercel — ausentes em dev/self-host): logados no carregamento (`console.log("[radar] cabeçalhos de geolocalização da visita:", …)`) e gravados em `DemoVisita.geo` quando algum vem preenchido. **Puramente informativo** na timeline da ficha — nunca entra em `classificarVisitaInterna`. Não foi possível confirmar quais chegam de uma visita real de produção neste ambiente (sandbox sem tráfego real/deploy na Vercel); o log acima é o ponto de verificação — conferir os logs de produção após o próximo deploy.
- **IP/hash de IP nunca foi critério de classificação** — não existe (nem existiu) `ipHash`/`uaBot` neste código; a única geolocalização por IP é a de `x-vercel-ip-*` acima, sempre informativa. Se aparecer pedido pra "remover o hash de IP da classificação", é este parágrafo que confirma que não há nada a remover.

### Selo "Vendo como membro" (`demo/SeloVisitaInterna.tsx`)

Quando `visitanteInterno` (acima) classifica a visita como interna, `/demo/{leadId}` renderiza um selo fixo e discreto (canto inferior direito, `position: fixed`, `pointer-events: none`, estilo inline — não depende de nenhuma classe/CSS var da skin de baixo, que pode ter qualquer reset) com o texto "Vendo como membro" + o nome de quem está logado, quando a SESSÃO (não só o marcador de dispositivo) resolve pra um usuário ativo. **Decisão sempre no servidor** (`visitanteInterno`, chamado uma vez em `DemoPage` e reaproveitado tanto pelo selo quanto pelo tracking) e **fail-closed**: qualquer falha na resolução (Firestore fora do ar, cookie corrompido) cai em `interna: false` — sem certeza, o selo simplesmente não renderiza, nunca um "talvez". Cobre visitas sem token também (ex.: "Abrir demo" da ficha/editor), diferente do tracking em si, que só roda com `?t=` reconhecido.

### Causa raiz do 500 em produção (`/demo/[leadId]`, diagnosticado e corrigido nesta sessão)

A rota pública derrubava com 500 sempre que a demo resolvia algum efeito de fundo (a maioria — vários presets vêm com `"gradiente"`/`"particulas"` por padrão, ver "Efeitos visuais" acima). Causa: `DemoPage` (Server Component) chamava `getEfeitoComponenteDinamico(id)` como função comum — mas essa função é exportada de um módulo `"use client"` (`dynamicComponents.ts`); todo export de um módulo assim vira uma *client reference* no bundle do servidor, e invocá-la fora de JSX (em vez de renderizá-la como componente) lança em runtime ("Attempted to call ... from the server"), fora de qualquer try/catch. O tracking (`registrarVisitaDemo`) já era resiliente (try/catch desde a feature original); o efeito não era.

Fix: `dynamicComponents.ts` virou `dynamicComponents.tsx` e ganhou `EfeitoDinamico`, um componente client que resolve E renderiza o efeito por id (embrulhado no próprio error boundary, `EfeitoErrorBoundary`) — o Server Component só precisa montar `<EfeitoDinamico id={...} .../>` com props serializáveis, o caminho suportado de Server → Client Component (nunca mais chamar `getEfeitoComponenteDinamico` direto fora de um módulo client — `demo-preview/page.tsx` e `/interno/efeitos` continuam usando a função direto porque SÃO client components). `resolverEfeitoFundo` em `loadDemo` também ganhou try/catch — a resolução do efeito (puro, mas dado externo via `Theme.fundoEfeito`) nunca mais derruba a skin/dados da demo em si. Teste de regressão em `demo/[leadId]/__tests__/page.test.tsx` força erro nos dois pontos (efeito e rastreio) e confirma que `DemoPage` responde sempre.

### Token de envio por canal (`src/lib/demos/envio.ts` + `EnvioDemo.canal`)

Cada demo mantém um token vigente **por canal** (`EnvioCanal`: `"link"` | `"whatsapp"`), não um único token global: "Copiar link" (ficha e `/demos`) usa o vigente do canal `"link"`; a variável `{demo}` da mensagem de WhatsApp usa o vigente do canal `"whatsapp"`. Cada canal consome (rotaciona) seu próprio token de forma independente — copiar o link não queima o token que já pode estar numa mensagem de WhatsApp montada pro mesmo lead, e vice-versa. `demoVisitas[].canal` grava de qual canal veio o token da visita. Self-heal (`garantirEnvioToken`, chamado no GET da ficha/`/hoje`/`/api/leads`) garante os dois canais; entradas antigas sem `canal` (de antes desta feature) contam como `"whatsapp"` na leitura (`canalDoEnvio`) — era o único canal que de fato usava token antes. O "Abrir demo" do EDITOR continua sem token (preview, ver acima); "Abrir demo" da ficha e de `/demos` também continuam sem token (mesmo raciocínio de preview interno, não é um envio pro lead).

## Compactação de /leads e /buscas (`src/lib/usuarios/preferencias.ts` + `/api/preferencias/listas`)

**Relato**: as duas telas mais usadas do dia são filas longas de cards
altos — no celular, achar a busca de ontem custa uma dúzia de arrastadas de
polegar. A compactação tem **dois níveis independentes**, porque são dois
problemas diferentes: o que ocupa tela é o GRUPO inteiro (dobrar) ou o
MIOLO de cada card (modo compacto).

**Onde o estado mora — e por que não é mais a querystring.** O colapso de
grupo vivia em `?fechados=` (em `/leads`), ou seja, era do NAVEGADOR e da
NAVEGAÇÃO: recarregar a aba, abrir o app no celular ou chegar por um deep
link devolvia tudo aberto — e uma compactação que não sobrevive não
compacta nada. Agora a escolha mora em `/usuarios/{id}.preferenciasListas`,
mesmo padrão self-service de `tema`/`ultimoNivelIA`/`metaFaixaMinimizada`:

- `GET`/`PUT /api/preferencias/listas` — qualquer sessão lê e grava só o
  PRÓPRIO doc; `salvarPreferenciasListas` não toca `atualizadoEm` nem
  `sessao`.
- O `PUT` recebe a preferência INTEIRA (não um patch): a tela já tem o
  estado em mãos ao alternar, e o servidor normaliza — chave inválida cai,
  duplicata some, e o teto de `MAX_GRUPOS_FECHADOS` (200 por tela) corta as
  chaves mais ANTIGAS, para o doc do usuário não virar um acumulador
  infinito de grupos dobrados. Chave cortada só faz o grupo voltar a
  aparecer aberto, que é o padrão.
- **Normalização é a migração**: todo doc é "antigo" até o usuário mexer
  pela primeira vez, e `normalizaPreferenciasListas` resolve ausência e
  sujeira no mesmo caminho (`{ leadsCompacto: false, gruposFechados:
  { leads: [], buscas: [] } }`), sem código de migração à parte.
- As chaves de grupo são **por tela** (`gruposFechados.leads` /
  `.buscas`) porque as duas telas dobram coisas diferentes: em `/leads` a
  chave é o id da busca (ou `__sem_busca__`); em `/buscas` convivem ids de
  busca e as chaves dos agrupamentos por mês/nicho (`mes:2026-08`,
  `nicho:dentista`).
- **Gravação otimista**, no padrão do `MetaFaixa`: aplica local, dispara o
  `PUT`, reverte no erro — dobrar um grupo não pode esperar a rede. O hook
  `usePreferenciasListas` (`src/components/`) é o único ponto que fala com
  a rota; falha de rede cai no padrão em vez de prender a tela no
  esqueleto.

### Nível 1 — o grupo (`src/components/CabecalhoBusca.tsx`)

Fechado, o cabeçalho é a ÚNICA coisa do grupo na tela — então ele carrega
sozinho tudo que identifica a busca: **cor, nome, nicho e região, data,
autor e contagem de leads**, em duas linhas densas (a primeira é o que se
lê de relance; a segunda é a procedência). O mesmo componente serve as duas
telas, e é por isso que ele existe: em `/leads` o grupo é a seção de leads
daquela busca (contagem = leads carregados, com os filtros atuais); em
`/buscas` o grupo é a própria busca (contagem = criados + já existentes, o
detalhe fica no `title`). A cor continua sendo reforço redundante e nunca
canal único — o nome está escrito ao lado do ponto e o triângulo ▸/▾ diz o
estado da dobra sem depender de cor.

Diferenças legítimas entre as duas telas entram por slot, não por
duplicação: `onTrocarCor` (só `/buscas` cicla a paleta ao tocar no ponto) e
`acoes` (o atalho "leads →", que substitui o "card inteiro é um link" que
existia antes de o card dobrar).

### Nível 2 — o lead, por DENSIDADE (`LeadCard` + `SeletorDensidade`)

A grade tem **1, 2, 3 ou 4 cards por linha**, e a densidade não muda só
quantas colunas cabem: ela é também **o nível de conteúdo do card**. Uma
coisa depende da outra — não adianta pôr quatro colunas se o card
continuar do tamanho de uma.

| dens. | o que o card mostra |
|---|---|
| 1 | o card inteiro de sempre (nome, endereço, site/tel, horário, `SeloContato`, notas, ações) |
| 2 | sem endereço; a faixa de "já contatou" vira um **ponto** (texto inteiro no `title` e no leitor de tela); ficam nome, score, selo, site/tel e as cores das buscas |
| 3 | nome truncado, selo de status e score |
| 4 | cor da busca, nome curto e ponto de status |

O que sai a cada degrau é sempre o que só interessa DEPOIS da escolha; o
que fica é o que decide "abro esta ficha ou passo pra próxima".

- **O padrão sai da largura da tela; a escolha do usuário sobrepõe.**
  `densidade: null` no doc é o automático (celular em 1, e daí
  acompanhando os breakpoints do Tailwind: 640 → 2, 1024 → 3, 1280 → 4).
  Guardar `null` em vez do número já resolvido é o que faz quem nunca
  escolheu continuar acompanhando a largura ao trocar de aparelho, e quem
  escolheu levar a escolha para todos eles. É **por tela**: 3 buscas por
  linha cabem onde 3 leads não caberiam.
- **A lista espera a largura atrás do esqueleto.** Grade que nasce com 1
  coluna e vira 4 meio segundo depois é o "elemento que entra depois do
  primeiro desenho e empurra o resto" que o portão de CLS reprova. A
  largura é medida em efeito (não no inicializador do estado, que
  divergiria na hidratação), e o esqueleto já reserva a altura.
- **De 2 para cima o card inteiro é link pra ficha.** Numa coluna de
  ~85px do celular não cabe ação nenhuma dentro do card, e o toque passa a
  ter um destino só em vez de dois.
- **O recolher local sobrevive só na densidade 1**: ali o card continua
  como sempre foi — `▴` recolhe para a linha única, tocar na linha
  expande de volta, e nada disso é persistido (é gesto de leitura, não
  preferência).
- **O selo de status encolhe sem virar "só a cor decide"**, que é a regra
  que o `StatusBadge` existe para segurar. Nas três variantes
  (`completo`/`glifo`/`ponto`) o que sai é o texto VISÍVEL: o glifo de
  progresso (○◐◑●), a forma (quadrada no começo do funil, pill no fim) e
  o rótulo por extenso (`title` + leitor de tela) continuam nas três.
- **O indicador de site/tel é glifo, não cor.** "Sem site" é o caso BOM
  aqui (lead quente), então cor sozinha inverteria a leitura de quem não
  distingue os matizes: quem carrega o estado é o `✓/✕/?`, com o `title`
  por extenso; a cor só reforça.
- **O seletor tomou o lugar do botão "≡ Compacto/Completo"**, que
  governava a mesma coisa por outro nome. Os dois juntos produziam estados
  que se contradizem (compacto ligado + 1 coluna, que é justamente o card
  inteiro), e a barra de filtros do celular não tinha espaço para um oitavo
  controle. Saldo: zero. O ícone é a própria grade (1 a 4 barras), com
  largura fixa por botão — um controle que mudasse de tamanho ao alternar
  empurraria a barra inteira.
- **O modo compacto legado vira o degrau 2**, dentro da própria
  `normalizaPreferenciasListas` — nada de código de migração à parte, e
  `leadsCompacto` some do doc no primeiro `PUT`. 2 e não 3 porque quem
  ligou o compacto pediu mais leads por tela, não a fila mínima.

### A faixa da busca também encolhe (`CabecalhoBusca`)

Em `/buscas` a grade vale para as faixas **FECHADAS**, e o cabeçalho tem a
escada dele: em 2 a procedência cai para nicho e região (data e autor são
o que menos distingue uma busca da outra na mesma tela — quase sempre o
mesmo autor, datas próximas) e o selo "recorrente" sai; em 3 a procedência
sai inteira; em 4 sobram cor, nome curto e o triângulo da dobra.

**Busca ABERTA volta a ocupar a linha inteira e, junto, volta à densidade
1.** Mensagem do grupo, recorrência e ações não cabem numa coluna de
~85px — e é assim que o atalho "leads →" continua alcançável em qualquer
densidade, sem ninguém ter que trocar a grade para chegar nele. Em
`/leads` o cabeçalho fica sempre em densidade 1: lá ele encima uma seção
que ocupa a linha inteira, então nunca aperta.

### Agrupamento de `/buscas` por mês e por nicho (`agruparBuscas`)

Além da fila única de sempre (`nenhum`, o padrão), `/buscas` agrupa por
**mês** e por **nicho** — as duas dobras que o operador de fato procura
("o que rodei em julho", "o que já rodei de dentista"). Os três modos
passam pelo MESMO caminho de render: `nenhum` devolve um grupo único e a
tela só não desenha cabeçalho pra ele, em vez de existirem uma lista plana
e uma agrupada divergindo com o tempo.

- **O mês é o de America/Sao_Paulo, não o do ISO cru.** Uma busca rodada
  às 22h do dia 31 é de julho pra quem a rodou, e cairia em agosto se a
  chave saísse de `criadaEm.slice(0, 7)` — mesma razão das janelas de cota
  (ver `saoPauloDateKey`).
- **Nada some por dado sujo**: data ilegível vira "Sem data", busca sem
  nicho vira "Sem nicho" — grupos próprios, nunca despejadas no primeiro
  grupo que aparecer. Caixa e espaço não criam dois grupos do mesmo nicho
  ("Dentista" e " dentista " são o mesmo).
- **A ordem sai de graça**: a rota já devolve as buscas mais recentes
  primeiro, e agrupar preservando a ordem de chegada dá meses em ordem
  decrescente e nichos na ordem do uso mais recente.
### Verificação (`qa-plataforma.mjs --so=listas` + `qa-cls.mjs --so=app`)

As duas telas, no CELULAR (390×844, dpr 2), **dirigindo os controles de
verdade** — não uma preferência semeada no banco: estado semeado provaria
só que o componente sabe renderizar denso, e o que precisa ser verificado
é o caminho inteiro (tocar → gravar no doc → **recarregar** e continuar na
densidade escolhida, que é uma asserção do laço). Dezesseis estados
capturados: `/leads` nas quatro densidades → recarregado → um card
recolhido → grupo dobrado; `/buscas` aberto → dobrado → as quatro
densidades → uma aberta dentro da grade de 4 → por mês → por nicho.

**O portão** (é o análogo do `--so=colapso` das skins, para listas), em
quatro cobranças:

1. **nenhum slot renderiza com altura OU largura zero** — e "slot" não é
   só a linha da lista: é cada folha com conteúdo dentro dela (ponto de
   cor, selo, chip de score, nome). Folha sem texto e sem fundo é pulada
   de propósito (o card completo tem um `<span />` de espaçamento que é
   legitimamente 0×0). A **largura** entrou junto da altura nesta rodada
   porque é ela que colapsa nas densidades altas, onde a coluna tem ~85px;
2. **a grade tem mesmo N colunas**, contando quantos cards dividem a
   primeira linha. Sem isso, `grid-cols-${n}` montado em runtime — que o
   Tailwind não gera, porque ele varre o TEXTO dos arquivos — passaria
   despercebido: a tela continuaria certa, só que sempre em 1 coluna;
3. **densidade maior encurta o card** (senão não houve densificação);
4. nada vaza horizontalmente da viewport do celular.

`[data-ponto-busca]` tem asserção própria — e ela existe porque o ponto de
cor **já sumiu uma vez**: `<span>` inline ignora `width`/`height`, então
bastou ele deixar de ser filho direto de um flex (entrou dentro do botão
de trocar cor) pra virar uma caixa 0×0. A tela continuava "certa", só sem
o ponto; nenhuma asserção de altura de LINHA pegaria isso.

**O que a cobrança de LARGURA achou na primeira rodada da densidade**: o
nome da busca em `/buscas` densidade 2, renderizado em **0×20**. `truncate`
traz `overflow: hidden`, e um item de flex com overflow escondido pode
encolher até ZERO — o selo "recorrente" tem largura fixa de ~68px e, numa
faixa de ~170px, comia o nome inteiro. Duas correções: o título passou a
tomar o espaço que sobra explicitamente (`min-w-0 flex-1`, para truncar em
vez de sumir) e o selo "recorrente" saiu já na densidade 2. Nenhuma
captura denunciaria isso sozinha — a faixa continuava com altura, cor e
contagem; o que faltava era o nome.

**E o que só a CAPTURA achou, com o portão já verde**: nas mesmas faixas,
o nome vinha como "D..". Três causas somadas, nenhuma delas caixa zerada —
por isso o portão passou e o olho não:

1. o atalho "leads →" (~60px) é irmão do botão de dobrar, então disputa a
   MESMA linha do nome, não a da procedência. Saiu na densidade 2 (a busca
   aberta volta à densidade 1 e o recupera);
2. `line-clamp-2` **nunca cortou nada**, desde antes desta rodada: o clamp
   precisa de `display: -webkit-box` e a utility `block`, na mesma
   declaração, vence na cascata. Em largura cheia a procedência já cabia em
   duas linhas e ninguém notou; na faixa de ~170px ela foi para quatro. O
   `block` saiu;
3. a contagem custa ~44px com a pílula — metade do nome numa faixa de
   ~100px. Ficou só até a densidade 2.

É a mesma lição do ponto de cor, na direção contrária: **o portão pega o
que sumiu, a captura pega o que ficou ilegível.** Nenhum dos dois substitui
o outro.

**O limite honesto da densidade 4 no celular**: 390px divididos em quatro
dão ~85px por coluna, e o nome sobra em 3–4 caracteres. Quem identifica ali
é a COR, que é justamente o que a densidade 4 promete mostrar — duas buscas
do mesmo nicho ficam distinguíveis pelo ponto, não pelo texto. É também por
isso que o padrão automático do celular é 1, e não a densidade máxima.

**O que a captura achou e a leitura de código não acharia**: além do ponto
sumido, a data do cabeçalho contradizendo o grupo — "01/08" dentro de
"Julho de 2026", porque o agrupamento resolvia o mês em São Paulo e a data
saía no relógio do navegador (daí `formatDateShortSP`).

**Deslocamento de layout** (`qa-cls.mjs --so=app`, portão 0.1): as 7 abas
em 0.0000 — Leads e Buscas incluídas, já com a densidade —, menos `config`
em 0.0258 (pré-existente, sem relação com estas telas). A primeira medição pegou **0.0050 em Buscas**, com origem em
`div.border-t.border-line, li.rounded-lg.border`: o autor aparece no
cabeçalho de toda busca e o fallback "usuário removido" é mais longo que o
nome real, então a linha da procedência encolhia de duas para uma quando
`/api/usuarios/nomes` respondia — e empurrava tudo abaixo dela. Corrigido
pondo `nomes` no mesmo portão de esqueleto de `buscas`/`preferencias`;
nova medição: **0.0000**.

- **Voltar de um nível não perde o lugar**: o modo mora na querystring
  (`?agrupar=mes`) e é espelhado em `sessionStorage` (`radar:buscas:query`)
  porque a nav inferior aponta pra `/buscas` fixo; a posição de rolagem
  volta por `radar:buscas:scroll`. É o mesmo par de chaves que `/leads` já
  usava para sobreviver à ida e volta da ficha.

## UI (implementada)

Client Components (`"use client"`) que buscam dados via `fetch` no próprio cliente (não Server Components lendo o Firestore direto) — decisão deliberada: cada ação do usuário (buscar, enriquecer, mudar status, salvar config) precisa do feedback de erro específico das rotas (429/502/400/404/409), então a mesma rota HTTP serve tanto a carga inicial quanto a mutação, com um único caminho de tratamento de erro (`src/lib/api-client.ts`, classe `ApiError`).

- **`/login`**: form de usuário + senha → `POST /api/login` → redireciona para `/hoje` (a fila do dia é a home pós-login). Qualquer página protegida sem sessão redireciona para cá (proxy).
- **`(app)/` (route group)**: layout com nav inferior fixa (Hoje/Mundo/Painel/Leads/Buscas/Demos/Chat/Config) + botão Sair; com a oitava aba o rótulo passou a ser `text-xs` até `sm` (10px abaixo de 360px) — em `text-sm` os rótulos se encostavam e "Config" saía pela borda num celular de 390px (ver "Onde prospectar agora"); a aba Chat carrega o badge de não-lidas (polling leve de `/api/mensagens/nao-lidas`); todas as páginas autenticadas vivem aqui.
  - **`/hoje` (Fila do dia)**: contadores no topo + as 3 seções de `GET /api/hoje` (novos por score com badge da busca de origem, follow-ups com "Xd sem resposta", demos paradas), cada item com WhatsApp/Ficha/Demo diretos e, quando `lead.horarios` existe, "melhor momento pra contatar" ao lado do item — ver "Operação diária".
  - **`/mundo` (Onde prospectar agora)**: seletor de nicho + uma linha por país em faixa boa NESTE minuto (bandeira, nome, índice de preço com a fonte, hora local e até quando a faixa vai, idiomas), ordenada por idioma e depois por índice desc. Tocar num país abre os leads não contatados dele naquele nicho ou, não havendo nenhum, leva à busca pré-preenchida em `/leads` — sem disparar busca. Tela derivada, nenhuma chamada paga; ver "Onde prospectar agora".
  - **`/` (Dashboard)**: hero com custo projetado em R$, um `UsageMeter` por SKU (accent → warning → critical conforme se aproxima do teto, nunca só cor — sempre acompanhado da palavra "OK"/"Perto do teto"/"No limite"), um KPI row de prospecção com `/api/metrics`, o widget "Buscas recorrentes" (última execução do cron via `/api/cron/status`: quando rodou, quanto achou, interrupção/erros e quantas recorrentes estão ligadas) e o card "Demos criadas" (total de `metrics.demosCriadas`, linka para `/demos`). **Membro vê os números escopados a ele** (a API já escopa); **admin ganha a seção "Por usuário"** (requests por SKU, buscas, demos, contatos de cada um).
  - **`/leads`**: form de nova busca (`POST /api/search`, trata `quota_exceeded`/`user_quota_exceeded`/`places_error`/`aviso` parcial com mensagem específica; campos nicho/sub-nicho/região/nome, quantidade 1–40, checkbox "Só sem site" e auto-enriquecimento dos primeiros N ≤ 5), o indicador `CotaIndicador` de cota individual de buscas (permanente, atualizado após cada busca, botão desabilitado como cortesia ao esgotar) + filtros (status/site/telefone/favoritos) + lista com **agrupamento colapsável por busca** (o mesmo `CabecalhoBusca` de `/buscas`: dot da cor + nome + badge "recorrente" + nicho·sub-nicho — região + data + autor + contagem; lead em várias buscas aparece em cada grupo; "Sem busca" agrupa o resto — sem procedência, porque não há busca de origem). O estado da dobra é do USUÁRIO, não da querystring (ver "Compactação de /leads e /buscas"), e a barra de filtros tem a alternância **Compacto/Completo**, que transforma cada card numa linha (nome · site/tel · score · status) até alguém tocar nele. Cada card (`LeadCard`) tem estrela de favorito e notas editáveis inline — sem abrir a ficha —, os dots de cor das buscas, destaque "sem site (lead quente)" e, quando `lead.horarios` existe, o estado atual ("Aberto agora · fecha 18h" / "Fechado · abre 9h", `estadoAtual` de `lib/leads/horarios.ts`). Aceita `?buscaId=` na URL (via `useSearchParams`, com Suspense) para mostrar só os leads de uma busca (aí a lista é plana), com chip de filtro e botão limpar.
  - **`/buscas`**: cada busca é um **grupo colapsável** (ver "Compactação de /leads e /buscas") — fechada, sobra só a faixa do `CabecalhoBusca` (dot de cor, nome, badge "recorrente", nicho·sub-nicho — região, data, autor, contagem de leads); aberta, revela os totais, a mensagem do grupo e o toggle "tornar recorrente"/"recorrente ✓" (`PATCH /api/buscas/[id]` — o 400 do teto de recorrentes aparece como erro na página). Tocar no dot cicla a cor pela paleta e persiste (mesmo PATCH). A navegação para `/leads?buscaId=…` deixou de ser "o card inteiro é um link" (o card agora dobra) e ganhou o atalho explícito "leads →" no cabeçalho. No topo, o seletor de **agrupamento** (sem agrupar · por mês · por nicho) — o modo fica na querystring e volta junto com a posição de rolagem quando o operador retorna dos leads do grupo.
  - **`/demos`**: todas as demos ativas (leads com `demo` salva) — nome do lead, skin, data de criação/edição (`demo.criadoEm`/`atualizadoEm`), selo de prontidão, link público copiável e atalhos "Editar" (`/leads/{id}/demo/editar`) e "Excluir" (confirmação inline, mesmo `DELETE /api/leads/[id]/demo` do editor). Reaproveita `GET /api/leads` (sem filtros) e filtra client-side pelos leads com `demo` — mesma escala de "centenas de leads" do resto do app, sem rota nova. **Agrupamento por busca** (checkbox "Agrupar por busca", ligado por default — mesmo padrão colapsável de `/leads`: dot de cor, nome, contagem, `agruparPorBusca` de `src/lib/buscas/agrupar.ts`, extraído pra ser compartilhado entre as duas páginas em vez de duplicado). Demo criada pelo diálogo de lote (`GerarDemosLoteDialog`) já nasce no grupo certo sem nenhum código especial: o `PUT /demo` nunca toca `lead.buscaId`, então o agrupamento por busca da própria demo cai no mesmo grupo de origem do lead.

**Filtro por autor** (`LeadDemo.criadoPor`, select "Todos os autores" — só aparece quando há mais de um autor com demo, sem opção morta): nomes resolvidos por `GET /api/usuarios/nomes` (qualquer sessão válida, o mesmo usado pelos selos de contato), demo sem `criadoPor` (salva antes do campo existir, ou sem sessão identificável) entra como "Sem autor registrado". **Combinável com o agrupamento**: o filtro roda ANTES de agrupar — um grupo de busca sem nenhuma demo do autor escolhido simplesmente não aparece, em vez de aparecer vazio.
  - **`/leads/[id]`**: ficha do lead; a página server é só um wrapper fino que extrai `params.id` e monta `<LeadDetailClient key={id} id={id} />` — o `key={id}` força remontar o client component ao trocar de lead, resetando o estado em vez de arrastar dado do lead anterior. A seção **Demo** é um resumo (skin, preset, atualizado em) com "Criar/Editar demo" apontando para o **editor visual** `/leads/{id}/demo/editar` (ver seção da Forja), além de abrir/copiar o link público. Sem demo salva, deixa claro que `/demo/{id}` responde 404. A mensagem do WhatsApp aceita `{demo}` além de `{nome}`. A seção **Detalhes** mostra o `CotaIndicador` de cota individual de enriquecimento (permanente — visível antes E depois de enriquecer, já que a cota é do usuário, não do lead), o estado atual ("Aberto agora · fecha 18h" / "Fechado · abre 9h") quando `lead.horarios` existe, com o botão discreto "buscar horários" (`POST /api/leads/[id]/horarios`) para leads enriquecidos antes desta feature; "melhor momento pra contatar" (`melhorMomento`) aparece junto do botão WhatsApp, com destaque verde quando o lead está aberto agora.
  - **`/mensagens`**: chat privado entre os usuários — lista de conversas e conversa aberta com envio de texto simples (ver seção "Mensagens entre usuários").
  - **`/config`** (restrita a admin — o proxy manda membro de volta ao painel): seção **Usuários** (criar, ativar/desativar, redefinir senha; membro sem senha definida aparece marcado) + seção **Cotas por usuário** (resumo do teto global relevante via `UsageMeter` + um cartão por usuário com uso × limite de dia/semana/mês, edição inline com efeito imediato — salva no blur, sem botão "Salvar" à parte — e botão "Zerar dia") + formulário completo (busca, filtros, mensagem padrão, **operação diária** — dias de follow-up e teto de buscas recorrentes —, tetos por SKU, preços/cota grátis/câmbio), mostra a lista de `problemas` de validação devolvida pela API.
- **Paleta**: sempre escura (sem alternância clara/escura — é um painel de operação pessoal), tema "radar/sonar": fundo em gradiente azul-profundo → quase-preto (`--background-2` → `--background`), surface com leve tingimento azul (`#121b24`), acento vibrante verde-radar (`--accent`, com `--accent-ink` preto para texto sobre ele — o verde não passa em contraste com texto branco). Tokens centralizados em `globals.css` como `@theme` do Tailwind v4. Validada com a skill de dataviz: status do lead é **ordinal** (posição no funil novo→fechado), não identidade — por isso um único hue em degraus de luminância (`--status-novo` … `--status-fechado`), não cores categóricas distintas, reforçado por forma (quadrado→pill) e marcador (○◐◑●); o meter de uso segue o contrato "accent → warning → critical" com a trilha em wash neutro. A paleta das 10 cores de busca (`BUSCA_CORES`) foi revalidada (mais saturada) contra a nova surface. Textos sobre `good`/`critical`/`warning` usam preto (não branco) — o contraste do branco falha nesses tons vibrantes.
- **Tipografia**: Space Grotesk (`font-display`, via `next/font/google`) para títulos e números grandes do dashboard; Inter (`font-sans`) para o corpo; JetBrains Mono (`font-mono`) para dados tabulares/valores.
- **Animações** (CSS puro, sem lib): fade-in sutil de página (`.page-transition`, disparado por `PageTransition.tsx` que troca a `key` pelo pathname), barra do `UsageMeter` cresce de 0 ao montar, pulso (`.pulse-warning`/`.pulse-critical`) no preenchimento do meter perto do teto/no limite, elevação no hover dos cards clicáveis (`.card-lift`), sweep de radar rotativo (`RadarSweep.tsx` + `.radar-sweep`) no carregamento do dashboard. Tudo respeita `prefers-reduced-motion`.
- **Favicon**: gerado via `app/icon.tsx` (`next/og`/`ImageResponse`) — círculos concêntricos + setor de varredura no verde-radar.
- **Padrão de fetch em `useEffect`**: o linter do React Compiler (`eslint-plugin-react-hooks` 7.x, via `eslint-config-next`) rejeita chamar, dentro de um efeito, qualquer função de escopo externo que (mesmo transitivamente) atualize estado — a regra é sobre o grafo de chamadas, não sobre ordem antes/depois de `await`. A cada tela, a busca é declarada **inline dentro do próprio `useEffect`** (ou via `.then/.catch/.finally` direto no corpo do efeito); quando a mesma busca precisa ser reaproveitada por um handler de evento (retry, refetch pós-mutação), extrai-se um fetcher **puro** (sem `setState`) chamado nos dois lugares.

## Sistema de temas da plataforma (`src/lib/tema.ts` + `/api/tema`)

O tema do app autenticado é **por usuário**, não global. Antes ele vivia em
`localStorage["radar:tema"]` — ou seja, era do NAVEGADOR: dois integrantes na
mesma máquina herdavam o tema um do outro, e o mesmo integrante em dois
aparelhos tinha duas preferências. Agora a escolha mora em
`/usuarios/{id}.tema`, e claro/escuro continuam sendo duas das opções.

- **Fonte da verdade é o doc.** `GET`/`PUT /api/tema` são self-service (mesmo
  padrão de `/api/ia/nivel` e `/api/metas/proprio`): qualquer sessão lê e grava
  só o próprio doc, e `salvarTemaUsuario` não toca em `sessao` nem em
  `atualizadoEm` — trocar de tema não é edição administrativa e não derruba
  sessão nenhuma.
- **O cookie `radar_tema` é um espelho, nunca a fonte.** Ele existe por um
  motivo só: deixar o `RootLayout` (Server Component) renderizar
  `data-theme="<id>"` já no HTML do servidor, o que elimina o flash de tema
  errado antes da primeira pintura sem script inline e sem `localStorage`.
  Quem escreve o cookie é sempre uma ROTA, a partir do doc — `POST /api/login`
  (é o que faz o segundo integrante entrar já no tema dele numa máquina
  compartilhada), `GET`/`PUT /api/tema`, e `POST /api/logout` o apaga (o tema
  pertence a quem estava logado). É `httpOnly`: o cliente lê o tema do
  `data-theme` que o servidor pintou, nunca do cookie.
- **Reconciliação entre dispositivos.** O cookie de um navegador fica velho se
  a escolha mudou em OUTRO aparelho desde o último login dali. O `TemaSeletor`
  chama `GET /api/tema` na montagem; a resposta traz o valor do doc e reescreve
  o cookie. Custo de uma requisição por carga, a mesma ordem do badge de
  não-lidas da Nav.
- **`TemaSeletor` não guarda o tema em estado React.** O tema ativo vive no DOM
  (`data-theme` no `<html>`) e o componente o espelha via `useSyncExternalStore`
  — mesmo desenho do antigo `ThemeToggle`, agora com N temas em vez de um
  booleano. É o que o linter do React Compiler exige aqui: escrever no
  `documentElement` dentro de handler, ou chamar `setState` no corpo de um
  efeito, são erros de lint neste repo (`react-hooks/immutability` e
  `react-hooks/set-state-in-effect`), então a escrita mora numa função de
  escopo de módulo que notifica os inscritos.
- **Adicionar um tema é operação de CSS.** Nenhum componente tem cor hardcoded:
  cada tema é um bloco `:root[data-theme="<id>"]` em `globals.css` trocando os
  mesmos papéis. `:root` é o tema `escuro`, que também é o `TEMA_PADRAO` (sem
  cookie e sem escolha salva, é o que vale).

### Verificação (`scripts/qa-plataforma.mjs --so=usuario`)

Um único contexto de browser — uma máquina compartilhada — em que duas pessoas
logam em sequência de verdade (`POST /api/login` com senha real, PBKDF2
semeado pelo script), cada uma troca o tema pelo SELETOR (não por `fetch`), e o
laço confere três coisas: o `data-theme` do DOM, o campo `tema` gravado no doc,
e — depois de deslogar e relogar — o `data-theme` que veio dentro do **HTML do
servidor**, que é a prova de que não há flash. Resultado da rodada:

```
admin      escolheu "claro" pelo seletor  → DOM=claro   doc=claro    ok
membro-1   escolheu "escuro" pelo seletor → DOM=escuro  doc=escuro   ok
docs: admin=claro  membro-1=escuro  → independentes ok
admin      relogou no MESMO navegador → data-theme no HTML do servidor = claro   ok (sem flash)
membro-1   relogou no MESMO navegador → data-theme no HTML do servidor = escuro  ok (sem flash)
```

Detalhe achado montando o laço: escolher no seletor o tema que JÁ está ativo é
(corretamente) um no-op — nenhum `PUT` sai. A primeira versão do laço fazia
exatamente isso com o `membro-1` e "provava" a gravação lendo um campo que
continuava ausente; passou a percorrer outro tema antes do alvo, para a escolha
final ser sempre uma troca de verdade.

Captura: `docs/temas/usuario-dois-temas.png` (folha de contato — mesmo
navegador, dois usuários, duas primeiras pinturas).

### Temas iridescentes (Ácido, Vapor, Prisma)

Três temas de base preta que compartilham um vocabulário e se separam pelo
miolo. Adicioná-los foi operação de CSS: um bloco `:root[data-theme="<id>"]`
por tema, nenhum componente tocado por cor.

- **O `--accent` carrega a identidade, não a cor de apoio.** O verde-lima é o
  parentesco (`--apoio`, presente nos três) e o rosa é a faísca (`--faisca`,
  sempre pontual). Se a lima fosse o accent nos três, o lugar mais visível da
  interface — botão primário, aba ativa, barra do meter — seria idêntico em
  todos, e eles seriam variações do mesmo tom em vez de temas.
- **A iridescência "entre eles" é o arco que os três varrem.** Todos começam na
  lima (~80-85°) e terminam na mesma cauda de rosa (~320-333°); o que gira é o
  miolo: 147° (Ácido) → 187° (Vapor) → 255° (Prisma). Lado a lado, os três
  gradientes de cromo são a mesma película de óleo girada.

| tema | preto base | `--accent` (miolo) | `--apoio` (lima) | `--faisca` (rosa) | arco `--iris-1/2/3` |
|---|---|---|---|---|---|
| **Ácido** | `#050704` neutro | `#b8ff2e` lima 80° | `#b8ff2e` | `#ff4d9d` | 80° → 147° → 333° |
| **Vapor** | `#03070c` azulado | `#2fe6ff` ciano 187° | `#a8f03c` | `#ff5aa8` | 84° → 187° → 332° |
| **Prisma** | `#06040c` violáceo | `#a98cff` violeta 255° | `#a6f53a` | `#ff5cc8` | 85° → 255° → 320° |

- **A rampa ordinal de status muda de hue por tema** para não colidir com o
  accent — status é posição no funil, accent é ação, e dois significados não
  podem dividir cor: azul no Ácido, índigo no Vapor, teal no Prisma. Todas
  monótonas em luminância, cada degrau com a própria ink (ver `docs/temas/contraste.md`).
- **Um quarto tema quente foi desenhado e descartado.** Com accent âmbar o
  meter viraria `âmbar (OK) → amarelo (perto do teto) → vermelho (no limite)`:
  progressão de severidade invertida, porque amarelo lê como *menos* alarmante
  que laranja. Descartar foi mais barato que quebrar o contrato
  `accent → warning → critical`.

**Rosa "em quantidade bem menor", medido** (`--so=iris`): o laço captura o
header e a barra inferior, decodifica pixel a pixel (`scripts/png.mjs`) e
classifica por faixa de matiz, descartando o que tem croma baixo (a superfície
sólida, que é a maioria). O rosa é a cauda dos últimos 12% da rampa e nunca
passa de 1/6 do cromo colorido:

| tema | lima | miolo | rosa | do cromo é colorido |
|---|---|---|---|---|
| `escuro` | 0,2% | 90,8% | **9,0%** | 2,3% dos pixels |
| `claro` | 0,0% | 90,7% | **9,3%** | 2,2% |
| `acido` | 37,1% | 55,0% | **7,9%** | 2,2% |
| `vapor` | 9,3% | 85,6% | **5,1%** | 3,2% |
| `prisma` | 25,8% | 57,7% | **16,5%** | 2,0% |

Header e nav são contados também **em separado** — somados, um dos dois poderia
estar sem linha nenhuma e o total continuaria bonito. Os dois têm entre 1.138 e
2.612 pixels coloridos em todos os temas.

**Dois defeitos reais que só a captura pegou** (e nenhum apareceria em teste
unitário nem lendo o código):

1. **As cinco levas de captura saíam IDÊNTICAS.** O laço cunhava o cookie do
   tema, mas o `TemaSeletor` chama `GET /api/tema` ao montar e aplica o valor
   do DOC — que estava vazio, então tudo voltava pro padrão. Quem denunciou foi
   o `qa-diff.mjs`: `ácido vs vapor, médio=0.000, máx=0`. O laço passou a semear
   o doc antes de capturar, e ganhou a asserção `exigirTema` depois de cada
   carga. (O comportamento do app está certo: é assim que um segundo
   dispositivo se corrige.)
2. **A barra de navegação deixou de ser fixa.** A iridescência entrou como
   `::after`, que exige ancestral posicionado; a primeira versão pôs
   `position: relative` na classe `.cromo-linha`, que tem a MESMA
   especificidade das utilities do Tailwind e vem depois delas no arquivo —
   venceu o `fixed` da nav e jogou a barra de volta pro fluxo, grudada embaixo
   do header. É o terceiro caso do mesmo cascade neste repo (os blobs do hero da
   tatuagem e o `.d-nav-cta` foram os outros dois). Corrigido tirando `position`
   da classe custom; o laço ganhou `exigirCromoNoLugar`, que cobra
   `position: fixed` e a nav colada no rodapé da viewport em toda captura.

Um terceiro, do próprio laço: o doc `cron/ultima` semeado tinha forma
encurtada, e o widget do painel formata `totalNovos` direto — o `formatInt`
de `undefined` derrubava a página no cliente, e quando React desmonta a
árvore o `data-theme` do `<html>` vai junto. O sintoma que apareceu não foi
"o painel quebrou", foi "o tema sumiu".

Capturas: `docs/temas/tema-{escuro,claro,acido,vapor,prisma}-{desktop,celular}.png`
(folha de contato com as 7 abas de cada tema), `docs/temas/contraste.md` e
`docs/temas/iridescencia.md`.

### Regra de legibilidade

Gradiente e iridescência vivem em **borda, cabeçalho, navegação inferior,
estado ativo e realce**. Texto de leitura fica em superfície **sólida**. Na
prática isso significa que todo gradiente do app é uma faixa de 1–2px, e a
lista completa dos que existem cabe em cinco classes de `globals.css`:
`.cromo-linha::after` (bordas do header, da barra de metas e da nav),
`.cromo-linha-baixo`/`.cromo-linha-cima` (posição da faixa),
`.cromo-aba-ativa` (estado ativo) e `.cromo-realce` (a régua do número
principal do painel).

**O plano da página deixou de ter gradiente.** O `body` tinha uma vinheta
(`radial-gradient` + `linear-gradient` entre `--background-2` e
`--background`, com `background-attachment: fixed`), e boa parte do texto do
app vive direto sobre ele — o número grande do painel, títulos de seção, os
contadores de /hoje. Era gradiente sob texto de leitura, exatamente o que a
regra proíbe. `--background-2` continua existindo como degrau de elevação; só
não pinta mais o fundo da página.

**A regra é cobrada em dois lugares, e nenhum substitui o outro:**

- **`globals.legibilidade.test.ts`** lê o `globals.css`, encontra toda regra
  que PINTA gradiente e reprova qualquer seletor fora da lista permitida —
  pega o gradiente novo antes de existir tela. Tem teste de mutação junto (um
  gradiente falso num container de leitura tem que reprovar) para não passar
  contando zero, e uma asserção de que `--surface`/`--background` continuam
  sendo hex chapado em todos os temas.
- **`qa-plataforma.mjs --so=legibilidade`** varre o DOM REAL: para cada
  elemento com texto próprio, nas 7 abas de cada tema, sobe a árvore até o
  primeiro fundo OPACO (o que de fato pinta atrás), registra se havia
  gradiente na cadeia e mede o contraste da `color` computada contra esse
  fundo. Pega o caso que o parser não vê: classe permitida aplicada no lugar
  errado.

**Resultado da varredura** (418 nós de texto por tema, piso de 4,5:1 — o de
texto normal, sem a folga de 3:1 que o texto grande teria):

| tema | pior contraste do app | onde | gradiente sob texto |
|---|---|---|---|
| `escuro` | 4,73:1 | "Excluir" (config, 12px) | **nenhum** |
| `claro` | 4,92:1 | "novos desde a sua última visita" (hoje, 12px) | **nenhum** |
| `acido` | 4,98:1 | "Contactado" (hoje, 12px) | **nenhum** |
| `vapor` | 5,05:1 | "-5" (leads, 10px) | **nenhum** |
| `prisma` | 5,02:1 | "Contactado" (hoje, 12px) | **nenhum** |

**Um defeito real, no tema que já existia.** A primeira varredura reprovou o
`escuro` com **4,33:1**: `--ink-muted` (`#7c8992`) passava sobre `--surface`
(4,84:1) e falhava sobre `--surface-2` (o degrau de elevação onde ficam os
chips e as legendas de 10px em /leads). A tabela de contraste por TOKEN não
enxergava esse par porque só media contra `--surface` e `--background` — foi a
varredura no DOM que achou, e é a diferença entre validar a paleta e validar a
tela. Corrigido para `#87949d` (5,00:1 sobre `--surface-2`), e os pares com
`--surface-2` entraram na tabela de tokens. Os três temas novos já passavam
(5,05–5,36:1); o defeito era só do escuro, e estava lá antes desta rodada.

Relatórios: `docs/temas/contraste.md` (110 pares de token, os cinco temas) e
`docs/temas/legibilidade.md` (a varredura no DOM).

### Custo (a plataforma fica aberta o dia inteiro)

Três regras, todas cobradas por teste E por medição no navegador:

1. **Nenhuma animação contínua no cromo da interface.** O ponto do wordmark
   RADAR, no header, tinha `animate-ping` — uma animação infinita no elemento
   que fica na tela o dia inteiro, em todas as abas. Virou halo estático
   (`box-shadow`), mesma leitura visual, zero custo por quadro. O ganho não é
   de fps (um `transform`/`opacity` num elemento de 8px é composto pela GPU e
   praticamente não aparece na contagem de quadros): é que uma animação que
   nunca termina impede o compositor de ficar ocioso, e isso se paga em
   bateria durante um dia inteiro de aba aberta, não em travamento.
2. **Nada de desfoque animado junto de transformação.** É a combinação que
   derrubou o preview do editor a 9 fps (ver "Custo por quadro dos efeitos").
   No cromo da plataforma não existe `blur` nenhum — nem animado nem estático.
3. **A iridescência é deslocamento lento de matiz ou nada. Aqui é nada:**
   gradiente multi-matiz PARADO. O item permitia as duas saídas; com a
   plataforma aberta o dia inteiro e a regra 1 valendo, animar o arco seria
   reintroduzir pelo cromo exatamente o que a regra 1 tirou dele.
   Iridescência é propriedade óptica estática — não precisa se mexer para ler
   como película.

**`globals.custo.test.ts`** trava as três: toda `animation: … infinite` do CSS
tem que estar numa lista de CONTEÚDO permitido, nenhuma classe `.cromo-*` pode
declarar `animation`/`transition`, `Nav.tsx`/`MetaFaixa.tsx` não podem usar
`animate-ping|pulse|spin|bounce`, nenhum `@keyframes` toca em `--iris-*` nem em
`gradient()`/`filter`, e nenhuma regra combina `blur()` com animação.

> Detalhe de escrita do teste: ele lê o texto-fonte do `Nav.tsx`, e o
> comentário que explica POR QUE o `animate-ping` saiu cita o nome da classe.
> A primeira versão reprovava o arquivo pelo próprio comentário que documenta a
> correção; agora os comentários saem antes da busca.

**As duas animações contínuas que sobram são de conteúdo e condicionais**, não
de cromo: `.radar-sweep::before` (o mostrador só existe enquanto uma carga está
em curso — some quando o dado chega) e `.pulse-warning`/`.pulse-critical` (só
quando o meter está perto do teto ou no limite, e o estado também vem como
palavra). Nenhuma das duas está viva no estado de repouso medido abaixo.

**Medição 1 — animações vivas** (`--so=custo`): `document.getAnimations()`
filtrado por `playState === "running"` e `iterations === Infinity`, nas 7 abas
de cada tema, depois de a página assentar. Alvo dentro de `header`/`nav`/
`.cromo-*` conta como cromo. Resultado: **nenhuma, em nenhum tema, nem no cromo
nem no conteúdo**. Esta é a medição da CAUSA; o fps abaixo mede a consequência.

**Medição 2 — fps navegando entre as abas** (`--so=fps`): celular 390×844 com
`deviceScaleFactor: 2`, **CPU limitada em 4×** via CDP, contagem CONTÍNUA de
quadros enquanto 6 trocas de rota acontecem em 4s (a nav é `<Link>`, então a
navegação é client-side e o contador sobrevive a ela). Mediana de 5 cargas
independentes por tema — a mesma disciplina do piso do registro de efeitos,
pelo mesmo motivo: uma varredura de uma tacada só dá leituras de 13 a 52 fps
para o mesmo estado. Piso de aprovação: **45 fps**.

| tema | fps (mediana) | cargas | veredito |
|---|---|---|---|
| `escuro` | **55,4** | 54,9 / 55,2 / 55,4 / 55,7 / 56,4 | passa |
| `claro` | **56,0** | 55,6 / 55,7 / 56,0 / 56,0 / 56,2 | passa |
| `acido` | **55,8** | 55,3 / 55,5 / 55,8 / 56,3 / 56,4 | passa |
| `vapor` | **56,0** | 55,5 / 55,8 / 56,0 / 56,2 / 56,2 | passa |
| `prisma` | **56,2** | 55,2 / 56,0 / 56,2 / 56,5 / 56,5 | passa |

Os cinco temas ficam dentro de 0,8 fps um do outro: **o tema não é o custo** —
o que a navegação paga é o mesmo em todos, que é o esperado quando a
iridescência é uma faixa de 1px parada e não uma camada animada. Os ~4 fps
que faltam para 60 são a troca de rota em si (montar a árvore da aba nova e
buscar os dados), não o cromo.

Relatórios: `docs/temas/custo.md` e `docs/temas/fps.md`.

### `theme-color` acompanha o tema do usuário

A barra do navegador passa a ser a `--surface` do tema ativo DESTE usuário —
a mesma cor do header, para a barra ficar contínua com ele em vez de encostar
com um degrau. `generateViewport` no layout raiz lê o mesmo cookie-espelho do
`data-theme`, então a cor sai pronta no HTML do servidor; o `TemaSeletor`
reescreve o `content` da mesma tag na troca, sem recarregar.

`TemaMeta.barra` DUPLICA a `--surface` do CSS — a meta tag é HTML e nada lê
custom property no servidor. Duplicata sem guarda vira divergência silenciosa
(alguém ajusta a surface, a barra fica na cor velha, e só aparece na moldura
do celular), então `lib/__tests__/tema.test.ts` compara os dois arquivos.

**A demo pública não é afetada**: `/demo/{leadId}` declara o próprio
`generateViewport` com a cor da skin do lead, e o da ROTA vence o do layout.
Confirmado com o cookie de tema presente: a demo responde `#1A1411` (a cor da
skin) e não a do app.

| tema | HTML do servidor | DOM | tags |
|---|---|---|---|
| `escuro` | `#121b24` | `#121b24` | 1 |
| `claro` | `#ffffff` | `#ffffff` | 1 |
| `acido` | `#111710` | `#111710` | 1 |
| `vapor` | `#0b151d` | `#0b151d` | 1 |
| `prisma` | `#140f22` | `#140f22` | 1 |

Troca pelo seletor, sem recarregar: `#121b24` → `#140f22`.

**Duas armadilhas de MEDIÇÃO, não de produto** — as duas custaram tempo e as
duas valem registro, porque a segunda quase virou uma reescrita inteira em
cima de um diagnóstico falso:

1. **A leitura do HTML do servidor saía atrasada em um tema.** O laço grava o
   tema no doc e carrega a página; só que o cookie-espelho é escrito por uma
   ROTA, e na primeira carga ele ainda é o do tema anterior. O laço ganhou uma
   carga de aquecimento — o próprio `GET /api/tema` põe o navegador em regime
   — e passou a medir a segunda. O atraso era do laço, não do produto.
2. **Um servidor sobrando de uma sondagem anterior serviu TODAS as sondagens
   seguintes.** `next start` numa porta ocupada falha com `EADDRINUSE` e sai;
   o processo velho continua respondendo, com o build velho. Sondando por
   `curl` contra ele, o `theme-color` "nunca aparecia" — e as conclusões
   tiradas dali ("`generateViewport` não roda em layout", "a camada de
   metadados do Next filtra a tag", "`metadata.other` não emite") eram TODAS
   falsas. O sintoma que denunciou foi o HTML ainda conter o `animate-ping`
   removido dois commits antes. Contra um servidor novo, `generateViewport` no
   layout raiz funciona exatamente como documentado.

   O laço nunca caiu nessa: `qa-plataforma.mjs` herdou de `qa-visual.mjs` o
   `exigirPortaLivre`, que aborta antes de subir se a porta já responde — foi
   por isso que ele vinha reportando "ok" enquanto a sondagem manual reportava
   "não existe". **A sondagem à mão é que precisava da guarda que o laço já
   tinha.**

Relatório: `docs/temas/barra.md`.

## Verificação da UI

### Qual laço cobre o quê

Os nomes se parecem e o custo de errar é alto: rodar o laço errado
devolve "ok" sem ter olhado a tela em questão. A divisão é por SUPERFÍCIE,
não por assunto.

| laço | superfície | o que ele julga |
|---|---|---|
| `scripts/qa-visual.mjs` | **camada decorativa das DEMOS** (rota pública das 8 skins, via o harness `/interno/demo-qa`) | efeito × intensidade × tema, estilos de LED, modos de cor, animação por seção, cor da barra do navegador, fps no celular com CPU 4× (`--so=fps`) e o portão de foto colapsada (`--so=colapso`). **Não conhece `/leads` nem `/buscas`** — não há tela da plataforma nele |
| `scripts/qa-plataforma.mjs` | **a PLATAFORMA autenticada** (as 7 abas do Radar) | tema × aba, contraste, legibilidade, custo do cromo, iridescência medida por matiz e — em `--so=listas` — o portão de `/leads` e `/buscas` no celular: caixa zerada, colunas da grade, escada de densidade, nada vazando |
| `scripts/qa-cls.mjs` | **deslocamento de layout**, nas três | `--so=skins` (rota pública), `--so=editor` (o preview do editor) e `--so=app` (as 7 abas da plataforma). Portão 0.1, o mesmo piso "bom" do Core Web Vital real |

Os outros são de recorte estreito e o nome já diz: `qa-aura.mjs`,
`qa-editor.mjs`, `qa-titulo.mjs`, `qa-perfil-blur.mjs`, `qa-servidor.mjs`,
`qa-diff.mjs` (compara duas capturas pixel a pixel — é ele que denuncia
"as levas saíram idênticas").

Dois deles (`qa-plataforma.mjs` e `qa-cls.mjs --so=editor|app`) precisam do
**patch temporário de banco falso** (`RADAR_FAKE_DB=1` +
`src/lib/testing/qa-fake-db.ts`), aplicado e revertido na mesma sessão e
nunca commitado — princípio 2, nenhum caminho de banco falso no código do
app. `qa-visual.mjs` e `qa-cls.mjs --so=skins` não precisam: o harness
`/interno/demo-qa` renderiza sem banco.

Sem Firebase real neste ambiente de sessão, a verificação de ponta a ponta foi feita ligando temporariamente o `FakeFirestore` (o mesmo fake dos testes) no lugar do Firestore via uma env var (`RADAR_FAKE_DB=1`), com dados de exemplo, rodando `next build && next start` e navegando o app real com Playwright (login errado/certo, dashboard com os três estados de meter, filtros de leads, ficha enriquecida/não enriquecida, botão Enriquecer com erro real de `GOOGLE_PLACES_API_KEY` ausente, transição de status, link `wa.me` com telefone e `{nome}` corretos, salvar config, logout e bloqueio pós-logout). O patch em `admin.ts` e os dados de exemplo foram revertidos antes do commit — não fazem parte do código do app.

O **editor visual de demos** foi verificado no app real com o mesmo esquema (fake Firestore + fake Storage via env var temporária, revertidos antes do commit; `next dev` + Playwright): abrir `/leads/{id}/demo/editar` com preview renderizando a skin e os dados do lead; digitar no painel e ver o preview atualizar ao vivo; clicar num slot do preview e ver o campo correspondente focado; ocultar seção na aba Estrutura sumindo do preview; trocar cor primária na aba Tema; salvar e conferir `/demo/{id}` **200** com as edições e a cor custom no HTML; excluir com confirmação voltando à ficha e `/demo/{id}` de volta a **404** (também 404 antes do primeiro save); e, em viewport mobile (390px, touch), o painel começando fechado, abrindo pelo botão flutuante como drawer editável e fechando.

A skin de barbearia da Forja de Demos foi verificada **lado a lado com o material bruto** (`skins-raw/barbearia` rodando em paralelo, `npm install && next build && next start` no diretório clonado): comparação seção a seção (header com scroll, hero com máquina de escrever, agendamento rápido, filosofia, serviços, equipe com hover de fios de cabelo e tesourinha animada, ritual, passos de agendamento, contato, footer com poste de barbeiro) e a animação de entrada (navalha cortando a tela) e o cursor contextual capturados em pleno funcionamento (motion habilitado, sem `prefers-reduced-motion`). Divergências encontradas nessa comparação (fontes trocadas, seção QuickBooking reduzida a uma faixa, animações ausentes, bio da equipe sem a segunda linha de detalhe) foram corrigidas antes do commit final.

**Rodada de verificação seguinte** (mesmo esquema de fake Firestore + `next dev`/`next build && next start`, revertido antes do commit):

- **Handle de drag na aba Estrutura**: em viewport mobile com touch simulado via CDP (`Input.dispatchTouchEvent`), um swipe começando no corpo do item rola o painel (`scrollTop` muda, ordem intacta) e um swipe começando no ⠿ reordena a seção (ordem muda) — confirmando que o toque fora do handle não é mais capturado como drag.
- **`/demos`**: lista renderizou os dois leads seedados com skin/datas corretas, copiar link, abrir demo e o fluxo de exclusão com confirmação inline; o card "Demos criadas" do dashboard mostrou o total certo e levou pra lá.
- **Fontes sob demanda**: build de produção + captura de rede (Playwright) confirmaram que `/demo/{leadId}` só baixa os arquivos das fontes core + as explicitamente escolhidas no `tema` do lead (nenhuma das ~9 fontes curadas não-selecionadas aparece nas requisições nem no `class` do wrapper); no editor, trocar a fonte na aba Tema disparou novas requisições de fonte só depois da escolha (import dinâmico client-side).
- **Animação**: comparação `animacao: "marcante"` vs `"nenhuma"` — opacidade da seção Filosofia antes/depois de entrar no viewport (0 → 1 só quando "marcante"/"sutil"; sempre 1 em "nenhuma"), lift no hover de um card de depoimento (~10px em "marcante", 0px em "nenhuma") e a sidebar `sticky` da seção Serviços comparada pixel a pixel entre os dois níveis (idêntica em ambos — o wrapper de entrada não envolve essa seção de propósito, ver "Animação" acima).

**Rodada multiusuário + animações do editor**: verificada por testes automatizados (suíte completa: proxy com redirect/401 por tipo de rota e gate de papel em /config, login com seed/migração e revogação por versão de sessão, rotas de usuários, atribuição de userId em busca/enriquecimento/status/demo, quebra `porUsuario` de uso e métricas, validação de `animacaoEntrada` por seção e dos novos campos de tema, diff mínimo do editor) + `next build` de produção. Sem navegação Playwright nesta rodada — as mudanças de UI são finas sobre rotas testadas, seguindo o critério das rodadas anteriores.

**Rodada bug do Portfólio + vídeo-no-título/LED/escolha de skin/título hero** (mesmo esquema de fake Firestore + fake Storage via env var temporária, `next dev`/`next build && next start`, tudo revertido antes do commit):

- **Bug real encontrado e corrigido**: a seção Portfólio da tatuagem nunca revelava (opacity presa em 0) com uma lista de itens realista (20+) em viewport mobile — confirmado rolando a página inteira via CDP e lendo a opacity computada do wrapper de entrada. Causa: `SectionReveal` envolvia a seção INTEIRA com `viewport.amount: 0.2`, exigindo 20% da área TOTAL do elemento visível de uma vez — inatingível quando a seção passa de ~5x a altura da viewport (o que só acontece com listas de tamanho livre como o masonry do Portfólio, não com as ~4 itens de outras seções). Corrigido pra `amount: "some"` (mesmo bug e fix no `SectionReveal` da barbearia, preventivo) — reproduzido e confirmado corrigido em navegador real antes e depois da mudança, com teste de regressão que falha contra o código antigo.
- **Vídeo-no-título**: com `dados.videos.titulo` ausente/inválido (URL do fake Storage não é servida de verdade), o wordmark caiu corretamente no fallback de imagem — a foto do slot `hero` mascarada pelas letras, visível tanto na demo pública quanto no preview do editor, confirmando a cadeia vídeo → imagem → cor sólida na prática (não só em teste unitário).
- **Escolha de skin**: lead sem demo em `/leads/{id}/demo/escolher` mostrou os dois cards (miniatura + nicho); escolher "Tatuagem" navegou pro editor com a skin certa já carregada (`?skin=`), sem precisar trocar depois na aba Tema.
- **LED**: ligar "Marcante" na aba Tema fez as barras vermelhas aparecerem nas bordas esquerda/direita do preview ao vivo.
- **Título hero**: mover o alinhamento pra "Esquerda" e a escala pro máximo do slider moveu e aumentou o wordmark no preview, sem afetar o resto do hero (subtítulo/CTA continuam no lugar).

**Skin "Lancheria Chapa Burger"** (conversão de `skins-raw/lancheria`, uma lanchonete artesanal full stack — Mercado Pago, painel de comandas, carrinho — da qual só as páginas públicas visuais foram portadas): verificada lado a lado com o material bruto (`npm install && next dev` no diretório clonado, screenshots via Playwright em desktop e mobile, comparando com uma página temporária renderizando a skin fora da proteção por sessão — revertida antes do commit, sem alterar `src/proxy.ts` no resultado final).

- **Divergência de cor encontrada e corrigida**: a primeira versão usava `paleta.destaque` (cor de CTA) para os títulos também, deixando os botões amarelos — no material bruto os botões ("VER CARDÁPIO", "ESCOLHER", "+") são sempre laranja e só títulos/logo são amarelos. Corrigido remapeando os papéis: `destaque` = laranja (ação), `acentoSecundario` = amarelo (marca/títulos), `acentoTerciario` = verde (preço, papel fixo em todos os presets — igual ao `alface` do original).
- **Efeito de lente do card do cardápio** (`BurgerCard.tsx`, fiel ao `<BurgerCard>` original: `clipPath` circular via `useMotionValue`/`useSpring`/`useMotionTemplate` que revela o "prato vazio" sob a foto do lanche, com frase aleatória sem repetição) confirmado hover a hover em navegador real — círculo segue o mouse, frase troca sem repetir a anterior.
- **CTA de pedido neutro** (`OrderCta.tsx`): substitui carrinho/checkout/Mercado Pago do original — com `data.whatsapp` preenchido (caso do exemplo), vira link `wa.me` com mensagem pronta por item; sem número, mostra o toast "Disponível na versão completa" (mesmo cartão/animação de toast do material bruto, sem o carrinho por trás). Usado no botão do header, "ESCOLHER" do cardápio, "+" de bebidas/acompanhamentos e "Fazer Pedido" do rodapé.
- **Elemento decorativo entre seções** (`DecorativeBlob.tsx`, parallax fiel ao `<DecorativeElement>` original): reposicionado da borda superior (onde sobrepunha o título da seção seguinte) pra borda inferior com `-z-10`, garantindo que fique sempre atrás do texto independente da ordem de reprodução no DOM.
- **Fonte nova**: Fugaz One (display "poster" do material bruto) virou fonte core (`--font-demo-fugaz`) e entrou na lista curada do editor (`lib/demos/fontes.ts`) — nenhuma das skins anteriores tinha essa família.
- Responsivo confirmado em mobile (390px): título do hero quebra em duas linhas naturalmente (sem split manual), grade de lanches vira coluna única, listas de bebidas/acompanhamentos mantêm rolagem horizontal, rodapé empilha.

**Skin "Tatuagem Pigmento Vivo"** (conversão de `skins-raw/tatuagem2`, CROMA Tattoo Studio — fundo claro, blobs coloridos, manifesto scroll-driven e portfólio em trilha horizontal): clonado com `git clone` (o material bruto é um componente único auto-bootstrapping via CDN — React/ReactDOM/Babel carregados em runtime pelo próprio `support.js`), renderizado localmente (interceptando as 3 URLs de CDN e servindo os pacotes equivalentes do `node_modules` via Playwright `page.route`, já que o CDN não é alcançável no sandbox) e comparado lado a lado com a conversão através de uma página temporária (`/qa-tatuagem2-preview`, fora da proteção por sessão via uma exceção EXATA em `src/proxy.ts`) — ambas revertidas antes do commit, sem sobra no resultado final.

- **Dois bugs reais de layout encontrados e corrigidos**: (1) os blobs decorativos do hero, embrulhados direto em `<Parallax>`, herdavam a classe `relative` do próprio wrapper do Parallax por cima do `absolute` que a skin passava — como as duas utilities Tailwind têm a mesma especificidade, a ordem de geração do CSS decidiu a disputa a favor de `relative`, jogando os três blobs (cada um ~46vw de altura) para dentro do fluxo normal do documento e empurrando o hero inteiro ~1900px pra baixo da dobra; corrigido envolvendo cada blob num `<div>` absolutamente posicionado PRÓPRIO, com o `<Parallax>` só por dentro (`h-full w-full`, sem position). (2) O CTA da nav mobile (classe utilitária `.d-nav-cta` com `display: inline-flex` fixo no `<style>` do componente) duplicava visualmente o CTA desktop em vez de somente aparecer abaixo de 768px: a tag `<style>` do componente é renderizada no `<body>`, depois do CSS compilado do Tailwind no `<head>` — com a mesma especificidade de seletor, a regra que vem depois no documento ganha o cascade, então o `display` fixo do `.d-nav-cta` vencia o `md:hidden` do Tailwind independente do viewport; corrigido tirando `display` da classe custom e deixando cada uso decidir via utility Tailwind (`inline-flex` / `inline-flex md:hidden`). Ambos reproduzidos e confirmados corrigidos via Playwright (`getBoundingClientRect`/screenshot) antes e depois da mudança.
- Um terceiro problema, de hidratação (não de layout): um comentário de código dentro do template string do `<style>` continha a substring literal `<style>`, e o sanitizador de conteúdo de tags `<style>`/`<script>` do React escapa essa sequência de formas diferentes entre o HTML gerado no servidor e a renderização no cliente — causando "Hydration failed" nesse texto. Corrigido reescrevendo o comentário sem a substring `<style>` verbatim.
- **Manifesto scroll-driven** (`ManifestoReveal.tsx`, DOM direto + rAF, mesmo padrão de `LedEdges.tsx`): confirmado rolando a página real — palavras "acendem" progressivamente da cor esmaecida (`color-mix` entre texto e fundo, funciona em qualquer preset) para a cor final conforme o scroll alcança o índice de cada uma; a cada 5 palavras, uma ganha itálico + cor do ciclo de acentos do tema, reproduzindo o efeito do original sem depender de quais palavras específicas o texto de exemplo usa.
- **Trilha horizontal do portfólio** (`ScrollGallery.tsx`): confirmada em desktop (ponteiro fino) com pin real — a seção fica "presa" enquanto a trilha desliza horizontalmente conforme o scroll vertical avança — e em mobile (390px) com o fallback de scroll nativo (sem pin, `overflow-x-auto`), mesmo comportamento do material bruto em `coarse` pointers.
- **Cartões de "Estilos"**: hover real confirmado — o blob de cor por trás do cartão expande (`scale(2.1)`) e o cartão inclina em 3D (`perspective`/`rotateX`/`rotateY`, alternando o sinal por posição par/ímpar), fiel ao original; o último cartão da lista sempre nasce com o esquema invertido (fundo escuro, texto claro usando os mesmos tokens de tema — funciona em preset claro OU escuro) no lugar do "Blackwork" fixo do original.
- **FAQ** (`FaqAccordion.tsx`): primeiro item nasce aberto (`state = { open: 0 }` do original), clicar em outro item fecha o anterior e abre o novo, ponto colorido só preenche quando aberto.
- **Preset escuro** ("Meia-noite"): confirmado visualmente com boa legibilidade e as micro-interações opcionais da Forja ligadas nesse preset (LED sutil, partículas de fundo) renderizando por cima do conteúdo sem atrapalhar leitura — mesma verificação de contraste feita nos outros presets claros ("Aquarela", "Boreal", "Terra").
- Sem foto no hero nem nos cartões de "Estilos"/"Artistas" — fiel ao material bruto, que também não usa nenhuma imagem ali (só blobs de cor e rabiscos SVG); só o Portfólio tem slot de imagem de verdade.

**Layout do chat `/mensagens`** (mesmo esquema de fake Firestore via `RADAR_FAKE_DB=1`, `next dev`, revertido antes do commit; Playwright em viewport mobile 390×844, dois usuários logados em contextos de browser separados): conversa com 18 mensagens confirmando header RADAR + mini-header da conversa no topo, lista preenchendo `flex-1` com scroll (sem colapsar), input colado acima da nav com as 6 abas sempre visíveis (checado por geometria via `getBoundingClientRect`, não só visual). Teclado mobile simulado por resize real do Chromium (390×844 → 390×400, o efeito equivalente ao `interactiveWidget:"resizes-content"` abrindo o teclado): input permaneceu dentro da viewport reduzida e a última mensagem visível acima dele, nunca escondida. Reabrir a conversa (nova navegação) e o lado do destinatário confirmados abrindo já com o scroll no fundo.

**Cotas por usuário** (fake Firestore via `RADAR_FAKE_DB=1` + um mock HTTP local do Text Search/Place Details/Geocoding — os fetches ao Google acontecem no servidor Next.js, não no browser, então a interceptação via `page.route` do Playwright não alcança; `BASE_URL`/`GEOCODE_URL` foram temporariamente parametrizados por env var pra apontar pro mock, revertido antes do commit junto do patch do `admin.ts`). `next dev` com Turbopack não hidratou neste sandbox (o client bundle carregava, mas nenhum listener React anexava — WebSocket de HMR falhando no handshake, possivelmente por causa do proxy do ambiente; sem diagnóstico definitivo, contornado usando `next build && next start`, que não depende de HMR): login como admin, definir senha e limites (`buscasDia`/`enriquecimentosDia` = 1) de um membro pela própria UI, confirmado persistindo após reload; login como o membro, indicador de cota em `/leads` saindo de "hoje: 0/1", uma busca bem-sucedida levando a "hoje: 1/1" com o botão "Buscar" desabilitando (cortesia client-side) e uma 2ª tentativa via `fetch` direto (fora do botão) confirmando o bloqueio real do servidor (`429 user_quota_exceeded`, `janela: "dia"`, `resetaEm` batendo com meia-noite em Brasília — `03:00Z` no dia seguinte); o mesmo fluxo na ficha do lead pro indicador de enriquecimento (permanente antes/depois de enriquecer); de volta como admin, teto global de `textSearch` zerado em `/config` e a busca do admin ainda respondendo `200` (bypass confirmado), e "Zerar dia" no cartão do membro zerando o "usado" de hoje sem sessão nova.

**Token de envio por canal + classificação interna/externa, ponta a ponta com demo real** (fake Firestore via `RADAR_FAKE_DB=1`, backed por ARQUIVO em `/tmp` em vez de módulo em memória — o build de produção separa cada route handler em seu próprio bundle, então um singleton em memória não é compartilhado entre rotas; `next build && next start`, Playwright com DOIS contextos de browser, tudo revertido antes do commit): logado como admin num contexto (sessão + marcador de dispositivo estabelecidos), clique real em "Copiar link" na ficha do lead confirmou (via `navigator.clipboard.readText()`) que a URL copiada já vem com `?t=` — corrigindo o bug em que só o botão de WhatsApp emitia token. Essa URL foi aberta num SEGUNDO contexto de browser totalmente limpo (sem cookies, sem localStorage — sem sessão e sem marcador de dispositivo, simulando o navegador real de um lead). O documento gravado em `lead.demoVisitas` teve exatamente uma entrada: `{ interna: false, canal: "link", envioEm: <geradoEm do token copiado> }` — confirmando que uma visita sem sessão/marcador entra como NÃO-interna. Em `lead.demo.envios`, só o token do canal `"link"` foi consumido (rotacionado para um novo); o token do canal `"whatsapp"`, gerado no mesmo save, permaneceu intocado — confirmando que os dois canais consomem de forma independente.

**Autor da busca + metas de prospecção** (fake Firestore via `RADAR_FAKE_DB=1`, seed de uma busca com `userId` e um doc `usage_users/membro-1/dias/{hoje}` com `buscas: 3` direto no patch do `admin.ts`, já que gerar isso de verdade exigiria a Google Places API; `next build && next start`, Playwright com dois contextos de browser, tudo revertido antes do commit): login como admin, "Redefinir senha" de `membro-1` pela própria UI; seção "Metas por integrante" em `/config` mostrando "3" de uso ao lado do campo vazio, digitar `5` (dia) e `20` (semana) e confirmar persistência após reload; `/buscas` mostrando "por membro-1" tanto pro admin quanto, depois, logado como o próprio `membro-1`; painel (`/`) do admin mostrando a seção "Metas do time" com a barra de `membro-1` em "3 / 5" e "3 / 20"; login como `membro-1` e `/hoje` mostrando "Sua meta de prospecção" com as mesmas barras; confirmado que `membro-1` NÃO vê "Metas do time" no painel (seção exclusiva do admin, 403 silencioso na UI).

**5 novos efeitos de fundo (veios, filotaxia, geometrico-pulsante, faiscas, varredura-de-luz) + registro de estilos de LED (barra/dissipado/cantos/moldura)**: verificado sem Firestore (nenhum lead precisa existir) — uma rota temporária `/qa-efeitos-preview` (Server Component fino que resolve skin/tema/efeito só a partir de query string, usando `demoDataExemplo`; exceção EXATA em `src/proxy.ts`) renderizou a MESMA árvore da rota pública (`<Skin>` + `<EfeitoDinamico>`; o LED já vem embutido no próprio `Skin.tsx`) sem precisar de sessão/lead/demo salva — página e exceção **removidas antes do commit**, nenhuma sobra no resultado final. `next dev` + Playwright (`chromium` do `/opt/pw-browsers`, viewport 1280×800, skin `barbearia-editorial`, `intro=0` pra pular a splash):
- **Cada efeito em intensidade 3 comparado com `fundoEfeito=nenhum`**: veios (traços com pulso claramente visível viajando pela curva), filotaxia (espiral de pontos do centro pra fora, opacidade crescente em direção à borda), geometrico-pulsante (hexágonos concêntricos com stroke metálico) e faíscas (pontos dispersos, mesma técnica de `particulas`) — diferença visível na captura em todos. Varredura-de-luz e faíscas são efeitos com janela de "aceso" bem menor que o resto do ciclo (a varredura ocupa só ~14% de um ciclo de 5,5s): a comparação por captura única em um instante aleatório não é confiável pra esses dois — confirmado fixando o `currentTime` da animação CSS via `document.getAnimations()` (WAAPI) num ponto dentro da janela de varredura, o que tornou o feixe diagonal claramente visível atravessando a viewport.
- **LED**: `led=desligado` (baseline) vs `led=marcante` nos 4 estilos — barra (linha fina nítida) e dissipado (halo bem mais largo e difuso, sem a borda nítida) lado a lado confirmam a diferença de forma pedida; cantos mostrou luz só nos 4 cantos (sem barra nenhuma) com o par de cima mais aceso que o de baixo em `scroll=0` (`--d-led-scroll` funcionando); moldura mostrou o perímetro completo, com o ponto mais brilhante deslocado entre topo e base ao comparar `scrollTo(0)` vs `scrollTo(bottom)` (o mesmo `--d-led-scroll`, agora dividido em 4 quartos por lado) — e um clique real acendeu o frame inteiro de uma vez (`.d-led-pulse`), confirmando que o vínculo com scroll/clique (JS inalterado desde antes desta migração) funciona igual nos 4 estilos.

**Revisão de qualidade visual dos efeitos de fundo e dos estilos de LED** (a leva anterior foi entregue com acabamento amador; nada disso se julga por teste unitário, então a rodada foi montada como um LAÇO de captura reproduzível, e cada item só foi dado por pronto depois da imagem vista):

- **Harness commitado, não temporário.** A rodada anterior usou uma rota `/qa-efeitos-preview` + exceção no `proxy.ts`, ambas removidas antes do commit — o que deixa o laço impossível de repetir depois. Agora existe **`/interno/demo-qa`**, irmã de `/interno/efeitos` e protegida por sessão como o resto do app: renderiza a MESMA árvore da rota pública (`<Skin>` + `<EfeitoDinamico>` sibling; o LED já vem embutido no `Skin.tsx`) resolvendo skin/preset/efeito/intensidade/LED só de query string sobre o `demoDataExemplo` — nenhum lead, nenhuma demo salva, nenhum Firestore. **`scripts/qa-visual.mjs`** sobe `next build && next start` com um `APP_PASSWORD` efêmero e **cunha um cookie de sessão assinado com esse mesmo segredo** (o proxy roda no Edge e só confere a assinatura HMAC — ver `lib/auth.ts`), percorre a matriz (9 efeitos × intensidades 1–3 × claro/escuro; 4 estilos de LED × 2 níveis × claro/escuro × scroll 0 e 50%), salva um PNG por estado em `qa-shots/` (gitignored) e monta uma folha de contato por item.
- **Ressalva de matriz**: `Theme.led` tem só DOIS níveis acesos (`sutil`/`marcante`; o terceiro valor é `desligado`) — não existe um "nível 3" de LED. O eixo de 3 intensidades só existe de verdade nos efeitos.
- **Dois defeitos do próprio laço, achados e corrigidos na primeira rodada**: (1) um servidor sobrando de uma rodada anterior ainda na porta ACEITA a conexão e RECUSA o cookie novo (o segredo é sorteado por rodada) — toda captura virava tela de login sem ninguém perceber; agora falha antes de subir, e o servidor é morto em grupo (`next start` deixa um filho que sobrevive ao SIGTERM do wrapper). (2) Congelar animação pra capturar efeito de janela curta precisa **somar o `animation-delay`** (`currentTime` corre na linha do tempo da animação, que só entra no ciclo depois do delay: com delay de 2s a captura ficava presa na fase de espera, com nada desenhado) e mirar **só** as animações da camada de efeito (`animationName` começando em `d-efeito-`), senão as revelações da própria skin congelam junto e a captura deixa de ser comparável com o baseline.
- **Diagnóstico por medição, não por palpite**: além de olhar cada captura, um analisador descartável calculou o brilho médio por COLUNA de cada PNG, subtraiu o do baseline (mesmo tema, sem efeito e sem LED) e reportou os saltos abruptos de coluna a coluna — a assinatura de aresta dura vertical.
- **Bug relatado ("faixa vertical escura atravessando o centro da tela"): DUAS origens, ambas confirmadas pela medição.** (1) `led=dissipado`: uma laje de 110–160px com gradiente só AO LONGO da barra e chapada na largura, terminando numa aresta vertical dura — maior salto de coluna 16,9 em x=160 (marcante) e 11,0 em x=110 (sutil), numa viewport de 1100px. (2) `geometrico-pulsante`: os hexágonos concêntricos tinham rotação alternada de 30°, o que deixa DOIS lados de cada camada exatamente verticais no meio da viewport; com 7 camadas na intensidade 3 eles empilhavam numa barra contínua, escura porque o gradiente do stroke passava por `cores.textoSuave` — saltos de 25,4 em x=771 e 23,2 em x=329. Depois da correção: dissipado cai para 2,1 (a última coluna da viewport, não uma faixa interna) e o geométrico não tem nenhuma coluna acima do limiar de detecção.
- **LED, por captura**: `dissipado` virou halo pequeno colado na borda com queda longa; `cantos` deixou de ser quatro bolinhas com aresta de caixa e virou luz sangrando na diagonal de cada canto; `moldura` trocou a tira chapada de 3–4px por bandas com queda perpendicular, com as pontas apagadas pela máscara (o contorno fechado era o que a fazia ler como retângulo desenhado). `barra` ficou intocada de propósito (ver "Micro-interações do tema"). Saltos de coluna medidos antes → depois: moldura marcante claro 22,4 → 1,7; moldura sutil escuro 12,2 → 1,2; cantos marcante escuro 4,6 → 1,3.
- **Efeitos, por captura**: `veios` deixou de ler como risco reto de espessura uniforme com pulso em forma de tracinho; `geometrico-pulsante` não tem mais figura legível como polígono em nenhuma intensidade; `filotaxia` e `faiscas` perderam a borda de disco recortado; `varredura-de-luz` deixou de ser laje branca por cima do título. Os tetos de opacidade (6% para forma geométrica) viraram teste em cada pacote. `aura`, `grao` e `particulas` foram capturados na mesma matriz e passaram sem mudança — nenhum tinha aresta dura nem opacidade fora do lugar.
- **Verificação do pulso de `veios`**, que usa uma técnica nova (mancha radial recortada por `clipPath`, movida por `@keyframes` que lê custom properties): confirmado em navegador real lendo o `transform` computado dos círculos recortados — o CSS var resolve e a mancha percorre o traço de verdade, não é só markup.

**Rodada "modos de cor + animação por seção + transição da camada"** (mesma rota-harness `/interno/demo-qa` e o mesmo `scripts/qa-visual.mjs`, agora com quatro itens novos: `--so=cores`, `--so=secao`, `--so=transicao` e os parâmetros `corModo`/`cores`/`ledCorModo`/`ledCores`/`semAnim` no harness). Nada aqui se julga por teste unitário, então cada item só foi dado por pronto depois da imagem VISTA — e, onde a imagem sozinha não decidia, com medição junto:

- **Modos de cor, por medição de matiz** (matiz médio da diferença contra o baseline sem efeito, folhas `_folha-cores-{particulas,aura,veios}.png` e `_folha-cores-led.png`, cada modo animado capturado em 3 fases do ciclo congeladas por WAAPI): tema 26.8° → `fixa` 193.8° (o ciano escolhido) → `transicao` 290.8°/113.2°/14.4° (as três cores girando entre os papéis) → `iridescente` 26.8°/44.0° (±16°, a paleta continua reconhecível) → `arco-iris` 27.1°/149.6°/261.1° (volta completa). O LED foi medido do mesmo jeito, contra o LED do tema.
- **Uma captura por modo não prova nada.** Um ciclo de 20-42s fotografado em instante aleatório não distingue "cor fixa" de "cor que muda devagar" — daí `congelarCores`, que fixa o relógio SÓ das animações `d-cores-*` (as da skin ficam correndo, senão a captura deixa de ser comparável). Detalhe achado montando a folha: as fases do `iridescente` não podem ser 0/0.25/0.5, porque o ciclo é 0 → +16° → 0 → -16° → 0 e a fase 0.5 é IGUAL à 0 — a folha mostrava dois estados dizendo três.
- **Default inalterado, provado pixel a pixel**: `efeito-faiscas-i{1,2,3}-{claro,escuro}` capturado antes e depois da mudança dá **0 pixels diferentes**. Era a dúvida real do desenho: a div nova da camada não pode criar stacking context, senão o `mix-blend-mode: screen` das faíscas passaria a compor contra um grupo isolado em vez da página. (A aura difere em 0.1% dos pixels nas duas rodadas porque ela se move sozinha o tempo todo — deriva senoidal —, não por causa da mudança.)
- **Animação por seção** (`_folha-secao.png`): com animação, o marcador tem um DIV do `motion` por filho e a seção está no meio da revelação no instante em que entra na viewport (opacidade 0.72 escuro / 0.87 claro, título ainda sendo digitado — "TRÊS |"); sem animação, o filho direto é a própria `SECTION` (nenhum elemento a mais no DOM), opacidade 1 desde o primeiro quadro e o título inteiro.
- **A transição, nos três momentos pedidos** (`_folha-transicao.png`, claro e escuro): antes (fade 1.00, aura dourada e moldura de LED acesas), durante (0.50, as duas visivelmente mais fracas) e depois (0.00, fundo limpo sobre a seção sem animação). A rampa medida em 21 posições de scroll — 1 → 0.99 → 0.85 → 0.50 → 0.15 → 0.006 → 0, simétrica na volta, maior salto entre pontos vizinhos 0.36 (um degrau daria 1.0) — é o que separa "interpola" de "some de uma vez", e efeito e LED aparecem sempre no mesmo valor.
- **Motor vivo e pausado, pelo relógio das animações**: `running` t=1633ms na seção animada → `paused` t=1817ms depois de 2,5s parado na seção sem animação (avançou 184ms, não 2500) → `running` t=2167ms na volta, sem nunca voltar a zero. É a prova de que partícula e traço retomam de onde pararam em vez de reiniciarem embaralhados.
- **Dois defeitos que SÓ a medição encontrou** (nenhum aparecia lendo o código nem numa captura isolada): (1) **colisão de atributo** — o marcador de seção nasceu como `data-d-anim`, nome que a raiz de cada skin já usava para o nível global de animação do tema; a raiz do documento inteiro (7220px) entrava na conta como "seção animada" e travava a cobertura em exatamente 0.50, o que fazia o efeito nunca sumir E o motor nunca pausar. O inventário de seções marcadas impresso pelo laço (`hero(700px) … filosofia(635px, SEM anim) …` mais um item `undefined(7220px)`) foi o que denunciou. Renomeado para `data-d-secao-anim`. (2) **piso de 0.50 na cobertura** — com a viewport INTEIRA como núcleo, uma seção de meia tela de altura não passava de metade apagada; a banda de foco virou a metade central da tela. (3) Um terceiro, do próprio laço: a tabela da rampa mostrava valores repetidos porque a leitura saía antes do quadro em que o listener (throttled por rAF) rodava — corrigido esperando dois `requestAnimationFrame` depois de cada scroll.
- **Bug de produto encontrado de raspão**: `tema.ledEstilo` era validado no PUT mas faltava na lista de chaves conhecidas — salvar uma demo com estilo de LED escolhido no editor respondia **400 "chave desconhecida"**. Corrigido com teste de regressão.

**Rodada "efeitos travando o editor"** (relato: `gradiente`, `veios` e `geometrico-pulsante` causariam sobreposição de elementos, LED piscando e travamento durante a edição; os efeitos em canvas, não). Reproduzida no editor REAL (`/leads/{id}/demo/editar` com o preview em iframe), não só na rota pública: fake Firestore backed por ARQUIVO ligado por env var temporária (`RADAR_FAKE_DB=1` num patch de `lib/firebase/admin.ts` + `lib/testing/qa-fake-db.ts`, ambos **revertidos antes do commit**), `next build && next start`, Playwright com cookie de sessão assinado.

O laço do editor virou script commitado (`scripts/qa-editor.mjs`), no mesmo espírito de `/interno/demo-qa`: abre o editor, digita num campo e reporta, por efeito, os fps do preview + a contagem de `<style>` antes e depois, salvando um PNG tirado NO MEIO da digitação. Ele não consegue ser 100% autônomo como o `qa-visual.mjs` — o editor lê o lead do Firestore, e um caminho de banco falso commitado violaria o princípio 2 —, então o cabeçalho do script traz o patch temporário exato (duas peças) que precisa ser aplicado e revertido na mesma sessão.

### Custo por quadro dos efeitos (a causa do travamento)

> Esta tabela é o registro HISTÓRICO da rodada do editor (desktop, sem CPU limitada) e cita `geometrico-pulsante`, que não existe mais. O piso de aprovação que vale hoje é a medição em celular com CPU 4× logo abaixo.

Medição: um `requestAnimationFrame` contando quadros DENTRO do iframe do preview por 4s, com o editor aberto, viewport 1400×900, intensidade 3, Chromium headless. Cada número é a mediana de 3 cargas independentes da página (a primeira varredura, feita numa tacada só para os 9 efeitos, deu leituras entre 13 e 52 fps para o mesmo estado — ruído de carga da máquina; medir 3× por estado é o que separa sinal de ruído aqui).

| efeito | antes | depois |
|---|---|---|
| `aura` (intensidade 3) | **12,7 fps** | **41,0 fps** |
| `aura` (intensidade 1) | 16,7 fps | 36,4 fps |
| `gradiente` (cor do tema) | **8,7 fps** | **59,9 fps** |
| `gradiente` (arco-íris) | 9,0 fps | 50,8 fps |
| `veios` (cor do tema) | 59,7 fps | 60,2 fps |
| `veios` (arco-íris) | 45,2 fps | 45,0 fps |
| `geometrico-pulsante` (cor do tema) | 55,4 fps | 55,4 fps |
| `geometrico-pulsante` (arco-íris) | 52,3 fps | 52,3 fps |
| `grao` / `faiscas` / `particulas` / `varredura-de-luz` / `nenhum` | ~60 fps | ~60 fps |

- **A causa era UMA, e era o `gradiente`**: `filter: blur(80px)` num elemento de 150% da viewport que anima `transform` infinitamente. Atribuído desligando uma coisa de cada vez no DOM da página já carregada: como estava **10 fps**; tirando só o `filter` e mantendo a animação **55 fps**; mantendo o `filter` e parando a animação **59 fps**; trocando `scale`+`translate3d` por só `translate3d` **11 fps** (não era o `scale`); com `background` estático **10 fps** (não era o `color-mix`); com `inset: 0` no lugar de `-25%` **16 fps** (a área ajuda, mas não é a causa). Nenhum dos dois sozinho custa nada — a combinação derruba a página a 1/6 do quadro, e é por isso que os efeitos em canvas (`grao`, sem animação nenhuma) e os de partícula (`faiscas`/`particulas`, transform em elementos pequenos e compositáveis) não tinham o problema. **Correção**: o filtro caiu e a suavidade virou rampa de gradiente (7 paradas, cauda longa).
- **A `aura` tinha o MESMO defeito, e não estava no relato** — foi achada pela mesma varredura: `filter: blur(60–100px)` em blobs de dezenas de vmax que recebem um `transform` novo a cada quadro (rAF, não `@keyframes`), o pior caso possível da combinação. Corrigida do mesmo jeito, com a ressalva de que a rampa dela precisou ser MEDIDA e a caixa precisou crescer (ver "A rampa que substituiu o blur"). Diferença média contra o código antigo, com o blob parado: **1,72/255** no preset escuro e **1,71** no claro, contra uma presença do próprio efeito de 21,4 e 20,2 que se manteve — a mudança é ~8% da presença dele. As duas versões erradas do caminho até aqui mediam 4,97 e 3,02 e as DUAS mostravam aresta circular na captura: é o caso em que o número sozinho aprovaria e a imagem reprova. Folha `_folha-efeito-aura-depois.png` (claro/escuro × intensidade 1–3) sem aresta em nenhum dos 6 estados. Sobra um custo real: 41 fps, não 60, porque o `mix-blend-mode: screen` de um blob grande obriga a compor com o fundo a cada movimento — mas é 3,2× o que era.
- **A correção é visualmente neutra, provado pixel a pixel**: `/interno/demo-qa` com o `d-efeito-gradiente-drift` CONGELADO em fase 0 (WAAPI), capturado com o código antigo e com o novo — diferença média **0,73/255** no preset escuro (máx 5, 0,096% dos pixels acima de 2 níveis) e **0,88/255** no claro. Para escala: a diferença entre "com efeito" e "sem efeito" no mesmo preset é 2,23 (escuro) e 3,76 (claro), e ela se manteve depois da mudança (2,12 e 3,50) — o efeito continua com a mesma presença, e a mudança é ~1/4 da presença dele. Folhas de contato `_folha-efeito-gradiente-{antes,depois}.png` (matriz claro/escuro × intensidade 1–3) indistinguíveis a olho.
- **`veios` e `geometrico-pulsante` NÃO tinham defeito de custo próprio**: 60 e 55 fps com a cor do tema. O que os derruba (para 45 e 52) é o modo de cor ANIMADO, que muda `stop-color` dentro de um `<svg>` de viewport inteira e obriga a repintar o SVG a cada quadro. É um custo real, mas de outra ordem — foram acusados junto do `gradiente` porque a sensação de travamento vinha da página inteira a 9 fps.
- **Verificação final, no editor e digitando** (`scripts/qa-editor.mjs`, PNG por efeito em `qa-shots/editor-*.png`, capturado no MEIO da digitação, com LED `marcante` e os DOIS modos de cor em arco-íris — o estado mais caro que o editor consegue montar): `gradiente` 42,1 fps · `veios` 43,2 · `geometrico-pulsante` 46,5 · `aura` 35,5 · `grao` 59,3, e a contagem de `<style>` igual antes e depois em todos (1 de cada bloco). Nas cinco capturas o layout está íntegro: nenhuma sobreposição de elementos, o LED nas duas laterais, o texto do hero legível e o painel respondendo à tecla.
- **O que NÃO se confirmou** (as duas hipóteses iniciais do relato):
  - **acúmulo de `<style>` por remontagem**: contado no DOM do iframe do preview, antes e depois de digitar 30 caracteres num campo, nos 5 efeitos com bloco de estilo próprio — **1 antes, 1 depois**, em todos (`@keyframes d-cores-efeito`, `@property --d-efeito-c1`, `@keyframes d-efeito-*`, `.d-led-edges`: todos 1; total de `<style>` no documento constante em 12). React remove o `<style>` do JSX junto com o componente; não há folha órfã. Fixado como teste de regressão mesmo assim: **`efeitos/__tests__/EfeitoCamada.remontagem.test.tsx`** monta e desmonta a camada (nos três modos de cor animados) e o `LedEdges` **10 vezes**, cobrando no máximo 1 bloco de cada `<style>` enquanto montado e **0** depois do último `unmount` — e cobrando antes que o modo escolhido REALMENTE injete CSS, senão o teste passaria contando zero sem provar nada. Verificado por mutação: com uma versão que injeta o bloco na `<head>` sem limpeza, o teste falha já na 2ª remontagem (`expected 2 to be 1`, depois 3, depois 4).
  - **`@property` invalidando o estilo da demo inteira**: as custom properties são declaradas `inherits: true` mas ANIMADAS no elemento da camada (`[data-d-efeito-camada]`), que é IRMÃO da skin — a subárvore afetada é só a do efeito. Medição que fecha a questão: `efeito=nenhum` com o LED em arco-íris (que anima `--d-led-c1` a 60 Hz num elemento de viewport inteira) fica em **59,4 fps**. Se a animação de uma property registrada invalidasse a demo inteira, esse seria o caso mais caro de todos. Por isso NÃO foi acrescentado `contain: paint layout` na camada: medido, ele não melhora nada aqui (10,5 contra 11,2 fps no `gradiente`; 51,7 contra 56 no `geometrico`) e a div da camada é deliberadamente sem `contain`/`position`/`opacity` porque qualquer um deles criaria stacking context e mudaria como o `mix-blend-mode` de aura/faíscas/varredura se compõe com a página (ver "Modos de cor").
  - **conflito entre as escritas por JS e o re-render do React** (a hipótese para o LED): marcadas as MESMAS propriedades que o `LedEdges`/`EfeitoCamada` escrevem (`--d-led-scroll`, `opacity`, `--d-efeito-fade`) mais a classe `.d-led-pulse`, e forçados **40 re-renders** da árvore inteira digitando no painel — **tudo sobreviveu**, valor por valor, e o nó do LED nem foi recriado. Não há conflito a resolver: o `style` que o React controla nesse nó não contém nenhuma dessas propriedades, e o diff de `style` do React só escreve chave cujo VALOR mudou (objeto novo a cada render com os mesmos valores não gera escrita nenhuma).
  - **LED piscando**: a série de opacidade do LED ao longo de 31 posições de scroll, com duas seções de animação desligada e digitando entre cada passo, é **idêntica byte a byte** entre o efeito lento (`gradiente`) e o rápido (`grao`): 1 → 0,97 → 0,30 → 0 (…) → 0,05 → 0,77 → 1, com a mesma rampa na volta e nenhum salto fora dela. As escritas por JS (`--d-led-scroll`, `opacity`) não são desfeitas por re-render do React — o `style` que o React controla nesse nó não contém nenhuma das duas, e o diff de `style` do React só escreve chave que mudou de valor. O que a pessoa via era a rampa acontecendo a 9 fps: com o quadro restaurado, a mesma rampa passa a ter ~7× mais passos intermediários.

### A aura no celular: o relato, as duas hipóteses e o que a medição achou (`scripts/qa-aura.mjs`)

**Relato**: no celular, o efeito `aura` trava e faz elementos da página ficarem brancos e voltarem ao normal; piora nos modos iridescente e arco-íris; o `ondas` está fluido.

O laço que responde a isso é `scripts/qa-aura.mjs` — irmão do `qa-visual.mjs`, mas focado em ATRIBUIR em vez de reprovar. Condição comum: viewport 390×844 com `deviceScaleFactor: 2`, CPU limitada em 4× via CDP, intensidade 3, LED desligado, skin `barbearia-editorial`, e a página **rolando de cima a baixo a 1800 px/s** durante toda a janela de medição (a aura no celular tem o alvo das esferas preso ao progresso de scroll — página parada nem exercita o caminho do relato). Mediana de 5 cargas independentes por célula.

**1. fps por modo de cor, rolando a página inteira** — e o primeiro resultado é um resultado NEGATIVO:

| alvo | fps (mediana) | pior quadro | quadros >50ms |
|---|---|---|---|
| `nenhum` (referência) | 60,0 | 17ms | 0 |
| `aura` · tema | 60,0 | 17ms | 0 |
| `aura` · fixa | 60,0 | 17ms | 0 |
| `aura` · transicao | 60,0 | 17ms | 0 |
| `aura` · iridescente | 59,6 | 33ms | 0 |
| `aura` · arco-iris | 59,6 | 33ms | 0 |

Nada trava aqui. Isso não desmente o relato — **desmente o instrumento**, e essa é a descoberta mais importante da rodada: `Emulation.setCPUThrottlingRate` limita a thread PRINCIPAL, e a rasterização acontece em outra (`--num-raster-threads=2` no renderer, mais o processo de GPU). Custo de PINTURA — justamente o que derruba um aparelho real — é invisível pro contador de `requestAnimationFrame`. O piso de 45 fps aprovou, cinco vezes seguidas, um efeito quebrado.

**2. A medição que enxerga**: `LayerTree.layerPainted` via CDP, somando a área de cada evento — quantos megapixels o navegador REPINTA por segundo durante a rolagem. É trabalho, não velocidade da máquina:

| estado | pinturas/s | Mpx/s repintados |
|---|---|---|
| `nenhum` (referência) | 100 | **11,2** |
| `aura` · tema | 101 | **10,5** |
| `aura` · iridescente | 220 | **83,6** |
| `aura` · arco-iris | 220 | **82,6** |

Oito vezes a superfície da referência, ~1,4 Mpx por quadro só de decoração — e exatamente nos dois modos que o relato aponta. Com a cor do tema a aura custa ZERO acima da página (10,5 contra 11,2). O `recalc` de estilo acompanha: 169ms no tema contra 557ms no arco-íris, dos 5616ms da janela.

**A causa**: cada esfera era uma `<div>` com `background: radial-gradient(...)` cujas paradas eram `color-mix(in srgb, var(--d-efeito-c1) X%, transparent)`. Nos modos animados essa custom property muda a 60 Hz, e cada mudança REGENERA a imagem de gradiente e repinta o elemento — que tem ~2× a viewport de lado, duas vezes. É o corolário da "Regra de superfície" que já tinha reprovado a `filotaxia` (93 spans com gradiente na cor animada), aqui com 2 superfícies gigantes no lugar de 93 pequenas.

**As duas hipóteses do relato, as duas testadas com medição:**

- **(b) "as esferas desfocadas voltaram a animar transformação junto com o desfoque" — DESCARTADA.** Estilo COMPUTADO lido no navegador real, nas duas esferas: `filter: none`, `backdrop-filter: none`, `will-change: transform`, `opacity: 0.58`, 810×810px (1,99× a viewport) e 743×743px (1,68×). O `transform` muda, sim — em 29 de 29 quadros consecutivos —, mas não há desfoque nenhum pra re-rasterizar junto. O defeito histórico não voltou.
- **(a) "o modo de mistura estoura em branco quando a cor passa por matizes de alta luminância" — NÃO CONFIRMADA como estouro, e o motivo é instrutivo.** O ciclo de cor foi congelado em 12 fases (WAAPI), nos dois presets, com captura por fase e contagem de pixels: **0,00% de pixels quase-brancos acima da referência em todas as 48 fases medidas**. Mais: no preset CLARO o efeito ABAIXA a luminância média da viewport (0,806 sem efeito → 0,650 com), o oposto de "soma luz". A explicação é que o `mix-blend-mode: screen` **nunca chegou a misturar com a página**: a raiz do efeito é `position: fixed; z-index: 40`, que é um stacking context, e stacking context ISOLA blending — as duas esferas faziam `screen` entre si e o grupo era composto normalmente por cima. (O comentário em `Aura.tsx` e a linha correspondente em "Cobertura de viewport" afirmavam o contrário; estavam errados.)
  - **O que a cor animada FAZ de dano visual, medido**: lava o contraste. No preset escuro, arco-íris, a luminância média da viewport sobe de 0,031 (sem efeito) pra 0,054 e o desvio da luminância — a medida de quanto a tela ainda tem claro e escuro pra distinguir — cai de 0,106 pra 0,088. O pico de luminância da cor chegava a **0,55** no arco-íris. É esse pico que o teto de luminância corta (ver "Modos de cor").
- **O momento em que os elementos ficam brancos NÃO foi capturado nesta máquina.** Foi procurado do jeito certo: `Page.startScreencast` entrega o quadro COMPOSTO (o `page.screenshot` força uma rasterização completa antes de capturar e por construção nunca mostraria tile em branco), 337 a 360 quadros por rolagem, nos dois presets, decodificados um a um — **0,000% de branco no pior quadro de todos os estados**. Registrado como o que é: um resultado negativo num ambiente que rasteriza fora da thread limitada, não uma refutação do relato. A leitura que os números sustentam é que o branco é o outro lado da mesma moeda dos 83 Mpx/s: área que o compositor precisa apresentar antes de a rasterização ter terminado aparece como tile ainda não pintado — e num tema claro, um tile não pintado é indistinguível de "o elemento ficou branco e voltou ao normal". A correção ataca a causa medida; o sintoma não medido só some junto.

**Depois da correção** (mesma condição, mesmo script): a repintura do modo arco-íris cai de 220 pinturas/s para 120,7 — e o excedente que sobra são os dois bitmaps de 256×256 sendo redesenhados a 10 Hz, não superfície de viewport. Na tabela do portão (rolando, cinco modos) isso aparece como **9,6 / 10,1 / 21,3 / 19,2 / 21,3 Mpx/s**: em `tema` e `fixa` a aura custa ZERO acima da página, e nos três modos animados soma ~+11 Mpx/s, contra os +72 de antes. O pico de luminância da cor cai de 0,55 para 0,438 (teto em 0,45).

**O visual aprovado foi preservado, e isso também é medição, não impressão:**

- **as duas esferas continuam lá, do mesmo tamanho**: estilo computado depois da correção — `810×810px` (1,99× a viewport) e `743×743px` (1,68×), os mesmos números de antes, agora com `filter: none`, `mix-blend-mode: normal` e `opacity: 1` (o alfa foi pra dentro da rampa);
- **continuam se deslocando pelos cantos ao longo do scroll**: o `transform` muda em **29 de 29 quadros consecutivos** rolando a página, exatamente como antes — `alvo.ts` (alvo preso ao progresso de scroll + deriva senoidal + lerp) não foi tocado em nenhuma linha;
- **e a imagem bate**: diferença média de **1,0 a 2,0/255** (máx 9) entre as folhas `_folha-efeito-aura-{antes,depois}.png`, nas 6 combinações de preset × intensidade. Para escala, a presença do próprio efeito contra "sem efeito" é da mesma ordem de grandeza — ou seja, a mudança é uma fração pequena do que o efeito já pinta.

### O portão de qualidade do registro (`--so=fps`) — efeito × modo de cor, rolando, no celular

`node scripts/qa-visual.mjs --so=fps` percorre a matriz INTEIRA — cada efeito × cada um dos 5 modos de cor — na pior condição que uma demo publicada consegue montar num aparelho modesto, e imprime as duas tabelas abaixo. **O veredito é o piso de 45 fps, e só ele. Célula que reprova desabilita AQUELE MODO DE COR para AQUELE efeito — o efeito inteiro não sai do registro.**

- **Condição**: viewport de celular 390×844 com `deviceScaleFactor: 2` (o efeito rasteriza no dobro dos pixels — o teto do `devicePixelRatioClamped`), **CPU limitada em 4×** via CDP (`Emulation.setCPUThrottlingRate`), intensidade **3**, LED desligado (pra o número ser do efeito) e a página **ROLANDO de cima a baixo a 1800 px/s** durante a janela de medição.
- **Por que rolando**: a versão anterior deste portão media a página PARADA, num modo de cor só, e aprovou a `aura` quebrada cinco vezes seguidas. Página parada não exercita o caminho que a pessoa usa — a `aura` tem o alvo das esferas preso ao progresso de scroll, e rolagem é quando o compositor tem mais o que fazer.
- **Método**: `requestAnimationFrame` contando quadros, 1,8s depois do carregamento (o efeito entra por `next/dynamic` sem SSR — medir antes disso mede o carregamento), até o fim da página ou 9s. **Mediana de 5 cargas independentes por célula**: uma varredura de uma tacada só dá leituras de 13 a 52 fps para o mesmo estado, e com a CPU limitada 3 cargas ainda deixavam passar outlier.
- **Saída**: `qa-shots/_fps-mobile.md` (as tabelas + o veredito), `qa-shots/fps-mobile-<efeito>.png` e `_folha-fps-mobile.png`.
- **`QA_FPS_EFEITOS=`, `QA_FPS_COR_MODO=` e `QA_FPS_CARGAS=`** restringem a rodada — é o "desligar uma coisa de cada vez" que ATRIBUI o custo quando uma célula reprova, e é como uma rodada interrompida se completa sem repetir a matriz toda.

**fps (mediana de 5 cargas), piso 45:**

| efeito | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` (referência) | 60,0 | 60,0 | 60,0 | 60,0 | 60,0 |
| `aura` | 60,0 | 60,0 | 59,8 | 59,6 | 60,0 |
| `grao` | 60,0 | 60,0 | 60,0 | 60,0 | 60,0 |
| `gradiente` | 60,0 | 60,0 | 58,6 | 60,0 | 60,0 |
| `particulas` | 60,0 | 60,0 | 59,8 | 60,0 | 60,0 |
| `filotaxia` | 59,8 | 59,6 | **40,8 ✗** | 47,9 | **40,5 ✗** |
| `ondas` | 59,8 | 59,8 | 59,8 | 59,8 | 60,0 |
| `faiscas` | 59,6 | 59,8 | 59,8 | 60,0 | 59,6 |
| `varredura-de-luz` | 59,6 | 59,8 | 59,8 | 58,9 | 59,6 |

**Superfície repintada (Mpx/s durante a rolagem, por `LayerTree.layerPainted`) — INFORMA, não reprova:**

| efeito | tema | fixa | transicao | iridescente | arco-iris |
|---|---|---|---|---|---|
| `nenhum` (referência) | 9,6 | 10,3 | 9,6 | 8,7 | 9,9 |
| `aura` | 9,6 | 10,1 | 21,3 | 19,2 | 21,3 |
| `grao` | 9,5 | 9,4 | 9,6 | 9,5 | 9,8 |
| `gradiente` | 10,0 | 9,5 | 41,2 | 17,0 | 45,0 |
| `particulas` | 9,6 | 9,7 | 8,9 | 9,1 | 9,5 |
| `filotaxia` | 9,5 | 9,6 | 8,4 | 8,3 | 8,5 |
| `ondas` | 19,9 | 19,3 | 19,6 | 19,6 | 19,9 |
| `faiscas` | **255,2 ⚠** | **257,4 ⚠** | **256,0 ⚠** | **255,9 ⚠** | **255,8 ⚠** |
| `varredura-de-luz` | 9,8 | 9,0 | 20,3 | 19,1 | 19,4 |

- **Por que a segunda tabela existe**: `Emulation.setCPUThrottlingRate` limita só a THREAD PRINCIPAL. A rasterização roda em outra thread, sem limite nenhum, então nesta máquina um efeito pode repintar 8× mais superfície e ainda marcar 60 fps — foi exatamente o que escondeu o defeito da `aura`. `LayerTree.layerPainted` mede o TRABALHO (megapixels repintados por segundo), que é independente de quão rápida é esta máquina. Referência: `nenhum`, a própria página. Limiar de marcação: **+40 Mpx/s** sobre ela. O `clip` desses eventos vem em px **CSS** (confirmado pelo inventário de camadas: 20 camadas somam 6,7 Mpx, e só a camada de rolagem principal já teria 17,1 Mpx se fosse px de dispositivo), então a viewport vale 0,329 Mpx e +40 Mpx/s é ~2 viewports repintadas por quadro a 60 Hz.
- **Ela MARCA (⚠), não reprova, e isso foi aprendido medindo**: `faiscas` repinta +246 Mpx/s em TODOS os cinco modos, **inclusive `tema`**. Não é propriedade de um modo de cor — é do efeito (o `mix-blend-mode: screen` dos pontos obriga o grupo inteiro a repintar), e é anterior a esta rodada. Um teto que reprovasse derrubaria as cinco células de uma vez, o que contradiz a própria regra do portão ("modo que reprova é desabilitado, não o efeito inteiro") usando um critério que ninguém escolheu. A coluna informa; a decisão é de quem lê.

**O achado que a coluna de superfície trouxe, e que o fps não vê: `faiscas`.**

Ele passa o portão em tudo — 59,6 a 60,0 fps nos cinco modos — e repinta **258,4 Mpx/s**, contra 9,6 da página sem efeito. Em Mpx por quadro: 4,31, ou ~13 viewports inteiras repintadas a cada quadro. Para escala, a `aura` QUEBRADA (a que gerou o relato de travamento e branqueamento no celular) media 83,6 Mpx/s — **`faiscas` repinta 3,1× o que ela repintava**, e faz isso em TODOS os cinco modos de cor, `tema` inclusive.

Atribuído com o mesmo método de sempre (`QA_AURA_EFEITO=faiscas node scripts/qa-aura.mjs --so=atribuicao`, uma coisa desligada de cada vez, mediana de 3 cargas rolando):

| variante | fps | Mpx/s repintados |
|---|---|---|
| como está | 60,0 | **258,4** |
| sem `mix-blend-mode` | 59,8 | **11,7** |
| cor congelada | 59,6 | 256,9 |
| sem blend + cor congelada | 58,6 | 11,7 |
| faíscas escondidas | 58,9 | 11,2 |

- **96% da repintura é o `mix-blend-mode: screen`**, e ele está na RAIZ do efeito — um `fixed inset-0`, viewport inteira —, não nos 16 spans. Um elemento blendado obriga o navegador a compor o grupo do fundo inteiro a cada quadro em que o conteúdo dele muda, e o conteúdo muda sempre (as faíscas caem por `@keyframes`).
- **Não tem nada a ver com modo de cor**: congelar a animação de cor não muda nada (256,9). E desligar só o blend recupera praticamente tudo — 11,7 contra os 11,2 de esconder o efeito inteiro.
- **O fps não enxerga isso nesta máquina** porque a CPU limitada não alcança a thread de rasterização. Num aparelho real a banda de rasterização é o gargalo, e é a mesma forma de defeito que a `aura` tinha, 3× maior: quadro perdido, ou tile apresentado antes de ter sido pintado.
- **Nada foi alterado**. `faiscas` continua no registro, com os cinco modos, exatamente como estava — o número está aqui para a decisão, que não é do laço.

**Veredito desta rodada — 2 células reprovadas, as duas da `filotaxia`:**

- **`filotaxia` × `transicao`: 40,8 fps** (cargas 38,1 / 39,0 / 40,8 / 41,1 / 43,4) e **`filotaxia` × `arco-iris`: 40,5 fps** (39,2 / 39,5 / 40,5 / 42,1 / 42,7). As cinco cargas de cada uma estão abaixo do piso: não é outlier. Os dois modos entraram em `EfeitoDefinition.modosDeCorReprovados` — a demo publicada com esse par continua válida e continua abrindo no editor, só deixa de animar a cor (cai em `tema`).
- **A causa NÃO é superfície repintada** — a `filotaxia` repinta 8,4 Mpx/s, na referência da página. É recálculo de estilo na thread principal: 93 spans com `radial-gradient` cuja cor muda a 60 Hz, um a um, e é a thread que a CPU limitada de fato limita. Atribuído pela própria tabela: o mesmo efeito faz 59,8 fps em `tema` e 59,6 em `fixa`, onde a cor não anima.
- **`filotaxia` × `iridescente` passou raspando: 47,9 fps**, com 2 das 5 cargas abaixo do piso (44,9 e 45,4). Pela regra escrita — a mediana é o número — ela passa, e fica. É a primeira a cair se a próxima rodada medir pior.
- **`gradiente` é o segundo mais caro em superfície** (41,2 e 45,0 Mpx/s nos dois modos com cor animada, ~+35 sobre a referência): abaixo do limiar de marcação, mas é o mesmo mecanismo da `aura` antiga em escala menor (duas manchas de `radial-gradient` na cor animada, 225% da viewport). Não reprova em nenhum modo e não foi tocado.
- **A dispersão importa tanto quanto a mediana**: `varredura-de-luz` teve pior quadro de 100ms em `fixa` e `arco-iris` sem sair dos 59 fps de mediana — quadro longo isolado, que a mediana não mostra e o relato de "trava" sente. O laço imprime o pior quadro de cada célula junto do fps por isso.

### A barra do navegador, medida (`--so=barra`)

A cor da barra NÃO aparece numa captura de tela: quem a pinta é o cromo do
navegador, fora da página. O item do laço é por isso uma MEDIÇÃO, e a
imagem que se olha (`qa-shots/_folha-barra.png`) é montada a partir dela —
a rampa de cor por posição de scroll, desenhada como faixa, uma linha por
skin. As 8 skins, viewport de celular (390×844), sem efeito e sem LED.

Três perguntas, uma por requisito, e as três **cegas à implementação**:

1. **A barra assume mesmo a cor da seção?** Com cada seção centralizada,
   a cor da meta é comparada com o PIXEL que a página pinta ali, amostrado
   do PNG nas duas bordas laterais.
2. **A troca é rampa, não degrau?** Rolando a página em passos de 40px, o
   maior salto entre dois passos tem que caber num teto derivado da
   inclinação de pico do núcleo (`2·passo/banda` ≈ 0,19 da amplitude, com
   folga: 0,30) — uma troca seca daria 1,0.
3. **Degrada sem quebrar?** A cor inicial é lida do HTML SERVIDO por
   `fetch` cru, sem navegador e sem JavaScript; e os modos fixos são
   conferidos como fixos de verdade, imóveis do topo ao fim.

**A evidência mais forte veio de graça**: a multimarcas é a única skin que
já tinha um mapa `seção → cor` escrito à mão (o `data-themec`, removido
nesta feature). A leitura automática reproduz as três cores dele com
**erro 0 em todas as sete seções**, inclusive a `avaliacao`, que usa o
DESTAQUE como fundo. É o teste de mutação que ninguém precisou escrever.

**Quatro defeitos, e a divisão entre eles é o ponto** — dois eram do
produto, dois eram do próprio laço, e os quatro só apareceram porque a
medição compara duas fontes independentes:

1. **(produto) Percentagem frouxa deixava decoração virar fundo.** A regra
   original — "≥90% da largura, ≥50% da altura" — reprovou duas vezes na
   skin de petshop: um painel arredondado de 358px numa seção de 390
   (91,8%) punha o LARANJA do destaque na barra de uma seção creme
   (erro 190 contra o pixel), e um círculo decorativo de 560×560
   transbordando o hero (144% da largura) punha o lilás do `--d-bg-alt`
   (erro 21). Virou condição geométrica: largura igual à da seção, com
   piso E teto.
2. **(produto) Uma cor por seção é grosso demais.** O rodapé da
   imobiliária é um `<footer>` creme de 1510px com um bloco verde-escuro
   de 901px dentro — mais alto que a tela do celular. A barra ficava creme
   atravessando o verde inteiro: **erro 203**, o maior da rodada. A
   unidade passou a ser a FAIXA, com as de dentro recobrindo as de fora.
3. **(laço) Duas skins declaram `html { scroll-behavior: smooth }`.** Com
   isso `window.scrollTo` vira animação: pedir 9000 e ler dois quadros
   depois devolvia `scrollY: 89`. As duas — imobiliaria e multimarcas —
   apareceram no primeiro relatório com "1 cor distinta na página
   inteira", que lido de fora é exatamente o sintoma de "a barra não
   acompanha nada". Não era: a página é que não tinha rolado. O laço
   passou a desligar o scroll suave por estilo inline e a CONFIRMAR que
   chegou onde pediu.
4. **(laço) A câmera fotografava a entrada de seção a meio fade.** O
   `SectionReveal` dispara no instante em que o salto de scroll põe a
   seção na tela; dois quadros depois o pixel ainda está misturado com o
   plano da página, e a comparação acusava erros de 15 a 27 que não
   existiam. A barra não depende disso (ela lê a cor computada, que
   opacidade de ancestral não muda) — quem precisava esperar era a
   captura.

Duas ressalvas de método, deliberadas: seções **mais baixas que a
viewport** saem do veredito (ali a barra mistura as vizinhas de propósito
— cobrar delas uma cor só seria cobrar o contrário do requisito), e
quando as duas bordas laterais **não concordam** entre si o ponto é
declarado não conclusivo em vez de virar falso positivo (é o caso da
fileira de fotos do portfólio da tatuagem, que encosta na margem).

Relatório e o levantamento por navegador: `docs/temas/barra-demo.md`.

### Deslocamento de layout (CLS), medido (`scripts/qa-cls.mjs`) e o portão (`--sem-portao` desliga)

**Relato**: elementos que entram depois do primeiro desenho empurravam e
comprimiam conteúdo já visível, mudando o enquadramento da tela — na
plataforma, na demo pública e no preview do editor. Como "empurrou" não se
julga por captura isolada (a tela FINAL pode estar perfeita e o caminho até
ela ter empurrado tudo três vezes), a medição usa a mesma API que o
navegador usa pro Core Web Vital real: `PerformanceObserver` do tipo
`layout-shift`, instalado ANTES de qualquer script da página rodar
(`page.addInitScript` — cobre a página e os iframes que ela cria, o que é
o que faz o preview do editor, que é um iframe, ser medido sem nada
especial). Viewport de celular (390×844, dpr 2), rolando a página inteira
(lazy-load/scroll-mount também podem empurrar) e voltando ao topo.

Três telas — os três lugares do relato: as 8 skins (via harness
`/interno/demo-qa`, mesma árvore que a rota pública renderiza), o preview
do editor (o iframe de `/demo-preview`, não o painel) e as 7 abas do
Radar. **Portão: reprova (lança, código ≠ 0) qualquer tela acima de 0.1** —
o mesmo piso "bom" do Core Web Vital real.

**Antes** (`qa-shots/_cls-antes.md`) **→ depois** (`qa-shots/_cls-depois.md`):

| tela | antes | depois |
|---|---|---|
| skin:barbearia-editorial | 0,0018 | 0,0018 |
| skin:barbearia2-sul … multimarcas-vortice (6 skins) | 0,0000 | 0,0000 |
| skin:petshop-focinho-feliz | 0,0007 | 0,0007 |
| editor:preview | 0,0019 | 0,0020 |
| app:hoje / painel / leads / buscas / demos / chat | **0,0504** cada | 0,0000 |
| app:config | **0,4104 ✗** | 0,0000 |

**As 8 skins e o preview do editor já nasciam limpos** — os suspeitos
"fontes trocando depois do carregamento" e "camadas de efeito/LED montando
depois" foram verificados e não são a causa: as fontes core resolvem
`await` no SERVIDOR (`resolveExtraFontClassNames` em
`/demo/[leadId]/page.tsx`) e chegam no HTML já prontas; efeito e LED são
`position: fixed`, fora do fluxo do documento, então montar depois nunca
empurra o resto da página (confirmado pela própria medição: 0.0000 nas 6
skins sem imagem "foto" que colapsava antes do gate `--so=colapso`
existir). O único resíduo real (0,0007-0,0018) são pontos do typewriter do
título — muito abaixo do piso.

**Os dois causadores de verdade, achados pela medição, não por palpite:**

1. **`MetaFaixa` sem espaço reservado — a causa mais ampla, presente em
   TODA aba autenticada.** `<MetaFaixa>` nasce retornando `null` (0px) e só
   depois que `GET /api/metas/proprio` responde é que decide se mostra a
   faixa — pra quem tem meta configurada, isso insere um bloco de ~44-52px
   ACIMA do cabeçalho, empurrando cabeçalho E conteúdo pra baixo em toda
   navegação (`header.cromo-linha.cromo-linha-baixo` +
   `main.mx-auto.w-full` como fontes do MESMO deslocamento, medido
   IDÊNTICO — 0,0504 — nas 7 abas). **Corrigido resolvendo o progresso da
   meta no SERVIDOR**, dentro do próprio `AppLayout` (que passa a ser
   `async`, lendo a sessão do cookie com os mesmos `usuarioDaRequest`/
   `getProgressoMetaUsuario` que a rota usa) e passando o resultado como
   prop `inicial` pro componente — mesma ideia do `data-theme` do tema
   (resolvido no servidor pra não ter flash). `MetaFaixa` continua
   refazendo o fetch a cada troca de rota (o progresso muda navegando);
   só o PRIMEIRO desenho deixou de arriscar.
2. **`/config`, conteúdo carregado no cliente sem espaço reservado —
   dentro da própria página, em cascata.** Três defeitos empilhados: (a) a
   página inteira ficava atrás de `if (loading) return <p>Carregando…</p>`
   até o `GET /api/config` responder, trocando um parágrafo de uma linha
   pelo formulário inteiro; (b) `UsuariosSection`/`CotasUsuariosSection`/
   `MetasUsuariosSection` (cada uma com o PRÓPRIO fetch) renderiam a
   moldura da seção já vazia — sem convidados, sem linhas — e a lista
   crescia quando os dados chegavam; (c) o bloco do teto global de cotas
   só montava quando `usoGlobal` chegava. **Corrigido**: `form` já nasce
   com `DEFAULT_CONFIG` (mesmo shape do config real), então o formulário
   pinta desde o primeiro desenho e a carga real só troca VALORES de campo
   controlado, nunca a estrutura (`loading` passou a só desabilitar o
   botão Salvar, evitando salvar um default por cima do real antes da
   carga chegar); as três seções e o bloco de cotas globais ganharam
   skeletons (`src/components/Skeleton.tsx`) do MESMO tamanho aproximado
   do conteúdo final, no lugar do "Carregando…"/lista vazia.

**A mesma regra foi aplicada preventivamente** aos pontos com o idêntico
padrão "lista nasce vazia, cresce quando os dados chegam" nas demais abas
— `Painel` (skeleton no formato número+meters+grade de stats), `Leads`,
`Buscas`, `Demos`, `Mensagens` (lista de conversas) e a ficha de lead
(`LeadDetailClient`) — mesmo sem cruzar o piso de 0.1 nesta medição (a
carga local contra o fake-db é rápida demais pra sempre disparar o
deslocamento; a estrutura do bug é a mesma que reprovou `/config`, e a
regra ("todo elemento que entra depois do primeiro desenho ocupa espaço
reservado desde o início") vale para todos os casos, não só o que a
medição pegou desta vez).

**O editor também ganhou a correção, por inspeção do código-fonte, não só
pela medição** (o cenário — abrir o editor com uma demo que já usa uma
fonte NÃO-core salva — não estava no seed de teste, mas o defeito é real):
`demo-preview/page.tsx` resolvia a fonte extra num `useEffect` client-side
e trocava `extraFontClassName` de `""` pro valor final assim que o
`import()` dinâmico da fonte escolhida resolvia — reflow de texto se essa
fonte não for uma das core. Corrigido: o preview só sai do estado
"Carregando prévia…" depois que a resolução da fonte termina pela PRIMEIRA
vez; trocas de fonte já em edição (o usuário mexendo na aba Tema) não
passam pelo gate de novo — o preview seria mais irritante piscando em
branco a cada escolha do que o reflow pontual que já existia.

**A ficha do lead entrou nas telas medidas junto com a barra do dia**, e em DOIS estados do mesmo lead: sem horário de funcionamento (a barra cai no intervalo comercial estimado) e com ele (expediente real). Além do CLS de cada carga, o laço mede a ALTURA do bloco que reserva a barra nos dois estados e **reprova se ela mudar** — é essa igualdade que garante que o horário chegando DEPOIS do primeiro desenho (botão "buscar horários") troque só o conteúdo. Medido: bloco de **100px nos dois estados**; `app:ficha` 0,0241 e `app:ficha-horarios` 0,0153, ambos abaixo do piso de 0.1. Com o bloco da barra REMOVIDO à mão, as mesmas telas deram 0,0420 e 0,0167 — ou seja, o resíduo é a própria ficha montando (o `textarea` da mensagem), não a barra, que não acrescenta deslocamento nenhum. O portão também foi verificado ao contrário: sem a barra, ele falha com "a barra do dia não foi encontrada na ficha", em vez de passar contando zero.

**Uso**: `node scripts/qa-cls.mjs` (as três telas, portão ligado) ·
`--so=skins|editor|app` · `--sem-portao` (só mede) · `--marca=<rotulo>`.
`--so=editor`/`--so=app` (e a rodada default) exigem o mesmo patch
TEMPORÁRIO de banco falso dos outros laços que tocam o app autenticado
(`qa-plataforma.mjs`/`qa-editor.mjs` — ver cabeçalho do script), aplicado
e revertido na mesma sessão; `--so=skins` roda sem banco, como
`qa-visual.mjs`.

## Variáveis de ambiente

```
GOOGLE_PLACES_API_KEY=    # NUNCA exposta ao cliente; usada só em route handlers
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=     # com \n literais; admin.ts converte
FIREBASE_STORAGE_BUCKET=  # bucket das imagens de demo (ex.: <projeto>.appspot.com)
APP_PASSWORD=             # segredo de assinatura das sessões + senha INICIAL do admin; sem ela tudo responde 503
GEMINI_API_KEY=           # OPCIONAL: sugestões de IA da Forja; ausente = IA oculta/desabilitada com aviso, nada quebra
CRON_SECRET=              # segredo do cron diário (/api/cron); o Vercel Cron envia "Bearer ${CRON_SECRET}"; sem ela a rota responde 503
```

Ver `.env.example`. Na Vercel, cadastrar todas em Project Settings → Environment Variables (a do Gemini só se quiser IA).

## Decisões tomadas

- **Proteção de acesso**: multiusuário simples sobre `/usuarios` (papéis admin/membro, PBKDF2) + cookie de sessão ASSINADO com `APP_PASSWORD` (ver seção acima). Sem Firebase Auth — a escala é um punhado de usuários de confiança e a autorização se resume a "admin vs membro".
- **Paginação do Text Search**: só a 1ª página (até 20 resultados). `nextPageToken` nem é lido.
- **Demo avulsa em coleção própria, não flag em `/leads`**: uma demo sem lead não é prospect e não pode entrar em contagem nenhuma do funil (metas, penetração, `/hoje`, `/leads`). Em `/demosAvulsas` isso vale por construção — nenhuma query de lead a alcança, hoje ou depois de qualquer refatoração; como flag, valeria só enquanto todo mundo lembrasse do filtro. O custo aceito é o adaptador `ClienteDemo` no editor e o alvo prefixado nas capturas (ver "Demos avulsas").
- **Re-enriquecimento**: não existe. Lead enriquecido retorna do cache sempre; um novo Place Details para o mesmo lead nunca é disparado.
- **Cotas por usuário vs. teto global**: o teto global (`/config/app.caps`) deixou de ser um limite absoluto de conta — desde as cotas individuais, ele é "vale pra todo mundo, menos admin". A trava absoluta de fatura passa a ser só a cota configurada no console do Google. Decisão deliberada (não um efeito colateral): ver "Cotas individuais por usuário".
