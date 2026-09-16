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
      config/fila/route.ts          # ✅ GET/PUT /config/fila (doc PRÓPRIO, não /config/app) — ADMIN nos dois, ver "Fila de envio"
      config/fila/respostas/route.ts    # ✅ GET as respostas pendentes do painel (ADMIN; sob /api/config/ de propósito — ver "O painel Respostas pendentes")
      config/fila/respostas/[id]/route.ts # ✅ PATCH { estado, texto? } — usar (guarda o texto EDITADO) ou descartar (ADMIN)
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
    wa.ts                           # ✅ aplicarMarcadores/linkWhatsApp/buildWhatsAppLink/digitosTelefone ({nome}/{demo}/{penetracao})
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
    fila/                           # ✅ fundação da fila de envio (celular MacroDroid) — ver "Fila de envio"
      auth.ts                       #    autenticarDispositivo: Bearer RADAR_DEVICE_KEY, comparação em tempo constante
      config.ts                     #    /config/fila (doc PRÓPRIO, não /config/app) — ativo/tetos/janela, defaults se ausente
      contadores.ts                 #    /filaContadores/{dia operacional} — total do dia, última hora deslizante, virada do dia operacional
      envios.ts                     #    /filaEnvios/{leadId} — reservarLead/confirmarClaim/liberarClaim (claim expira em 5min)
      estado.ts                     #    tipos + política SEM nada de servidor (a ficha e o painel são client)
      candidatos.ts                 #    /filaCandidatos/pool — a varredura cara, uma vez a cada 10min, + diagnóstico estrutural
      selecao.ts                    #    a DECISÃO pura: quem é o próximo, e o porquê quando não é ninguém
      confirmar.ts                  #    confirmarEnvio: claim + lead + rotação + contador numa transação só
      pendencias.ts                 #    a lista de print pendente do painel (varre filaEnvios, lê lead por id)
      respostasPainel.ts            #    as respostas pendentes do painel: lista (varre filaRespostas, lead por id) + usar/descartar
      painel.ts                     #    a VISÃO do painel: linhas com nome (lead por ID) + contador do dia
      print.ts                      #    printUrlDoLead: a imagem de celular que vai junto da mensagem
      mensagem.ts                   #    montarMensagemParaLead: resolverMensagem+aplicarMarcadores num route handler
      __tests__/
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

O lead fixo de teste da fila de envio (`leadDeTeste`) **nunca entra nesta conta**: `calcularPenetracaoGrupo` monta o conjunto a partir de `listLeads`, que já o exclui na origem — um lead inventado somado aqui mudaria um percentual que vai numa conversa de venda.

`src/lib/buscas/penetracao.ts` faz a parte com Firestore: **"neste nicho nesta cidade" é o grupo lógico de TODAS as buscas com o mesmo nicho+região** (normalizado: minúsculas, espaços colapsados), não só a busca corrente — `calcularPenetracaoGrupo` reúne os leads de todas elas. `recalcularPenetracao(db, buscaId)` recalcula e cacheia o agregado no campo `penetracao` do doc da busca (ver `/buscas/{id}`); é chamado **toda vez que a busca roda de novo** — em `POST /api/search` (logo após criar o doc) e no cron (`executarBusca`, logo após `registrarExecucao`). Cada busca doc reflete o agregado de quando ELA rodou por último — buscas irmãs (mesmo nicho+região) que não rodaram desde então ficam com o cache defasado até rodarem de novo; é uma leitura, não uma fonte de verdade em tempo real.

Onde aparece:
- **Grupo de busca** (`/leads?buscaId=`): card "Penetração de site" com `buscaAtual?.penetracao` — "Neste nicho nesta cidade: X% têm site próprio · Y% só rede social · Z% sem presença (base: N estabelecimentos)"; base pequena mostra só a contagem.
- **Ficha do lead sem site próprio** (`siteProprio === false`): `argumentoPenetracao(nicho, regiao, penetracao, nome)` monta a linha pronta ("X% dos estabelecimentos de {nicho} em {regiao} que mapeamos já têm site — a {nome} está entre os que ainda não têm.") com botão copiar; usa "estabelecimentos de {nicho}" (em vez de flexionar o nicho em gênero/plural) porque o texto do nicho é livre e imprevisível. `penetracaoParaLead(lead, buscas)` escolhe, entre as buscas em que o lead apareceu (mais recente primeiro), a primeira que já tem `penetracao` cacheada.
- **Variável `{penetracao}`** na mensagem padrão do WhatsApp (`src/lib/wa.ts`, `buildWhatsAppLink`): mesma linha de argumento, substituída só quando calculada (ausência não apaga a variável em silêncio) — mesmo padrão de `{nome}`/`{demo}`.
- **Badge "argumento forte"** (`argumentoForte(penetracao)`, `percentuais.comSiteProprio > 60`) em `/hoje` e no `LeadCard` da lista de leads — discreto, não bloqueia nada, só sinaliza que o argumento é forte.

O campo **`capturas`** do lead guarda a última geração de prints (estado, `execucaoId`, `pedidoEm`/`iniciadoEm`/`geradoEm`, `runUrl`, `erro` e as `imagens` com âncora/tela/URL/dimensões) — ver "Disparo pela plataforma" na Forja de Demos.

O campo **`leadDeTeste`** (booleano, ausente = false) marca o LEAD FIXO DE TESTE da fila de envio — ver "Disparo de teste da fila". Ele não é um negócio real, então fica fora de TODA listagem e de todo agregado: `listLeads` (e com ela /leads, /demos, /hoje, /mundo, a análise de grupo e a penetração por nicho+cidade), `getMetrics`/`getMetricsPorUsuario` e `construirPool` o excluem na ORIGEM. Um lead de teste somado à penetração envenenaria, em silêncio, um número usado como argumento de venda.

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

As duas varreduras pulam o lead marcado com `leadDeTeste` — inclusive em `demosCriadas`, que ele inflaria por já nascer com demo salva (ver "Disparo de teste da fila").

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

   **A regra vale para VARIANTE também, e é aí que ela deixa de ser óbvia.** O contrato de seções é da SKIN, não da variante: as variantes de uma skin compartilham os mesmos ids, os mesmos nomes de `data-d-secao` e o mesmo conjunto de slots. Uma variante **move, redimensiona e retexturiza**; não renomeia, não remove e não inventa seção. O arranjo próprio dela entra como **dado** (`ordemSecoes` + `secoes[].oculta` na camada de exemplo), nunca como um segundo caminho de render — é por isso que a aba Estrutura reordena por cima de qualquer variante sem a skin saber que variante existe. Ver "Variante de skin" abaixo.

   O mecanismo do render pode mudar quando o componente não é nosso: as skins nativas montam a ordem no `visiveis.map` do `Skin.tsx`, e a `lancheria-2` — cujo componente vem de um pacote calibrado que monta as seções por dentro — emite **CSS de `order`/`display` renderizado no servidor**, derivado da MESMA `secoesVisiveis`. O dado é o mesmo; o que muda é quem o aplica. Fazer isso depois da hidratação seria deslocamento de layout, que é o que o portão de CLS pega.
4. **Imagens: placeholder local por slot, upload por lead no Firebase Storage.** Os placeholders (`public/demos/<nicho>/*.svg`) nunca são fotos do cliente original; o editor troca slot a slot subindo para `demos/{leadId}/{slot}-{ts}.{ext}` (jpg/png/webp, ≤2MB, comprimido client-side via canvas antes do envio — ver `comprimir.ts`). Objetos são públicos (a demo é pública) com cache imutável — trocar imagem gera caminho novo, e o upload apaga as versões velhas do slot. A URL vai em `dados.imagens[slot]` no PUT normal; "Remover" apaga os arquivos e o override (volta ao placeholder). "Excluir demo" apaga o registro e **todas** as imagens (e vídeos) do lead; upload órfão de edição abandonada é limpo no próximo upload do slot ou na exclusão.
5. **A configuração vive no campo `demo` do doc do lead** (não em subcoleção — a interface `AppDb` não precisa crescer) e é salva por `PUT /api/leads/[id]/demo` com validação estrita (skin/preset existentes, chaves desconhecidas rejeitadas, textos ≤2000, listas ≤30, `tema` contra a lista curada/`TEMA_RAIOS`/hex/`heroTitulo`/`led`, `ordemSecoes` só com seções reordenáveis da skin, `oculta` proibido em seção fixa, `alinhamento` só onde a skin declara `alignOptions`, `dados.videos` só com slots de `SkinDefinition.videoSlots` da skin).
6. **A rota pública é `force-dynamic` e `noindex`**: reflete a última edição na hora e não entra em buscador.

### Variante de skin (`SkinVariante` + `src/lib/demos/variantes.ts`)

**Uma skin, vários mundos visuais, o mesmo contrato.** O preset de tema carrega paleta e pouco mais; não carrega composição nem conteúdo de exemplo. Quando uma skin tem mais de um mundo completo — outra paleta, outra tipografia, outra textura, outro arranjo de seções e outra cópia de exemplo — isso é uma **variante**, não um preset, e não são skins diferentes. Foi por não existir esse eixo que as quatro lancherias do raio-x entraram no registro como quatro `SkinDefinition` (ver histórico no fim desta seção).

**A variante OCUPA O LUGAR DO PRESET.** O id da variante é o id do `Theme` dela, que é o que `LeadDemo.themeId` já persiste e o PUT já valida — nenhum campo novo no banco, nenhuma migração, e `getTheme` resolve pelo caminho de sempre. `SkinDefinition.themePresets` passa a ser **derivado** das variantes (`variantes.map(v => v.theme)`, mesma ordem), então tudo que já lia `themePresets` continua funcionando sem saber que variante existe.

`SkinVariante` declara o mundo inteiro: `theme` (paleta e textura), `arranjo` (`{ ordem, ocultas? }` sobre o contrato da skin), `exemplo` (o `DemoData` dela), `fundo` (`claro`/`escuro`), `thumbnail`, e `modosDeCorReprovados`/`motivoModosReprovados` do portão de fps.

- **A variante entra na CAMADA DE EXEMPLO, e só nela.** `exemploDaSkin(skin, themeId)` é o único ponto: ele escolhe QUAL exemplo é a camada 1 de `montarDemoData`. A montagem continua sendo ponto único e não ganhou argumento — as três camadas (exemplo ← `dadosDoLead` ← patch do editor) seguem iguais, e o arranjo da variante é um default que o operador sobrescreve na aba Estrutura como em qualquer skin. Quem monta o DemoData efetivo ou a BASE do diff resolve pela variante (rota pública, preview, editor, avulsa, lote, prontidão, harness); no editor isso importa duas vezes, porque trocar de variante troca a base do diff — senão o conteúdo da variante nova entraria no patch como se fosse edição do operador.
- **A TRAVA** (`src/lib/demos/__tests__/variantes.test.tsx`) é o que impede o eixo de virar "quatro skins com outro nome". Ela verifica, para toda skin com variantes: o `arranjo` é permutação exata dos ids do contrato (sem renomear, remover, repetir ou inventar) e `ocultas` só toca seção não-fixa; as variantes têm as mesmas chaves de `secoes` e as mesmas `imagens` — mesmo VALOR, não só mesma chave, porque `montarPatch` compara cada slot contra o SVG do exemplo da skin; **no HTML DO SERVIDOR, com JavaScript desligado** (`renderToStaticMarkup`, no arranjo NEUTRO) cada variante emite exatamente os `data-d-secao` do contrato, sem duplicata, e as variantes emitem a mesma lista na mesma ordem; há **ao menos uma variante de fundo claro e uma de fundo escuro**, conferindo a luminância da paleta contra o campo declarado; e cada variante renderiza **um `<h1>`, dentro da abertura**.
  A última regra parece deslocada e não é: sem ela a trava passava por cima do caso que existe para pegar. O marcador `hero` fica num wrapper que envolve cabeçalho + faixa + horário, então uma variante pode ESVAZIAR a abertura sem mudar o conjunto de `data-d-secao`. Foi assim que o Prático (`hero: 'nenhum'`) escapava. A trava foi testada por mutação: renomear seção, tirar o fundo escuro, divergir os slots e esvaziar a abertura — as quatro reprovam.
- **`temaCalibrado(skin)`** marca a skin cuja tipografia, raio, densidade e animação vêm do pacote dela em vez dos tokens da Forja. `aplicarTema` já ignorava esses campos; a função existe para o editor não oferecer controle que a resolução descarta, e para haver UM lugar a generalizar. O que continua editável é toda a camada de cima: papéis de cor, efeito de fundo, LED e cor da barra — que são siblings da skin e valem sobre qualquer variante.
- **O portão de qualidade é POR CÉLULA — variante × modo de cor.** Um fundo claro e um escuro repintam superfícies diferentes, então o mesmo efeito no mesmo modo pode passar numa variante e reprovar noutra. `resolverCamadaEfeito` soma os `modosDeCorReprovados` da variante aos do efeito; modo reprovado cai em `tema`, nada é rejeitado, e **a variante inteira nunca é desabilitada**. Mesmo contrato que `EfeitoDefinition` já usa para a `filotaxia`. A matriz sai de `qa-visual.mjs --so=variante` (imagem) e `--so=fps --skin=<id>` (número).
- **Skin sem `variantes` não muda em nada**: `exemploDaSkin` devolve o `demoDataExemplo` de sempre, e `themePresets` continua sendo a lista escrita à mão.

**Histórico — por que a `lancheria-2` existe.** Meia-Noite, Diner, Prático e Cantina chegaram como quatro `SkinDefinition` sobre o mesmo componente (`@radar/lancheria-rx`), cada uma com um preset único, e fora do sistema de personalização: a aba Imagens e a aba Estrutura eram substituídas por um aviso, a aba Tema desviava para um painel de três controles, `demoDataExemplo.imagens` era `{}`, e o teste de contrato do registro tinha três exceções `if (!skin.themeDefault.lancheria)`. A comparação das quatro (render de SSR, esqueleto de blocos, slots e knobs) mostrou **uma** divergência estrutural — o Prático não emitia `section.hero-faixa` — e nenhuma seção inventada: o resto era textura, paleta e cópia. Viraram quatro variantes de `lancheria-2`, e as exceções caíram junto. Os quatro `skinId` antigos continuam resolvendo por `SKINS_MIGRADAS` no registro (regra na RESOLUÇÃO, sem tocar no banco — mesma filosofia de `EFEITOS_MIGRADOS`), e o id da variante é o mesmo `themeId` que a demo já gravava.

### Barbearia Editorial — migração de presets para variantes

`barbearia-editorial` mantém uma entrada de skin, nove seções (`hero`,
`agendamentoRapido`, `filosofia`, `servicos`, `equipe`, `ritual`, `depoimentos`,
`agendamento`, `contato`) e sete slots de imagem. Só `hero` é fixa. As variantes
Norte, Meia-noite, Creme e Vinho vivem em `barbearia/variantes.ts`; a composição
é parametrizada por `Theme.barbearia`, sem quatro caminhos de render. A ordem
continua em `criarVariante` → `exemploDaSkin` → `montarDemoData` → `secoesVisiveis`.
O diff de ordem compara com a BASE da variante, não com o contrato neutro:
abrir/salvar uma variante não pode congelar seu arranjo como edição do operador.

**ID público coerente:** Vinho usa `vinho`. `SkinDefinition.themeAliases` declara
`oliva: vinho` só nesta skin. `idThemeAtual` atende `getTheme`, `getVariante`,
`exemploDaSkin` e a validação do PUT. O editor abre a seleção canônica; salvar
um payload legado grava `vinho`, sem migração em lote do banco.

**Atalho de conversão:** na Creme e na Vinho, `agendamentoRapido` vem imediatamente
após o hero. Enterrá-lo depois dos perfis/ritual contrariava sua função. A
narrativa editorial começa após o atalho; a Meia-noite mantém serviços antes
dele para permitir a escolha do serviço/preço primeiro.

**Origem SSR:** intro não é barreira sem JavaScript; as duas metades decorativas
não são h1. O título completo já está no HTML e o typewriter preserva sua caixa;
reveals só são ativados no cliente, sem esconder o documento servido. A trava
específica usa um DOM parseado sem executar scripts, exige nome dentro do h1 da
âncora hero, e o laço `qa-barbearia.mjs` confirma visibilidade com
`javaScriptEnabled:false`. Fotos da equipe têm seus próprios `data-demo-slot`.
`DemoData.imagensAlt` é opt-in por skin, com chaves declaradas no exemplo,
validação estrita, edição e diff por slot; string vazia é alt decorativo.

#### Lacuna sistêmica dos laços: preset não selecionado

**Confirmada nas OITO skins nativas**, não só na barbearia: `colapso`, `barra` e
`avulsa` enumeravam skins por `ANCORAS_PADRAO`, mas suas URLs não passavam
`preset`. Assim, cada uma das oito era exercitada somente no `themeDefault`.
A nona skin do registro, `lancheria-2`, também sofria: só Meia-Noite era carregada.
O eixo `AVULSA_VARIANTES` desses laços significa identidade vazia/preenchida,
não variantes visuais — não deve ser confundido com a cobertura de temas.

Agora `capturas/temas.mjs` reúne `PRESETS_SEM_VARIANTES` e `VARIANTES_POR_SKIN` em
`ALVOS_QA`. Os três laços passam skin E preset na URL e identificam ambos nos
arquivos e relatórios. São 36 combinações no registro atual (9 × 4). O teste
`capturas/__tests__/temas-mjs.test.ts` exige equivalência exata com `SKINS`,
sem sobreposição ou ID duplicado. `--skin=<id>` filtra explicitamente o alvo;
sem filtro, o laço percorre todas as combinações.

**Para as próximas sete migrações:** remover a entrada de `PRESETS_SEM_VARIANTES`,
adicionar suas variantes em `VARIANTES_POR_SKIN` e manter o teste verde. Não
reintroduzir uma lista só de skins nem confiar que quatro presets existem só
porque o default passou. A matriz visual inclui os cinco modos de cor,
inclusive `tema`, além da referência sem efeito. Capturas esperam o título
assentar, em vez de registrar o meio do typewriter.

#### Auditoria de endereço — pendência fora desta migração

Renderização SSR com um lead sem endereço confirmou que as SETE outras skins
nativas preservam e exibem o endereço do exemplo. Elas **não foram corrigidas**
neste bloco, conforme escopo aprovado. `CAMPOS_IDENTIDADE_DEMO` não inclui
`endereco`; `dadosDoLead` omite valores ausentes e não apaga o exemplo.

| Skin | Endereço do exemplo que aparece no HTML sem dado do lead |
|---|---|
| `barbearia2-sul` | Av. Brasil, 500 — Zona 3 |
| `tatuagem-editorial` | Rua das Palmeiras, 512 — Zona 07 |
| `tatuagem-pigmento-vivo` | Rua das Aquarelas, 88 — Centro |
| `lancheria-chapa-burger` | Av. Principal, 500 — Centro |
| `imobiliaria-curada` | Rua Principal, 100 — Centro |
| `multimarcas-vortice` | Av. Principal, 1000 — Centro |
| `petshop-focinho-feliz` | Rua das Begônias, 240 — Jardim das Flores |

Na `barbearia-editorial`, o endereço fictício foi retirado de `BARBEARIA_EXEMPLO`;
lead sem endereço não emite o slot nem o botão de rota. O teste específico
cobre as quatro variantes e não depende da blocklist histórica incompleta.

### Animação (`Theme.animacao` + `DemoSecao.animacaoEntrada`)

Três níveis globais — `nenhuma` / `sutil` / `marcante` — definidos no contrato (`Theme.animacao`, override em `TemaPatch.animacao`) e resolvidos por `aplicarTema` como qualquer outro token. Cada preset da skin tem um default (`themes.ts`); o editor pode sobrescrever na aba Tema. A skin de barbearia consome o nível em três pontos:

