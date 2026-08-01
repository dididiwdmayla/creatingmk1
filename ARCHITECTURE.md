# Radar — Arquitetura

Web app pessoal de prospecção de leads locais para web designer freelancer. Multiusuário SIMPLES: um punhado de usuários (`/usuarios`, papel admin/membro) sobre a mesma base compartilhada — sem Firebase Auth, sem isolamento de dados por usuário; o que é "por usuário" é atribuição (quem buscou/enriqueceu/criou demo/contactou e o uso de cota de cada um), não partição.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Firebase Firestore · Vercel · Google Places API (New).

## Princípios inegociáveis

1. **A chave da Google Places API vive só em variável de ambiente** (`GOOGLE_PLACES_API_KEY`) e é usada exclusivamente em route handlers server-side. Nenhuma chamada ao Google parte do cliente.
2. **Todo acesso ao Firestore é server-side** via `firebase-admin` dentro de route handlers. O cliente nunca fala com o Firestore diretamente — as security rules negam tudo (`allow read, write: if false`). Como o app é um time minúsculo sobre uma base compartilhada, isso elimina a necessidade de rules complexas e mantém um único ponto de entrada auditável para dados e custos.
3. **Todo request ao Google passa antes pelo módulo de custos** (`src/lib/costs`). Sem reserva de cota, sem request. O módulo é a única porta de saída para a API paga.
4. **Enriquecimento é sob demanda, nunca em lote.** Place Details só é chamado quando o usuário abre a ficha de um lead e pede o enriquecimento.

## Estrutura de pastas

```
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
      [leadId]/page.tsx             # ✅ demo PÚBLICA do lead (única rota sem senha; só Firestore; 404 sem demo salva)
    demo-preview/page.tsx           # ✅ preview do editor (iframe; estado via postMessage; protegida por senha)
    interno/
      efeitos/page.tsx              # ✅ harness de teste dos efeitos registrados: fundo claro/escuro, slider de intensidade — fora do (app) e do registro de skins, protegida por sessão (default do proxy.ts)
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
      page.tsx                      # ✅ Dashboard: uso vs teto, custo projetado, métricas, widget do cron, card "Demos criadas"
      hoje/page.tsx                 # ✅ fila do dia (home pós-login): novos por score, follow-ups, demos paradas
      leads/page.tsx                # ✅ lista de leads com filtros + nova busca (com auto-enriquecimento)
      leads/[id]/page.tsx           # ✅ wrapper server (extrai params.id, key={id})
      leads/[id]/LeadDetailClient.tsx # ✅ ficha: enriquecer, WhatsApp, transições de status
      buscas/page.tsx               # ✅ buscas salvas → clique filtra os leads da busca
      demos/page.tsx                # ✅ todas as demos ativas: skin, datas, link copiável, editar/excluir
      mensagens/page.tsx            # ✅ chat privado entre usuários: conversas, envio, polling leve
      config/page.tsx               # ✅ config completa + gestão de usuários (página restrita a admin)
    api/
      login/route.ts                # ✅ POST { nome, senha } → cookie de sessão assinado (+ seed de /usuarios)
      logout/route.ts               # ✅ POST limpa o cookie de sessão
      me/route.ts                   # ✅ GET usuário logado (id, nome, papel) — a UI escopa por papel
      usuarios/route.ts             # ✅ GET lista / POST cria usuário (admin)
      usuarios/[id]/route.ts        # ✅ PATCH nome/papel/ativo/senha/limites (admin; sem DELETE — desativa)
      usuarios/[id]/zerar-dia/route.ts # ✅ POST zera o contador do dia corrente do usuário (admin)
      usuarios/cotas/route.ts       # ✅ GET uso × limite de todos os usuários (admin, tabela do painel)
      cotas/route.ts                # ✅ GET uso × limite do PRÓPRIO usuário (indicador em /leads e na ficha)
      config/route.ts               # ✅ GET config (qualquer sessão) / PUT (admin)
      search/route.ts               # ✅ POST busca (geocode + Text Search paginado/qualificado) + registra em /buscas — exige sessão (cota individual)
      geocode/route.ts              # ✅ GET região resolvida ("Buscando em: X"), cache em /geocache
      regioes/route.ts              # ✅ GET índice de mercado da região (geocodifica + gera via IA se ainda não tiver)
      regioes/regenerar/route.ts    # ✅ POST regenera o índice (admin; reaproveita cidade/país já salvos)
      regioes/ajustar/route.ts      # ✅ PATCH indiceAjustado (admin; number seta, null limpa)
      precificacao/slider/route.ts  # ✅ GET/PUT última posição do slider da calculadora (self-service, por usuário)
      buscas/route.ts               # ✅ GET buscas salvas
      buscas/[id]/route.ts          # ✅ PATCH cor / mensagem do grupo
      leads/route.ts                # ✅ GET lista de leads com filtros
      leads/[id]/route.ts           # ✅ GET ficha / PATCH status·notas·favorito·descartado
      leads/[id]/enrich/route.ts    # ✅ POST enriquecimento (Place Details Enterprise + Pro/horários JUNTO) — exige sessão (cota individual)
      leads/[id]/horarios/route.ts  # ✅ POST busca só o horário (SKU detailsProHours) — botão "buscar horários" — exige sessão
      leads/[id]/demo/route.ts      # ✅ PUT configuração da demo / DELETE exclui demo + imagens
      leads/[id]/demo/imagens/route.ts # ✅ POST upload de imagem de slot / DELETE volta ao placeholder
      leads/[id]/demo/videos/route.ts  # ✅ POST upload de vídeo-no-título / DELETE volta ao fallback (opt-in por skin)
      leads/[id]/demo/sugestao/route.ts # ✅ POST sugestão de IA da demo (Gemini; SKU aiGeneration)
      ia/route.ts                   # ✅ GET disponibilidade da IA (GEMINI_API_KEY configurada?)
      ia/nivel/route.ts             # ✅ GET/PUT último nível de intervenção da IA (self-service, por usuário)
      mensagens/route.ts            # ✅ GET resumo/conversa (escopado à sessão) / POST envia texto
      mensagens/nao-lidas/route.ts  # ✅ GET total de não-lidas (badge do menu, polling leve)
      hoje/route.ts                 # ✅ GET fila do dia (delta por usuário; carimba ultimaVisitaEm)
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
    idioma.ts                       # ✅ mapa país (pt-BR)→idioma BCP-47 + IDIOMAS_SUPORTADOS (ver "Idioma da IA na demo")
    usuarios/                       # ✅ multiusuário simples
      types.ts                      #    Usuario (papel admin|membro, ativo, senhaHash, versão de sessão)
      senha.ts                      #    hash PBKDF2 via Web Crypto (sem dependência nova)
      repo.ts                       #    CRUD + seed (migra APP_PASSWORD → admin) + guarda-corpo do último admin
      session.ts                    #    usuarioDaRequest (atribuição/escopo) + requireAdmin (403)
    api-client.ts                   # ✅ fetch tipado do cliente (ApiError, um método por rota)
    format.ts                       # ✅ formatBRL/USD/percent/int/dateTime (pt-BR)
    wa.ts                           # ✅ monta o link wa.me a partir de dados já persistidos ({nome}/{demo}/{penetracao})
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
      hoje.ts                       # ✅ montarFilaDoDia: seleção pura das 3 seções de /hoje
      penetracao.ts                 # ✅ calcularPenetracaoSite/argumentoPenetracao/argumentoForte (ver "Penetração de site")
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
        dynamicComponents.ts        #    getEfeitoComponenteDinamico(id): next/dynamic({ssr:false}) por efeito — nunca bloqueia o first paint
        aura/Aura.tsx                #    dois blobs radiais (blur assado, só translate3d anima); ponteiro no desktop, scroll+deriva no celular; mix-blend-mode
        grao/Grao.tsx                #    textura de ruído via canvas (dpr clamped), gerada uma vez — sem loop de JS
        gradiente/Gradiente.tsx     #    ✅ dois radiais derivando devagar (transform); migrado do antigo Theme.fundoEfeito "gradiente" por skin
        gradiente/estilo.ts         #    ✅ estilo puro (opacidade por intensidade, animationName/PlayState) — testável sem DOM
        particulas/Particulas.tsx   #    ✅ pontos subindo em loop; migrado do antigo Theme.fundoEfeito "particulas" por skin
        particulas/estilo.ts        #    ✅ contagem/opacidade por intensidade + estilo do ponto — testável sem DOM
        __tests__/registry.test.ts  #    contrato: campos obrigatórios, ids únicos, intensidade 0 não renderiza nada, intensidadePadrao por nicho
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
    PrecificacaoCard.tsx            # ✅ card "Precificação": slider + cálculo ao vivo + edição de índice (admin) — ver seção própria
    LeadCard.tsx                    # card da lista: estrela, notas inline, dots de cor, destaque sem site, badge "argumento forte"
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
          LedEdges.tsx               # ✅ bordas laterais com luz LED (Theme.led), reage a scroll/clique
      tatuagem/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        GothicLetters.tsx           # letras góticas gigantes atrás do conteúdo (chrome fixo)
        Wordmark.tsx                # assinatura tipográfica (gradiente + contorno multicor, CSS puro) + overlay de vídeo-no-título
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
          LedEdges.tsx               # ✅ bordas laterais com luz LED (Theme.led), reage a scroll/clique
          VideoNoTitulo.tsx          # ✅ vídeo/imagem mascarados pelas letras do wordmark (SVG mask + foreignObject)
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
          LedEdges.tsx               # ✅ bordas laterais com luz LED (Theme.led), reage a scroll/clique
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
          LedEdges.tsx               # ✅ bordas laterais com luz LED (Theme.led), reage a scroll/clique
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
          LedEdges.tsx               # ✅ bordas laterais com luz LED (Theme.led), reage a scroll/clique
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
          LedEdges.tsx               # ✅ bordas laterais com luz LED (Theme.led), reage a scroll/clique
      multimarcas/
        Skin.tsx                    # composição { data, theme }, sem hooks próprios
        secoes.ts                   # contrato SkinSecaoDef[]
        themes.ts                   # default + presets de tema
        exemplo.ts                  # DemoData de exemplo (base da ficha)
        interactive/                # ✅ subcomponentes "use client" (animações/interação)
          logic.ts                    # funções puras (parse de número formatado, wa.me, categorias) — testadas isoladamente
          SectionReveal.tsx          # entrada de seção por scroll, intensidade = theme.animacao
          LedEdges.tsx               # ✅ bordas laterais com luz LED (Theme.led), reage a scroll/clique
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
          LedEdges.tsx               # ✅ bordas laterais com luz LED (Theme.led), reage a scroll/clique
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
  "ultimoPrecoBaseSlider": 2500,     // ✅ opcional: última posição do slider da calculadora de precificação (self-service)
  "ultimoNivelIA": "equilibrado",    // ✅ opcional: último nível de intervenção da IA na Forja (self-service, ver "IA na Forja")
  "criadoEm": "<ISO 8601>",
  "atualizadoEm": "<ISO 8601>"
}
```

