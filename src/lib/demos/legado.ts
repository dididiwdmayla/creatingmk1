/**
 * Defaults históricos de campos de identidade, por skin — snapshot dos
 * valores que `exemplo.ts` costumava ter em `telefone`/`whatsapp`/
 * `instagram`/`cidade`/`horarios`/`secoes.hero.titulo` antes desses campos
 * virarem "ausente fica ausente" (ver ARCHITECTURE.md, Forja de Demos).
 *
 * Demos salvas ANTES dessa mudança podem ter um desses valores persistido
 * em `LeadDemo.dados` como se fosse edição real do usuário — `montarDemoData`
 * ignora esse patch na leitura (trata como se o campo nunca tivesse sido
 * setado), pra não perpetuar pra sempre um texto de exemplo que nunca
 * identificou o negócio de verdade. NUNCA usado na escrita (PUT) — só
 * filtra o que já está salvo.
 */
export interface DefaultsHistoricos {
  telefone?: string;
  whatsapp?: string;
  instagram?: string;
  cidade?: string;
  horarios?: string;
  /** secoes.hero.titulo */
  heroTitulo?: string;
}

export const DEFAULTS_HISTORICOS: Record<string, DefaultsHistoricos> = {
  "barbearia-editorial": {
    telefone: "(00) 0000-0000",
    whatsapp: "(00) 90000-0000",
    instagram: "@suabarbearia",
    horarios: "Terça a sábado, 10h às 20h. Atendimento por agendamento.",
    heroTitulo: "OFÍCIO. TESOURA. NAVALHA.",
  },
  "barbearia2-sul": {
    telefone: "(00) 0000-0000",
    whatsapp: "(00) 90000-0000",
    instagram: "@suabarbearia",
    cidade: "Sua Cidade — UF",
    horarios: "SEG–SEX 9H–20H · SÁB 9H–18H · DOM FECHADO",
    heroTitulo: "BARBEARIA\n& SUL",
  },
  "tatuagem-editorial": {
    telefone: "(00) 0000-0000",
    whatsapp: "(00) 90000-0000",
    instagram: "@ossea.studio",
    cidade: "Maringá - PR",
    horarios: "Terça a sábado, 13h às 21h. Atendimento por agendamento.",
    heroTitulo: "ÓSSEA STUDIO",
  },
  "tatuagem-pigmento-vivo": {
    telefone: "(00) 0000-0000",
    whatsapp: "(00) 90000-0000",
    instagram: "@matiz.studio",
    cidade: "Curitiba - PR",
    horarios: "Terça a sábado, 11h às 20h. Atendimento por agendamento.",
    heroTitulo: "Sua história,\nnossa tinta.",
  },
  "lancheria-chapa-burger": {
    telefone: "(00) 0000-0000",
    whatsapp: "(00) 90000-0000",
    instagram: "@sualancheria",
    cidade: "Sua Cidade — Seu Estado",
    horarios: "Terça a domingo, 18h às 23h",
    heroTitulo: "CHAPA BURGER",
  },
  "imobiliaria-curada": {
    telefone: "(00) 0000-0000",
    whatsapp: "(00) 90000-0000",
    instagram: "@suaimobiliaria",
    cidade: "Sua Cidade — UF",
    horarios: "Seg–Sex · 9h às 19h · Sáb · 9h às 14h",
    heroTitulo: "Morar bem é uma arte.",
  },
  "multimarcas-vortice": {
    telefone: "(00) 0000-0000",
    whatsapp: "(00) 90000-0000",
    instagram: "@suamultimarcas",
    cidade: "Sua Cidade — Seu Estado",
    horarios: "Seg–Sex 9h às 19h · Sáb 9h às 16h",
    heroTitulo: "Seu próximo carro já está aqui",
  },
  "petshop-focinho-feliz": {
    telefone: "(00) 3456-7890",
    whatsapp: "(00) 90000-0000",
    instagram: "@seupetshop",
    cidade: "Sua Cidade — Seu Estado",
    horarios: "Seg a Sex · 8h às 19h · Sáb · 8h às 17h",
    heroTitulo: "Seu pet merece o melhor dia da semana.",
  },
};