- **Entrada de seção**: `interactive/SectionReveal.tsx` serve HTML visível e, após hidratação, usa `IntersectionObserver` com limiar zero e Web Animations, uma vez, nas seções abaixo da tela (distância/duração maiores em `marcante`). O **tipo** vem do override por seção. A animação não persiste transform no fim, preservando a sidebar `position: sticky`. Serviços sem override continua sem wrapper; seu contrato só oferece opções SEM transform.
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
--so=colapso` checa os 92 slots de imagem das 9 skins sem colapso, e agora REPROVA skin com zero slots (portão que não visita a skin passa sempre).

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
- **Painel em abas**: Conteúdo (negócio, serviços, depoimentos e cada seção do contrato da skin, com listas add/remove), Imagens (trocar/remover por slot de imagem + seção "Vídeo no título" quando a skin declara `videoSlots`, com aviso de peso/fallback), Tema (skin, **presets — ou VARIANTES, quando a skin tem o eixo: mesma fileira, com o rótulo claro/escuro de cada uma**, cor primária com amostra do ink calculado, fontes display/corpo da lista curada, raio, densidade, animação, toggle da Intro, hover, animação de clique, efeito de fundo, **cor do efeito** e **cor do LED** (os cinco modos — ver "Modos de cor"), **LED** e o bloco **Título principal (hero)** — fonte/escala/alinhamento) e Estrutura (drag-and-drop via `Reorder` do `motion`, ocultar/exibir, alinhamento, **animação de entrada** onde a skin oferece e o liga/desliga de **animação por seção**, presente também nas seções fixas).
  A aba Tema **esconde o que a skin não pode honrar**, em vez de oferecer controle morto: numa skin de tema calibrado (`temaCalibrado` — tipografia/raio/densidade/animação vêm do pacote dela) somem cor primária, fontes, raio, densidade, animação, hover, clique e o bloco do título hero, e entram no lugar os papéis de cor que aquela skin realmente tem; idioma e país somem quando a skin declara `localeFixo`. Na aba Estrutura, o liga/desliga de animação por seção some quando a skin declara `animacaoPorSecao: false` (componente externo, sem wrapper de entrada onde pendurar a animação).
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
6. **Decida cedo: são presets ou VARIANTES?** Se os "temas" da skin mudam só paleta, é preset. Se cada um traz também composição (outro arranjo de seções) e conteúdo de exemplo próprio, são **variantes** — declare `SkinDefinition.variantes` e derive `themePresets`/`themeDefault`/`demoDataExemplo` delas (ver "Variante de skin"). O que NÃO vale nunca é registrar cada mundo como uma skin separada: o contrato de seções e de slots é da skin, e quatro entradas no registro para o mesmo componente foi o erro corrigido em 2026-09 (ver o histórico da `lancheria-2`). A trava (`variantes.test.tsx`) roda sozinha na skin nova.
   Se a skin tem variantes, precisa de **ao menos uma de fundo claro e uma de fundo escuro** — o mesmo espírito da "regra dos 4 mundos" dos presets, e é testado.
7. Acrescente a entrada em `src/lib/demos/registry.ts` (incluindo `heroEscalaLimites` e `thumbnail`, obrigatórios) — rota pública, ficha e editor passam a conhecê-la sem mais mudanças.
8. **Entre nas listas que os laços leem.** `ANCORAS_PADRAO` (`capturas/padrao.mjs`) e `SECOES_POR_SKIN` (`capturas/ancoras.ts`) são obrigatórias e têm teste de contrato contra o registro; se a skin tem variantes, `VARIANTES_POR_SKIN` (`capturas/variantes.mjs`) também. Essas cópias em `.mjs` existem porque os laços de verificação não compilam TypeScript, e **é por isso que elas têm teste**: `qa-visual.mjs` tinha uma lista de skins escrita à mão, o registro cresceu para doze e as quatro lancherias ficaram fora de `--so=colapso`, `--so=barra` e `--so=avulsa` por uma rodada inteira, sem nada acusar. Um portão que não visita a skin passa sempre. Hoje `BARRA_SKINS` é derivada de `ANCORAS_PADRAO` e o portão de colapso REPROVA skin com zero slots de imagem.
9. Rode os testes: o teste de contrato do registro (`registry.test.ts`) valida ids únicos, default entre os presets, exemplo completo, existência física dos placeholders e da miniatura, `heroEscalaLimites` coerentes, `heroTitulo`/`led` resolvidos em todo preset, `videos` ausente no exemplo (vídeo nunca tem placeholder) e o contrato de seções (ids únicos, presentes no exemplo, `alignOptions` válidos, ao menos uma seção reordenável). Com variantes, some a trava (`variantes.test.tsx`) e o contrato de identidade por variante (`lead-data-contract.test.tsx` percorre skin × variante).

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

O diálogo também aceita um link curto `maps.app.goo.gl`. Nada acontece ao
colar: o usuário vê primeiro **1 chamada** e o custo incremental real e
aciona explicitamente “Buscar detalhes”. O servidor expande os redirects
HTTP (gratuitos, sem SKU), extrai nome/coordenadas da URL final e faz uma
única `places:searchText`, `pageSize: 1`, com o SKU
`textSearchEnterprise`. O mask Enterprise traz nome, endereço/componentes,
telefone, site e `regularOpeningHours` na mesma resposta; portanto são
**1× textSearchEnterprise, 0× geocoding, 0× detailsEnterprise e 0×
detailsProHours**. `reserveQuota` ocorre antes do request pago e usa a cota
individual de enriquecimentos. Fotos não entram no mask.

O resultado apenas preenche o formulário local — inclusive Instagram quando
`websiteUri` aponta para o Instagram — e continua editável; a demo só é
gravada pelo botão normal de criação. O `placeId` é consultado diretamente em
`/leads/{placeId}` para exibir um aviso com link para a ficha, sem impedir a
criação. Link inválido, zero resultados, erro do Google ou cota esgotada
deixam todos os campos manuais e o botão de criação funcionando.

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

## Fila de envio ao WhatsApp — fundação (celular Android + MacroDroid)

Um celular Android com MacroDroid é um EXECUTOR BURRO: pergunta "qual o próximo lead", envia a mensagem no WhatsApp e reporta o resultado. Todo o estado (fila, cota, pausa, claim, decisão de horário) vive no Radar — o celular nunca decide nada sozinho. Este bloco é só a FUNDAÇÃO (autenticação, config, contadores, a coleção de reservas e a montagem da mensagem); as rotas HTTP que o celular de fato chama (`/api/fila/*`) vêm num bloco seguinte.

### Autenticação do dispositivo (`src/lib/fila/auth.ts` + exceção em `src/proxy.ts`)

`/api/fila/*` fica fora da sessão de usuário (mesmo molde de `/api/cron`, mas por PREFIXO — a fila tem várias rotas abaixo dele, não uma só), com segredo PRÓPRIO: `RADAR_DEVICE_KEY`, nunca `CRON_SECRET` — raios de explosão diferentes (o cron dispara buscas pagas; o celular dispara mensagens de WhatsApp para negócios reais). `autenticarDispositivo(req)` confere `Authorization: Bearer ${RADAR_DEVICE_KEY}` em TEMPO CONSTANTE (`crypto.timingSafeEqual`, sem vazar o tamanho da chave por timing) e devolve `401 { erro: "nao_autorizado" }` — formato PRÓPRIO desta fila, não o `{ error: { code, message } }` do resto do app (o executor no celular só precisa checar uma chave). Sem `RADAR_DEVICE_KEY` configurada, fail-closed: `503 config_error`. `RADAR_DEVICE_USER_ID` é o userId (de `/usuarios`) sob o qual as ações do celular são atribuídas — mantém coerente o registro de autor (quem contatou, quem fechou) mesmo quando quem dispara a mensagem é o executor automático, não uma sessão de usuário logado.

### `/config/fila` — documento único (`src/lib/fila/config.ts`)

```jsonc
{
  "ativo": true,                     // botão de pausa: false = o celular não recebe mais leads
  "metaDiaria": 15,
  "tetoPorHora": 4,
  "exigirJanelaBoa": true,           // só libera lead cuja janela de contato atual é "boa"
  "nichosPermitidos": [],            // vazio = todos
  "intervaloMinimoSegundos": 180,
  "retencaoEnvioHoras": 12,          // claim que expirou SEM CONFIRMAÇÃO prende o lead por estas horas; 0 desliga — ver "Retenção por claim não confirmada"
  "respostaAgrupamentoSegundos": 45, // janela de silêncio antes de gerar UM rascunho com as mensagens acumuladas — ver "Fila de respostas"
  "respostaAutomatica": false,       // LIGA a resposta automática — ver "Resposta automática" adiante
  "respostaAutomaticaApenasPrimeira": true, // só a primeira resposta do lead; da segunda em diante, painel
  "respostaDelayMinSegundos": 180,   // atraso SORTEADO antes de a resposta ficar disponível…
  "respostaDelayMaxSegundos": 720,   // …um sorteio por resposta, dentro desta faixa (3 a 12 min)
  "respostaJanelaInicio": 8,         // janela PRÓPRIA da resposta, em horas do fuso do OPERADOR
  "respostaJanelaFim": 22,           // (não a janelaContato, que é sobre o lead)
  "respostasAutomaticasMaxDia": 30,  // teto próprio, contra filaContadores.respostasEnviadas
  "inicioDiaOperacionalHora": 0,     // hora (America/Sao_Paulo) em que o dia operacional começa; 0 = meia-noite
  "numeroTeste": "5544984570105",    // destino de TODO disparo de teste; vazio = disparo desligado
  "ativoAlteradoPor": "dispositivo", // "dispositivo" (POST /api/fila/pausar) ou o userId do admin (PUT); null = nunca mudou
  "ativoAlteradoEm": "<ISO>"         // quando — null junto com o campo acima
}
```

`numeroTeste` é dígitos puros com DDI (mesmo formato que `montarMensagemParaLead` entrega ao aparelho — nada de parêntese ou traço, que o WhatsApp do celular não resolve). Ver "Disparo de teste da fila" adiante: toda tarefa de teste sai para ELE, nunca para o telefone real do lead escolhido.

`ativoAlteradoPor`/`ativoAlteradoEm` existem para o painel responder sozinho "pausada pelo aparelho às 03:12" em vez de exigir adivinhação. **Não são patcheáveis direto** — ficam fora de `TOP_LEVEL_KEYS`/`validateFilaConfigPatch`, então um PUT que tentasse setá-los cai em "chave desconhecida". Só duas escritas os tocam, cada uma com sua própria identidade: `POST /api/fila/pausar` (adiante) grava `"dispositivo"`; `saveFilaConfig` (usado por `PUT /api/config/fila`) grava o `userId` do admin — e só quando o patch de fato MUDA `ativo` (editar `metaDiaria` ao lado não pode fazer parecer que o admin acabou de mexer na pausa). `mergeFilaConfig` trata os dois campos como passthrough normal (`patch.campo ?? base.campo`) por uma razão não óbvia: é também o motor de `loadFilaConfig`, que o chama com o **doc cru do Firestore** como "patch" para reidratar o que está persistido — um passthrough especial (tipo "nunca vem do patch") quebraria essa releitura silenciosamente.

Doc PRÓPRIO, fora de `/config/app`: a fila é lida com muito mais frequência (o celular bate a cada ciclo) e por um chamador totalmente diferente (dispositivo, não sessão de usuário) — misturar no doc de app acoplaria dois ritmos de escrita/leitura sem necessidade. `loadFilaConfig` aplica os defaults acima quando o doc não existe — a AUSÊNCIA do documento nunca pode virar erro nem liberar envio irrestrito. Editável em `/config` (painel "Fila de envio", `GET`/`PUT /api/config/fila` — **os dois restritos ao admin**, ver "O painel inteiro é ADMIN ONLY" abaixo) reaproveitando o padrão de edição inline de "Metas por integrante" (cada campo salva no próprio blur/clique, sem botão "salvar" geral) — o botão de pausa mostra o estado ATUAL sem precisar clicar ("Ativa ✓" / "Pausada ⏸").

### `/filaContadores/{dia operacional}` — um doc por DIA OPERACIONAL (`src/lib/fila/contadores.ts`)

```jsonc
{
  "enviados": 7,
  "envios": ["<ISO>", "<ISO>"],       // um por envio confirmado do dia — só as últimas 24h são mantidas
  "ultimoEventoEm": "<ISO>",          // ou null
  "falhas": 2,                        // confirmações "falhou" do dia
  "invalidos": 1,                     // confirmações "invalido" do dia
  "semPrint": 3,                      // envios "enviado" do dia com `detalhe` não vazio (texto saiu, print não)
  "respostasEnviadas": 4              // respostas AUTOMÁTICAS confirmadas no dia — coluna própria, ver adiante
}
```

A chave do doc (`YYYY-MM-DD`) é o dia OPERACIONAL, não o calendário UTC nem a meia-noite fixa de São Paulo: `diaOperacionalKey(now, inicioHora)` calcula em `America/Sao_Paulo` e desloca para o dia ANTERIOR quando o instante ainda está antes de `inicioDiaOperacionalHora` — um plantão que atravessa a meia-noite não vê a cota resetar no meio. `inicioHora` 0 é meia-noite normal (mesma chave do calendário). `lerContadorFila(db, now, inicioDiaOperacionalHora)` é uma leitura PURA que devolve, para o instante dado: total do dia (`enviados`), quantos na ÚLTIMA HORA deslizante (filtra `envios` pela janela de 1h a partir de `now` — por isso o array, não só o contador) e segundos desde o último evento (`null` se nunca houve um). Doc ausente é o dia sem nenhum envio ainda — nunca erro. Esta fundação só tem a LEITURA; o incremento (grava `enviados`/`envios`/`ultimoEventoEm`, podando o array para 24h) fica para as rotas que consomem a fila.

**`falhas`/`invalidos`/`semPrint` — os três contadores que faltavam para o resumo do dia.** Nenhum dos três era derivável do que já estava gravado: um lead que falhou e depois foi enviado fica com estado final `"enviado"` e nenhum carimbo de QUANDO falhou; `estado === "invalido"` não tem data; `semPrint` só seria derivável varrendo `filaEnvios` inteira. `lerContadorFilaCompleto(db, now, inicioDiaOperacionalHora)` devolve o doc inteiro (os seis campos acima) mais os dois derivados que `lerContadorFila` já expunha — é a base tanto do snapshot de RITMO (que continua com o mesmo contrato de sempre, `totalDoDia`/`ultimaHora`/`segundosDesdeUltimoEvento`) quanto de `GET /api/fila/resumo` (adiante), numa leitura só do mesmo doc.

Os três são incrementados dentro da MESMA transação de `POST /api/fila/confirmar` (`confirmarEnvio`, uma escrita a mais no MESMO doc que já lia `enviados` só para `"enviado"` — agora lê para os três resultados): `contadorComFalha`/`contadorComInvalido` (puras, análogas a `contadorComEnvio`) incrementam SÓ o campo correspondente. **Deliberadamente NÃO tocam `envios`/`ultimoEventoEm`**: uma tentativa que falhou, ou um número inválido, não é uma mensagem que saiu, e sujar a janela deslizante de 1h (ou o relógio do intervalo mínimo) com eles faria os portões de RITMO (`teto_hora`, `intervalo`) pensarem que acabou de sair uma mensagem quando não saiu nenhuma. `semPrint` entra dentro de `contadorComEnvio` (`{ semPrint: Boolean(detalhe) }`), incrementado junto de `enviados` quando o `detalhe` que a macro manda não é vazio — o mesmo sinal que a lista de pendência do painel já usa (ver `detalheEnvio` adiante), só que contado por dia em vez de varrido.

**Aditivo, e só aditivo.** Nenhuma escrita existente, transição de status ou regra de idempotência mudou: confirmação repetida da MESMA claim continua devolvendo sucesso sem reescrever nada, e "nada" agora inclui os três contadores novos (o caminho idempotente retorna ANTES de qualquer leitura do doc de contador). Os contadores só contam PARA FRENTE — o dia em que isso subiu para produção começou em zero, e dias anteriores não são retroativos (não há como reconstruir, por exemplo, quantas falhas aconteceram num dia que só gravava `enviados`).

`momentoFimTetoHora(doc, tetoPorHora, now)` e `momentoFimIntervalo(doc, intervaloMinimoSegundos)` são os dois outros puros que vivem aqui: dado o doc do dia, QUANDO o portão `teto_hora`/`intervalo` deixa de bloquear. `momentoFimTetoHora` não é "daqui a 1h" — é quando envios SUFICIENTES saem da janela deslizante para `ultimaHora` cair abaixo do teto de novo (se o teto caiu no meio do plantão, pode ser preciso mais de um envio sair). Os dois existem para `GET /api/fila/resumo` (adiante) calcular `proximaJanela` sem inventar uma hora.

### `/filaEnvios/{leadId}` — um doc por LEAD (`src/lib/fila/envios.ts`)

```jsonc
{
  "leadId": "ChIJ...",
  "estado": "reservado",             // "reservado" | "enviado" | "invalido" | "falhou"
  "claimId": "<token curto>",        // novo a cada reserva
  "reservadoEm": "<ISO>",
  "expiraEm": "<ISO>",               // reservadoEm + 5min (ou EPOCH, se a claim foi devolvida — ver a retenção adiante)
  "dispositivo": "celular-1",
  "tentativas": 0,
  "ultimoErro": null,
  "enviadoEm": null,
  "detalheEnvio": "",                // texto que veio junto de um envio BEM-SUCEDIDO; ausente = ""
  "detalheEnvioResolvido": false     // o operador já anexou o print à mão; ausente = false
}
```

Coleção PRÓPRIA, fora do doc do lead em `/leads` de propósito: `leads/repo.ts` é leitura-modificação-escrita simples por design (sem transação), e reservar/confirmar claim precisa de transação de verdade (duas reservas concorrentes do mesmo lead não podem as duas "ganhar").

Três helpers, cada um com `runTransaction` só nesta coleção:

- **`reservarLead(db, leadId, dispositivo, now)`** → `claimId` novo, ou `null` quando o lead está com reserva viva de outro ciclo OU num estado TERMINAL (`enviado`/`invalido`/`falhou` — esta função não decide política de reenvio; isso fica para as rotas que vêm depois). **Regra central**: um doc `"reservado"` com `expiraEm` no passado é tratado como LIVRE e é re-reservado (claimId NOVO; `tentativas`/`ultimoErro` do lead sobrevivem à re-reserva) — é isso que devolve o lead à fila sozinho quando o celular trava ou a execução morre no meio, sem precisar de nenhum job de limpeza.
- **`confirmarClaim(db, leadId, claimId, resultado, detalhe?, now)`** — grava o resultado: `"enviado"` carimba `enviadoEm` e limpa `ultimoErro`; `"falhou"` incrementa `tentativas` e grava `detalhe` em `ultimoErro`; `"invalido"` grava `ultimoErro` SEM incrementar `tentativas` (é lead descartado — número errado etc. —, não uma tentativa que pode ter sucesso depois). Este helper é a fundação; quem a rota `/confirmar` de fato chama é `confirmarEnvio` (`lib/fila/confirmar.ts`), que faz isto e mais três docs numa transação só.
- **`liberarClaim(db, leadId, claimId)`** — o dispositivo desiste ANTES de expirar (sem confirmar envio/falha): devolve o lead à fila na hora, reaproveitando a mesma regra de "reservado expirado = livre" (marca `expiraEm` bem no passado, `EPOCH_ISO`) em vez de inventar um terceiro estado de disponibilidade.

**Duas invariantes deste doc, que a retenção adiante LÊ** (e é por isso que ela não precisou de campo novo):

1. **`estado === "reservado"` já quer dizer NUNCA CONFIRMADA.** Confirmar move para `enviado`/`invalido`/`falhou` na mesma transação, então uma claim que continua "reservado" com prazo vencido é silêncio, não resultado.
2. **`expiraEm <= reservadoEm` só acontece por `liberarClaim`.** `reservarLead` é a única escrita que CRIA "reservado" e sempre grava `expiraEm = reservadoEm + RESERVA_DURACAO_MS` (5 min à frente); `liberarClaim` (e a liberação manual do painel) é a única que joga `expiraEm` para trás. Então a comparação distingue, sem ambiguidade, "o aparelho ficou calado" de "a claim foi devolvida de propósito" — e o segundo caso é justamente onde a ROTA desistiu antes de montar tarefa nenhuma (lead que perdeu o print, lead sem telefone): ali nada saiu, e o servidor sabe. `EPOCH_ISO` é exportado porque a invariante passou a ser observável, e há teste pinando-a contra o doc que `liberarClaim` de fato grava.

**Correção explícita, nos dois últimos**: `claimId` que não bate com o ATUAL do doc é REJEITADO (`ClaimInvalidoError`), nunca ignorado em silêncio. Cenário real que isso impede: o celular trava, a claim expira, o lead é re-reservado (claimId novo) e só então o celular volta e tenta confirmar/liberar a claim VELHA — sem essa checagem isso vira envio duplicado ou contador errado.

### `montarMensagemParaLead` no servidor (`src/lib/fila/mensagem.ts`)

Mesma precedência e os mesmos marcadores que já rodam na ficha (`LeadDetailClient.tsx`) e na fila do dia (`hoje/page.tsx`) — skin → grupo → global, `{nome}`/`{demo}`/`{penetracao}`, NENHUMA regra nova — só que a partir de um route handler em vez de um componente client: busca frases/buscas/config direto do Firestore (as rotas da fila não têm `window.location` nem sessão de navegador para montar o link da demo) e reusa `resolverMensagem`/`aplicarMarcadores` tal como já existiam em `src/lib`.

- `{demo}` usa `APP_PUBLIC_URL` (mesma env já documentada, hoje só lida pelo motor de capturas) como origem pública; sem ela configurada, o marcador fica sem substituir — mesmo espírito de "nunca inventar domínio" da moldura de captura.
- **Normalização de telefone, movida para o servidor**: `digitosTelefone` (extraído de `linkWhatsApp` em `src/lib/wa.ts`, reaproveitado — não duplicado) limpa o `telefoneIntl` CRU do Google (espaços, parênteses, traço) para dígitos puros com DDI. `detalhes.telefoneIntl` (enriquecido) tem precedência sobre o da busca, mesma regra do cliente. Lead sem telefone nenhum devolve `telefone: undefined`, sem erro.

## Fila de envio ao WhatsApp — as rotas que o celular chama (`/api/fila/*`)

A fundação acima guarda o estado; estas são as rotas que o MacroDroid de fato bate — mas por **duas macros diferentes, com raios de explosão diferentes**. A macro GRANDE roda o ciclo completo de envio e é a única que decide algo: **`GET /proximo` devolve no máximo UMA tarefa, ou o MOTIVO de não ter nenhuma**; **`POST /confirmar` fecha aquela tarefa**. O celular não decide nada — nem horário, nem cota, nem qual lead. `GET /resumo` e `POST /pausar` (adiante) são para uma macro PEQUENA e SEPARADA, disparada no desbloqueio do aparelho — dezenas de vezes por dia, porque é o celular pessoal do operador — e por isso **nunca reservam nada nem tocam em mais que um campo**: o alcance de cada uma é proporcional a quantas vezes ela é chamada e a quão exposta a chave que a autentica está.

### O pool de candidatos (`src/lib/fila/candidatos.ts`) — por que existe

`/proximo` é chamada **de minuto em minuto, a noite toda**, para entregar no máximo `metaDiaria` mensagens. E os critérios de elegibilidade **não são consultáveis**: a janela de contato é CALCULADA (faixas da família × horário de funcionamento × fuso do lead — ver `barraDoDia`), "tem demo" é presença de campo, e `telefoneInvalido` AUSENTE não casa com `== false` em query nenhuma. Somando a isso que o `AppDb` deste repo **não tem query** (`firestore-like.ts`: só `collection().get()`, a coleção inteira, porque o app é single-user com centenas de docs), a rota ingênua varreria `/leads` 1440× por dia — ~216 mil leituras por noite, crescendo linear com a base, para mandar 15 mensagens.

Então a varredura acontece **uma vez a cada `POOL_TTL_MS` (10 min)** e o resultado fica num doc só, `/filaCandidatos/pool`:

```jsonc
{
  "geradoEm": "<ISO>",
  "candidatos": [{ "id": "ChIJ...", "nicho": "barbearia masculina", "offset": -180, "faixas": [], "criadoEm": "<ISO>" }],
  "lidos": 312,        // quantos leads a varredura leu — o custo, explícito
  "truncado": false,   // a base passou de POOL_MAX e o pool saiu cortado
  "estrutural": {      // diagnóstico da mesma passada — ver "Diagnóstico da fila" abaixo
    "status": 180, "descartado": 4, "telefoneInvalido": 9, "semTelefone": 21,
    "semDemo": 60, "capturaNaoPronta": 30, "semFuso": 2
  }
}
```

Cada entrada guarda o fuso e o nicho **já resolvidos** (não o endereço cru): resolver é a parte cara e só precisa acontecer uma vez por varredura. Uma chamada que não entrega nada custa **4 leituras** em vez de centenas — e não cresce em nada quando a base cresce.

**Este doc é CACHE, nunca fonte de verdade.** Nada é entregue com base nele: escolhido o candidato, a rota reserva a claim e **relê o doc do lead** para reconferir tudo contra dado fresco. Pool velho pode OFERECER um lead que não serve mais; nunca ENTREGAR — e a claim aberta na tentativa é devolvida com `liberarClaim` em vez de ficar pendurada. É isso que deixa a janela de 10 minutos ser barata sem ser mentirosa.

`candidatoEstavel` decide o que entra: só os critérios que **não dependem da hora nem da config** (status novo, telefone, demo, `capturas.estado === "pronto"` COM imagem de celular, fuso derivável, não descartado, não `telefoneInvalido`, sem estado permanente na fila). A janela e `nichosPermitidos` ficam de fora de propósito — a primeira muda a cada minuto, a segunda quando o admin mexe em /config, e congelar qualquer uma faria o pool mentir até a próxima varredura. **Claim viva também não barra aqui**: dura 5 min contra os 10 do pool, então quem decide isso é a transação de `reservarLead`, na hora.

**`descartado` entra na peneira e não estava no pedido**: um lead que o operador descartou à mão não pode voltar por uma porta automática. O descarte é suave e reversível, mas é uma decisão humana explícita de não falar com aquele negócio.

**Por que não `where(...).limit(N)`** (mesmo que o `AppDb` ganhasse query): `limit` sem `orderBy` ordena por `__name__`, então devolveria as MESMAS N docs em toda chamada. Se essas N estivessem todas fora de janela, a rota diria "sem leads elegíveis" para sempre enquanto o lead N+1 estava pronto — exatamente o silêncio que faz sair 4 mensagens em vez de 15. Consertar exigiria cursor rotativo persistido (`orderBy(documentId)` + `startAfter`), quatro métodos novos na interface e no fake, e risco de índice faltando derrubar a rota às duas da manhã. **Anotado e não implementado:** guardar, quando ninguém está em janela, o próximo instante bom (`barraDoDia` já calcula `proximoBom`) elimina até as reconstruções da madrugada — otimização de segunda ordem sobre um custo que já caiu de ~300 leituras por chamada para 4.

`POOL_MAX` (2000) é o teto do doc (Firestore trava em 1 MiB). Ao estourar ficam os de `criadoEm` mais ANTIGO — quem esperou mais vai primeiro, a mesma ordem justa da seleção — e o corte fica registrado em `truncado` em vez de acontecer calado.

### `GET /api/fila/proximo` — uma tarefa, ou o motivo

A ordem dos portões é a ordem do **custo**: pausa e ritmo custam 2 leituras de doc e barram a esmagadora maioria das chamadas da noite; só quem passa delas paga a leitura do pool.

1. `config/fila.ativo === false` → `pausado`
2. contador do dia ≥ `metaDiaria` → `meta_atingida`
3. envios na última hora corrida ≥ `tetoPorHora` → `teto_hora`
4. último evento há menos de `intervaloMinimoSegundos` → `intervalo`
5. nenhum candidato em janela agora → `fora_de_janela`
6. nenhum candidato, ponto → `sem_leads_elegiveis`

**O motivo é o produto principal desta rota, não um detalhe da resposta** — é ele que responde, de manhã, por que saíram 4 mensagens e não 15. Por isso `fora_de_janela` e `sem_leads_elegiveis` são separados e nunca colapsam: o primeiro é "estão todos dormindo, volte mais tarde e vai sair"; o segundo é "não existe lead pronto (ou os que existiam estão todos reservados)" — nenhuma espera resolve, alguém precisa gerar demo e capturas. Providências diferentes, donos diferentes.

Elegibilidade, além dos critérios estáveis do pool: `nichosPermitidos` quando não vazio (confronto por SUBSTRING sobre o nicho normalizado, mesmo espírito de `familiaDoLead` — "barbearia" na lista pega quem veio de "barbearia masculina"; lead sem nicho fica de fora quando há lista, porque não dá para provar que é permitido) e a **janela de contato AGORA** via `barraDoDia`: precisa estar ABERTO e no nível `bom`, ou também `razoavel` quando `exigirJanelaBoa === false`. **Lead sem fuso derivável nunca é entregue** — mandar mensagem às três da manhã é pior do que não mandar.

**Ordem de atendimento:** janela `bom` antes de `razoavel` (a hora melhor primeiro), e dentro do mesmo nível o mais ANTIGO na base primeiro — quem esperou mais é atendido antes. Desempate por `placeId`, para a ordem não depender de em que ordem o Firestore devolveu os docs.

**A reserva acontece DENTRO da chamada e ANTES de montar a mensagem**: a claim trava o lead primeiro, para que nenhum trabalho (três leituras de coleção em `montarMensagemParaLead`) seja feito sobre um lead que outro ciclo já levou. Reserva que falha por concorrência **não vira erro** — cai no próximo candidato.

**Resposta ACHATADA, de propósito** — um objeto de UM nível só, sem `tarefa`
aninhado, com TODAS as chaves sempre presentes nos dois casos:

```jsonc
// Com tarefa (200):
{ "temTarefa": true, "tipo": "prospeccao", "teste": false, "id": "<claimId>", "leadId": "ChIJ...",
  "nome": "Ink House", "numero": "5544991543803", "texto": "<mensagem montada e resolvida>",
  "printUrl": "<url pública da captura>", "expiraEm": "<ISO>", "motivo": "" }

// Com tarefa de RESPOSTA (200) — ver "Resposta automática" adiante:
{ "temTarefa": true, "tipo": "resposta", "teste": false, "id": "resp-<id>.<token>", "leadId": "ChIJ...",
  "nome": "Ink House", "numero": "5544991543803", "texto": "<o rascunho, congelado na geração>",
  "printUrl": "", "expiraEm": "<ISO>", "motivo": "" }

// Sem tarefa (200):
{ "temTarefa": false, "tipo": "prospeccao", "teste": false, "id": "", "leadId": "", "nome": "", "numero": "",
  "texto": "", "printUrl": "", "expiraEm": "", "motivo": "fora_de_janela" }
```

Quem consome este JSON é uma macro do MacroDroid: ela converte o corpo em
dicionário e lê cada campo por marcador de texto, e **não resolve chave
aninhada** — uma referência a `tarefa.id` devolvia o marcador literal em vez
do valor. Com o envelope antigo (`{ "tarefa": {...} }`), toda variável
derivada virava lixo, a URL do print virava string inválida, e o lead era
reportado como falha sem nada ter sido enviado. Daí as três regras que valem
para sempre, não só estilo: (1) nenhum objeto ou array aninhado; (2) toda
chave presente nos dois casos — chave ausente é o mesmo bug da chave
aninhada, o marcador some e a macro carrega lixo sem perceber; chave ausente
é pior que chave vazia; (3) todo valor é string, exceto `temTarefa` e
`teste` (booleanos) — nunca `null`, nunca `undefined`, nunca campo omitido.
`tipo` é a exceção dentro da regra (2): ele é string e está sempre presente,
mas nunca vazio — vale "prospeccao" ou "resposta", e sem tarefa vale
"prospeccao" (ver "Resposta automática" adiante).
Com tarefa, `motivo` é string vazia; sem tarefa, todos os outros campos são
string vazia e `motivo` é um dos seis valores (`pausado`, `meta_atingida`,
`teto_hora`, `intervalo`, `fora_de_janela`, `sem_leads_elegiveis`).

`teste` diz se aquela volta trouxe uma TAREFA DE TESTE em vez de uma
prospecção real — ver "Disparo de teste da fila" adiante. Ela entra pela
MESMA rota, antes do portão de ritmo, e é o único caso em que a chave é
`true`.

**`printUrl` (`src/lib/fila/print.ts`)** é escolhido por regra fixa, não pelo operador — o celular é executor burro. Duas decisões: a **seção principal no celular** (a âncora de MENOR `ordem`, que em todos os padrões é o hero — a primeira impressão da marca é o que abre uma conversa), e **com moldura, caindo para a crua** (a composta "se lê como um site num aparelho" numa conversa; numa mensagem com UMA imagem é a peça que vende, mas a composição pode ter falhado). Sem nenhuma imagem de celular o lead **não é elegível**: `estado === "pronto"` não garante que a tela de celular saiu, e tarefa sem print é mensagem sem a peça que vende. As URLs do Storage são públicas e estáveis (`public: true`, `scripts/capturas.mjs`), então o celular baixa direto, sem passar pelo proxy de `servir.ts`.

O dispositivo se identifica pelo header `X-Radar-Device` (ausente = `"android"`, o único que existe hoje) e vai para `filaEnvios.dispositivo`.

### Diagnóstico da fila — `ordenarCandidatos` devolve `{ escolhido, diagnostico }` e `GET /api/fila/diagnostico`

`fora_de_janela` era caixa preta: o operador desmarca `exigirJanelaBoa` no painel e `/proximo` continua devolvendo `fora_de_janela` — comportamento CORRETO (`niveisAceitos` amplia de `["bom"]` para `["bom", "razoavel"]`, e pode simplesmente não haver ninguém em `razoavel` agora), mas sem contagem por etapa não dá para distinguir isso de "a flag não pegou". A correção não mexe em nenhuma decisão — só faz o pipeline contar, na ordem real em que avalia:

1. **Ritmo** — `pausado`, `meta_atingida`, `teto_hora`, `intervalo` (`motivoDeRitmo`, antes de ler o pool). Não é contagem por lead, é um portão único: ou está ativo, ou não está.
2. **Estrutural** — os mesmos critérios de `candidatoEstavel`, mas cada um com o próprio contador (`motivoEstrutural`, em `lib/fila/candidatos.ts`): `status` (diferente de "novo"), `descartado`, `telefoneInvalido`, `semTelefone`, `semDemo`, `capturaNaoPronta` (cobre tanto `capturas.estado !== "pronto"` quanto print ausente — as duas dizem a mesma coisa pro operador), `semFuso`. Um lead que falha em vários ao mesmo tempo conta só uma vez, pelo PRIMEIRO da ordem acima — a mesma ordem de `candidatoEstavel`. Apurado **na mesma passada** de `construirPool` (uma segunda varredura só para contar duplicaria a leitura cara que o pool existe pra evitar) e gravado em `PoolCandidatos.estrutural`, junto do `geradoEm` que já existia.
3. **Nicho** — `nichoBarrado`: passaria em tudo, mas o nicho não está em `nichosPermitidos`. Calculado fresco, na seleção.
4. **Janela** — quem não está em `niveisAceitos` agora, quebrado por nível: `razoavel`, `ruim`, `semNivel` (fechado na hora do lead). Também fresco.

**Tentativas esgotadas (`filaParado`) fica FORA do diagnóstico estrutural, de propósito**: por construção, um envio "enviado" já reprova antes em `status` (a confirmação move `novo → contactado` na mesma transação) e "inválido" já reprova antes em `telefoneInvalido` (mesma transação) — só "tentativas esgotadas" sobra, e esse caso já tem vitrine própria na ficha do lead. Duplicá-lo no pool confundiria duas fontes da mesma informação.

**Onde os números ficam**: as contagens estruturais só são apuráveis na varredura completa de `/leads` — a que `construirPool` já faz — então vão dentro do próprio doc `/filaCandidatos/pool`. Isso tem um preço explícito: são um retrato do último rebuild, e podem ter até `POOL_TTL_MS` (10 min) de idade — ou mais, se `/proximo` não estiver sendo chamado. É por isso que `pool.geradoEm` viaja junto do `pool.estrutural` na resposta: quem olha o painel precisa poder dizer "isto é de X minutos atrás" na tela. Nicho e janela, ao contrário, são calculados NA HORA sobre esse mesmo pool — são sempre frescos.

`ordenarCandidatos` (`lib/fila/selecao.ts`) passou a devolver `{ escolhido, diagnostico }` numa PASSAGEM SÓ — o mesmo laço que decide quem é elegível já conta nicho e janela; nunca uma varredura para escolher e outra para contar. `escolhido` é a lista ordenada de candidatos (o que `/proximo` chamava de `elegiveis`); `diagnostico` é `{ nichoBarrado, janela: { razoavel, ruim, semNivel }, bloqueados }`, estrutura de dados pura, testável sem rota. `bloqueados` (a LISTA de quem parou na janela, não só a contagem) só é preenchida sob demanda — ver "A VISÃO da fila" adiante.

`GET /api/fila/diagnostico` junta as quatro etapas numa leitura: `motivoDeRitmo` de novo (portão 1), `lerPoolBruto` — o pool tal como está, **sem checar TTL e sem reconstruir** (o painel não pode custar uma varredura de `/leads` só para mostrar números) — para o `estrutural` e o `geradoEm` (portão 2), e `ordenarCandidatos` sobre esse pool para `nichoBarrado`, `janela` e `elegiveis` (portões 3 e 4). Pool nunca construído (ninguém bateu em `/proximo` ainda) devolve `pool.geradoEm: null` e `estrutural` zerado, nunca erro. A mesma rota devolve também o contador do dia e as duas listas curtas COM NOME que a tela desenha — ver "A VISÃO da fila" adiante.

Autenticação de **sessão de admin**, mesmo mecanismo de `PUT /api/config/fila` (`requireAdmin`) — **nunca a `RADAR_DEVICE_KEY`**: aquele segredo é do aparelho e não abre nada além das rotas de execução da fila. A rota vive sob `/api/fila/*`, o mesmo prefixo que `src/proxy.ts` isenta da sessão comum (porque o celular usa o device key, não cookie) — por isso ela faz sua própria checagem completa de sessão+papel, igual `/api/config/fila` PUT já faz.

**`/api/fila/proximo` não muda de formato.** O contrato achatado do MacroDroid continua exatamente como estava — mesmas chaves, todas sempre presentes, todo valor string exceto `temTarefa`; `escolhido`/`diagnostico` são detalhe interno de `ordenarCandidatos`, nunca aparecem no corpo da resposta (há teste comparando `Object.keys` do corpo contra a lista fixa de chaves, de propósito).

### `POST /api/fila/confirmar` — o celular reporta o que aconteceu

Corpo `{ id, leadId, resultado, detalhe }`, onde `id` é o claimId da tarefa e `resultado` é `enviado | invalido | falhou`.

**O contrato desta rota nunca mudou, e não muda com a resposta automática**: os mesmos três resultados, a mesma idempotência, o mesmo 409, as mesmas chaves na resposta. O que varia é para ONDE a confirmação vai, e isso é decidido pelo PREFIXO do claimId — `teste-` (adiante) e `resp-` (ver "Resposta automática") —, cada um com desvio de custo zero e ANTES da transação real. A posição não é estilo: uma resposta que passasse por `confirmarEnvio` moveria o status do lead, gravaria selo, giraria a rotação de frases e gastaria a meta do dia.

**"enviado" move QUATRO docs em coleções diferentes, ou nenhum** (`src/lib/fila/confirmar.ts`, uma `runTransaction` só): a claim (`estado`/`enviadoEm`), o lead (`novo → contactado` + selo + `registrosEnvio` com a hora e o dia local DO LEAD), a rotação de frases e o contador do dia operacional (`enviados++`, push do ISO em `envios`, poda para 24h). Uma confirmação pela metade seria contador que não bate com lead que não bate com o que o negócio recebeu no WhatsApp.

Isso obrigou a **extrair o miolo PURO** de três funções que já rodavam em produção pelo clique manual do WhatsApp: `aplicarTransicao` e `aplicarSeloContato` (de `leads/repo.ts`) e `patchAvancoRotacao`/`conjuntoDoDoc`/`refConjunto` (de `frases/repo.ts`). As versões com I/O são leitura-modificação-escrita **sem** transação por design, e não podem ser chamadas de dentro de uma — mas duas cópias da mesma regra é que não podia haver. `changeStatus`, `registrarSeloContato` e `avancarRotacao` passaram a ser cascas finas sobre os mesmos puros: nenhum comportamento mudou, e os dez arquivos de teste que cobrem o caminho manual continuam **byte a byte idênticos** e passando.

Duas regras específicas do envio pela fila:

- **Nunca rebaixa status.** Só move quem ainda está em `"novo"`; lead que o time já avançou à mão (respondeu, fechado) mantém o status — o que importa registrar aqui é o disparo, e isso é o selo.
- **A rotação é a COMPARTILHADA**, o mesmo doc que o clique manual gira (o dispositivo não tem contador próprio), e gira a skin gravada em `filaEnvios.rotacaoSkinId` — a frase que o lead de fato recebeu, não a que estaria valendo agora. Escrita com `merge`, como sempre: girar o contador nunca pisa nos textos que o admin possa estar salvando no mesmo segundo. Entra na transação porque, dentro da fila, o confirmar é atômico inteiro — o que APERTA a regra otimista de `frases/repo.ts`, não a contradiz.

**"invalido"**: a claim é encerrada e o lead ganha `telefoneInvalido = true` — número sem WhatsApp não volta à fila nunca mais, mas o lead continua na base com demo e capturas, porque o número pode ser corrigido depois. `enviados` NÃO anda (não saiu mensagem), mas `invalidos` sim — ver "`falhas`/`invalidos`/`semPrint`" em `/filaContadores` acima.

**"falhou"**: `tentativas + 1` e a claim devolvida à fila. A partir de `TENTATIVAS_MAX` (3) o lead **para**: não é excluído nem marcado como inválido, só deixa de ser elegível — e a ficha mostra por quê, para a inspeção manual acontecer. Mesma ressalva: `enviados` não anda, `falhas` sim.

### `detalheEnvio` — o texto saiu, o print não

A macro manda DUAS coisas por lead: o texto da prospecção e o print da demo. Quando o texto sai e o **anexo falha**, ela reporta `"enviado"` — não `"falhou"` — com o `detalhe` preenchido. O motivo é evitar duplicata: reportar falha depois de o texto ter saído devolveria o lead à fila e a pessoa receberia a mesma mensagem duas vezes, que é o padrão que mais gera denúncia no WhatsApp.

A consequência aceita é que passam a existir **leads contactados com o texto mas sem a peça que vende**. `detalheEnvio` (string, ausente = `""`) é o que torna esses leads ENCONTRÁVEIS — sem ele, achá-los exigiria abrir um por um.

- **Campo próprio, nunca `ultimoErro`.** `ultimoErro` é semanticamente FALHA: é o que a ficha mostra na tarja do lead parado e o que alguém lê para saber por que um lead não saiu. Escrever nele o detalhe de um envio que DEU CERTO faria falha e sucesso se confundirem justamente durante um diagnóstico. No caminho `"enviado"`, `ultimoErro` continua indo para `null`.
- **Dentro da MESMA transação** do resto do caminho `"enviado"` (claim + lead + rotação + contador). Gravá-lo depois abriria a janela em que o lead já conta como enviado e a pendência do print não existe em lugar nenhum.
- **Não vai em `registrosEnvio[]`.** Aquele array tem a forma herdada do clique manual do WhatsApp (`{ em, horaLocalLead, diaSemanaLocalLead }`) e não tem conceito de detalhe; mexer nele afetaria o fluxo que o time usa todo dia.
- **O caminho idempotente não o reescreve.** Confirmar repetido da mesma claim já enviada continua devolvendo 200 sem alterar nada — e "nada" inclui o detalhe, mesmo que o celular reenvie com um texto diferente (há teste com esse pior caso).

### A lista de pendência no painel "Fila de envio" (/config)

`detalheEnvio` guarda o rastro; esta lista é quem o mostra. Bloco **subordinado** ao painel que já existia (mesma seção, separado por um filete, título em `<h3>` — não uma seção nova competindo com ele), listando os leads com detalhe não vazio e ainda não resolvidos: leadId, nome, data do envio e o texto do detalhe.

É lista de trabalho **MANUAL**: o operador abre a conversa e anexa o print à mão. **Sem ação em massa e sem botão de reenvio** — reenviar produziria justamente a mensagem duplicada que reportar "enviado" existe para evitar.

- **`detalheEnvioResolvido` (booleano, ausente = false)**, gravado pelo alternador de cada linha. Sem ele a lista nunca esvazia e em uma semana vira ruído que ninguém olha — e lista que ninguém olha não avisa nada. **Reversível**, pelo mesmo motivo de `telefoneInvalido` na ficha: um alternador clicado por engano não pode sumir com a pendência para sempre. Daí o "ver resolvidas" ao lado do título; a visão padrão são as abertas.
- **Fica sob `/api/config/`, não sob `/api/fila/`.** Aquele prefixo INTEIRO passa sem sessão de usuário (é o celular com Bearer `RADAR_DEVICE_KEY` — ver `src/proxy.ts`), e pendurar ali uma tela de admin a tiraria da sessão junto. `GET /api/config/fila/pendencias` e `PATCH /api/config/fila/pendencias/{leadId}` são restritos ao admin, como todo o painel (ver "O painel inteiro é ADMIN ONLY").
- **`PendenciaEnvio` mora em `estado.ts`**, não no módulo que a monta: quem desenha a lista é componente client e `pendencias.ts` lê o Firestore. Mesma divisão (e mesmo motivo) de `FilaEnvioDoc`; `pendencias.ts` reexporta o tipo para ninguém precisar saber dela.
- **404 para lead sem pendência, sem criar doc.** `set` com `merge` CRIA o documento ausente — um leadId errado não pode plantar lixo em `filaEnvios`. A escrita é merge de um campo só, e sem transação de propósito: o doc já está em estado terminal (`enviado` nunca volta a ser reservado), então não há claim concorrente com que competir.

**O custo de leitura, explícito:** o `AppDb` não tem query, então listar é VARREDURA de `filaEnvios`. Está tudo bem AQUI, e só aqui — /config é página de admin aberta esporadicamente por uma pessoa, não `/api/fila/proximo`, que o celular bate 1440× por dia e por isso ganhou o pool de `candidatos.ts`. **Nada de pool nem cache para esta lista.** O que a varredura não faz é ler `/leads` inteira atrás dos nomes: filtra primeiro e só então lê, **por id**, os poucos docs de lead que sobraram — há teste que espiona as chamadas e reprova uma varredura de `/leads`.

**Verificação visual:** `node scripts/qa-plataforma.mjs --so=pendencias` captura o painel nos três estados (cheia com um detalhe longo de ~250 caracteres, "ver resolvidas" com o alternador marcado, e VAZIA) × celular e desktop × temas escuro e claro. O tema claro entra porque é onde os tokens apagados deste bloco têm menos contraste de sobra, e as capturas de aba não o cobrem: o painel fica muito abaixo da dobra de /config. O estado vazio é o motivo de o passo existir — é ali que um bloco subordinado costuma deixar caixa quebrada ou espaço morto, e o passo cobra que o painel ENCOLHA sem pendências (−244px no celular) em vez de trocar a lista por um vão.

**Duas garantias de que o executor no celular depende:**

- **409 `{ erro: "claim_invalida" }` para claim que não bate, sem alterar NADA.** Cenário real: o celular trava, a claim expira, o lead é re-reservado, e só então o aparelho volta e tenta confirmar a claim velha — sem isto viraria envio duplicado ou contador errado.
- **Confirmação repetida da MESMA claim já confirmada devolve sucesso (`repetida: true`) sem duplicar nada** — nem contador, nem rotação, nem registro de envio. A rede pode cair DEPOIS de a mensagem ter saído, e aí o celular reenvia o confirmar.

**Todas as leituras antes de todas as escritas**, dentro da transação: o Firestore real recusa `get` depois de `set`, e o fake dos testes deixaria passar calado — um confirmar que violasse isso passaria na suíte inteira e quebraria só em produção, na primeira mensagem da noite. Há teste que vigia a ordem, e ele foi verificado quebrando a ordem de propósito.

### Duas mudanças na fundação que estas rotas exigiram

- **`reservarLead` devolve `{ claimId, expiraEm }`** em vez de só o `claimId`: a resposta ao celular carrega esse instante, e recomputá-lo do lado de fora criaria duas fontes para a mesma data.
- **`filaEnvios.rotacaoSkinId`**, gravado por `anotarRotacao` logo depois da reserva: é a skin cuja frase DE FATO saiu. Fica na claim, e não é re-resolvido na confirmação, porque entre entregar a tarefa e o celular confirmar o envio a rotação compartilhada pode ter girado por um envio manual de alguém do time — o contador que gira tem que ser o da frase que o lead recebeu.
- **A política de reenvio entrou como argumento explícito** (`reservarLead(..., { tentativasMax })`), que é exatamente onde a fundação a tinha deixado ("esta função não decide política de reenvio; isso fica para as rotas que vêm depois"). O default 0 mantém `falhou` terminal; `/proximo` passa `TENTATIVAS_MAX` (3), e com isso um lead que falhou volta à fila até esgotar as tentativas. `enviado` e `invalido` são terminais em qualquer política.

### `GET /api/fila/resumo` — o retrato somente-leitura, para a macro do desbloqueio

`/proximo` e `/confirmar` são a macro GRANDE, o ciclo completo de envio. Esta rota é para uma macro PEQUENA e SEPARADA, disparada no desbloqueio do aparelho — dezenas de vezes por dia, porque é o celular pessoal do operador. Mesma autenticação (`RADAR_DEVICE_KEY`, cabeçalhos de dispositivo), sob `/api/fila/*` para cair na mesma exceção do proxy.

**Resposta ACHATADA, mesma regra de `/proximo`**: um nível só, TODAS as chaves sempre presentes, tudo string exceto o booleano e os números — chave ausente faz o MacroDroid devolver o marcador literal em vez de vazio (já custou um ciclo inteiro de depuração nesta fila).

```jsonc
{
  "ativo": true,
  "enviados": 7, "meta": 15, "restante": 8,
  "semPrint": 3, "falhas": 2, "invalidos": 1,
  "elegiveisAgora": 4,
  "motivoAtual": "",            // um de MotivoSemTarefa, ou "" quando há tarefa disponível agora
  "proximaJanela": "<ISO>",     // ou "" — ver abaixo
  "diaOperacional": "2026-03-10"
}
```

Tudo referente ao DIA OPERACIONAL corrente (`inicioDiaOperacionalHora`, não o dia civil — o operador trabalha em turno noturno e o dia vira no meio da jornada dele). `enviados`/`meta`/`restante`/`semPrint`/`falhas`/`invalidos` vêm de `lerContadorFilaCompleto` (ver `/filaContadores` acima). `semPrint` aqui são os EVENTOS do dia (o contador); a lista de pendência do painel (adiante) são os NÃO RESOLVIDOS de sempre, sem corte por dia — números diferentes, os dois certos, perguntas diferentes.

**ESTA ROTA NUNCA RESERVA NADA.** Calcula o mesmo motivo que `/proximo` devolveria, mas em caminho somente-leitura: não chama `reservarLead`, não cria claim, não toca `filaEnvios`, não incrementa contador. Reusar o handler de `/proximo` aqui queimaria uma claim e prenderia um lead por 5 minutos à toa a cada desbloqueio do celular — em vez disso, `decidirFila` (`lib/fila/selecao.ts`) extrai a MESMA cadeia de portões (ritmo → nicho → janela) numa função pura, sem a etapa de reserva/releitura fresca que só faz sentido quando se está de fato ENTREGANDO. `/proximo` foi refatorado para reusar o pedaço que os dois precisam idêntico (`motivoSemTarefaAgora`, a distinção `fora_de_janela`/`sem_leads_elegiveis`) em vez de ganhar uma segunda implementação da mesma regra — duas rotas recomputando a cadeia de portões cada uma à sua maneira seriam duas verdades sobre o motivo, capazes de divergir em silêncio. O contrato de `/proximo` não mudou (mesma resposta plana, mesma idempotência — há teste travando isso).

**`elegiveisAgora` conta os leads que passam nos filtros DE LEAD (estruturais, nicho, janela), independente dos portões de RITMO.** Por isso `decidirFila` sempre roda `ordenarCandidatos` sobre o pool, mesmo quando `motivoDeRitmo` já bloqueou — diferente de `/proximo`, que só paga a leitura do pool DEPOIS de passar pelo ritmo (a ordem ali é a ordem do custo, porque a rota é chamada 1440× por noite). Aqui o custo é aceitável: a macro do desbloqueio bate dezenas de vezes por dia, não 1440, e o pool em si continua sendo CACHE (`lerPool`, TTL de 10min) — a maioria das chamadas paga 1 leitura, não a varredura de `/leads`. Sem isso, "pausado com 12 leads prontos" e "pausado e vazio" seriam indistinguíveis — e são situações diferentes: o operador precisa ver 12, não 0.

**`proximaJanela` — o cuidado central desta rota: número plausível e ERRADO é pior que número ausente.** Se o que está bloqueando é RITMO (`meta_atingida`, `teto_hora`, `intervalo`) e não janela, o próximo momento enviável NÃO é a abertura da próxima faixa — é a virada do dia operacional, ou o instante em que o teto/intervalo se resolve. Mostrar a faixa nesse caso daria uma hora que parece certa e está errada, o mesmo erro já visto na "próxima faixa aceita" do painel (ver `barraDoDia.ts` mais adiante). A rota decide pelo PORTÃO que está bloqueando e devolve o instante coerente com ele:

- `meta_atingida` → `proximaViradaDiaOperacional(now, inicioDiaOperacionalHora)`.
- `teto_hora` → `momentoFimTetoHora` (quando envios saem da janela deslizante e `ultimaHora` cai abaixo do teto).
- `intervalo` → `momentoFimIntervalo` (`ultimoEventoEm + intervaloMinimoSegundos`).
- `fora_de_janela` → a MENOR das próximas faixas aceitas entre os candidatos bloqueados por janela (`proximoMomentoAceito` com `niveisAceitos(config)` — nunca `proximoBom` direto, que estaria errado com `exigirJanelaBoa` false, já que o próximo aceito seria "bom" OU "razoável", e pode vir antes do próximo bom).
- `pausado` e `sem_leads_elegiveis` → `""`: não há instante que resolva (o primeiro depende do admin/dispositivo reativar; o segundo, de alguém gerar demo e capturas) — melhor não prometer hora nenhuma do que inventar uma.
- `""` (tarefa disponível agora) → `""`.

**Conversão de fuso, sempre para o OPERADOR (America/Sao_Paulo), nunca para o lead.** `proximoMomentoAceito` devolve o próximo trecho aceito no calendário LOCAL DO LEAD (`{ offsetDias, inicioMin }`); a rota converte isso num instante ABSOLUTO (a aritmética funciona porque o deslocamento do lead é constante entre agora e o alvo — mesma simplificação que o resto da fila já assume) antes de devolver. Devolver o par bruto, ou o rótulo do dia na hora do lead, seria mostrar ao operador uma hora no fuso errado.

### `POST /api/fila/pausar` — liga/desliga, e só isso

Também para a macro pequena do desbloqueio, mesma autenticação. Escreve UM ÚNICO campo de config — nem meta, nem tetos, nem janela, nem `numeroTeste`. O motivo é o ALCANCE da chave: `RADAR_DEVICE_KEY` vive numa variável do MacroDroid, num celular que sai de casa. Comprometida, deve permitir no máximo ligar e desligar a fila — nunca reconfigurar cotas. `PUT /api/config/fila` continua sendo o único caminho para o resto, e continua `requireAdmin`.

**Nunca reusa `saveFilaConfig`** (`lib/fila/pausar.ts`, `aplicarPausar`): aquela grava o doc INTEIRO com `set` (lê a config efetiva, mescla, regrava tudo) — se esta rota lesse a config e regravasse por ali, ela estouraria uma edição que o admin tivesse acabado de fazer ao lado, em outro campo, entre a leitura e a escrita. A escrita aqui é DIRIGIDA: `set({ ativo, ativoAlteradoPor, ativoAlteradoEm }, { merge: true })`, só os três campos, nunca o doc inteiro.

**Valor EXPLÍCITO no corpo, nunca toggle**: `{ "ativo": true }` ou `{ "ativo": false }`. A macro pode reenviar o POST se a rede cair depois de a escrita já ter saído, e um toggle desligaria o que acabou de ligar no reenvio. **Idempotente por VALOR**: mandar o valor que já está vale como sucesso e não escreve nada (`alterado: false`) — nem `ativoAlteradoPor`/`ativoAlteradoEm` são retocados, porque não houve mudança nenhuma para registrar.

Resposta plana, mesma regra das outras rotas da fila — as três chaves sempre presentes:

```jsonc
{ "ativo": true, "alterado": false, "erro": "" }
```

`alterado` indica se houve escrita de fato. Corpo malformado (`ativo` ausente ou não booleano) é bug de integração da própria macro, não um estado operacional da fila — sai com `400` e `ativo: false` de PLACEHOLDER (quem lê deve checar `erro` antes de `ativo` nesse caso), sem escrever nada.

**`ativoAlteradoPor`/`ativoAlteradoEm`** (ver `/config/fila` acima): esta rota grava `"dispositivo"`; `saveFilaConfig` (o `PUT` de admin) grava o `userId`, e só quando o patch de fato muda `ativo`. O painel "Fila de envio" passa a poder mostrar "pausada pelo aparelho às 03:12" — responde sozinho uma pergunta que hoje exige adivinhação.

### `Lead.telefoneInvalido` — o número que não tem WhatsApp

Booleano novo no lead, ausente = false. Escrito por dois caminhos que não se falam: a **fila**, ao receber `invalido` do celular, e a **ficha**, à mão. Tira o lead da fila de envio para sempre — mas **não** o descarta: ele continua na base com demo e capturas, porque o número pode ser corrigido depois.

**Reversível de propósito.** A ficha traz o alternador "Número sem WhatsApp" / "Número tem WhatsApp" ao lado de "Descartar lead": um número certo marcado por engano ficaria fora da fila para sempre sem uma forma de desmarcar. Entra em `updateLeadExtras` junto de `notas`/`favorito`/`descartado`, pelo mesmo `PATCH /api/leads/{id}` e com a mesma proteção (quem barra anônimo nos extras é o PROXY, não a rota — ver "Proteção por sessão multiusuário").

### O lead PARADO na fila, visível na ficha

Um lead que esgota as tentativas some da fila sozinho. Se isso não aparecesse em lugar nenhum, seria um estado que mente — o lead estaria vivo, elegível a olho nu, e nunca mais sairia. Então `GET /api/leads/{id}` passa a devolver `filaEnvio` (o doc de `/filaEnvios/{leadId}`, ausente se o lead nunca passou pela fila) e a ficha mostra a tarja com as tentativas e o último erro.

`src/lib/fila/estado.ts` existe por causa disso: os TIPOS e a política (`TENTATIVAS_MAX`, `filaParado`) moram num módulo sem nada de servidor, porque a ficha é um componente client e `envios.ts` — o dono das transações — importa `node:crypto` para cunhar o claimId. Arrastá-lo para o navegador por causa de uma constante quebraria o bundle; `envios.ts` reexporta o que era dele para ninguém precisar saber da divisão.

**Verificação visual:** `node scripts/qa-plataforma.mjs --so=listas` ganhou o fixture `lead-fila-parada` (número inválido + 3 tentativas) e um passo que cobra as duas tarjas, o texto do último erro e o alternador no estado que DESFAZ a marcação.

### A VISÃO da fila no painel "Fila de envio" (/config)

O diagnóstico acima responde "quantos pararam em cada etapa". Esta tela responde as outras quatro perguntas — **o que vai acontecer, quando, com quem, e por que os demais não entram** — sem ninguém precisar abrir log de aparelho. Bloco subordinado ao painel que já existia (mesma seção, separada por um filete, `<h3>` "O que vai acontecer"), ao lado da lista de print pendente.

**A tela é LEITURA mais uma ação pontual. Nada nela dispara envio** — quem entrega continua sendo o celular, quando pedir a próxima tarefa; a tela só mostra o que ele vai encontrar quando pedir.

Quatro partes:

- **Contador do dia** — enviados, meta, restante, quantos na última hora contra o teto, e **quando o dia operacional vira** (`proximaViradaDiaOperacional`, respeitando `inicioDiaOperacionalHora`). Sem o instante da virada, "7 de 15" não diz se resta a noite inteira ou dez minutos. A função é calculada no relógio de São Paulo com o deslocamento reconferido NO ALVO, e há teste que a amarra a `diaOperacionalKey`: o instante devolvido é exatamente aquele em que a chave do contador muda. `restante` nunca é negativo — a meta pode ser reduzida no meio do dia, e "-3 restantes" não quer dizer nada.
- **Funil**, nas quatro etapas e na ordem real de avaliação (ritmo → estrutural → nicho → janela). As sete contagens estruturais levam **o instante do rebuild ao lado delas** ("retrato do pool de 14h32, há 12min, 312 leads lidos"), e nicho/janela ficam sob "calculado agora, sobre esse mesmo pool". A fronteira entre defasado e fresco é visível NA TELA, não só na documentação: número defasado lido como se fosse agora é pior que número ausente. Pool nunca construído tem texto próprio, e não um funil de zeros sem explicação.
- **Próximos elegíveis** — nome, nicho, nível e a hora local do lead, **na ordem em que serão entregues**. A lista é `ordenarCandidatos(...).escolhido`, a mesma função que `/proximo` usa: o painel não ordena por conta própria, porque duas ordenações seriam duas verdades sobre quem é o próximo e divergiriam em silêncio.
- **Bloqueados por janela** — nome, nicho, nível agora e a **próxima faixa ACEITA**, que não é o `proximoBom` (ver abaixo).

**A próxima faixa aceita não é o "próximo bom"** — e essa é a armadilha central desta tela. Com `exigirJanelaBoa === false`, `niveisAceitos` é `["bom", "razoavel"]` e o lead entra no próximo instante BOM **OU RAZOÁVEL**, que vem antes do `proximoBom`. Mostrar `proximoBom` nos dois casos daria uma hora errada e plausível — sempre mais tarde que a verdadeira, e ninguém desconfiaria. `barraDoDia` não expunha isso, e a generalização óbvia também estaria errada: `razoavel` é o `NIVEL_PADRAO`, então todo minuto ABERTO que nenhuma faixa cobre é razoável **sem existir faixa nenhuma** — varrer `faixas.filter(f => f.nivel === "razoavel")` acharia só o razoável explícito e diria "amanhã" para um lead que entra em meia hora. Por isso `acharProximoBom` virou `acharProximoNivel`, varrendo **segmentos** (que já resolvem o padrão implícito via `nivelEm`); `proximoBom` passou a ser o caso `["bom"]` da mesma varredura, com saída idêntica, e `proximoMomentoAceito(janelas, lead, niveis, now)` é o público que o painel usa. `diaClassificado` extraiu a classificação de UM dia, agora compartilhada entre o dia que a barra desenha e os 7 dias que a varredura percorre.

**O custo de leitura, explícito.** As entradas do pool são compactas de propósito (`{ id, nicho, offset, faixas, criadoEm }`, teto de 1 MiB) e **continuam sem nome** — acrescentar nome ali encareceria a rota que o celular bate 1440× por dia para servir uma tela de admin. O nome vem de leitura **por id**, só das poucas linhas que a tela mostra (`PAINEL_LINHAS`, 5 por lista); nada aqui varre `/leads`, e há teste que espiona as chamadas. Varredura seria aceitável nesta tela (/config é admin, aberta esporadicamente por uma pessoa — ver a lista de pendência acima), mas aqui nem é preciso: o pool já tem os ids, e ler 10 docs é mais barato que varrer a base. **Nada de cache nem de pool para esta tela.**

**A releitura por id também é honestidade, não só o nome.** O pool é CACHE, e a regra da fila inteira é "pode OFERECER um lead que não serve mais, nunca ENTREGAR" (ver `lerPool`). A tela segue a mesma regra: cada linha é reconferida contra o doc fresco (`motivoEstrutural`) e **sai da lista** quando não passa mais. É isso que faz o lead desaparecer assim que o operador o tira da fila, em vez de continuar listado como próximo até o pool reconstruir — e é o motivo de a lista poder ser mais curta que a contagem de elegíveis.

**`ordenarCandidatos` ganhou `coletarBloqueados`**, opt-in: a LISTA de quem parou na janela sai da mesma passagem que já decide e conta, nunca de uma segunda varredura do pool. Fica opt-in porque `/proximo` roda de minuto em minuto e não tem o que fazer com ela — montar um array de até `POOL_MAX` itens para ninguém ler é desperdício. `nivel` ausente na linha = lead FECHADO neste minuto, a distinção que a tela precisa fazer entre "hora ruim" e "não está aberto".

**Uma ação só sobre lead específico: tirar da fila.** É o `descartar` que já existe (`PATCH /api/leads/{id}`), o mesmo do card e da ficha: já reversível por lá, e já exclui o lead do pool na próxima reconstrução. **Nenhum campo novo**, e nada de `telefoneInvalido`, que quer dizer outra coisa (o número não tem WhatsApp). **"Despriorizar" ficou fora de propósito**: exigiria campo novo participando da ordenação e carregado nas entradas do pool, para uma fila que entrega no máximo 15 por dia onde o FIFO já resolve.

**A resposta inteira vem de `GET /api/fila/diagnostico`** — a rota que já calculava o funil —, e não de uma rota nova: as listas saem da MESMA chamada de `ordenarCandidatos` que produz as contagens. Duas rotas recomputando a seleção no mesmo segundo seriam duas respostas capazes de discordar entre si. Editar a config no painel acima recarrega a visão (`versao`), porque `exigirJanelaBoa` e `nichosPermitidos` mudam o funil inteiro — um funil que não reagisse à edição ao lado dele seria justamente o número defasado lido como se fosse agora.

#### Regras de segurança contra colapso

Existem porque um humano edita esta tela enquanto o celular pode estar no meio de um ciclo:

- **Alteração de configuração NUNCA invalida claim já emitida.** Quem decide a vida da claim é `expiraEm`; nada em `saveFilaConfig` escreve em `filaEnvios`. Há teste que pausa a fila, zera a meta e confere que a reserva viva continua byte a byte igual.
- **`POST /api/fila/confirmar` continua aceitando confirmação de lead removido da fila pelo painel.** Recusar seria pior: o texto já pode ter saído, e o lead ficaria marcado como não contactado tendo sido contactado — com o contador do dia sem bater com o que o negócio recebeu. O descarte do operador sobrevive à confirmação (o lead vira `contactado` E continua `descartado`).
- **O painel nunca libera claim ATIVA**, automaticamente ou não. A regra nasceu como "não há botão nenhum para isso": uma claim presa se resolvia sozinha em 5 minutos pela expiração, e um botão que a devolvesse enquanto o aparelho está no meio do envio produziria a mensagem duplicada que a fila inteira existe para evitar. A **retenção por claim não confirmada** (adiante) mudou a primeira metade dessa frase, não a segunda: ela criou um estado que NÃO se resolve em 5 minutos — o lead fica preso 12h —, e um estado assim precisa de saída manual. Então existe um botão, com a guarda que a razão original exige: `DELETE /api/config/fila/retidos/{leadId}` **recusa com 409 se houver claim não expirada** naquele lead, e a decisão é tomada dentro da transação, sobre o doc fresco. O que continua não existindo é botão que interrompa um envio em curso.

#### O painel inteiro é ADMIN ONLY

Não é sigilo de dado: **a fila é global** — um `/config/fila`, um pool, um contador — e é drenada por UM aparelho físico. Membro que pausa, para o celular do admin; membro que mexe na meta, muda o que aquele aparelho vai fazer à noite. É comando sobre hardware alheio.

A página `/config` já era restrita ao admin no proxy (membro é mandado de volta ao painel), mas a checagem de PAPEL nas rotas estava só na ESCRITA: `PUT /api/config/fila` e `PATCH .../pendencias/{leadId}` eram `requireAdmin`, e os dois GET passavam com qualquer sessão válida. Fechado: **as quatro rotas do bloco** (`GET`/`PUT /api/config/fila`, `GET /api/config/fila/pendencias`, `PATCH /api/config/fila/pendencias/{leadId}`) e `GET /api/fila/diagnostico` exigem sessão de admin — 401 sem sessão, 403 para membro, com teste em cada uma conferindo que o corpo do 403 não traz `fila` nem `pendencias`. `GET /api/config/fila` passou a receber a `Request` (não recebia argumento nenhum) para poder ler o cookie. `GET`/`POST /api/fila/teste` (o disparo de teste, adiante) nasceram com a mesma checagem — ali a razão fica ainda mais literal: um membro que injeta tarefa de teste faz o celular do admin acordar a tela e enviar.

`/api/fila/diagnostico` continua sendo o caso especial que já era: vive sob o prefixo `/api/fila/*` que o proxy isenta da sessão (porque é lá que o celular bate com a `RADAR_DEVICE_KEY`), e por isso faz a própria checagem completa de sessão + papel. A `RADAR_DEVICE_KEY` **não abre esta tela**: aquele segredo é do aparelho e só serve às rotas de execução (`/proximo`, `/confirmar`).

O painel "Respostas pendentes" (adiante) nasceu com a mesma checagem nas duas rotas dele (`GET /api/config/fila/respostas`, `PATCH .../{id}`), e ali a razão vai além de "comando sobre hardware alheio": o corpo daquelas mensagens é conversa PRIVADA captada do celular pessoal do operador.

As rotas dos RETIDOS (`GET /api/config/fila/retidos`, `DELETE .../{leadId}`) nasceram com a mesma checagem, e no DELETE a razão é a mais literal do bloco: liberar um retido devolve o lead à fila do celular alheio — e a decisão que ela registra ("conferi no WhatsApp, a mensagem não saiu") só quem tem o aparelho na mão pode tomar.

**Verificação visual:** `node scripts/qa-plataforma.mjs --so=fila` captura o painel em quatro estados × celular e desktop × temas escuro e claro (o tema claro pelo mesmo motivo do `--so=pendencias`: é onde os tokens apagados deste bloco têm menos contraste de sobra, e as capturas de aba não o cobrem). Os estados: **cheia** (5 próximos + "e mais 1 na fila", 2 bloqueados, 3 retidos, contador andando, retrato do pool datado); **sem retidos** com a fila cheia em volta (ver "Os RETIDOS no painel" adiante para por que este estado é próprio); **vazia** — fila ativa, pool sem candidato, contador zerado e as três listas vazias ao mesmo tempo, que é o motivo de o passo existir e onde ele cobra que o painel ENCOLHA (−679px no celular, −530px no desktop) em vez de trocar as listas por um vão; e **sem pool**, o celular que nunca pediu tarefa. Os fixtures usam as famílias `petshop` (faixa `bom` o dia inteiro nos 7 dias) e `multimarcas` (`ruim` igual), pelo mesmo motivo já anotado para `imobiliaria` em /mundo: captura cujo CONTEÚDO muda com a hora da rodada não prova nada. Os aferidores do painel (não vaza da viewport, nenhum slot com caixa zerada) são compartilhados com o `--so=pendencias` e com o `--so=teste`, e a asserção "sobrou linha de lista" daquele passo passou a ser escopada por `[data-lista="pendencias"]` — o funil desta visão também é feito de `<li>`, e ele não é linha de pendência.

### Retenção por claim não confirmada — a proteção que não depende do aparelho

**O que aconteceu.** Um lead recebeu a mesma mensagem duas vezes. Reconstituído pelo log do aparelho: o ciclo executou inteiro (texto enviado, print anexado), o `POST /api/fila/confirmar` respondeu 503, a macro não repetiu a chamada, a claim expirou, o lead voltou ao pool e foi enviado de novo. O lado do aparelho foi corrigido (a confirmação agora repete 3 vezes) — isso reduz a probabilidade e **não elimina a classe**: aparelho reiniciado, macro morta pelo sistema, rede caindo ou nova indisponibilidade do servidor produzem o mesmo resultado. Mensagem repetida é o comportamento que mais gera denúncia no WhatsApp, e denúncia derruba número. Então a proteção tem que viver no servidor.

**A regra.** Lead cuja claim EXPIROU SEM CONFIRMAÇÃO fica inelegível por uma janela configurável (`retencaoEnvioHoras` em `/config/fila`, padrão **12**, editável no painel; **0 desliga**).

**Isto INVERTE deliberadamente a regra central de `reservarLead`** ("reserva `reservado` com `expiraEm` no passado é livre"), que está documentada em `/filaEnvios` acima. Aquela regra existia para o lead não ficar preso quando o celular trava; o fato novo é que **"o aparelho pegou e não disse o que houve" é mais provavelmente "mandou" do que "não mandou"** — a reserva já é evidência suficiente. A assimetria que decide: bloquear um lead que não recebeu nada custa **um envio, recuperável a qualquer momento** (pela liberação manual do painel, ou sozinho quando a janela vence); liberar um lead que já recebeu **manda duas vezes, e isso não tem volta**. Na dúvida, bloqueia.

#### O RECORTE: o que retém é o SILÊNCIO, não a falha reportada

Claim confirmada com resultado `"falhou"` **não** entra na retenção. Confirmação de falha é evidência POSITIVA de que nada saiu — é exatamente o caso em que o aparelho falou —, e a política de `TENTATIVAS_MAX` (3) segue valendo **intacta** para esse caminho. Lido ao pé da letra, o pedido original ("claim reservada nas últimas horas") mataria a retentativa.

O recorte sai de graça, por construção, e é isso que o torna confiável: confirmar move `estado` para `enviado`/`invalido`/`falhou` na mesma transação, então só uma claim NUNCA confirmada continua em `"reservado"` — a retenção nem precisa saber o que é uma falha. Mesma coisa para a claim devolvida de propósito, que a segunda invariante de `/filaEnvios` separa.

#### EM DOIS LUGARES — e o pool sozinho não fecha o furo

O filtro entra na construção do pool, junto de `envioImpedePool`, como pedido. Isso é **necessário e não suficiente**, por aritmética: o pool dura `POOL_TTL_MS` (10 min) e a claim dura `RESERVA_DURACAO_MS` (5 min), então um pool construído ANTES de uma expiração continua OFERECENDO o lead por ~4 minutos DEPOIS dela — em toda expiração. A sequência que produzia a duplicata cabe dentro dessa janela:

```
t=0      pool construído, lead L dentro (a claim dele nem existe ainda)
t=1min   /proximo reserva L → claim expira em t=6min
t=6min   a claim expira EM SILÊNCIO
t=7min   /proximo: pool ainda no TTL e ainda listando L → reserva de novo → DUPLICATA
```

Então a retenção mora nos dois lados, exatamente na doutrina que o pool já declara ("pode OFERECER um lead que não serve mais, nunca ENTREGAR"):

- **`leadDisponivel`/`reservarLead` (`retencaoMs`) — o portão DURO.** Transacional, sobre o doc fresco. É este que impede a mensagem repetida, e há teste que percorre a janela pool-versus-claim minuto a minuto.
- **`envioImpedePool`/`construirPool`/`lerPool` (`retencaoMs`) — o PRÉ-FILTRO.** Mantém o funil e as listas do painel honestos e não dá a vaga de candidato a quem não pode receber nada.

`retencaoMs` é explícito no chamador, como `tentativasMax` já era e pelo mesmo motivo ("a fundação não decide política de reenvio"): o default 0 mantém o comportamento antigo byte a byte para quem não a declara. Que o pool congele a política até o TTL vencer é **seguro justamente por causa dessa divisão** — uma janela recém aumentada no painel vale na reserva no mesmo segundo, mesmo que o pool ainda não saiba dela. `/api/fila/proximo` e `montarResumoFila` passam o MESMO valor, porque o doc do pool é compartilhado e quem reconstruísse primeiro decidiria pelo outro.

#### SEM CAMPO NOVO — a evidência já estava em `/filaEnvios`

As duas invariantes documentadas em `/filaEnvios` acima bastam, e a derivação mora em `lib/fila/estado.ts` (política pura, sem servidor, ao lado de `TENTATIVAS_MAX`/`filaParado`): `claimExpiradaSemConfirmacao`, `retencaoVenceEm`, `retidoPorEnvio`, `retencaoMsDeHoras`.

**A âncora é `reservadoEm`, não `expiraEm`**: a janela conta de quando a mensagem PROVAVELMENTE saiu, não de cinco minutos depois. E **`reservadoEm` ser sobrescrito a cada nova reserva não atrapalha** — foi verificado, não presumido: enquanto a retenção vale, o lead está fora do pool E a reserva o recusa, então nada o re-reserva, logo nada reescreve o carimbo. Vencida a janela, uma reserva nova reinicia a contagem do carimbo novo, que é o correto — é evidência nova de um envio novo.

#### CLAIMS DE TESTE FICAM DE FORA — verificado, em duas camadas

O lead fixo de teste é reservado a cada disparo, por construção. Se a retenção o enxergasse, o PRIMEIRO teste o bloquearia por 12h e o recurso de teste repetível morreria na primeira volta. Duas camadas independentes impedem isso, e há teste cobrando cada uma:

1. **A tarefa de teste vive em `filaTestes/atual` e nunca escreve `filaEnvios`** (ver "A TAREFA DE TESTE" adiante, que já era assim por outro motivo: dez testes no mesmo lead destruiriam o histórico dele). Teste espiona as escritas das três etapas — injetar, entregar, confirmar — e reprova qualquer uma que toque `filaEnvios`.
2. **`construirPool` pula `leadDeTeste === true`**, então nem como candidato nem como retido ele entra. Teste semeia uma claim silenciosa no lead fixo e confere que o pool não a vê.

Dez ciclos de teste seguidos, sem retenção nenhuma.

#### A confirmação ATRASADA continua válida — o outro lado da proteção

A retenção não só impede o envio duplicado: ela mantém a confirmação tardia correta. Com o lead retido, `/proximo` não o re-reserva, então **o claimId velho ainda é o atual** — e a confirmação que chega duas horas depois (o desfecho do caso que criou esta seção) é aceita e aplicada inteira, em vez de bater num 409 depois de o lead já ter recebido a mensagem outra vez. O 409 para claim que não bate continua valendo como sempre; o que mudou é que o caminho que produzia essa divergência agora só existe com a retenção vencida ou desligada.

**`/api/fila/proximo` e `/api/fila/confirmar` não mudam de contrato**: nenhuma chave nova, nenhum `motivo` novo. Lead retido não entra no pool, então o motivo segue `sem_leads_elegiveis` — e continua havendo teste comparando `Object.keys` do corpo contra a lista fixa.

### Os RETIDOS no painel "Fila de envio" (/config) — contagem, lista e liberação

A retenção tira o lead da fila **sem que nada no lead mude**: o doc continua `status: "novo"`, com demo, com print, elegível a olho nu. Sem vitrine ele pararia EM SILÊNCIO — a mesma razão de `filaParado` aparecer na ficha e de `detalheEnvio` ter lista própria. Três peças, todas dentro da visão da fila:

- **Contagem própria no funil, com etiqueta explícita** ("retidos por envio recente não confirmado"). É a **exceção deliberada** ao precedente registrado acima, de que razão do lado de `filaEnvios` fica fora do diagnóstico estrutural: `filaParado` fica fora porque já tem vitrine na ficha do lead; a retenção não tem vitrine em lugar nenhum, então entra. Linha separada das sete contagens estruturais por um filete, e com o aviso de que ela é contada AGORA, direto de `filaEnvios` — **não** é do retrato do pool. A fronteira entre defasado e fresco é a disciplina desta tela, e misturar as duas coisas na mesma lista a apagaria.
- **Lista dos retidos**, com nome, **quando foi a reserva** (o instante em que a mensagem provavelmente saiu — é o que o operador confere no WhatsApp) e **quando a retenção vence**. Não só o número: sem lista não há como liberar um específico. Ordenada do mais RECENTE para o mais antigo, porque a conversa mais nova é a que ainda está no topo do WhatsApp dele. Lead excluído não apaga a retenção (some o nome, fica o id).
- **Ação de liberar por linha**, para quando o operador confirmar que o envio realmente não saiu.

**Uma varredura, uma verdade.** `total` (o número do funil) e `linhas` (a lista) saem da MESMA chamada de `listarRetidos`, e por isso não têm como discordar — duas fontes para o mesmo número, uma congelada no pool e outra fresca, divergiriam em silêncio justamente na tela que existe para nada ficar em silêncio. É também por isso que a lista **não tem teto**, diferente das listas de próximos/bloqueados: o volume é limitado pela própria fila (`metaDiaria` reservas por dia, uma claim por reserva), e um teto esconderia exatamente o lead que o operador quer liberar.

**Rota PRÓPRIA, e não `/api/fila/diagnostico`.** Aquela rota é declaradamente sem varredura (lê UM doc, o pool), e o retido está exatamente FORA do pool — achá-lo exige varrer `filaEnvios`, que é o custo que o diagnóstico existe para não pagar. `GET /api/config/fila/retidos` devolve `{ total, linhas, retencaoHoras }`; `retencaoHoras` viaja junto porque "0 retidos" com a retenção ligada e "0 retidos" com ela desligada são fatos diferentes, e a tela não pode confundi-los. A varredura é aceitável aqui pelo mesmo motivo da lista de pendência (/config é admin, aberta esporadicamente por uma pessoa) e **não lê `/leads` inteira atrás de nomes**: filtra primeiro e lê **por id** só os que sobraram — há teste que espiona as chamadas e reprova uma varredura de `/leads`.

**A liberação: `DELETE /api/config/fila/retidos/{leadId}`.** DELETE porque o que se apaga é a RETENÇÃO — não o lead, não a claim — e a ação é de mão única: diferente do alternador de `pendencias`, não há "re-reter". A retenção é estado DERIVADO da claim silenciosa, e "conferi, não saiu" é informação que o servidor não tem como reproduzir depois.

- **Implementada com a semântica de `liberarClaim`** (`expiraEm` no `EPOCH_ISO`), e não com campo ou estado novo: a invariante `expiraEm <= reservadoEm` JÁ significa "devolvida de propósito, nada saiu", que é exatamente o que o operador está afirmando. Reusar a distinção que a própria retenção lê é o que garante que os três lugares — lista, pool e reserva — concordem por construção; um segundo conceito de "livre" poderia divergir do primeiro. `reservadoEm` fica **intacto**: é o rastro de que houve um envio provável ali.
- **NUNCA atropela claim ativa.** Claim não expirada quer dizer que o aparelho pode estar com o WhatsApp aberto NESTE segundo, e liberar ali produziria a segunda reserva do mesmo lead — a duplicata que a retenção inteira existe para evitar. **409 com o motivo estruturado** (`claim_ativa`) e o `expiraEm`, porque a tela precisa DIZER por quê: recusa sem explicação faz o operador clicar de novo. A decisão é tomada DENTRO da transação, não sobre um doc lido antes — entre a lista e o clique, `/proximo` pode ter re-reservado o lead (retenção vencida no intervalo), e aí a transação vê a claim nova e recusa. Há teste para essa corrida.
- **404 para lead que não está retido, sem criar doc** (`set` com merge CRIA o documento ausente — um leadId errado não pode plantar lixo em `filaEnvios`), e liberar duas vezes dá 404 na segunda em vez de um segundo efeito.

**Admin-only como todo o bloco**: as duas rotas exigem sessão de admin — 401 sem sessão, 403 para membro, com teste conferindo que o corpo do 403 não traz `linhas` nem `total`, e que um membro não consegue liberar (a claim fica byte a byte como estava). Ver "O painel inteiro é ADMIN ONLY" acima para a razão: a fila é global e drenada por UM aparelho físico.

**No painel**, a contagem e a lista ficam no MESMO componente (`VisaoFila`) porque têm de vir do mesmo payload — mas em **efeitos separados**: a rota de retidos que falha não pode apagar o funil da tela, e nesse caso o número vira "—" em vez de zero, que seria mentira.

**Verificação visual:** `node scripts/qa-plataforma.mjs --so=fila` ganhou **dois** estados, não um: **com retidos** (a lista, o "reservado … · volta à fila em …", o botão de liberar por linha) e **sem retidos com a fila CHEIA em volta** — este último porque é o caso em que uma lista vazia no meio de um painel cheio deixa caixa quebrada ou espaço morto, e o estado "vazia" (onde tudo está vazio junto, e que agora também cobra o vazio dos retidos) não o revelaria. O passo também CONFRONTA o número renderizado no funil com a quantidade de linhas da lista: se um dia divergirem, é ali que aparece. Medido: o painel encolhe sem retidos (−178px no celular, −149px no desktop) em vez de trocar a lista por um vão. Os fixtures trazem três estados de propósito — um recém retido, um no FIM da janela (volta em 9min, o caso em que o "volta à fila" mais importa) e um cujo LEAD foi excluído, que mostra o id sem nome — com claims silenciosas de verdade (`estado: "reservado"`, prazo vencido, `expiraEm = reservadoEm + 5min`, a relação exata que `reservarLead` grava).

## Fila de respostas — captura, agrupamento e rascunho por IA (`POST /api/fila/mensagem-recebida`)

O terceiro pilar da fila do celular: depois de captar o lead (busca) e disparar a mensagem (fila de envio acima), este bloco capta a RESPOSTA do lead e prepara um rascunho para o operador revisar. Mesma macro do MacroDroid, mesmo aparelho pessoal do operador — mas agora observando notificações em vez de disparando.

### O que o aparelho manda, e por que isso importa para o design

Comportamento TESTADO no celular, não suposto: cada mensagem do WhatsApp gera uma notificação PRÓPRIA (sem agrupar), o corpo vem íntegro (quebras de linha, sem truncar), contato não salvo vem com o título sendo o número cru (`"+55 16 98213-3909"`), e o canal de notificação distingue conversa individual de grupo. Três consequências de design saem direto daí: (1) um lead que manda três linhas seguidas dispara três chamadas — sem agrupar, viraria três rascunhos; (2) o texto chega escapado no JSON, e a rota precisa aceitar corpo longo sem truncar; (3) o casamento com o lead tem que ser por TELEFONE normalizado, nunca por nome.

Corpo: `{ remetente, texto, canal, recebidoEm, chave }`. Autenticada por `autenticarDispositivo` (`RADAR_DEVICE_KEY`), sob `/api/fila/*` — mesma exceção do proxy que o resto da fila já usa.

### PRIVACIDADE — requisito de segurança, não de eficiência

O aparelho é o celular PESSOAL do operador e manda TODA notificação do WhatsApp Business, inclusive de conversas que não são prospecção. Duas regras são fail-closed, e as duas descartam em SILÊNCIO (200, nada persistido, nada vai para a IA):

- **Sem lead correspondente** ao telefone do remetente.
- **Canal de grupo.** `CANAL_INDIVIDUAL = "individual_chat_defaults_1"` (`lib/fila/mensagemRecebida.ts`) é uma WHITELIST, não uma tentativa de reconhecer todo formato de canal de grupo: o aparelho só manda os canais que o Android de fato usa, e uma lista de permissão erra para o lado seguro (descarta o que não reconhece) em vez de tentar adivinhar um padrão.

**NUNCA logar `texto`**, em nenhum caminho, inclusive tratamento de erro — um log de exceção com o corpo da requisição colocaria mensagem privada do operador no log da Vercel. Precisando logar falha, só a chave e o motivo (ver `flushGruposMaduros`, que isola erro por grupo sem nunca tocar no conteúdo das mensagens no que grava).

### Casamento com o lead

`digitosTelefone` (já extraído para `lib/wa.ts` — reaproveitado, não duplicado) normaliza o `remetente` para dígitos puros com DDI; a mesma função normaliza `telefoneIntl`/`detalhes.telefoneIntl` de cada lead, na MESMA precedência de `montarMensagemParaLead` (enriquecido vence o da busca). Varredura completa de `/leads`, mesmo espírito de `listLeads`/`construirPool`: dezenas ou centenas de docs, não milhões.

### Dedupe — a armadilha do `recebidoEm`

`chave` é um hash estável da notificação; `recebidoEm` é o CARIMBO DA NOTIFICAÇÃO, capturado UMA VEZ no aparelho. **Contrato com o lado do aparelho, documentado aqui porque quebrar isso quebra em produção sem barulho**: se a macro reenviar após queda de rede, `recebidoEm` tem que continuar sendo o mesmo instante original — nunca o instante da nova chamada HTTP. Se o aparelho recarimbasse `recebidoEm` a cada tentativa, e `chave` incluísse esse valor (é assim que o hash é montado do lado do aparelho), o hash mudaria e o dedupe falharia exatamente no caso em que ele existe para proteger — a macro reenviando por causa de rede instável.

O dedupe em si sai de graça: `chave` (encoded) É o ID do doc de log em `leads/{leadId}/respostas/{chave}` (ver abaixo). Chave já registrada → devolve `{ processada: false, motivo: "chave_repetida" }` sem tocar em status nem no grupo pendente; a rota sempre responde `200 { ok: true }`, sucesso do ponto de vista do aparelho tanto no caminho novo quanto no repetido.

### Registro e status (`lib/fila/mensagemRecebida.ts`)

Cada mensagem aceita (lead casado, canal individual, chave nova) grava um log PERMANENTE em `leads/{leadId}/respostas/{chave}` — mesmo espírito de subcoleção que `/buscas/{id}/execucoes`, e o mesmo motivo de o id ser a própria chave: dedupe de graça, sem coleção auxiliar para o log em si.

Transição de status: reusa `VALID_TRANSITIONS` (`lib/leads/types.ts`) em vez de checar `lead.status === "contactado"` à mão — só "contactado" tem "respondeu" na própria lista de destinos válidos, e é essa checagem que automaticamente impede rebaixar "fechado" e regravar "respondeu" (ambos ficam de fora da lista de destinos de "respondeu"/"fechado"). Lead em "novo" (nunca deveria responder antes de ser contatado, mas a rota não assume isso) também só recebe a mensagem, sem virar "respondeu".

### Agrupamento — `/filaRespostasPendentes/{leadId}` (`lib/fila/respostasPendentes.ts`)

Como cada mensagem vira uma chamada própria, agrupar é obrigatório: uma janela de silêncio configurável (`respostaAgrupamentoSegundos` em `config/fila`, default 45s) sem mensagem NOVA daquele lead, e só então um rascunho é gerado considerando tudo que chegou.

```jsonc
// filaRespostasPendentes/{leadId}
{
  "leadId": "ChIJ...",
  "mensagens": [{ "texto": "Oi, tenho interesse!", "recebidoEm": "<ISO>" }],
  "primeiraMensagemEm": "<ISO>",
  "ultimaMensagemEm": "<ISO>",   // toda mensagem nova REABRE a janela, avançando este campo
  "tentativas": 0,
  "ultimoErro": null
}
```

Coleção PRÓPRIA e pequena por natureza (só conversas com mensagem recente ainda sem rascunho) — ler a coleção INTEIRA a cada flush é barato, mesmo espírito de `/filaEnvios`. Existe separada de `leads/{leadId}/respostas` (log permanente, acima) porque os ciclos de vida são diferentes: o log nunca morre, o grupo pendente morre assim que o rascunho sai — e é o que permite achar, de QUALQUER rota, quais leads têm grupo maduro sem varrer `/leads` inteira.

**Reivindicar sem `delete` transacional**: a `UsageTransaction` deste app só tem `get`/`set` (`firestore-like.ts`) — nenhum `delete` dentro de transação, mesmo motivo de `liberarClaim` marcar `expiraEm` no passado em vez de apagar a claim. `reivindicarGrupoMaduro` "reivindica" um grupo maduro devolvendo as mensagens acumuladas e ESVAZIANDO o doc (`mensagens: []`), nunca apagando-o: o doc esvaziado continua como âncora, então uma mensagem nova que chegue ENQUANTO o rascunho está sendo gerado (`adicionarMensagemAoGrupo`, chamada por `mensagemRecebida.ts`) começa um grupo NOVO em cima dele, sem se misturar com o que já foi reivindicado e sem se perder. Um segundo `reivindicarGrupoMaduro` sobre o mesmo doc esvaziado devolve `null` (nada a fazer) — é isso que impede dois flushes concorrentes (`/proximo` e `/mensagem-recebida` podem, em teoria, rodar ao mesmo tempo) de gerarem dois rascunhos do MESMO grupo.

Falha na geração (ver flush, abaixo) devolve as mensagens ao grupo pendente via `restaurarGrupoComErro`, MESCLANDO com o que estiver no doc agora (mensagem nova pode ter chegado durante a tentativa que falhou): a mais antiga das duas `primeiraMensagemEm` e a mais recente das duas `ultimaMensagemEm` prevalecem — é isso que faz o grupo restaurado já nascer MADURO de novo (retentável no PRÓXIMO flush, sem esperar uma nova mensagem do lead para reabrir a janela).

### Quem dispara o flush — o ponto que a serverless não resolve sozinha

Sem servidor de longa duração (Vercel functions) e sem cron com granularidade de segundos, não dá para "esperar" a janela vencer. A solução reaproveita o que já existe: **o aparelho já chama `GET /api/fila/proximo` a cada 180s** (o ciclo normal de envio). Como a janela (45s default) é sempre menor que esse intervalo de polling, `flushGruposMaduros` (`lib/fila/flushRespostas.ts`) chamado no INÍCIO de `/proximo` garante que nenhum grupo fica preso por mais de um ciclo.

`POST /api/fila/mensagem-recebida` chama o MESMO flush no seu próprio início, para grupos de OUTROS leads que já venceram — assim a rota se limpa sozinha quando há movimento, sem depender só do polling de `/proximo`.

**Isolamento obrigatório, em duas camadas**: `processarGrupoReivindicado` (um grupo por vez) tem seu próprio `try/catch` — falha na geração de UM grupo (IA fora do ar, cota estourada, timeout) NUNCA propaga, e o grupo é devolvido ao pendente com o erro marcado, retentável, nunca perdido; `flushGruposMaduros` tem um `try/catch` de última linha por cima de TUDO (listagem + claim + processamento), para um erro na própria infraestrutura (ex.: Firestore fora do ar) também não vazar. O CONTRATO de `/proximo` — a mesma resposta achatada de sempre, com os mesmos seis motivos — nunca muda por causa disto; há teste travando exatamente essa garantia (`fila-proximo.route.test.ts`, describe "flush do agrupamento de respostas").

### Geração do rascunho (`lib/fila/rascunhoResposta.ts`) → `filaRespostas/{id}`

Uma chamada de IA por grupo — sem retry de schema (diferente de `gerarSugestaoDemo`, que tenta 2×): resposta fora do formato vira falha do GRUPO, e a "segunda tentativa" já existe no próprio mecanismo de flush (o grupo restaurado fica maduro de novo). A reserva de cota (`reserveQuota`, SKU `aiGeneration`) acontece ANTES do request ao Gemini, como todo o resto do app.

Contexto no prompt — o que separa um rascunho útil de um educado e genérico:

- **Nicho e nome do negócio** — direto do lead.
- **A mensagem que o Radar mandou** — reconstruída via `montarMensagemParaLead(db, lead)` (a mesma função que a fila de envio usa): o app não guarda o texto literal que saiu, então reconstruir com a mesma regra de precedência (skin → grupo → global) é a fonte de verdade mais próxima do que o lead de fato recebeu.
- **O que a demo mostra** — slogan, texto do hero e nomes dos serviços salvos em `lead.demo.dados` (ausência de qualquer um simplesmente omite a linha do prompt, nunca inventa).
- **Posicionamento de preço** — índice de mercado da REGIÃO (leitura somente-cache de `/regioes`, via `regiaoCacheKey` — nunca gera/regenera aqui, isso é ação explícita do admin) × multiplicador do nicho × piso configurado (`config.precificacao`), com o mesmo `precoBase` de partida (R$2000, "Presença") que o card "Precificação" já assume antes do operador mexer no slider. Sem região cacheada, cai no índice NEUTRO (1.0) — ainda dá um número direcional, só sem a faixa de mercado local.

A IA de análise interna do Radar é sempre pt-BR; o rascunho sai no idioma do LEAD (`idiomaEfetivoDemo`, a mesma derivação país/cidade → idioma que a Forja de Demos já usa).

O rascunho vai para uma coleção PRÓPRIA, `filaRespostas/{id}` (id próprio, gerado na hora) — NUNCA `filaEnvios`, que é doc POR leadId e carrega o estado do ENVIO real daquele lead; aqui pode haver várias entradas por lead ao longo do tempo, uma por grupo:

```jsonc
// filaRespostas/{id}
{
  "id": "<uuid>",
  "leadId": "ChIJ...",
  "mensagens": [{ "texto": "Oi, tenho interesse!", "recebidoEm": "<ISO>" }],
  "rascunho": "Oi! Posso te mostrar agora mesmo, tem 2 minutinhos?",
  "geradoEm": "<ISO>",
  "estado": "pendente"   // "pendente" | "usada" | "descartada"
}
```

Quem faz o estado sair de "pendente" é o painel abaixo — ou, com a RESPOSTA AUTOMÁTICA ligada, a confirmação do próprio aparelho (ver o bloco adiante). `usada` ganha junto `textoUsado` (o texto EDITADO pelo operador, ou o rascunho congelado quando quem mandou foi o aparelho) e `resolvidoEm`; `descartada` ganha só o carimbo.

### O painel "Respostas pendentes" (/config)

O bloco acima capta a resposta e produz o rascunho. Esta tela é onde alguém DECIDE o que fazer com ele — e é a única parte da fila de respostas que um humano opera.

**Seção PRÓPRIA, irmã de "Fila de envio", e não um bloco subordinado a ela** como a lista de print. A distinção não é de tamanho, é de pertencimento: a pendência de print é efeito colateral do ENVIO (mesma claim, mesmo doc de `filaEnvios`, mesmo ciclo de vida), então pertence àquele painel; a resposta do lead é o outro pilar, com coleção própria (`filaRespostas`), rota própria e ciclo próprio — e aqui neste documento "Fila de envio" e "Fila de respostas" já são seções irmãs, não uma dentro da outra. Nada de linguagem nova, porém: é o mesmo `<section>` de todo painel da página, os mesmos tokens, o mesmo estado vazio de uma linha.

Cada item traz de uma vez as quatro coisas que a decisão exige — **nome e nicho do lead, TODAS as mensagens do grupo na ordem em que chegaram, o texto que o Radar tinha mandado, e o rascunho**. Mostrar só a última mensagem faria o operador responder à pergunta errada: o agrupamento existe justamente porque o lead manda três linhas seguidas, e a pergunta costuma estar na terceira. A mensagem do Radar fica recolhida num `<details>` — é contexto, não ação — e é RECONSTRUÍDA por `montarMensagemParaLead` (o app não guarda o literal que saiu; `rascunhoResposta.ts` já a reconstrói pelo mesmo caminho para montar o prompt). Reconstrução que falha apaga o bloco, nunca a pendência.

**O rascunho é campo EDITÁVEL, e é a edição que vai para o WhatsApp.** A caixa é o estado; o rascunho é só o valor inicial dela. `PATCH` guarda `textoUsado` — o editado, não o original: gravar o rascunho da IA registraria uma resposta que ninguém recebeu. A caixa cresce com o conteúdo (teto em 50vh); altura fixa cortava o texto no meio de uma linha, e não se edita o que não se vê.

**Duas ações, e as duas tiram a linha da lista:** usar (o operador mandou o texto) e descartar (prefere responder do próprio jeito). Sem a segunda, a lista só cresceria — e lista que não esvazia é lista que ninguém olha, o mesmo motivo de `detalheEnvioResolvido` existir na pendência de print.

#### Abrir o Business, e não o WhatsApp comum

O aparelho tem os dois instalados. Um `wa.me` genérico ali abre o seletor de aplicativo ou o app errado, e o rascunho vai parar na conta pessoal do operador — o problema central desta tela, e o que decide se ela serve para alguma coisa.

A integração que a própria WhatsApp documenta para Android é `ACTION_VIEW` sobre `https://api.whatsapp.com/send?phone=…&text=…` com `setPackage("com.whatsapp.w4b")`. Da web não há como chamar `setPackage`, mas o Chrome no Android aceita a mesma coisa escrita na gramática de `Intent.parseUri` — URI de dados, `#Intent;`, campos separados por `;`, `end` (`linkWhatsAppBusinessAndroid`, em `lib/wa.ts`):

```
intent://api.whatsapp.com/send?phone=<dígitos>&text=<texto>#Intent;scheme=https;
  action=android.intent.action.VIEW;package=com.whatsapp.w4b;
  S.browser_fallback_url=<wa.me codificado>;end
```

Preferido ao `whatsapp://send` de esquema próprio porque é EXATAMENTE a mesma ação, o mesmo dado e o mesmo pacote da integração documentada; o esquema próprio funciona, mas é folclore.

**A codificação do texto é o detalhe que decide.** `encodeURIComponent` não está ali só pelas quebras de linha (que viram `%0A` e atravessam inteiras): ele também escapa `#` → `%23` e `;` → `%3B`, que são precisamente os dois caracteres que delimitam `#Intent;…;end`. Um rascunho com "Pacote #1" ou "50% de sinal; 50% na entrega" — texto comum numa negociação — cortaria o intent no meio, e provavelmente sem erro visível. Há teste que remonta o URI por um parser escrito a partir da GRAMÁTICA, e não do construtor (um parser que reusasse a mesma montagem concordaria com ela até quando os dois estivessem errados), e confere que um texto adversário volta byte a byte — inclusive com o próprio `#Intent;` colado dentro do rascunho. Verificado quebrando de propósito: trocar `encodeURIComponent` por `encodeURI` reprova três testes.

**`S.browser_fallback_url` existe porque o padrão do Chrome é pior.** Sem ele, pacote não instalado manda o operador para a página do app na Play Store. Com ele, cai no `wa.me` de sempre: pior que o Business, muito melhor que a loja. Vai codificado porque `Intent.parseUri` decodifica extras `S.`, e porque um `;` cru ali encerraria o campo no meio da URL.

**O botão é uma âncora de VERDADE, não um `onClick` que navega.** O Chrome recusa lançar aplicativo externo a partir de navegação sem gesto do usuário. Esperar o `PATCH` para só então mexer em `location` gastaria o gesto e o intent não abriria nada — então o `href` carrega a URI e o navegador navega sozinho, com a marcação saindo na mesma ação e com `keepalive` (a página pode ser trocada pelo fallback antes de a requisição terminar).

**O que isto NÃO prova, dito aqui de propósito:** que o Android escolhe o Business. A gramática, a codificação e o pacote mirado estão travados em teste; a escolha do app é do aparelho, e só o aparelho responde por ela.

#### A /config aberta no computador

Metade do uso desta página não é no celular, e ali não há Business para abrir. Botão que não faz nada em metade dos casos é pior que botão ausente — então ele **troca de mecanismo** em vez de existir morto: fora do Android, "usar" copia o texto para a área de transferência e marca como usada, e a linha acima da lista diz exatamente isso ("Aberta no computador, não há Business para abrir…"). Mesmo caminho para lead sem telefone, no celular também: sem número não há conversa para abrir.

A detecção é `podeAbrirBusiness` (a string do agente — a única checagem que existe: não dá para perguntar ao navegador se ele resolve `intent://` sem tentar navegar) e sai de `useSyncExternalStore`, não de estado num efeito. É o caso dele: valor que o servidor não pode conhecer (`navigator` não existe lá) e que o cliente conhece na primeira pintura, com instantâneo de servidor `false` — o React reconcilia depois da hidratação, sem divergência e sem render em cascata. Erra para o lado seguro: um Android com navegador fora da família Chrome cai no `browser_fallback_url`, nunca num beco sem saída. `copiarTexto` tenta `navigator.clipboard` (contexto seguro: https, e o `127.0.0.1` do laço de captura) e cai em `execCommand` sobre a própria caixa quando a permissão é negada. **Copiar que falha NÃO marca como usada** — sumir com a pendência apagaria o único lugar onde aquele texto existia.

#### As rotas e o custo

`GET /api/config/fila/respostas` e `PATCH /api/config/fila/respostas/{id}` (`lib/fila/respostasPainel.ts`). Ficam sob `/api/config/`, e não sob `/api/fila/`, pelo mesmo motivo da lista de print: aquele prefixo INTEIRO passa sem sessão de usuário (é o celular com Bearer `RADAR_DEVICE_KEY` — ver `src/proxy.ts`). As duas são `requireAdmin` — 401 sem sessão, 403 para membro —, e aqui a razão é mais forte que "comando sobre hardware alheio": o corpo destas mensagens é **conversa PRIVADA** captada do celular pessoal do operador (ver PRIVACIDADE acima). Há teste conferindo que o corpo do 403 não traz uma linha sequer.

`PATCH` tem três saídas, e a terceira é a que protege um dado que não tem segunda cópia:

- **id ausente → 404 e nenhuma escrita.** `set` com merge CRIA o documento que falta, e um id errado não pode plantar lixo em `filaRespostas`.
- **Repetir o MESMO estado → sucesso sem escrever nada** (idempotente por VALOR, como `POST /api/fila/pausar`): o operador clicou duas vezes, ou tem duas abas abertas, e o resultado que ele queria já aconteceu. Nem o carimbo é retocado.
- **Trocar o estado de uma já fechada → 409, sem escrever.** Deixar um "descartada" apagar o `textoUsado` de uma resposta que de fato saiu seria perder a única cópia dela. Reusa `InvalidTransitionError` (já mapeado a 409 com `de`/`para` em `http.ts`) em vez de uma classe nova: é literalmente uma máquina de estados recusando uma transição, e a única diferença é qual máquina.

**O custo de leitura, explícito.** O `AppDb` não tem query, então listar é VARREDURA de `filaRespostas`. Está tudo bem AQUI pelo mesmo motivo da lista de print — /config é página de admin aberta esporadicamente por uma pessoa, não `/api/fila/proximo` —, com uma diferença que vale dizer: `filaEnvios` tem um doc por LEAD e `filaRespostas` acumula um por GRUPO de mensagens, para sempre (resolver marca o estado, nunca apaga: o registro é o que sobra da conversa). A varredura cresce com o total de conversas já respondidas, não com o número de pendências; para uma operação de um aparelho só isso são dezenas a centenas de docs. Se um dia não for, o conserto é uma coleção de índice, não um cache — mas hoje seria complexidade sem problema. O que a varredura NÃO faz é ler `/leads` inteira atrás dos nomes: filtra primeiro e só então lê, POR ID, os poucos docs que sobraram, e há teste que espiona as chamadas.

**`montarMensagemParaLead` ganhou fontes pré-carregadas** (`carregarFontesDaMensagem`, parâmetro OPCIONAL). `listBuscas`/`listConjuntos` são varreduras de coleção, e pagá-las uma vez por linha multiplicaria a leitura pelo tamanho da lista. Ausente, a função carrega sozinha — nenhum chamador de UM lead só mudou —, e há teste contando as varreduras: uma para a lista inteira, não uma por linha.

**Verificação visual:** `node scripts/qa-plataforma.mjs --so=respostas` captura o painel em três estados × celular e desktop × temas escuro e claro. Os estados: **cheia** (um grupo de três mensagens, e um rascunho longo com quebras de linha — o pior caso de layout da caixa editável), **editada** e **VAZIA**, que cobra o painel ENCOLHER (−731px no celular, −689px no desktop) em vez de trocar a lista por um vão. O passo existe por um motivo a mais que os vizinhos: **a ação muda com o aparelho**, e o Chromium do laço se apresenta como desktop — sem forçar um agente Android (`contextoLogado` ganhou `userAgent`), a captura do "celular" mostraria o caminho do desktop, provando o contrário do que existe para provar. No Android o passo exige âncora `intent://` com o pacote do Business, e reprova se o pacote do WhatsApp COMUM aparecer mirado; no desktop exige o inverso — nenhuma âncora, o aviso e os botões de copiar. Dois aferidores que só a tela real faz: o texto extraído do `href` tem que ser IDÊNTICO ao valor da caixa editável (com `%0A` nas quebras), e depois de digitar um texto com `#` e `;` dentro o URI ainda tem que ter exatamente um `#Intent;` e terminar em `;end`. O unitário prova a função; este prova que o que o operador digitou é o que entra no link.

## Resposta automática — o rascunho que deixa de esperar aprovação

O bloco acima capta a resposta do lead e produz um rascunho; o painel é onde alguém decide o que fazer com ele. Este bloco é o interruptor que tira a pessoa do meio: ligado, o rascunho **não espera aprovação** — vira TAREFA DE ENVIO na fila que o aparelho já drena.

`respostaAutomatica` em `config/fila`, **padrão FALSE**. É a única coisa em todo o Radar que fala com um negócio real sem ninguém ter lido o que ele escreveu; o padrão é a decisão, não um detalhe de implementação.

### DOIS interruptores, não um

- **`respostaAutomatica`** (padrão false) liga o mecanismo.
- **`respostaAutomaticaApenasPrimeira`** (padrão **true**) limita à PRIMEIRA resposta do lead; da segunda em diante o rascunho cai na aprovação manual do painel. A primeira resposta é quase sempre a mesma pergunta ("quanto custa?", "como funciona?"), e é onde responder rápido vale mais; a segunda já é negociação, e negociar sozinho é outro risco.

O segundo é **interruptor de verdade, editável no painel como os demais — não constante no código**. Desligado, a IA responde também as mensagens seguintes.

Os dois decidem no INSTANTE DA GERAÇÃO, uma vez, dentro do flush (`decidirAutomatica`, `flushRespostas.ts`). "É a primeira?" é uma varredura de `filaRespostas` — a mesma que o painel paga, e aceitável pelo mesmo motivo: acontece quando um lead RESPONDE (algumas vezes por dia), não a cada ciclo do aparelho. Um rascunho automático que não vira tarefa tem só duas causas: os interruptores, e **lead sem telefone** (sem conversa para abrir, a tarefa nasceria impossível de cumprir — o rascunho fica no painel, onde uma pessoa decide).

### Como chega ao aparelho — a MESMA rota, e a chave `tipo`

Pela mesma `GET /api/fila/proximo`, nunca por rota nova: cada alteração no aparelho custa reconfiguração manual, e uma rota a mais seria uma segunda fonte da mesma decisão. A resposta ganha `tipo`, string, com dois valores: `"prospeccao"` ou `"resposta"`.

**`tipo` segue a regra que vale para todas as outras chaves: SEMPRE PRESENTE, nos dois casos, com ou sem tarefa.** Chave ausente faz o MacroDroid devolver o marcador literal em vez de vazio — já custou um ciclo inteiro de depuração nesta fila. E sempre um dos DOIS VALORES, **nunca string vazia**: o desvio no aparelho é um se/senão de dois ramos, e sem tarefa o ramo certo é o de prospecção, que já sabia lidar com "não há nada para fazer agora". Um terceiro valor seria um caso a mais para a macro tratar, sem nada a ganhar.

Para `tipo: "resposta"`, **`printUrl` vem string vazia**: resposta não leva print — a conversa já está aberta e a peça que vende já foi na abordagem.

**Nenhuma outra chave muda de nome, tipo ou presença.** O teste de contrato compara `Object.keys` contra a lista fixa nos DOIS tipos e nos DOIS casos.

**ATENÇÃO: este bloco EXIGE mudança na macro, ao contrário de todos os anteriores.** Com `printUrl` vazio a macro atual quebraria ao tentar baixar o print. O desenho do lado do aparelho é **uma macro só com um desvio por `tipo`, não duas macros**: duas disputariam a tela do mesmo aparelho, e a proteção do MacroDroid contra execução sobreposta é POR MACRO — uma não veria a outra.

**Onde a entrega entra na ordem dos portões**: depois da tarefa de teste e **ANTES do portão de ritmo**, porque a resposta não disputa com a prospecção (ver o contador, abaixo). Os portões dela são próprios e são três:

1. **A PAUSA continua valendo** (`config.ativo`). Não está escrito em lugar nenhum que a resposta a ignora, e ela não ignora: aquele botão é o vermelho do aparelho — quem pausa a fila espera que o celular pare, não que pare metade.
2. **A JANELA de resposta** (abaixo).
3. **O TETO diário próprio** (abaixo).

O atraso sorteado não aparece aqui: ele já está embutido em `disponivelEm`, e tarefa que não venceu simplesmente não está disponível. O contador do dia é lido UMA vez e serve aos dois portões (o da resposta e o de ritmo) — é o mesmo doc, e lê-lo duas vezes na mesma chamada seria pagar de novo por nada. Com o interruptor desligado, nada disso é lido: custo zero.

### RITMO HUMANO — o atraso sorteado

`respostaDelayMinSegundos` e `respostaDelayMaxSegundos` em `config/fila`, padrão 180 e 720 (3 e 12 minutos). A tarefa só fica disponível depois do atraso **SORTEADO dentro da faixa, por resposta** (`sortearAtrasoSegundos`, puro) — resposta instantânea é a assinatura mais óbvia de robô. O sorteio é por resposta, e não um valor fixo, pelo mesmo motivo: um intervalo sempre igual é tão reconhecível quanto o zero.

Faixa invertida (`max < min`) **não é erro de validação**: cada campo do painel salva no próprio blur, então existe um instante em que o mínimo já subiu e o máximo ainda não, e esse instante não pode derrubar a fila às duas da manhã. Quem resolve é o sorteio, usando o maior dos dois.

### JANELA PRÓPRIA — não reusa `janelaContato`

`respostaJanelaInicio` e `respostaJanelaFim` em `config/fila`, em horas do fuso do **OPERADOR** (America/Sao_Paulo — a mesma `horaSaoPaulo` que fecha a chave do dia operacional, para não haver duas leituras de "que horas são para o operador"). Padrão 8h–22h.

A `janelaContato` existente responde "quando é bom abordar ESTE negócio" (faixas da família × horário de funcionamento × fuso do LEAD); aqui a pergunta é outra: **parecer humano**. Um lead que escreve às 4h e recebe resposta às 4h03 denuncia a automação mais que qualquer texto. Fora da janela, a tarefa **aguarda a abertura seguinte** — nunca é descartada.

Detalhes que a função trava (`dentroDaJanelaResposta`): início inclusive e fim exclusivo (fim 22 = a última resposta sai às 22h59); `inicio === fim` é o dia inteiro; `inicio > fim` atravessa a meia-noite (22 → 6 é a madrugada inteira).

### CONTADOR E TETO PRÓPRIOS — decisão tomada, não reabra

Respostas automáticas **NÃO consomem `metaDiaria`, NÃO respeitam `intervaloMinimoSegundos` e NÃO contam no `tetoPorHora`**. Aqueles três existem para disfarçar disparo em rajada para quem NUNCA falou com você; responder quem te escreveu é outra coisa, e uma noite movimentada de respostas comeria a cota de prospecção do dia.

Campo novo em `filaContadores`: **`respostasEnviadas`**, incrementado por `contadorComResposta` — puro, três linhas, e é onde a decisão inteira mora: toca SÓ essa coluna, nunca `enviados` (a meta), nunca `envios`/`ultimoEventoEm` (a janela deslizante de 1h e o relógio do intervalo mínimo). Mesmo dia operacional da prospecção, respeitando `inicioDiaOperacionalHora`. Teto próprio em `config/fila`: **`respostasAutomaticasMaxDia`** (padrão 30) — não é meta a perseguir, é o limite que impede a noite movimentada de virar outra rajada.

Pelo mesmo motivo, `"falhou"` numa resposta **não entra em `falhas`**, e `"invalido"` não entra em `invalidos`: aquelas colunas são da prospecção, e sujá-las estragaria o diagnóstico de manhã. A tentativa fica na própria tarefa.

`GET /api/fila/resumo` **não mudou** — o retrato da macro do desbloqueio continua com as mesmas chaves. O número das respostas vive no doc do contador e no painel; acrescentá-lo lá seria mudar um contrato que este bloco não precisa mudar.

### `filaRespostasTarefas/{id}` — a fila, e por que uma coleção nova

A tarefa tem o **MESMO id** do rascunho em `filaRespostas`: são os dois lados da mesma resposta, e um id próprio só criaria uma tabela de tradução entre eles.

**Por que não guardar a claim dentro do próprio `filaRespostas`**, que já tem um doc por rascunho: aquela coleção é REGISTRO e acumula um doc por grupo de mensagens PARA SEMPRE (resolver marca o estado, nunca apaga). `/proximo` é chamada de minuto em minuto e o `AppDb` não tem query — guardar a claim lá faria a rota varrer a base inteira de conversas já respondidas 480× por dia, crescendo a cada resposta. É exatamente o custo que o pool de `candidatos.ts` existe para não pagar. Esta coleção some com o rascunho que sai: é pequena por natureza, como `/filaRespostasPendentes`, e varrê-la é ler quase nada.

Conteúdo **CONGELADO na geração** (nome, número e texto), mesma decisão da tarefa de teste: `/proximo` serve a resposta sem reler lead nem rascunho, e o que o aparelho manda é exatamente o que foi gerado.

```jsonc
// filaRespostasTarefas/{id}
{
  "id": "<mesmo id do rascunho>", "leadId": "ChIJ...",
  "nome": "Ink House", "numero": "5544991543803",
  "texto": "<o rascunho, congelado>",
  "estado": "aguardando",          // aguardando | reservado | enviado | invalido | falhou | encerrada
  "disponivelEm": "<ISO>",         // criadoEm + atraso SORTEADO
  "criadoEm": "<ISO>",
  "claimId": null, "claimExpiraEm": null, "dispositivo": "",
  "entregueEm": null, "enviadoEm": null,
  "tentativas": 0, "ultimoErro": null
}
```

Os quatro estados do meio são os mesmos de `FilaEnvioEstado` de propósito — o aparelho reporta os MESMOS três resultados nos dois caminhos, e um vocabulário paralelo faria a mesma palavra significar coisas diferentes em duas coleções. `encerrada` é a única saída que não vem do aparelho: o operador fechou o rascunho pelo painel.

A reserva é transacional, pela mesma razão de `reservarLead` (duas chamadas no mesmo segundo não podem levar a mesma resposta), com **claim expirada valendo como livre** — é isso que devolve a resposta à fila sozinha quando o aparelho trava, sem job de limpeza, e reserva que expira **não gasta tentativa**: só a falha REPORTADA gasta. Ordem de atendimento: a que está disponível há mais tempo primeiro, desempate por id.

**O claimId carrega o id do rascunho**: `resp-<id>.<token>`. Diferente de `filaEnvios`, aqui o `leadId` do corpo não endereça o doc — um lead pode ter várias respostas ao longo do tempo. Assim a confirmação encontra a tarefa sem varrer nada. O `.` separa sem ambiguidade (nem o uuid do id nem o base64url do token o contêm), e o prefixo não colide com os outros dois espaços de claim (`teste-`, e o base64url de 12 caracteres da fila real).

### A confirmação, e o que ela NÃO faz

`POST /api/fila/confirmar` **não muda**: mesmos três resultados, mesma idempotência, mesmo 409, mesmas chaves na resposta. O desvio é pelo prefixo, ANTES da transação real.

- **"enviado"** move TRÊS docs numa transação só, ou nenhum: a tarefa (`enviado` + `enviadoEm`), o rascunho em `filaRespostas` (`usada` + `textoUsado` com o texto que de fato saiu) e o contador, só em `respostasEnviadas`. **Todas as leituras antes de todas as escritas**, como em `confirmarEnvio` — o Firestore real recusa `get` depois de `set` e o fake deixaria passar.
- **"falhou"**: tentativa gasta e a tarefa volta à fila. Esgotadas as `RESPOSTA_TENTATIVAS_MAX` (3, número próprio ainda que hoje igual ao da prospecção — lá ele decide quando um LEAD para para inspeção; aqui, quando a máquina desiste), a resposta sai do caminho automático e o rascunho reaparece no painel.
- **"invalido"**: a tarefa encerra e o rascunho volta ao painel, **mas o lead NÃO ganha `telefoneInvalido`**. Aquele número acabou de mandar mensagem; tirar o lead da fila de prospecção para sempre por causa de uma conversa que a macro não conseguiu abrir seria dano permanente a partir de um sinal fraco.

O que a confirmação de uma resposta **não** faz é a parte importante, e há teste para cada uma: não move o status do lead (ele já está em "respondeu" desde que a mensagem dele chegou), não grava selo de contato, não gira a rotação de frases (a resposta não sai de frase nenhuma) e não encosta em `filaEnvios`.

### Desligar NÃO descarta rascunho nenhum

Desligar `respostaAutomatica` devolve os pendentes para a lista de aprovação manual — nada é apagado, e a tarefa continua no lugar esperando o interruptor voltar. **Rascunho já entregue ao aparelho segue seu curso**: a mudança de config nunca invalida claim emitida, a mesma regra que já vale na fila de envio.

Isso tudo sai de uma regra só, em `listarRespostasPendentes`, que passou a receber a config e o relógio. A lista deixou de ser "tudo que está pendente" e virou "tudo que espera uma PESSOA":

- rascunho SEM tarefa (o caminho normal, e todo o histórico anterior a este bloco) → aparece, como sempre;
- tarefa JÁ NA MÃO DO APARELHO (claim viva) → nunca aparece, nem com o interruptor desligado;
- tarefa viva com o interruptor LIGADO → não aparece (o automático cuida);
- tarefa viva com o interruptor DESLIGADO → **aparece**;
- tarefa em que a máquina desistiu (`invalido`, tentativas esgotadas, `encerrada`) → aparece: a decisão voltou para o humano.

Fechar pelo painel (`resolverResposta`) **encerra a tarefa** na mesma ação, para o aparelho não responder depois — e é **RECUSADO com 409 enquanto a tarefa está com o celular**: entre a tela carregar e o clique, ele pode ter puxado a resposta, e fechar ali faria o lead receber duas. Reusa `InvalidTransitionError`, como as outras transições impossíveis desta tela.

### No painel

**"Resposta automática" é bloco subordinado a "Fila de envio"** (`<h3>`), ao lado da visão, do disparo de teste e da lista de print — e não uma parte da seção "Respostas pendentes" ao lado, ainda que o assunto seja dela. O motivo é a ESCRITA: estes campos são o mesmo doc `/config/fila` que aquele painel já carrega e salva, e duas seções editando o mesmo documento seriam dois donos da mesma escrita, capazes de sobrescrever um ao outro. Admin-only como todo o resto do bloco, e cada campo salva no próprio clique/blur.

O que a seção "Respostas pendentes" mostra é o EFEITO do interruptor: com ele ligado a lista é curta por construção, e **lista curta sem explicação é um estado que mente** — o operador olharia um painel vazio e concluiria que ninguém respondeu. Por isso `GET /api/config/fila/respostas` devolve `respostaAutomatica` junto da lista, **da MESMA chamada que a filtrou** (duas fontes poderiam discordar), e a tela diz a razão e onde desligar.

## Disparo de teste da fila — o lead fixo, a tarefa injetada e os interruptores

A visão acima responde o que vai acontecer. Este bloco responde a pergunta que vem depois: **o ciclo do aparelho ainda funciona?** Um disparo que o operador injeta na tela, que sai pela MESMA rota que o celular já chama, e que não deixa rastro em lead nenhum.

Ele é o terceiro bloco subordinado ao painel "Fila de envio" (`<h3>` "Disparo de teste"), ao lado da visão e da lista de print pendente — e, como eles, **é ADMIN ONLY**: fazer o celular do admin acordar a tela e mandar mensagem é comando sobre hardware alheio, igual à pausa e à meta.

### O LEAD FIXO DE TESTE (`src/lib/fila/leadTeste.ts` + `Lead.leadDeTeste`)

Um lead permanente, com demo e captura prontas, que serve de alvo estável para validar o ciclo sem envolver nenhum negócio real. `leadDeTeste: true` no doc é a marcação; o id (`radar-lead-teste`) **não tem forma de placeId do Google**, então nenhuma busca pode devolvê-lo e o `upsertLeads` do cron nunca vai sobrescrevê-lo.

**Por que um lead de verdade, e não um objeto sintético na rota:** o teste só prova alguma coisa se percorrer o MESMO caminho da tarefa real — `montarMensagemParaLead` (frases, precedência skin→grupo→global, marcadores, link da demo com token) e `printUrlDoLead` (âncora principal, celular, moldura caindo para a crua). Um mock na rota testaria a rota, não o ciclo.

**Por que ele parece um negócio comum** ("Barbearia Dom Aurélio", endereço de Maringá, terça a sábado das 9h às 19h, nicho `barbearia` — que tem skin registrada): o destino é sempre sobrescrito por `numeroTeste`, mas a rede de segurança pode falhar, e se a mensagem escapar para o número errado é muito melhor parecer prospecção normal do que chegar assinada "LEAD TESTE 123".

**Demo e captura são geradas UMA vez e persistem.** `garantirLeadDeTeste(db)` cria o doc se não existir e **nunca sobrescreve** o que já está lá — é chamada pelo painel, então abrir a tela basta (não há seed nem migração neste repo, e não precisa haver). A captura o operador gera à mão, uma vez, pela ficha do lead. Depois disso nada a invalida: **não existe ciclo de expiração de captura** — a regra de `semNoticia` (`capturas/estado.ts`) só degrada `enfileirado` e `rodando`, nunca `pronto`. O único caminho que apagaria a demo do alvo era o `DELETE /api/leads/{id}/demo` manual, e ele passou a **recusar** neste lead: se ele aparecesse como "não pronto" justamente na noite do teste, o recurso não serviria para nada.

#### O INVENTÁRIO — onde ele é excluído, e por quê isso é o trabalho central

Criar o lead é a parte fácil. O que custa é garantir que ele não vaze: **um lead de teste somado à penetração de site por nicho envenena, em silêncio, um número que é usado como argumento de venda**; somado ao pool da fila, manda mensagem de verdade sozinho às dez da noite.

A exclusão acontece na ORIGEM de cada varredura, nunca em cada consumidor:

- **`listLeads`** (`leads/repo.ts`) — e com ela `/api/leads` (páginas `/leads` e `/demos`), `/api/hoje` (a fila do dia), `/api/mundo`, a análise de grupo por IA, o apagar demos em lote do grupo e `calcularPenetracaoGrupo` (a penetração por nicho+cidade). Os derivados puros que rodam sobre essa lista — `montarFilaDoDia`, `montarMundo`, `calcularPenetracaoSite`, `calculaScore` — ficam cobertos sem código novo.
- **`getMetrics` e `getMetricsPorUsuario`** (`leads/metrics.ts`) — o painel e o rollup por integrante, inclusive `demosCriadas`, que ele inflaria por já nascer com demo.
- **`construirPool`** (`fila/candidatos.ts`) — nem como candidato, nem em `lidos`, nem em nenhuma das sete contagens estruturais do funil. Aqui não é só higiene de número: candidato, ele receberia prospecção de verdade à noite. O alvo do disparo de teste chega por id, nunca pelo pool.

Dois lugares que a busca alcançou e onde **não havia nada a excluir**, conferido no código: o **índice regional de preço** (`lib/regioes`, `lib/precificacao`) não lê `/leads`, e as **metas por integrante** (`usuarios/metas.ts`) leem o contador de buscas em `usage_users`. A lista de print pendente também fica de fora por construção: ela varre `filaEnvios`, onde o teste nunca escreve.

### A TAREFA DE TESTE (`src/lib/fila/teste.ts` + `filaTestes/atual`)

**Por dentro de `/proximo`, nunca por rota nova — requisito duro.** Cada alteração na macro custa reconfiguração manual no celular. Ela continua perguntando a mesma coisa no mesmo lugar, com o mesmo contrato achatado; só recebe, naquela volta, a tarefa de teste em vez da normal.

**Onde a claim mora, e por que NÃO em `filaEnvios/{leadId}`.** Aquele doc é por leadId e carrega o estado REAL daquele lead: claimId, tentativas, `enviadoEm`, `detalheEnvio`. Dez testes no mesmo lead destruiriam o histórico dele — o contrário do que este recurso promete. A claim de teste tem **id próprio** e vive numa coleção separada.

**Por que doc próprio e não dentro de `config/fila`** (que `/proximo` já lê em toda chamada, e onde sairia de graça): `saveFilaConfig` grava o documento INTEIRO com `set`, então o admin ajustando a meta destruiria uma tarefa pendente ao lado, e consumir a tarefa faria o caminho do APARELHO escrever no doc que hoje só o admin escreve. Seria exatamente a corrida que a regra "alteração de configuração nunca invalida claim já emitida" existe para não ter. O preço é **+1 leitura por chamada** (~480/dia, trivial) — e ele some quando há teste pendente: a entrega acontece ANTES do portão de ritmo e pula a leitura do contador.

**UM doc, três estados**, `filaTestes/atual`:

```jsonc
{
  "claimId": "teste-XXXXXXXXXXXX",  // cunhado na INJEÇÃO, não na entrega
  "estado": "pendente",              // "pendente" | "entregue" | "confirmado"
  "leadId": "radar-lead-teste",
  "nome": "Barbearia Dom Aurélio",
  "numero": "5544984570105",         // config/fila.numeroTeste, nunca o telefone do lead
  "texto": "<mensagem montada e resolvida>",
  "printUrl": "<url pública da captura>",
  "criadoEm": "<ISO>",
  "expiraEm": "<ISO>",               // criadoEm + 15min — só vale enquanto "pendente"
  "criadoPor": "<userId do admin>",
  "pulou": ["ritmo"],                // rastro de quais etapas foram puladas
  "entregueEm": null, "confirmadoEm": null, "resultado": null, "detalhe": "",
  "repeticoesTotal": 1,               // pedido na injeção, congelado — 1..10 (ver "Auto-repeat" abaixo)
  "repeticoesRestantes": 0,           // quantas rearmadas automáticas ainda faltam
  "repeticoesCanceladasEm": null      // ISO só quando o OPERADOR cancelou; null inclusive ao zerar sozinho
}
```

Injetar de novo **sobrescreve**: há UM aparelho, e duas tarefas de teste vivas ao mesmo tempo não significariam nada.

**Tudo é congelado na INJEÇÃO** — nome, texto e print. Assim `/proximo` serve o teste sem ler o lead nem as três coleções de `montarMensagemParaLead`, e a tarefa não muda de conteúdo entre o clique e a puxada. Como efeito direto, **a rotação de frases não gira**: `montarMensagemParaLead` é leitura pura, e `anotarRotacao` nunca é chamada no caminho de teste.

**Comportamento:**

- **One-shot, por transação** (`marcarTesteEntregue`): duas chamadas de `/proximo` no mesmo segundo — a macro repetindo o pedido, um retry de rede — não podem as duas levar a mesma tarefa. Quem perde a corrida cai na fila normal, sem virar erro.
- **Expira em 15 minutos e some sozinha.** Sem prazo, o operador clica às 18h, se distrai, e às 2h da manhã a macro puxa e dispara. A regra é a MESMA da claim expirada da fila real ("instante no passado = não existe"), sem job de limpeza: o doc fica como rastro de que houve um teste que ninguém puxou, e a tela mostra isso em vez de ficar eternamente "aguardando".
- **Destino sempre `config/fila.numeroTeste`** (campo novo, inicial `5544984570105`; dígitos com DDI, vazio = disparo desligado). **Nunca o telefone real do lead — inclusive quando o alvo é o lead fixo de teste**, porque a sobrescrita não é conveniência: é a rede de segurança de quando o alvo escolhido é um negócio real.
- **Entregue ANTES do portão de ritmo.** Quem decidiu que ela podia sair foi o operador na tela, que pode ter mandado PULAR justamente a etapa de ritmo. Reaplicar o portão em `/proximo` engoliria o teste em silêncio.
- **Nenhum efeito colateral**: não move o status do lead, não incrementa o contador do dia, não gira a rotação, não grava selo de contato e não toca `filaEnvios`. O mesmo lead pode ser testado dez vezes sem consequência.

**O contrato de `/proximo` ganha `teste`, BOOLEANO e SEMPRE PRESENTE nos dois casos** — com e sem tarefa. Chave ausente faz o MacroDroid devolver o marcador literal em vez de vazio; foi exatamente essa a causa do bug do envelope aninhado. Nenhuma outra chave muda de nome, tipo ou presença, e o teste de contrato (que compara `Object.keys` contra a lista fixa) cobre os dois casos com a chave nova. `temTarefa` e `teste` passam a ser os dois únicos booleanos; todo o resto continua string.

**`POST /api/fila/confirmar` desvia pelo PREFIXO do claimId** (`teste-`), custo zero e **ANTES** de `confirmarEnvio` — a transação que toca lead, contador e rotação. Essa checagem não podia ficar depois de nenhuma escrita: um teste que incrementasse o contador do dia falsificaria a meta, e um que movesse o status marcaria como contactado um negócio que não recebeu nada. O prefixo não colide: um claimId real é `randomBytes(9)` em base64url, SEMPRE 12 caracteres; o de teste tem 18. O caminho de teste registra o resultado, responde com as MESMAS chaves do caminho real (mais `teste: true`, e `teste: false` no real) e repete com sucesso sem regravar, como a claim normal.

### Auto-repeat — o campo de repetições (`repeticoesTotal`/`repeticoesRestantes`/`repeticoesCanceladasEm`)

**O problema.** O disparo de teste era one-shot: cada volta exigia rearmar à mão no painel. Validar o comportamento do APARELHO (desbloqueio, envio, anexo, verificação, confirmação) pede repetir o MESMO ciclo várias vezes seguidas — dez, na prática — e fazer isso na mão, clicando de novo a cada ~3 minutos, é inviável.

**A mudança é só no campo de repetições do painel; nada na SELEÇÃO do lead.** Continua UM lead FIXO por disparo (ver "Os INTERRUPTORES e a escolha do lead" abaixo) — o auto-repeat não é para exercitar candidatos diferentes (isso o painel já mostra sem disparar nada, pelo funil e pela lista de elegíveis); é para repetir o MESMO ciclo do aparelho várias vezes com o lead constante, que é o que torna qualquer diferença entre voltas atribuível ao aparelho, não ao lead.

**Continua UM documento e UMA tarefa por vez em `filaTestes/atual`.** Isto NÃO é uma fila de testes: é a MESMA tarefa se recarregando sozinha depois que a anterior fecha. Cada rearme SOBRESCREVE o doc com o próximo ciclo — a decisão de manter o registro de teste fora de `filaEnvios` (ver "A TAREFA DE TESTE" acima) continua intacta, e por isso dez repetições seguidas continuam sem sujar `filaEnvios`, o lead ou os contadores do dia.

**A REGRA DE SEGURANÇA CENTRAL: o rearme acontece na CONFIRMAÇÃO, nunca no disparo.** `confirmarTeste` (`lib/fila/teste.ts`) é o ÚNICO lugar que rearma, e só quando a claim que está confirmando é a claim ATUAL — ou seja, só depois que o aparelho efetivamente respondeu. Se a confirmação não chega (aparelho travou, macro morta pelo sistema, rede caiu — os mesmos cenários da retenção por claim não confirmada, ver acima), o doc fica `entregue` PARA SEMPRE e nada rearma. Isto não é um detalhe: é o que impede um ciclo quebrado de virar um laço infinito de envios REAIS para `numeroTeste` — sem esta regra, um aparelho travado com repetições pendentes ficaria mandando mensagem sozinho a cada vez que alguém acordasse a macro.

**Como o rearme funciona por dentro.** `injetarTeste` recebe `repeticoes` (1 a `REPETICOES_TESTE_MAX` = 10, omitido = 1) e grava `repeticoesTotal` (congelado, nunca muda entre rearmes) e `repeticoesRestantes = repeticoes - 1` (o ciclo recém-injetado já É o primeiro dos `repeticoesTotal`). Dentro da transação de `confirmarTeste`, se `repeticoesRestantes > 0`, a claim que acabou de confirmar NÃO fica gravada como `"confirmado"` — o doc vira direto o PRÓXIMO ciclo `"pendente"` (`proximoCiclo`): claim nova, `criadoEm`/`expiraEm` do zero (mesma validade de 15min de sempre), `repeticoesRestantes` decrementado, e nome/número/texto/print/`pulou` copiados do ciclo anterior (continuam congelados desde a injeção ORIGINAL — um rearme nunca remonta a mensagem nem relê o lead). A resposta desta chamada de `/confirmar` já carrega tudo que o aparelho precisa saber sobre a claim que ele confirmou; nada se perde por ela não ficar persistida como `"confirmado"`. Quando `repeticoesRestantes` chega a 0, a última confirmação segue o caminho de sempre e o doc fica `"confirmado"` — é a DÉCIMA (ou a N-ésima) volta que não rearma mais.

**A validade que já existia continua valendo, ciclo a ciclo.** Cada ciclo rearmado tem seu PRÓPRIO prazo de 15 minutos para ser puxado — a mesma regra "instante no passado = não existe" da tarefa de teste original, sem job de limpeza. Se um ciclo rearmado expira sem o aparelho puxar, as repetições que sobravam são CANCELADAS junto — mas isso também é lazy: `repeticoesRestantesEfetivas(doc, now)` (`lib/fila/estado.ts`, pura, ao lado de `testeExpirado`) devolve 0 sempre que a tarefa está `"pendente"` E expirada, mesmo que o campo CRU do doc ainda mostre um número maior. Nada reescreve o doc por causa da expiração — só a PRÓXIMA injeção o substitui — mas o painel já mostra 0 no mesmo instante em que passa a mostrar "Expirou", porque é essa função (não o campo cru) que a tela lê.

**Cancelar é mão única, e funciona com uma tarefa EM VOO.** `DELETE /api/fila/teste/repeticoes` (`cancelarRepeticoesTeste`) zera `repeticoesRestantes` e grava `repeticoesCanceladasEm` a qualquer momento — inclusive com o doc `"entregue"` (o aparelho já pegou a tarefa e ainda não confirmou): essa tarefa em voo segue seu curso normal e confirma como qualquer outra, só que a confirmação dela não vai mais rearmar, porque `confirmarTeste` lê `repeticoesRestantes` FRESCO dentro da mesma transação. Não há "re-armar" por esta rota — mesmo espírito de mão única da liberação de retidos (`DELETE /api/config/fila/retidos/{leadId}`). Sem teste nenhum, 404. Quando já não resta nada (zerou sozinho ou já foi cancelado), é idempotente e não sobrescreve um `repeticoesCanceladasEm` que já existia com uma segunda chamada — só grava a primeira vez, e SÓ quando de fato havia algo a cancelar. É essa distinção (`repeticoesCanceladasEm !== null`) que separa "terminou sozinho" (zerou, nunca cancelado) de "o operador interrompeu" na tela — os dois têm `repeticoesRestantes === 0`, mas só um foi uma decisão do operador.

**O teto é rígido: `REPETICOES_TESTE_MAX = 10`**, validado por `repeticoesValidas` (`lib/fila/teste.ts`) — inteiro entre 1 e 10, `undefined` no corpo vira 1 (o disparo de sempre), qualquer outra coisa (0, negativo, fracionário, acima do teto) é `400`. O campo é para operador distraído: sem teto, "50 repetições" seriam 50 mensagens reais saindo para `numeroTeste`. `numeroTeste` vazio continua impedindo o disparo, como já impedia — o auto-repeat não abre exceção nenhuma a essa checagem (ela roda na INJEÇÃO original; um rearme nunca dispara sem ela ter passado antes).

**Zero mudança de contrato.** `GET /api/fila/proximo` e `POST /api/fila/confirmar` não ganham chave nova, e nenhuma muda de nome, tipo ou presença — o rearme é inteiramente uma decisão de `filaTestes/atual`, invisível aos dois lados que o aparelho fala. Teste de contrato cobre isso mesmo NO MEIO de um rearme (não só nos casos sem repetição). As claims de teste continuam sem efeito colateral em qualquer ciclo: não movem status, não contam no dia, não giram rotação, não gravam selo — dez ciclos seguidos, zero rastro fora de `filaTestes/atual`.

**Na tela**, o campo "Repetições" (1 a 10) fica junto dos interruptores, com a nota explícita de que a macro pergunta a cada ~3 minutos e que **dez repetições podem levar até meia hora** — sem isso o operador cancela achando que travou. Enquanto restar repetição (e não tiver sido cancelado), o painel mostra "Faltam N de M repetições" e o botão "Cancelar repetições restantes"; ao cancelar, o aviso muda para "Repetições canceladas pelo operador". `--so=teste` cobre os três estados do campo (zerado, em andamento com N faltando, cancelado com uma tarefa em voo) em celular/desktop × claro/escuro.

### Os INTERRUPTORES e a escolha do lead

**O operador ESCOLHE o lead**, com o fixo de teste pré-selecionado. Não é "o próximo elegível" de propósito: aquele é justamente quem já passou por todos os filtros, e testá-lo não ensina nada. A funcionalidade existe para rodar um lead **específico** pelo pipeline — o que você jurava que devia estar saindo e não sai — e ver **onde ele para**.

`POST /api/fila/teste` avalia as quatro etapas na **ordem real** (ritmo → estruturais → nicho → janela, a mesma de `/proximo` e a mesma do funil da visão) e, quando barra, devolve a etapa **nominal** e o motivo dentro dela: `meta_atingida`, não "ritmo"; `status`, não "estruturais". Um lead que reprovaria em várias é reportado pela PRIMEIRA, como no diagnóstico — é a ordem que torna a resposta acionável. Cada etapa tem um interruptor; ligado, ela não barra aquele disparo.

**Duas etapas não têm interruptor**, de propósito:

- **`numero`** — `numeroTeste` vazio. Sem destino não há disparo, e cair num número padrão seria exatamente o acidente que a sobrescrita existe para evitar. É avaliada primeiro, porque não depende de lead nenhum.
- **`conteudo`** — sem demo, sem captura pronta ou sem `printUrl`. Os estruturais podem ser pulados para diagnóstico, **mas a tarefa só é injetada se houver o que enviar**: entregar tarefa sem print quebraria o ciclo no aparelho sem ensinar nada. Vem por ÚLTIMO, depois das quatro etapas, porque o produto principal é saber QUAL ETAPA barrou — só quando nenhuma barrou a pergunta vira "tem o que enviar?".

Barrar é resultado legítimo de um pedido válido (é o diagnóstico que a tela pediu), então vem em **200 com `injetada: false`**; 4xx fica para pedido malformado (leadId inexistente → 404, etapa que não existe → 400).

**Rota própria, e não mais um campo em `/api/fila/diagnostico`.** Aquela rota é o FUNIL, e as listas dela saem todas da mesma chamada de `ordenarCandidatos` de propósito. Esta tem outro ciclo de vida (recarrega ao injetar, não ao salvar a config) e é ESCRITA — misturar as duas faria o funil recalcular a cada clique no botão. `GET /api/fila/teste` devolve o estado que a tela desenha (destino, alvo padrão e se ele está pronto, a tarefa atual) e é quem chama `garantirLeadDeTeste`.

Como `/api/fila/diagnostico`, ela vive sob o prefixo `/api/fila/*` que o proxy isenta da sessão (é lá que o aparelho bate com a `RADAR_DEVICE_KEY`) e por isso faz a **própria checagem completa de sessão + papel** (`requireAdmin`). A `RADAR_DEVICE_KEY` não abre esta rota.

**Na tela:** destino, seletor de alvo (o fixo de teste, os leads que a visão ao lado já carregou — emprestados por callback, nunca por uma segunda chamada que recalcularia o funil — ou um id digitado à mão), os quatro interruptores na ordem de avaliação, o botão, o resultado do último clique e o estado da tarefa atual. A nota de que **a macro pergunta a cada ~3 minutos** fica explícita: sem ela o operador clica de novo achando que não funcionou, e clicar de novo só substitui a tarefa que está esperando.

**Verificação visual:** `node scripts/qa-plataforma.mjs --so=teste` captura o BLOCO (não a seção inteira, que já passa de 2000px e é capturada nos outros dois passos — ali este bloco sairia com 30px de altura) em seis estados × celular e desktop × temas escuro e claro: **pendente** com o tempo restante, **repetições em andamento** (pedidas 5, faltam 2, com o botão "Cancelar repetições restantes" visível), **repetições canceladas** (com uma tarefa AINDA em voo — `entregue`, sem confirmação — provando que ela segue o curso normal e só o rearme para), **barrado** (o clique de verdade, com a fila pausada, cobrando a etapa nominal na tarja), **confirmado** com o detalhe do aparelho e o rastro das etapas puladas, e **desligado** — sem `numeroTeste`, onde o bloco tem que DIZER "não configurado" em vez de oferecer um botão que só falharia, e onde o passo cobra que o painel ENCOLHA (−66px no celular, −50px no desktop). O terceiro estado do campo de repetições — **zerado** (nenhuma repetição pedida, campo no padrão) — é o próprio estado **pendente**: sem `repeticoesTotal > 1`, o badge de contagem/cancelamento simplesmente não aparece, e é essa ausência que a captura "pendente" já prova. O lead fixo entra na semeadura já pronto, e como ele carrega `leadDeTeste: true` nenhuma outra captura pode mostrá-lo: `--so=listas`, `--so=fila` e `--so=pendencias` continuarem passando é a prova visual do inventário. Duas correções saíram dessas capturas — os quatro interruptores ganharam caixa própria (no celular o que sobrava quebrava para debaixo do rótulo "Pular" em vez de alinhar com os irmãos), e o aferidor de "slot com caixa zerada", compartilhado com os outros dois passos, passou a ignorar `<option>`: ele não tem caixa própria (quem desenha a lista é o SO) e o texto aparece do mesmo jeito — o aferidor procura conteúdo INVISÍVEL, não conteúdo fora do fluxo do documento.

### Gerar a captura do lead fixo, sem sair do painel

**O problema não era a exclusão de `listLeads`** (correta, e não afrouxada — ver "O LEAD FIXO DE TESTE" acima): a ficha `/leads/radar-lead-teste` é alcançável por URL direta (`GET /api/leads/[id]` busca por `getLead`, não por `listLeads` — só quem lista é filtrado), o botão de captura de lá funcionaria (`enfileirarCapturas` não sabe o que é `leadDeTeste`, só olha `demo.skinId`), e o lead nasce **com demo** (`leadDeTesteInicial`). O problema era não haver ATALHO: a única forma de gerar a captura era abrir a ficha à parte, e o painel só linkava para lá quando `!pronto`, sem dizer POR QUE (enfileirada? falhou? nunca gerada?) nem deixar regenerar quando a captura envelhece.

**`POST /api/fila/teste/capturas`** fecha isso reusando `enfileirarCapturas` — o MESMO mecanismo de `POST /api/leads/[id]/capturas` e `POST /api/capturas` (marca o estado, dispara o `repository_dispatch`) — mas **admin-only**, diferente das outras duas (que aceitam qualquer sessão, porque gerar print ali é trabalho de prospecção). Aqui vive dentro do bloco "Fila de envio", que é admin do início ao fim, então segue a mesma checagem de `GET`/`POST /api/fila/teste` em vez de herdar a regra mais aberta da rota genérica. Corpo `{ forcar? }`, mesmo contrato de resposta (`enfileirados`/`pulados`/`execucaoId`).

**Na tela**, o sub-bloco `data-bloco="captura-teste"` (dentro de "Disparo de teste", acima do seletor de alvo) mostra o estado ATUAL sem clicar em nada — reusa `useEstadoCapturas` + `CapturaBadge`, os mesmos componentes da ficha, então os cinco estados (nunca/enfileirado/rodando/pronto/falhou) chegam de graça, com o mesmo relógio de "sem notícia" virando falha visível. O botão é **sempre re-disparável** (rótulo muda: "Gerar captura" → "Refazer" quando já há uma pronta, com aviso de que substitui; "Gerar de novo" enquanto em andamento, para destravar um run perdido). **Enquanto a captura está `enfileirado` ou `rodando`, "Disparar teste" fica desabilitado com o motivo visível** logo abaixo — só quando o alvo selecionado é o lead fixo (outro lead escolhido nos interruptores não depende desta captura); é a mesma regra que `avaliarTeste` já aplicava no servidor (etapa `conteudo`), só que agora visível ANTES do clique, não só como resultado de um clique barrado.

**Verificação visual:** o mesmo `--so=teste` cobre os cinco estados da captura (celular/desktop × escuro/claro) numa folha própria (`_folha-teste-captura.png`), separada da do disparo — perguntas diferentes ("o aparelho vai mandar?" vs. "por que o teste não injeta?"). Enfileirada e gerando também capturam o PAINEL INTEIRO (não só o sub-bloco), prova visual de que "Disparar teste" aparece cinza com o motivo, não só desabilitado no DOM sem ninguém ver.

## Proteção por sessão multiusuário (src/proxy.ts + lib/auth.ts + lib/usuarios)

Todo o app (páginas e API) exige sessão, exceto assets estáticos, a página `/login`, `POST /api/login`, a demo pública `/demo/{leadId}`, o gatilho do cron `GET /api/cron` (match exato; protegido por `CRON_SECRET` na própria rota — ver "Operação diária") e as rotas da fila de envio `/api/fila/*` (match por PREFIXO; protegidas por `RADAR_DEVICE_KEY` — ver "Fila de envio ao WhatsApp"). Como a demo, essas exceções ficam DEPOIS do check de `APP_PASSWORD` (fail-closed vale para elas igual). Fluxo:

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
| `scripts/qa-visual.mjs` | **camada decorativa das DEMOS** (rota pública das skins do registro, via o harness `/interno/demo-qa`) | efeito × intensidade × tema, estilos de LED, modos de cor, animação por seção, **variante × modo de cor** (`--so=variante`), cor da barra do navegador, fps no celular com CPU 4× (`--so=fps`, com `--skin=` para escolher a skin e, quando ela tem variantes, variante no eixo das linhas) e o portão de foto colapsada (`--so=colapso`). **Não conhece `/leads` nem `/buscas`** — não há tela da plataforma nele |
| `scripts/qa-plataforma.mjs` | **a PLATAFORMA autenticada** (as 7 abas do Radar) | tema × aba, contraste, legibilidade, custo do cromo, iridescência medida por matiz; em `--so=listas`, o portão de `/leads` e `/buscas` no celular (caixa zerada, colunas da grade, escada de densidade, nada vazando); e os painéis da /config que ficam abaixo da dobra e por isso têm passos próprios — `--so=pendencias` (lista de print), `--so=fila` (a visão: funil, próximos, bloqueados) e `--so=respostas` (respostas pendentes, que além do estado vazio cobra a AÇÃO mudando com o aparelho: intent do Business no Android, copiar no desktop), todos cobrando os ESTADOS VAZIOS |
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
RADAR_DEVICE_KEY=         # segredo do celular da fila de envio (/api/fila/*); NUNCA o mesmo do CRON_SECRET (raio de explosão diferente); sem ela a rota responde 503
RADAR_DEVICE_USER_ID=     # userId sob o qual as ações do celular são atribuídas (registro de autor)
```

Ver `.env.example`. Na Vercel, cadastrar todas em Project Settings → Environment Variables (a do Gemini só se quiser IA).

## Decisões tomadas

- **Proteção de acesso**: multiusuário simples sobre `/usuarios` (papéis admin/membro, PBKDF2) + cookie de sessão ASSINADO com `APP_PASSWORD` (ver seção acima). Sem Firebase Auth — a escala é um punhado de usuários de confiança e a autorização se resume a "admin vs membro".
- **Paginação do Text Search**: só a 1ª página (até 20 resultados). `nextPageToken` nem é lido.
- **Demo avulsa em coleção própria, não flag em `/leads`**: uma demo sem lead não é prospect e não pode entrar em contagem nenhuma do funil (metas, penetração, `/hoje`, `/leads`). Em `/demosAvulsas` isso vale por construção — nenhuma query de lead a alcança, hoje ou depois de qualquer refatoração; como flag, valeria só enquanto todo mundo lembrasse do filtro. O custo aceito é o adaptador `ClienteDemo` no editor e o alvo prefixado nas capturas (ver "Demos avulsas").
- **Re-enriquecimento**: não existe. Lead enriquecido retorna do cache sempre; um novo Place Details para o mesmo lead nunca é disparado.
- **Cotas por usuário vs. teto global**: o teto global (`/config/app.caps`) deixou de ser um limite absoluto de conta — desde as cotas individuais, ele é "vale pra todo mundo, menos admin". A trava absoluta de fatura passa a ser só a cota configurada no console do Google. Decisão deliberada (não um efeito colateral): ver "Cotas individuais por usuário".
- **Claim que expira em SILÊNCIO prende o lead, não o libera**: a regra central de `reservarLead` ("reserva expirada = livre") foi deliberadamente INVERTIDA por `retencaoEnvioHoras` (padrão 12h). Aquela existia para o lead não ficar preso quando o celular trava; depois de um lead receber a mesma mensagem duas vezes (503 no `/confirmar`, macro não repetiu, claim expirou, lead voltou ao pool), a leitura mudou: "o aparelho pegou e não disse o que houve" é mais provavelmente "mandou". A assimetria é o argumento — bloquear quem não recebeu custa um envio recuperável; liberar quem já recebeu manda duas vezes, e isso não tem volta. Falha REPORTADA continua fora da retenção (a política de 3 tentativas fica intacta): o que retém é o silêncio. Ver "Retenção por claim não confirmada".
- **A retenção não ganhou campo novo, e mora em DOIS portões**: a evidência já estava em `/filaEnvios` (`estado: "reservado"` = nunca confirmada; `expiraEm <= reservadoEm` = devolvida de propósito). E o filtro do pool sozinho não fecharia o furo — pool de 10 min contra claim de 5 min deixa ~4 minutos em que o cache ainda oferece o lead —, então quem impede a duplicata é `leadDisponivel`, na transação da reserva; o pool é pré-filtro. Ver "EM DOIS LUGARES" naquela seção.
- **Resposta automática com cota PRÓPRIA**: uma resposta enviada sozinha não consome `metaDiaria`, não respeita `intervaloMinimoSegundos` e não conta no `tetoPorHora` — ela tem `filaContadores.respostasEnviadas` e `respostasAutomaticasMaxDia` só para ela. Aqueles três portões existem para disfarçar disparo em rajada para quem NUNCA falou com você; responder quem te escreveu é outra coisa, e somar as duas faria uma noite movimentada de respostas comer a cota de prospecção do dia seguinte. Ver "Resposta automática".