- **Seed/migração da senha única**: na primeira tentativa de login com a coleção vazia, o app cria `admin` (senha = `APP_PASSWORD` atual — quem já usava continua entrando igual) + `membro-1`/`membro-2` **sem senha** (o admin define em /config antes de eles conseguirem logar). Depois do seed, o doc é a fonte da verdade: trocar a senha do admin em /config faz a `APP_PASSWORD` valer só como segredo de assinatura.
- **Sem DELETE**: desativar preserva a atribuição histórica (buscas/demos/contatos apontam para o id). Guarda-corpo: o último admin ativo não pode ser desativado nem rebaixado.
- Hash de senha: PBKDF2 (Web Crypto, 100k iterações, salt aleatório) — sem dependência nova, roda em Node e Edge.
- `limites`: cada campo é opcional e independente (ausente = sem limite naquela janela); editável só via `PATCH /api/usuarios/[id]` (admin) — nunca pelo próprio usuário, nenhum caminho client-side escreve nele. Não revoga sessão (não é credencial).

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
      "fundoEfeitoIntensidade": 2                // opcional (0-3); ausente = default do nicho recomendado do efeito
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
| `/api/usuarios/[id]` | PATCH | `{ nome?, papel?, ativo?, senha?, limites? }` (≥1 campo, admin) | `200 { usuario }` · `400` · `401` · `403` · `404` | — |
| `/api/usuarios/[id]/zerar-dia` | POST | — (admin) | `204` (zera o contador do dia corrente do usuário) · `401` · `403` · `404` | — |
| `/api/usuarios/cotas` | GET | — (admin) | `200 { usuarios: [{ id, nome, papel, ativo, limites, buscas, enriquecimentos }] }` · `401` · `403` | — |
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
| `/api/buscas` | GET | — | `200 { buscas[] }` (mais recentes primeiro) | — |
| `/api/buscas/[id]` | PATCH | `{ cor? (da paleta), mensagemPadrao? (≤1000, "" limpa), recorrente? }` (≥1 campo; ligar recorrente respeita o teto `maxBuscasRecorrentes`) | `200 { busca }` · `400` · `404` | — |
| `/api/hoje` | GET | — (exige sessão identificável) | `200 { novos[], followUps[], demosParadas[], novosDesde, followUpDias, mensagemPadrao, buscas[] }` · `401` | — |
| `/api/cron` | GET | header `Authorization: Bearer ${CRON_SECRET}` (fora da sessão — exceção no proxy) | `200 { execucao }` · `401` · `503 config_error` (sem CRON_SECRET) | mesmo pipeline de `/api/search`, por busca recorrente |
| `/api/cron/status` | GET | — | `200 { ultima, recorrentes }` | — |
| `/api/leads` | GET | query: `status`, `temSite`, `temTelefone`, `buscaId`, `favorito` | `200 { leads[] }` · `400` | — |
| `/api/leads/[id]` | GET | — | `200 { lead }` · `404` | — |
| `/api/leads/[id]` | PATCH | `{ status?, notas? (≤500), favorito?, descartado? }` (≥1 campo) | `200 { lead }` · `400` · `404` · `409 invalid_transition` | — |
| `/api/leads/[id]/enrich` | POST | — (exige sessão identificável) | `200 { lead }` · `401` · `404` · `429 quota_exceeded` · `429 user_quota_exceeded` · `502 places_error` | Place Details · **detailsEnterprise** + **detailsProHours** (horário, chamado junto — falha nele não derruba o enriquecimento; nunca conta pra cota individual) |
| `/api/leads/[id]/horarios` | POST | — (exige sessão identificável) | `200 { lead }` · `401` · `404` · `429 quota_exceeded` · `502 places_error` | Place Details · **detailsProHours** (só o horário — botão "buscar horários" de leads já enriquecidos; nunca conta pra cota individual) |
| `/api/leads/[id]/demo` | PUT | `{ skinId, themeId, dados?, tema? }` | `200 { lead }` · `400` · `404` | — |
| `/api/leads/[id]/demo` | DELETE | — | `200 { lead }` (idempotente; apaga demo + imagens do Storage) · `404` | — |
| `/api/leads/[id]/demo/imagens` | POST | multipart `slot` + `arquivo` (+`skinId?`) | `200 { slot, url }` · `400` (formato/tamanho/slot) · `404` | — |
| `/api/leads/[id]/demo/imagens` | DELETE | `{ slot }` | `200 { lead }` (apaga arquivos do slot + override salvo) · `400` · `404` | — |
| `/api/leads/[id]/demo/videos` | POST | multipart `slot` + `arquivo` (+`skinId?`) | `200 { slot, url }` · `400` (formato/tamanho/slot fora de `videoSlots`) · `404` | — |
| `/api/leads/[id]/demo/videos` | DELETE | `{ slot, skinId? }` | `200 { lead }` (apaga arquivos do slot + override salvo) · `400` · `404` | — |
| `/api/ia` | GET | — | `200 { disponivel, modelo }` (nunca expõe a chave) | — |
| `/api/ia/nivel` | GET | — (exige sessão) | `200 { nivel }` (default `"equilibrado"`) · `401` | — |
| `/api/ia/nivel` | PUT | `{ nivel }` (`toque-leve`\|`equilibrado`\|`completo`) | `200 { nivel }` · `400` · `401` | — |
| `/api/leads/[id]/demo/sugestao` | POST | `{ skinId, nivel? }` (`nivel` default `"equilibrado"`) | `200 { sugestao }` · `400` · `404` · `429 quota_exceeded` · `502 ai_error` · `503 ai_unavailable` | Gemini generateContent · **aiGeneration** (1 por tentativa; retry de resposta inválida = 2) |
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
- **Estado atual e "melhor momento pra contatar"** (`src/lib/leads/horarios.ts`, funções puras `estadoAtual`/`melhorMomento` sobre `lead.horarios` + um `now`): os períodos do Google vêm em hora LOCAL do lugar, então o cálculo desloca `now` por `utcOffsetMinutes` em vez de depender do fuso da máquina — sem `utcOffsetMinutes` ou sem `faixas`, as duas funções devolvem `null` (nada é mostrado). `estadoAtual` monta "Aberto agora · fecha Xh" / "Fechado · abre Xh" (ficha e `LeadCard`); `melhorMomento` sugere **agora** se aberto (destaque verde no botão WhatsApp da ficha) ou a **próxima abertura + 1h** se fechado, com prefixo "hoje"/"amanhã"/dia da semana conforme a distância ("amanhã ~10h") — exibido na ficha e ao lado de cada item da fila em `/hoje`. Faixas que cruzam a meia-noite (madrugada) são representadas com o dia de fechamento podendo ser o seguinte; a implementação testa fusos diferentes, madrugada e fechamento num dia específico (domingo).
- O botão WhatsApp é montado **no cliente** a partir de dados já persistidos (`wa.me/<telefoneIntl sem símbolos>?text=<mensagem com {nome} substituído>`) — não há rota nem chamada externa. O telefone da **busca qualificada** já sustenta o botão sem enriquecer. A mensagem usada é a **do grupo** (busca mais recente do lead que tiver `mensagemPadrao` própria) e, na falta, a global da config.
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

Além do teto global mensal (segurança contra a fatura, UTC), cada usuário pode ter limites PRÓPRIOS de **buscas** (cada página do Text Search conta) e **enriquecimentos** (só o clique em "Enriquecer" — Place Details do enriquecimento principal; o horário de funcionamento, avulso ou embutido no enrich, nunca conta contra essa cota), em três janelas independentes e opcionais: dia, semana (começa segunda) e mês. Campo ausente = sem limite naquela janela.

Decisões:
- **Admin nunca é bloqueado** — nem pelo teto global, nem pelo limite individual. A trava absoluta de fatura passa a ser só a cota configurada no console do Google; `caps`/limites individuais são "para todo mundo, menos quem loga como admin". O uso do admin continua incrementando os contadores (dashboard/projeção corretos).
- **Fuso de Brasília, nunca UTC** (`periodoUsuario.ts`): chaves de data via `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` (não offset fixo) — 23h59 em Brasília ainda é o dia corrente mesmo já sendo o dia seguinte em UTC. Reset por composição de chave com a data, **sem cron**: semana/mês são somas puras dos docs diários dentro da janela.
- **Contador por usuário/dia**: `usage_users/{userId}/dias` (coleção — 3 segmentos, nunca 2, ver nota de paridade acima) → doc `{YYYY-MM-DD}` → `{ buscas, enriquecimentos }`. Mapa aberto de propósito — um terceiro tipo (ex.: item 2 do roadmap, fotos/reviews) encaixa sem redesenho.
- **Atomicidade**: a checagem/incremento do limite individual (`checarCotaUsuario`) roda na MESMA transação Firestore do `reserveQuota` global — ou os dois passam, ou nenhum conta. Só busca os docs de semana/mês quando aquela janela tem limite configurado (evita até 31 leituras à toa).
- **Sessão obrigatória**: `/api/search`, `/api/leads/[id]/enrich` e `/api/leads/[id]/horarios` passam a exigir sessão identificável (401 sem ela) — diferente do resto do app, que é best-effort (ver "Proteção por sessão" abaixo). Sem saber quem é o usuário não dá pra aplicar o limite dele.
- **Cron**: a busca recorrente conta no usuário que a marcou como recorrente (`busca.userId`, resolvido por id, sem sessão HTTP). Dono sem cota individual pula **só aquela busca** (`pulada`, fila continua) — diferente do teto global, que interrompe a fila inteira (mesmo espírito de "erro do Google não trava as demais").
- `UserQuotaExceededError` (código `user_quota_exceeded`, HTTP 429) carrega `tipo`/`janela`/`used`/`limite`/`resetaEm` — distinto do `QuotaExceededError` do teto global.

Rotas novas:

| Rota | Método | Quem | Devolve |
|---|---|---|---|
| `/api/cotas` | GET | qualquer sessão | uso × limite (dia/semana/mês) do PRÓPRIO usuário, buscas + enriquecimentos |
| `/api/usuarios/cotas` | GET | admin | o mesmo, de todos os usuários (tabela do painel) |
| `/api/usuarios/[id]/zerar-dia` | POST | admin | `204`; zera o contador do dia corrente daquele usuário |
| `/api/usuarios/[id]` | PATCH | admin | ganhou o campo `limites` (number seta, `null` limpa uma janela) |

UI: `/config` ganhou a seção "Cotas por usuário" (resumo do teto global relevante + um cartão por usuário com edição inline dos limites e botão "Zerar dia"); `/leads` e a ficha do lead mostram `CotaIndicador` (componente compartilhado em `src/components/CotaIndicador.tsx`) — permanente, atualizado após cada busca/enriquecimento, com o botão desabilitado como cortesia quando a cota esgota (o bloqueio real é sempre do servidor).

## Forja de Demos (`src/lib/demos` + `src/components/demos`)

Prévia de site personalizada por lead, servida pelo próprio Radar em **`/demo/{leadId}`** — o link que vai na mensagem de prospecção (variável `{demo}`). Nenhum deploy por lead, nenhuma chamada ao Google: a página é um Server Component que lê **só o Firestore**. **A demo pública só existe depois de salva no editor**: lead sem campo `demo` (ou com skin removida do registro) responde 404 — nada é publicado sem intenção explícita, e "Excluir demo" devolve exatamente esse estado.

Contratos centrais (`src/lib/demos/types.ts`):

- **`DemoData`** — slots de conteúdo: nome, slogan, endereço, telefone, whatsapp, instagram, cidade, horários, `servicos[]` (nome/preço/descrição, + `categoria`/`destaques[]` opcionais — ex.: filtro e chips do catálogo de veículos da skin de multimarcas), `depoimentos[]` (autor/texto/nota, + `contexto` opcional — segunda linha curta sob o autor, ex.: "Toyota Hilux SRX 2021"), `secoes` (textos por seção, chaves definidas pela skin — cada `DemoSecao` tem `rotulo/titulo/texto/cta/ctaSecundaria/itens`, e cada `DemoItem` tem `titulo/subtitulo/detalhe/texto`, útil quando uma seção precisa de duas linhas de legenda com pesos visuais diferentes), `imagens` (caminho por slot), `videos` (opcional — URL por slot de **vídeo-no-título**, ver seção própria) e a **estrutura editável**: `ordemSecoes` (ordem das seções não-fixas) e, por seção, `oculta` e `alinhamento`.
- **`Theme`** — tokens visuais: `paleta` (fundo/alt/elevado, destaque + ink, texto/suave, borda, e dois acentos raros `acentoSecundario`/`acentoTerciario` para detalhes decorativos que não seguem o acento principal), `fontes` (display/corpo/mono/serif/decorativa/**citacao**/**destaque** como valores CSS prontos — vars `--font-demo-*` carregadas via `next/font` em `src/app/demo/fonts/`), `raio`, `densidade` (compacta/confortável/arejada → espaçamento vertical das seções), `animacao` (`nenhuma`/`sutil`/`marcante` → intensidade de entrada de seção, hover e transição; ver "Animação" abaixo), as **micro-interações**: `intro` (splash de abertura ligada?), `hover` (`lift`/`zoom`/`brilho`), `clique` (`nenhum`/`pressao`/`pulso`), `fundoEfeito` (`nenhum`/`gradiente`/`particulas`) e `led` (`desligado`/`sutil`/`marcante` — ver "Micro-interações" abaixo), e `heroTitulo` (`{ fonte, escala, alinhamento }` — estilo do título principal, ver "Título hero" abaixo; o **texto** continua em `dados.secoes.hero.titulo`/`dados.nome`, que é conteúdo, não tema).
- **`TemaPatch`** (`LeadDemo.tema`) — ajustes por cima do preset: `fonteDisplay`/`fonteCorpo` (ids da **lista curada** em `fontes.ts`, ~16 fontes via `next/font`, cada uma com os papéis onde funciona — só as fontes que são default de algum preset são carregadas sempre; as demais entram **sob demanda**, via `import()` dinâmico, só quando o editor escolhe uma delas — ver `src/app/demo/fonts/registry.ts`), `destaque` (cor primária hex; `destaqueInk` é **recalculado por contraste** em `tema.ts`), `raio` (um de `TEMA_RAIOS`), `densidade`, `animacao`, `intro`, `hover`, `clique`, `fundoEfeito` (id de um efeito do **registro de efeitos**, `src/lib/demos/efeitos/registry.ts`, ou `"nenhum"`), `fundoEfeitoIntensidade` (0-3; ausente = default do nicho recomendado do efeito, ver `intensidadePadrao`), `led` e `heroTitulo` (`{ fonte?, escala?, alinhamento? }`, todos opcionais). `aplicarTema(preset, patch, heroEscalaLimites?)` é puro e usado pela rota pública E pelo preview — o editor nunca mostra algo diferente do publicado; o 3º argumento (default de `tema.ts` se omitido) recorta `heroTitulo.escala` aos limites da skin. `aplicarTema` só resolve o **id** de `fundoEfeito` (contra o registro de efeitos); a intensidade efetiva é resolvida à parte por `resolverEfeitoFundo` (ver "Efeitos visuais" abaixo), que já recebe o patch bruto — não faz parte do `Theme` resolvido, já que depende do nicho da skin, não do preset.
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
- **`led`** (`desligado` default / `sutil` / `marcante`) — bordas laterais (esquerda/direita) com luz na cor de destaque do tema. CSS puro (opacity/box-shadow, sem transform de layout): a posição do ponto mais brilhante ao longo da barra acompanha o progresso do scroll via uma custom property (`--d-led-scroll`, 0–1) escrita **direto no DOM por um ref** dentro de um listener de scroll passivo throttled por `requestAnimationFrame` — nenhum estado React por frame, custo baixo em mobile por design. Clique em qualquer lugar da página dispara um pulso (`.d-led-pulse`, `filter: brightness()` reiniciado por toggle de classe). `desligado` nem monta o componente; `prefers-reduced-motion` mantém as barras estáticas (sem listener de scroll/click). Componente: `interactive/LedEdges.tsx` (idêntico nas duas skins).

### Vídeo-no-título (`DemoData.videos` + `SkinDefinition.videoSlots`)

Slot de conteúdo **opt-in por skin** (hoje só a tatuagem, slot `"titulo"`): vídeo rodando dentro das letras do wordmark, com o **texto como máscara** — fiel ao efeito do material bruto original (que usava um vídeo com máscara SVG; a conversão inicial da skin havia trocado isso por um efeito 100% CSS pra manter a Forja livre de assets binários — ver `Wordmark.tsx`). Ao contrário de `imagens`, **`videos` nunca tem placeholder**: a Forja não versiona vídeo de terceiros, e a ausência é o estado normal.

- **Técnica** (`interactive/VideoNoTitulo.tsx`, "use client", camada por CIMA do wordmark CSS que continua sendo a base sempre renderizada): um `<svg>` com `<mask>` contendo um `<text>` (herda `font-family`/tamanho do `.d-wordmark` por CSS normal, já que é inline no DOM — sem precisar casar métricas manualmente) recorta um `<foreignObject>` com o `<video>` (ou, no fallback, um `<image>` de SVG).
- **Três níveis de fallback, do mais rico ao mais seguro**: 1) vídeo mascarado, se houver `dados.videos.titulo`, a conexão não for lenta (`navigator.connection.saveData`/`effectiveType`, quando suportado) e `prefers-reduced-motion` não estiver ativo; 2) imagem mascarada (`dados.imagens.hero`) se o vídeo faltar, falhar (`onError`/`onStalled`) ou a conexão for lenta; 3) nada — a base CSS (gradiente + contorno multicor) do `Wordmark.tsx` continua visível por baixo. A decisão roda num `useEffect` deferido (`setTimeout(…, 0)`, mesmo padrão de `CustomCursor.tsx`) pra não chamar `setState` sincronamente no corpo do efeito.
- **Upload**: `POST /api/leads/[id]/demo/videos` (multipart `slot` + `arquivo` + `skinId?`), mp4/webm, **~15MB** de teto (bem maior que o de imagem — o editor avisa do peso e do fallback automático). Grava em `demos/{leadId}/video-{slot}-{ts}.{ext}` (prefixo `video-` nunca colide com uma imagem do mesmo nome de slot) via `src/lib/demos/videos.ts` (mesma interface `DemoStorage` de `imagens.ts`). `DELETE` aceita `skinId` opcional no corpo (cobre remover antes do primeiro save, quando `lead.demo` ainda não existe). "Excluir demo" já cobre a limpeza: apaga todo o prefixo `demos/{leadId}/`, vídeos inclusos.
- Sem compressão client-side (ao contrário de imagem): vídeo não é reencodado no browser: o teto e o aviso de peso são a defesa contra upload gigante.

### Título hero (aba Tema do editor)

O título principal (hero) ganha controles próprios, separados do resto da tipografia — persistidos em **`DemoData`** (texto) e **`Theme`/`TemaPatch`** (estilo):

- **Texto**: `dados.secoes.hero.titulo` onde a skin usa esse campo (barbearia, com fallback pro nome do negócio) ou `dados.nome` diretamente (tatuagem — o wordmark É o nome do negócio; não haveria um `secoes.hero.titulo` de exemplo aí, pra não arriscar mostrar copy de exemplo estático no lugar do nome real de um lead novo).
- **Fonte**: `tema.heroTitulo.fonte`, id da lista curada (papel `"display"`); ausente = acompanha `fonteDisplay`/`fontes.display` do preset (permite trocar SÓ o título hero sem afetar os outros títulos da skin).
- **Tamanho**: `tema.heroTitulo.escala` (slider, passo 0.05) multiplica o `clamp()` de tamanho da skin via `calc()`; recortado por `SkinDefinition.heroEscalaLimites` em `aplicarTema`.
- **Alinhamento**: `tema.heroTitulo.alinhamento` (esquerda/centro/direita) — `text-align` (tatuagem, bloco centralizado por padrão) ou `self-*`/`text-align` (barbearia, bloco à esquerda por padrão) no elemento do título, sem afetar o resto do hero.

### Editor visual (`/leads/{id}/demo/editar`)

A seção Demo da ficha virou só um resumo + atalho; a edição acontece nesta página em tela cheia (fora do route group `(app)`, sem o chrome do painel).

**Antes de criar** (lead sem `demo` salva), o botão "Criar demo" da ficha leva primeiro a **`/leads/{id}/demo/escolher`** — cards com miniatura (`SkinDefinition.thumbnail`) e nome do nicho de **todas** as skins do registro, em vez de assumir a primeira (`DEFAULT_SKIN`) como o editor fazia antes. Escolher um card navega para `/leads/{id}/demo/editar?skin={skinId}`; o editor lê essa query só na carga inicial e só quando o lead ainda não tem demo (`EscolherSkinClient`/`EditorClient`, via `useSearchParams`) — uma demo já salva ignora o parâmetro e mantém a skin dela (a troca continua disponível na aba Tema). Lead que já tem demo pula `/escolher` direto pro editor.

- **Preview ao vivo num iframe** apontando para `/demo-preview` (rota protegida por senha, como tudo). O editor manda o estado completo — `skinId` + `DemoData` efetivo + `Theme` já com `aplicarTema` + o `TemaPatch` bruto (`tema`, usado só para saber qual fonte curada buscar sob demanda) — por `postMessage` (mesma origem) a cada tecla; o iframe só renderiza a skin. Nada é lido do banco no preview, então o que se vê é exatamente o que o PUT publicará. Toggle desktop/celular muda a largura do iframe.
- **Edição por slot**: clique em qualquer elemento com `data-demo-slot` no preview → o iframe devolve o caminho por `postMessage` → o editor abre a aba/grupo certo e foca o campo (`campo-{slot}`). Links/CTAs não navegam dentro do preview (capture + preventDefault).
- **Painel em abas**: Conteúdo (negócio, serviços, depoimentos e cada seção do contrato da skin, com listas add/remove), Imagens (trocar/remover por slot de imagem + seção "Vídeo no título" quando a skin declara `videoSlots`, com aviso de peso/fallback), Tema (skin, presets, cor primária com amostra do ink calculado, fontes display/corpo da lista curada, raio, densidade, animação, toggle da Intro, hover, animação de clique, efeito de fundo, **LED** e o bloco **Título principal (hero)** — fonte/escala/alinhamento) e Estrutura (drag-and-drop via `Reorder` do `motion`, ocultar/exibir, alinhamento e **animação de entrada** onde a skin oferece).
- **Persistência explícita**: "Salvar" faz o PUT (diff mínimo + tema); "Excluir demo" pede confirmação inline, chama o DELETE e volta pra ficha. Aviso de alterações não salvas no header + `beforeunload`.
- **Mobile**: o painel vira um drawer inferior (72dvh) com botão flutuante "Editar"; as mesmas abas funcionam por toque. Na aba Estrutura, o `Reorder.Item` usa `dragListener={false}` + `dragControls` — o drag só inicia pelo handle dedicado (ícone ⠿, `touch-action: none`); o resto do item não tem listener de drag nenhum, então o toque rola a lista normalmente (scroll do painel) em vez de competir com o gesto de arrastar.

### Padrão para adicionar uma nova skin

1. Clone o material bruto em `skins-raw/<nicho>/` (fora do git/tsc/eslint — é só referência) e leia **todos** os componentes e estilos antes de converter, não só os principais — animações e interações (hover, scroll, cursor, máquina de escrever, intro) fazem parte do que precisa ser fielmente portado, não só o layout estático.
2. Crie o pacote `src/components/demos/<nicho>/`:
   - `Skin.tsx` — composição orientada por `{ data, theme }`, tokens só via CSS vars; delega interatividade a `interactive/*.tsx` (`"use client"`); renderiza as seções pela **ordem efetiva** (`secoesVisiveis` de `lib/demos/estrutura.ts`) e marca cada texto/imagem editável com `data-demo-slot`;
   - `secoes.ts` — o contrato `SkinSecaoDef[]` (ordem default, `fixa`, `alignOptions` onde o layout aguenta);
   - `themes.ts` — `themeDefault` fiel às cores do material bruto (inclusive acentos secundário/terciário se existirem) + 3–4 presets (contraste do `destaqueInk` é responsabilidade do preset);
   - `exemplo.ts` — `DemoData` completo com copy do material bruto e marca genérica.
3. Coloque os placeholders em `public/demos/<nicho>/` (locais, um por slot de `imagens`) e uma miniatura `thumb.svg` (usada no passo de escolha de skin).
4. Se a skin usa fonte nova, carregue-a em `src/app/demo/fonts/core.ts` (fontes que são default de algum preset — sempre carregadas) com var `--font-demo-*`, com o peso/estilo exatos do original (ex.: uma fonte carregada só em itálico 900 não é a mesma coisa que a mesma família em peso 400 normal). Fontes só alcançáveis por escolha explícita do editor entram como módulo próprio em `src/app/demo/fonts/dynamic/` + entrada no loader de `registry.ts` (carregadas sob demanda — ver "Fontes" acima).
5. Se o original usa uma lib de animação (ex.: `motion`), adicione a dependência e port fielmente o timing/easing em vez de recriar com CSS aproximado — o objetivo é a demo parecer idêntica ao original com os dados de exemplo, exceto o que é slot/tema por design. `interactive/LedEdges.tsx` pode ser copiado como está (nenhuma dependência do nicho); se o original tinha vídeo-no-texto/logo, considere declarar `videoSlots` (opt-in — ver "Vídeo-no-título" acima) e portar a técnica de `VideoNoTitulo.tsx`.
6. Acrescente a entrada em `src/lib/demos/registry.ts` (incluindo `heroEscalaLimites` e `thumbnail`, obrigatórios) — rota pública, ficha e editor passam a conhecê-la sem mais mudanças.
7. Rode os testes: o teste de contrato do registro (`registry.test.ts`) valida ids únicos, default entre os presets, exemplo completo, existência física dos placeholders e da miniatura, `heroEscalaLimites` coerentes, `heroTitulo`/`led` resolvidos em todo preset, `videos` ausente no exemplo (vídeo nunca tem placeholder) e o contrato de seções (ids únicos, presentes no exemplo, `alignOptions` válidos, ao menos uma seção reordenável).

### Efeitos visuais (`src/lib/demos/efeitos`) — camada decorativa opcional

Registro **separado** do registro de skins (mesmo padrão: metadado central + contrato + testes), pra uma camada decorativa opcional que uma skin pode somar por cima de si. Alimenta o seletor "Efeito de fundo" da aba Tema do editor (`Theme.fundoEfeito`/`TemaPatch.fundoEfeito`, ver "Micro-interações do tema" acima) e é renderizado como sibling da skin (não por dentro dela) tanto na rota pública quanto no preview.

- **Contrato do componente** (`types.ts`): `EfeitoProps { intensidade: 0|1|2|3, cores: ThemePaleta, pausado? }` — `0` desliga por completo (sem nada no DOM); `cores` é a paleta do tema vigente (nunca cor hardcoded); `pausado` é o sinal externo (ex.: o editor esconde o preview) somado às pausas automáticas do próprio efeito. Regras fixas pra todo efeito: renderiza **estático** (sem listener/rAF de movimento) em `prefers-reduced-motion`; pausa via `IntersectionObserver` fora da viewport e via `visibilitychange` com a aba oculta (`useEfeitoAtivo.ts` implementa as três fontes de pausa + a leitura de reduced-motion, reutilizado por todo efeito); `devicePixelRatioClamped` (`dpr.ts`) limita a 2 qualquer rasterização em canvas; a propriedade `filter` **nunca** é animada (blur/etc. é fixo no elemento — só `transform`/`opacity` mudam por frame).
- **`registry.ts`** guarda só metadado (`{ id, nome, nichosRecomendados }`) — **sem** o componente, pra quem só precisa listar efeitos (ex.: o seletor "Efeito de fundo" do editor) nunca puxar código de nenhum. `getEfeito(id)` resolve por id (ou `"nenhum"`/desconhecido → `undefined`); `intensidadePadrao(efeito, nicho)` devolve 2 se o nicho da skin está entre os recomendados do efeito, 1 caso contrário; `resolverEfeitoFundo(fundoEfeitoId, intensidadePersistida, nicho)` combina os dois (mais a intensidade persistida em `TemaPatch.fundoEfeitoIntensidade`) num resultado pronto pra render (`undefined` = nada a mostrar). O componente em si é resolvido por `getEfeitoComponenteDinamico(id)` (`dynamicComponents.ts`), sempre via `next/dynamic(() => import(...), { ssr: false })` — nunca bloqueia o first paint da demo nem entra no HTML pré-renderizado (confirmado em `next build`: `/interno/efeitos` gera estático sem nenhum efeito no HTML).
- **`aura/Aura.tsx`** — dois blobs de gradiente radial com blur assado (fixo, nunca animado) misturados por `mix-blend-mode`, movidos só por `transform: translate3d` com interpolação (lerp) em direção a um alvo: no desktop (`pointer: fine`) o alvo segue o ponteiro; no celular segue o progresso de scroll somado a uma deriva lenta autônoma (senoidal), pra não morrer parado.
- **`grao/Grao.tsx`** — textura de ruído: um tile é desenhado num `<canvas>` **uma única vez** (`devicePixelRatioClamped(2)` no tamanho), virado data URL e usado como `background-image` repetido — sem loop de JS nenhum a partir daí, opacidade baixa escalada pela intensidade.
- **`gradiente/Gradiente.tsx`** e **`particulas/Particulas.tsx`** — migrados do antigo `Theme.fundoEfeito` fixo por skin (cada skin tinha seu próprio `BackgroundEffect.tsx` em CSS puro, sem intensidade nem pausa automática): mesma técnica visual (dois radiais derivando devagar / pontos subindo em loop, posições determinísticas por índice), agora um componente único por efeito que só depende de `cores` e escala com `intensidade` (contagem/opacidade). Estilo separado em `estilo.ts` por pacote — puro, testável sem DOM (`__tests__/estilo.test.ts`), inclusive o fallback estático de `prefers-reduced-motion` (`animationName: "none"`, não só pausado).
- **Teste de contrato** (`__tests__/registry.test.ts`): ids únicos, campos obrigatórios (`nome`/`nichosRecomendados`) e — renderizando cada componente RAW direto via `react-dom/server` (fora do wrapper `next/dynamic`, que sempre devolve `null` no server) — intensidade `0` não renderiza nada, intensidade `1` renderiza o overlay; mais `intensidadePadrao`/`resolverEfeitoFundo` (inclusive o caso de compatibilidade: id antigo sem intensidade persistida cai no default do nicho, nunca em "nada").
- **Teste de compatibilidade** (`__tests__/compat.test.ts`): o preset "ouro-da-meia-noite" da barbearia sul tinha `fundoEfeito: "particulas"` hardcoded desde antes deste registro existir — roda o pipeline real (`aplicarTema` ← preset/patch, depois `resolverEfeitoFundo`) sem `TemaPatch`/intensidade nenhuma (o formato mais antigo possível) e confirma que ainda resolve pro mesmo efeito.
- **Harness de teste** (`/interno/efeitos`, fora do `(app)` e fora do passo de escolha de skin, protegida por sessão como o resto do app): cada efeito registrado sobre fundo claro e escuro, com slider de intensidade (0–3) e toggle do sinal `pausado`, pra avaliação visual no celular e no desktop.
- **Render na demo** (`src/app/demo/[leadId]/page.tsx` e `src/app/demo-preview/page.tsx`): `resolverEfeitoFundo` roda no `loadDemo`/postMessage (mesmo dado que resolve `theme`), e o componente dinâmico é renderizado como **sibling** de `<Skin>` (nunca por dentro dela) — `cores={theme.paleta}`. Import dinâmico sem SSR: não atrasa o first paint (a skin já está visível quando o chunk do efeito carrega) e não toca no `VisitaTracker` (componente separado, sem overlap de listeners/DOM).

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

1. **País do endereço do PRÓPRIO lead, não da região da busca**: `cidadeDoEndereco` (`src/lib/leads/cidade.ts`) extrai cidade E país do `Lead.endereco` (o último segmento do endereço formatado — Places API sempre chamada com `languageCode=pt-BR`). `src/lib/idioma.ts` centraliza o mapa país (pt-BR) → idioma BCP-47 (`idiomaDoPais`) — compartilhado com `lib/geo/geocode.ts` (idioma da REGIÃO geocodificada da busca, `lead.busca.idioma`, uma aproximação de mercado usada só como contexto de busca) para não duplicar a lista. `src/lib/demos/idioma.ts#idiomaPadraoDoLead` deriva o idioma-alvo do endereço do lead — mais específico que o da região. Sem país reconhecido (ou Brasil) → `IDIOMA_PADRAO` ("pt-BR").
2. **Seletor no editor, sobrescrita persistida**: a aba Tema tem um select "Idioma dos textos" (`IDIOMAS_SUPORTADOS`, curada a partir do mapa país→idioma) com o valor derivado do endereço como default (marcado "do endereço do lead" na opção); trocar e Salvar persiste em `LeadDemo.idioma` (ausente = segue o default derivado, não precisa persistir o caso comum) — mesmo padrão de patch mínimo do resto da demo.
3. **Passado ao Gemini em toda geração de conteúdo** (níveis equilibrado/completo): `gerarSugestaoDemo` resolve o idioma-alvo (override escolhido AGORA no seletor, ainda não salvo → `LeadDemo.idioma` persistido → derivado do endereço → `IDIOMA_PADRAO`) e instrui o prompt ("escreva os TEXTOS em {idioma}") + fixa o campo `idioma` do schema como enum de 1 valor (reforço). UMA chamada por geração, mesmo preview aplicar/descartar e degradação sem `GEMINI_API_KEY` de sempre.
4. **`resumirHorarios` localizado, sem IA** (`src/lib/leads/horarios.ts`): recebe o mesmo idioma-alvo e troca só a APRESENTAÇÃO — abreviação de dia (SEG-SEX → MO-FR) e formato de hora (9h/9h30 → 09:00, 24h) por raiz do BCP-47 (`pt`, `de`, `en`, `es`, `fr`, `it`, `nl` — idioma sem entrada cai no padrão pt-BR); os dados (horário de funcionamento em si) não mudam, só como aparecem escritos. `estadoAtual`/`melhorMomento` (UI interna do operador) continuam sempre pt-BR — não são conteúdo da demo pública.

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
- **Classificação** (`classificarVisitaInterna`, pura e testada): sessão válida OU cookie `radar_device` com o formato esperado — computada no carregamento SSR de `/demo/{leadId}` (`requestEhInterna`). **Reforço via beacon**: o `VisitaTracker` também lê o marcador do `localStorage` e manda como `deviceId` no `POST /api/demo-visita`; se válido, promove a visita já registrada pra `interna: true` (só PRA CIMA — nunca derruba uma visita que a sessão já classificou como interna) — cobre o caso do cookie não chegar no carregamento inicial (ex.: bloqueio de cookie de terceiros num navegador embutido) mas o localStorage sobreviver.
- **Token continua sendo o portão de entrada**: sem `?t=` reconhecido, nada é registrado — só o "Abrir demo" do EDITOR (preview durante a edição) usa a URL sem token de propósito, pra não virar ruído a cada refresh. Uma visita com token, sem sessão e sem marcador ainda é registrada — só fica `interna: false`. Ver "Token de envio por canal" logo abaixo: "Copiar link" (ficha e `/demos`) e o botão de WhatsApp EMITEM token, cada um do seu próprio canal.
- **Geolocalização por IP** (`x-vercel-ip-country`/`-country-region`/`-city`, só existem em produção na Vercel — ausentes em dev/self-host): logados no carregamento (`console.log("[radar] cabeçalhos de geolocalização da visita:", …)`) e gravados em `DemoVisita.geo` quando algum vem preenchido. **Puramente informativo** na timeline da ficha — nunca entra em `classificarVisitaInterna`. Não foi possível confirmar quais chegam de uma visita real de produção neste ambiente (sandbox sem tráfego real/deploy na Vercel); o log acima é o ponto de verificação — conferir os logs de produção após o próximo deploy.
- **IP/hash de IP nunca foi critério de classificação** — não existe (nem existiu) `ipHash`/`uaBot` neste código; a única geolocalização por IP é a de `x-vercel-ip-*` acima, sempre informativa. Se aparecer pedido pra "remover o hash de IP da classificação", é este parágrafo que confirma que não há nada a remover.

### Token de envio por canal (`src/lib/demos/envio.ts` + `EnvioDemo.canal`)

Cada demo mantém um token vigente **por canal** (`EnvioCanal`: `"link"` | `"whatsapp"`), não um único token global: "Copiar link" (ficha e `/demos`) usa o vigente do canal `"link"`; a variável `{demo}` da mensagem de WhatsApp usa o vigente do canal `"whatsapp"`. Cada canal consome (rotaciona) seu próprio token de forma independente — copiar o link não queima o token que já pode estar numa mensagem de WhatsApp montada pro mesmo lead, e vice-versa. `demoVisitas[].canal` grava de qual canal veio o token da visita. Self-heal (`garantirEnvioToken`, chamado no GET da ficha/`/hoje`/`/api/leads`) garante os dois canais; entradas antigas sem `canal` (de antes desta feature) contam como `"whatsapp"` na leitura (`canalDoEnvio`) — era o único canal que de fato usava token antes. O "Abrir demo" do EDITOR continua sem token (preview, ver acima); "Abrir demo" da ficha e de `/demos` também continuam sem token (mesmo raciocínio de preview interno, não é um envio pro lead).

## UI (implementada)

Client Components (`"use client"`) que buscam dados via `fetch` no próprio cliente (não Server Components lendo o Firestore direto) — decisão deliberada: cada ação do usuário (buscar, enriquecer, mudar status, salvar config) precisa do feedback de erro específico das rotas (429/502/400/404/409), então a mesma rota HTTP serve tanto a carga inicial quanto a mutação, com um único caminho de tratamento de erro (`src/lib/api-client.ts`, classe `ApiError`).

- **`/login`**: form de usuário + senha → `POST /api/login` → redireciona para `/hoje` (a fila do dia é a home pós-login). Qualquer página protegida sem sessão redireciona para cá (proxy).
- **`(app)/` (route group)**: layout com nav inferior fixa (Hoje/Painel/Leads/Buscas/Demos/Chat/Config) + botão Sair; a aba Chat carrega o badge de não-lidas (polling leve de `/api/mensagens/nao-lidas`); todas as páginas autenticadas vivem aqui.
  - **`/hoje` (Fila do dia)**: contadores no topo + as 3 seções de `GET /api/hoje` (novos por score com badge da busca de origem, follow-ups com "Xd sem resposta", demos paradas), cada item com WhatsApp/Ficha/Demo diretos e, quando `lead.horarios` existe, "melhor momento pra contatar" ao lado do item — ver "Operação diária".
  - **`/` (Dashboard)**: hero com custo projetado em R$, um `UsageMeter` por SKU (accent → warning → critical conforme se aproxima do teto, nunca só cor — sempre acompanhado da palavra "OK"/"Perto do teto"/"No limite"), um KPI row de prospecção com `/api/metrics`, o widget "Buscas recorrentes" (última execução do cron via `/api/cron/status`: quando rodou, quanto achou, interrupção/erros e quantas recorrentes estão ligadas) e o card "Demos criadas" (total de `metrics.demosCriadas`, linka para `/demos`). **Membro vê os números escopados a ele** (a API já escopa); **admin ganha a seção "Por usuário"** (requests por SKU, buscas, demos, contatos de cada um).
  - **`/leads`**: form de nova busca (`POST /api/search`, trata `quota_exceeded`/`user_quota_exceeded`/`places_error`/`aviso` parcial com mensagem específica; campos nicho/sub-nicho/região/nome, quantidade 1–40, checkbox "Só sem site" e auto-enriquecimento dos primeiros N ≤ 5), o indicador `CotaIndicador` de cota individual de buscas (permanente, atualizado após cada busca, botão desabilitado como cortesia ao esgotar) + filtros (status/site/telefone/favoritos) + lista com **agrupamento colapsável por busca** (toggle, header com dot da cor + nome + contagem; lead em várias buscas aparece em cada grupo; "Sem busca" agrupa o resto). Cada card (`LeadCard`) tem estrela de favorito e notas editáveis inline — sem abrir a ficha —, os dots de cor das buscas, destaque "sem site (lead quente)" e, quando `lead.horarios` existe, o estado atual ("Aberto agora · fecha 18h" / "Fechado · abre 9h", `estadoAtual` de `lib/leads/horarios.ts`). Aceita `?buscaId=` na URL (via `useSearchParams`, com Suspense) para mostrar só os leads de uma busca (aí a lista é plana), com chip de filtro e botão limpar.
  - **`/buscas`**: buscas salvas (dot de cor, nome, nicho/sub-nicho, região, data, totais); tocar no dot cicla a cor pela paleta e persiste (`PATCH /api/buscas/[id]`); clicar no card navega para `/leads?buscaId=…`; toggle "tornar recorrente"/"recorrente ✓" por card (mesmo PATCH — o 400 do teto de recorrentes aparece como erro na página) com badge "recorrente" no nome.
  - **`/demos`**: todas as demos ativas (leads com `demo` salva) — nome do lead, skin, data de criação/edição (`demo.criadoEm`/`atualizadoEm`), link público copiável e atalhos "Editar" (`/leads/{id}/demo/editar`) e "Excluir" (confirmação inline, mesmo `DELETE /api/leads/[id]/demo` do editor). Reaproveita `GET /api/leads` (sem filtros) e filtra client-side pelos leads com `demo` — mesma escala de "centenas de leads" do resto do app, sem rota nova.
  - **`/leads/[id]`**: ficha do lead; a página server é só um wrapper fino que extrai `params.id` e monta `<LeadDetailClient key={id} id={id} />` — o `key={id}` força remontar o client component ao trocar de lead, resetando o estado em vez de arrastar dado do lead anterior. A seção **Demo** é um resumo (skin, preset, atualizado em) com "Criar/Editar demo" apontando para o **editor visual** `/leads/{id}/demo/editar` (ver seção da Forja), além de abrir/copiar o link público. Sem demo salva, deixa claro que `/demo/{id}` responde 404. A mensagem do WhatsApp aceita `{demo}` além de `{nome}`. A seção **Detalhes** mostra o `CotaIndicador` de cota individual de enriquecimento (permanente — visível antes E depois de enriquecer, já que a cota é do usuário, não do lead), o estado atual ("Aberto agora · fecha 18h" / "Fechado · abre 9h") quando `lead.horarios` existe, com o botão discreto "buscar horários" (`POST /api/leads/[id]/horarios`) para leads enriquecidos antes desta feature; "melhor momento pra contatar" (`melhorMomento`) aparece junto do botão WhatsApp, com destaque verde quando o lead está aberto agora.
  - **`/mensagens`**: chat privado entre os usuários — lista de conversas e conversa aberta com envio de texto simples (ver seção "Mensagens entre usuários").
  - **`/config`** (restrita a admin — o proxy manda membro de volta ao painel): seção **Usuários** (criar, ativar/desativar, redefinir senha; membro sem senha definida aparece marcado) + seção **Cotas por usuário** (resumo do teto global relevante via `UsageMeter` + um cartão por usuário com uso × limite de dia/semana/mês, edição inline com efeito imediato — salva no blur, sem botão "Salvar" à parte — e botão "Zerar dia") + formulário completo (busca, filtros, mensagem padrão, **operação diária** — dias de follow-up e teto de buscas recorrentes —, tetos por SKU, preços/cota grátis/câmbio), mostra a lista de `problemas` de validação devolvida pela API.
- **Paleta**: sempre escura (sem alternância clara/escura — é um painel de operação pessoal), tema "radar/sonar": fundo em gradiente azul-profundo → quase-preto (`--background-2` → `--background`), surface com leve tingimento azul (`#121b24`), acento vibrante verde-radar (`--accent`, com `--accent-ink` preto para texto sobre ele — o verde não passa em contraste com texto branco). Tokens centralizados em `globals.css` como `@theme` do Tailwind v4. Validada com a skill de dataviz: status do lead é **ordinal** (posição no funil novo→fechado), não identidade — por isso um único hue em degraus de luminância (`--status-novo` … `--status-fechado`), não cores categóricas distintas, reforçado por forma (quadrado→pill) e marcador (○◐◑●); o meter de uso segue o contrato "accent → warning → critical" com a trilha em wash neutro. A paleta das 10 cores de busca (`BUSCA_CORES`) foi revalidada (mais saturada) contra a nova surface. Textos sobre `good`/`critical`/`warning` usam preto (não branco) — o contraste do branco falha nesses tons vibrantes.
- **Tipografia**: Space Grotesk (`font-display`, via `next/font/google`) para títulos e números grandes do dashboard; Inter (`font-sans`) para o corpo; JetBrains Mono (`font-mono`) para dados tabulares/valores.
- **Animações** (CSS puro, sem lib): fade-in sutil de página (`.page-transition`, disparado por `PageTransition.tsx` que troca a `key` pelo pathname), barra do `UsageMeter` cresce de 0 ao montar, pulso (`.pulse-warning`/`.pulse-critical`) no preenchimento do meter perto do teto/no limite, elevação no hover dos cards clicáveis (`.card-lift`), sweep de radar rotativo (`RadarSweep.tsx` + `.radar-sweep`) no carregamento do dashboard. Tudo respeita `prefers-reduced-motion`.
- **Favicon**: gerado via `app/icon.tsx` (`next/og`/`ImageResponse`) — círculos concêntricos + setor de varredura no verde-radar.
- **Padrão de fetch em `useEffect`**: o linter do React Compiler (`eslint-plugin-react-hooks` 7.x, via `eslint-config-next`) rejeita chamar, dentro de um efeito, qualquer função de escopo externo que (mesmo transitivamente) atualize estado — a regra é sobre o grafo de chamadas, não sobre ordem antes/depois de `await`. A cada tela, a busca é declarada **inline dentro do próprio `useEffect`** (ou via `.then/.catch/.finally` direto no corpo do efeito); quando a mesma busca precisa ser reaproveitada por um handler de evento (retry, refetch pós-mutação), extrai-se um fetcher **puro** (sem `setState`) chamado nos dois lugares.

## Verificação da UI

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
- **Re-enriquecimento**: não existe. Lead enriquecido retorna do cache sempre; um novo Place Details para o mesmo lead nunca é disparado.
- **Cotas por usuário vs. teto global**: o teto global (`/config/app.caps`) deixou de ser um limite absoluto de conta — desde as cotas individuais, ele é "vale pra todo mundo, menos admin". A trava absoluta de fatura passa a ser só a cota configurada no console do Google. Decisão deliberada (não um efeito colateral): ver "Cotas individuais por usuário".
