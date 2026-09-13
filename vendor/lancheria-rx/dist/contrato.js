// temas/meia-noite.ts
var meia_noite_default = {
  slug: "meia-noite",
  nome: "Meia-Noite",
  fundo: "escuro",
  cores: { base: "#120D0B", superficie: "#1C1512", traco: "#33251E", texto: "#E9E0D3", quente: "#A9762F", frio: "#A8C6D4" },
  fontes: { display: "Fraunces", corpo: "Archivo", medida: "IBM Plex Mono" },
  raio: 2,
  densidade: "media",
  assinatura: "letreiro",
  mascote: true,
  filtroInicial: "primeira-forma",
  abrirComposicao: "nenhuma",
  cardapio: "editorial",
  intro: true,
  hero: "chapa",
  adicionarIcone: true,
  rotulos: { modificar: "Modificar lanche", modificarCurto: "Modificar" },
  movimento: { grade: true, transicaoMs: null, captura: true },
  medida: { fallback: "monospace", numerais: "tabular-nums" },
  folhaFontes: "/fontes/meia-noite.css"
};

// temas/diner.ts
var diner_default = {
  slug: "diner",
  nome: "Diner",
  fundo: "claro",
  cores: { base: "#EAF4F8", superficie: "#FFFBF2", traco: "#9AA7AE", texto: "#1E2A30", quente: "#D2312B", frio: "#5B7C8D" },
  fontes: { display: "Alfa Slab One", corpo: "Work Sans", medida: "Space Mono" },
  raio: 4,
  densidade: "media",
  assinatura: "placa-de-porta",
  mascote: true,
  filtroInicial: "todos",
  abrirComposicao: "pela-foto",
  cardapio: "painel",
  intro: false,
  hero: "balcao",
  adicionarIcone: false,
  rotulos: { modificar: "Modificar lanche", modificarCurto: "Modificar" },
  movimento: { grade: true, transicaoMs: null, captura: true },
  medida: { fallback: "monospace", numerais: "tabular-nums" },
  folhaFontes: "/fontes/diner.css"
};

// temas/pratico.ts
var pratico_default = {
  slug: "pratico",
  nome: "Pr\xE1tico",
  fundo: "claro",
  cores: { base: "#FFFFFF", superficie: "#F4F4F5", traco: "#E0E0E2", texto: "#18181B", quente: "#E23744", frio: "#6B7280" },
  fontes: { display: "Inter", corpo: "Inter", medida: "Inter" },
  raio: 12,
  densidade: "apertada",
  assinatura: "nenhuma",
  mascote: false,
  filtroInicial: "primeira-forma",
  abrirComposicao: "nenhuma",
  cardapio: "lista",
  intro: false,
  hero: "nenhum",
  adicionarIcone: true,
  rotulos: { modificar: "Personalizar", modificarCurto: "Personalizar" },
  movimento: { grade: false, transicaoMs: 120, captura: false },
  medida: { fallback: "sans-serif", numerais: "tabular-nums" },
  folhaFontes: "/fontes/pratico.css"
};

// temas/cantina.ts
var cantina_default = {
  slug: "cantina",
  nome: "Cantina",
  fundo: "claro",
  cores: { base: "#F2EDE3", superficie: "#E8E0D2", traco: "#C4B79E", texto: "#26211C", quente: "#B6553B", frio: "#3E5240" },
  fontes: { display: "Playfair Display", corpo: "Lora", medida: "Lora" },
  raio: 2,
  densidade: "solta",
  assinatura: "toldo",
  mascote: false,
  filtroInicial: "primeira-forma",
  abrirComposicao: "nenhuma",
  cardapio: "folha",
  intro: false,
  hero: "menu",
  adicionarIcone: true,
  rotulos: { modificar: "Modificar lanche", modificarCurto: "Modificar" },
  movimento: { grade: true, transicaoMs: null, captura: true },
  medida: { fallback: "serif", numerais: "oldstyle-nums proportional-nums" },
  folhaFontes: "/fontes/cantina.css"
};

// temas/index.ts
var TEMAS = [meia_noite_default, diner_default, pratico_default, cantina_default];
var TEMA = meia_noite_default;
function selecionarTema(slug) {
  return TEMAS.find((tema) => tema.slug === slug) ?? TEMA;
}
function estiloTema(tema) {
  return {
    "--borra": tema.cores.base,
    "--fumo": tema.cores.superficie,
    "--traco": tema.cores.traco,
    "--osso": tema.cores.texto,
    "--latao": tema.cores.quente,
    "--letreiro": tema.cores.frio,
    "--fonte-display": `"${tema.fontes.display}"`,
    "--fonte-corpo": `"${tema.fontes.corpo}"`,
    "--fonte-medida": `"${tema.fontes.medida}", ${tema.medida.fallback}`,
    "--raio": `${tema.raio}px`,
    "--numerais": tema.medida.numerais,
    colorScheme: tema.fundo === "claro" ? "light" : "dark"
  };
}

// data/camadas.ts
var CAMADAS = [
  { slug: "pao-base", arquivo: "camadas/pao-base.webp", ficha: "/fichas/pao-base.webp", nome: "P\xE3o de baixo", alt: "Metade de baixo do p\xE3o redondo, vista de lado", alturaPx: 285, afundamento: 0, precoCent: 0, ordem: 1, obrigatorio: true, pao: "redondo" },
  { slug: "pao-prensado-base", arquivo: "camadas/pao-prensado-base.webp", ficha: "/fichas/pao-prensado-base.webp", nome: "P\xE3o de baixo", alt: "Metade de baixo do p\xE3o do prensado, marcada na chapa", alturaPx: 307, afundamento: 0, precoCent: 0, ordem: 1, obrigatorio: true, pao: "prensado" },
  { slug: "molho", arquivo: "camadas/molho.webp", ficha: "/fichas/molho.webp", nome: "Molho", alt: "Faixa de molho da casa passada no p\xE3o", alturaPx: 108, afundamento: 0.92, precoCent: 200, ordem: 2, obrigatorio: false },
  { slug: "alface", arquivo: "camadas/alface.webp", ficha: "/fichas/alface.webp", nome: "Alface", alt: "Folhas de alface crespa", alturaPx: 467, afundamento: 0.55, precoCent: 150, ordem: 3, obrigatorio: false },
  { slug: "tomate", arquivo: "camadas/tomate.webp", ficha: "/fichas/tomate.webp", nome: "Tomate", alt: "Rodelas de tomate vistas de lado", alturaPx: 139, afundamento: 0.4, precoCent: 200, ordem: 4, obrigatorio: false },
  { slug: "cebola", arquivo: "camadas/cebola.webp", ficha: "/fichas/cebola.webp", nome: "Cebola", alt: "Cebola caramelizada em tiras", alturaPx: 399, afundamento: 0.55, precoCent: 350, ordem: 5, obrigatorio: false },
  { slug: "carne", arquivo: "camadas/carne.webp", ficha: "/fichas/carne.webp", nome: "Carne", alt: "Hamb\xFArguer selado na chapa", alturaPx: 381, afundamento: 0.42, precoCent: 900, ordem: 6, obrigatorio: false, firme: true },
  { slug: "calabresa", arquivo: "camadas/calabresa.webp", ficha: "/fichas/calabresa.webp", nome: "Calabresa", alt: "Calabresa em rodelas marcadas na chapa", alturaPx: 224, afundamento: 0.5, precoCent: 500, ordem: 6.2, obrigatorio: false },
  { slug: "salsicha", arquivo: "camadas/salsicha.webp", ficha: "/fichas/salsicha.webp", nome: "Salsicha", alt: "Duas salsichas abertas ao meio", alturaPx: 330, afundamento: 0.5, precoCent: 450, ordem: 6.3, obrigatorio: false },
  { slug: "frango-desfiado", arquivo: "camadas/frango-desfiado.webp", ficha: "/fichas/frango-desfiado.webp", nome: "Frango", alt: "Frango desfiado na maionese temperada", alturaPx: 296, afundamento: 0.45, precoCent: 800, ordem: 6.4, obrigatorio: false },
  { slug: "milho", arquivo: "camadas/milho.webp", ficha: "/fichas/milho.webp", nome: "Milho", alt: "Camada de milho verde", alturaPx: 202, afundamento: 0.5, precoCent: 250, ordem: 6.8, obrigatorio: false },
  { slug: "queijo", arquivo: "camadas/queijo.webp", ficha: "/fichas/queijo.webp", nome: "Queijo", alt: "Fatia de queijo derretendo", alturaPx: 420, afundamento: 0.62, precoCent: 400, ordem: 7, obrigatorio: false },
  { slug: "presunto", arquivo: "camadas/presunto.webp", ficha: "/fichas/presunto.webp", nome: "Presunto", alt: "Fatia de presunto dobrada", alturaPx: 416, afundamento: 0.58, precoCent: 450, ordem: 8, obrigatorio: false },
  { slug: "bacon", arquivo: "camadas/bacon.webp", ficha: "/fichas/bacon.webp", nome: "Bacon", alt: "Duas fatias de bacon frito", alturaPx: 305, afundamento: 0.48, precoCent: 700, ordem: 9, obrigatorio: false },
  { slug: "ovo", arquivo: "camadas/ovo.webp", ficha: "/fichas/ovo.webp", nome: "Ovo", alt: "Ovo frito com gema inteira", alturaPx: 301, afundamento: 0.42, precoCent: 400, ordem: 10, obrigatorio: false },
  { slug: "queijo-ralado", arquivo: "camadas/queijo-ralado.webp", ficha: "/fichas/queijo-ralado.webp", nome: "Queijo ralado", alt: "Camada de queijo ralado grosso", alturaPx: 261, afundamento: 0.55, precoCent: 400, ordem: 10.5, obrigatorio: false },
  { slug: "batata-palha", arquivo: "camadas/batata-palha.webp", ficha: "/fichas/batata-palha.webp", nome: "Batata palha", alt: "Punhado de batata palha", alturaPx: 323, afundamento: 0.52, precoCent: 300, ordem: 11, obrigatorio: false },
  { slug: "pao-topo", arquivo: "camadas/pao-topo.webp", ficha: "/fichas/pao-topo.webp", nome: "P\xE3o de cima", alt: "Metade de cima do p\xE3o redondo com gergelim", alturaPx: 456, afundamento: 0.3, precoCent: 0, ordem: 12, obrigatorio: true, pao: "redondo" },
  { slug: "pao-prensado-topo", arquivo: "camadas/pao-prensado-topo.webp", ficha: "/fichas/pao-prensado-topo.webp", nome: "P\xE3o de cima", alt: "Metade de cima do p\xE3o do prensado, marcada na chapa", alturaPx: 315, afundamento: 0.3, precoCent: 0, ordem: 12, obrigatorio: true, pao: "prensado" }
];
var MAPA_CAMADAS = Object.fromEntries(
  CAMADAS.map((c) => [c.slug, c])
);

// data/casa.ts
var CASA = {
  nome: "Lancheria Meia-Noite",
  cidade: "Maring\xE1, PR",
  endereco: "Rua Exemplo, 000 \u2014 Zona 7",
  telefone: "(44) 98457-0105",
  whatsapp: "5544984570105",
  fuso: "America/Sao_Paulo",
  abre: 18,
  // hora local da casa
  fecha: 4,
  // hora local da casa, no dia seguinte
  pagamento: ["Dinheiro", "Pix", "D\xE9bito", "Cr\xE9dito"]
};
var PRECO_BASE_CENT = 1200;
var MAX_REPETICOES = 3;
var MAX_CAMADAS = 16;

// data/fixos.ts
var FIXOS = [
  { slug: "prensado-completo", essenciais: ["pao-prensado-base", "pao-prensado-topo", "carne"], nome: "Prensado Completo", forma: "prensado", camadas: ["pao-prensado-base", "alface", "tomate", "carne", "bacon", "calabresa", "milho", "queijo-ralado", "batata-palha", "pao-prensado-topo"] },
  { slug: "prensado-frango", essenciais: ["pao-prensado-base", "pao-prensado-topo", "frango-desfiado"], nome: "Prensado de Frango", forma: "prensado", camadas: ["pao-prensado-base", "alface", "tomate", "frango-desfiado", "milho", "queijo-ralado", "pao-prensado-topo"] },
  { slug: "prensado-calabresa", essenciais: ["pao-prensado-base", "pao-prensado-topo", "calabresa"], nome: "Prensado de Calabresa", forma: "prensado", camadas: ["pao-prensado-base", "alface", "calabresa", "cebola", "queijo-ralado", "pao-prensado-topo"] },
  { slug: "prensado-meia-noite", essenciais: ["pao-prensado-base", "pao-prensado-topo", "carne"], nome: "Prensado Meia-Noite", forma: "prensado", camadas: ["pao-prensado-base", "tomate", "carne", "bacon", "ovo", "queijo-ralado", "batata-palha", "pao-prensado-topo"] },
  { slug: "x-salada", essenciais: ["pao-base", "pao-topo", "carne"], nome: "X-Salada", forma: "redondo", camadas: ["pao-base", "alface", "tomate", "carne", "queijo", "pao-topo"] },
  { slug: "x-tudo", essenciais: ["pao-base", "pao-topo", "carne"], nome: "X-Tudo", forma: "redondo", camadas: ["pao-base", "molho", "alface", "tomate", "carne", "presunto", "queijo", "bacon", "ovo", "batata-palha", "pao-topo"] }
];
var EXTRAS = [
  { slug: "refri", nome: "Refrigerante lata", grupo: "bebida", precoCent: 700, icone: "" },
  { slug: "guarana", nome: "Guaran\xE1", grupo: "bebida", precoCent: 1200, icone: "" },
  { slug: "suco-laranja", nome: "Suco de laranja", grupo: "bebida", precoCent: 1e3, icone: "" },
  { slug: "agua", nome: "\xC1gua", grupo: "bebida", precoCent: 400, icone: "" },
  { slug: "milkshake", nome: "Milkshake", grupo: "bebida", precoCent: 1600, icone: "" },
  { slug: "batata-frita", nome: "Batata frita", grupo: "acompanhamento", precoCent: 1800, icone: "" },
  { slug: "batata-cheddar", nome: "Batata com cheddar e bacon", grupo: "acompanhamento", precoCent: 2600, icone: "" },
  { slug: "aneis-cebola", nome: "An\xE9is de cebola", grupo: "acompanhamento", precoCent: 2e3, icone: "" }
];
var MAPA_FIXOS = Object.fromEntries(FIXOS.map((f) => [f.slug, f]));

// data/negocio.ts
var TEXTOS_CASA = {
  chapa: {
    registro: "",
    categoria: "Lancheria",
    heroTitulo: "A noite pede\num prensado.",
    heroDescricao: "P\xE3o na chapa. Recheio no lugar.",
    heroFoto: "/chapa/chapa-selagem.webp",
    heroAlt: "Prensado fechando na chapa",
    historiaTitulo: "Antes do prato,\num carrinho.",
    historia: ["O prensado nasceu em Maring\xE1, dentro de um carrinho de lanches. Algu\xE9m instalou uma prensa na chapa e passou a fechar o p\xE3o sobre o recheio.", "Os concorrentes copiaram. Virou prato t\xEDpico da cidade e saiu do estado."],
    carimbo: "MARING\xC1 / P\xC3O / CHAPA / PRENSA",
    rodape: ""
  },
  balcao: {
    registro: "Lancheria de esquina",
    categoria: "Lancheria",
    heroTitulo: "Da esquina. Da chapa.",
    heroDescricao: "",
    heroFoto: "/fixos/prensado-meia-noite.webp",
    heroAlt: "Prensado Meia-Noite",
    historiaTitulo: "Antes do prato,\num carrinho.",
    historia: ["O prensado nasceu em Maring\xE1, dentro de um carrinho de lanches. Algu\xE9m instalou uma prensa na chapa e passou a fechar o p\xE3o sobre o recheio.", "Os concorrentes copiaram. Virou prato t\xEDpico da cidade e saiu do estado."],
    carimbo: "MARING\xC1 / P\xC3O / CHAPA / PRENSA",
    rodape: ""
  },
  menu: {
    registro: "",
    categoria: "Sanduicheria",
    heroTitulo: "P\xE3o, recheio e boa mesa.",
    heroDescricao: "O prensado da casa. Desde o primeiro p\xE3o.",
    heroFoto: "",
    heroAlt: "",
    historiaTitulo: "Antes do prato,\num carrinho.",
    historia: ["O prensado nasceu em Maring\xE1, dentro de um carrinho de lanches. Algu\xE9m instalou uma prensa na chapa e passou a fechar o p\xE3o sobre o recheio.", "Os concorrentes copiaram. Virou prato t\xEDpico da cidade e saiu do estado."],
    carimbo: "MARING\xC1 / P\xC3O / CHAPA / PRENSA",
    rodape: "Da chapa para a mesa."
  },
  nenhum: {
    registro: "",
    categoria: "Lancheria",
    heroTitulo: "",
    heroDescricao: "",
    heroFoto: "",
    heroAlt: "",
    historiaTitulo: "Antes do prato,\num carrinho.",
    historia: ["O prensado nasceu em Maring\xE1, dentro de um carrinho de lanches. Algu\xE9m instalou uma prensa na chapa e passou a fechar o p\xE3o sobre o recheio.", "Os concorrentes copiaram. Virou prato t\xEDpico da cidade e saiu do estado."],
    carimbo: "MARING\xC1 / P\xC3O / CHAPA / PRENSA",
    rodape: ""
  }
};
var DADOS_EXEMPLO = {
  casa: { ...CASA, marca: "Meia-Noite", abre: `${String(CASA.abre).padStart(2, "0")}:00`, fecha: `${String(CASA.fecha).padStart(2, "0")}:00`, pagamento: [...CASA.pagamento] },
  precoBaseCent: PRECO_BASE_CENT,
  ingredientes: CAMADAS.map(({ slug, nome, precoCent }) => ({ slug, nome, precoCent })),
  lanches: FIXOS.map((f) => ({ ...f, precoCent: PRECO_BASE_CENT + f.camadas.reduce((s, c) => s + MAPA_CAMADAS[c].precoCent, 0), foto: `/fixos/${f.slug}.webp` })),
  extras: EXTRAS,
  textos: TEXTOS_CASA.chapa
};
function exemploLancheria(hero) {
  return structuredClone({ ...DADOS_EXEMPLO, textos: TEXTOS_CASA[hero] });
}
function validarDadosLancheria(valor) {
  const erros = [];
  const objeto = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const chaves = (v, permitidas, path) => Object.keys(v).forEach((k) => {
    if (!permitidas.includes(k)) erros.push(`${path}.${k}: campo n\xE3o permitido`);
  });
  const texto = (v, path, vazio = false) => {
    if (typeof v !== "string" || v.length > 5e3 || !vazio && !v.trim()) erros.push(`${path}: texto inv\xE1lido`);
  };
  const cent = (v, path) => {
    if (!Number.isSafeInteger(v) || Number(v) < 0 || Number(v) > 1e7) erros.push(`${path}: centavos inv\xE1lidos`);
  };
  if (!objeto(valor)) return ["lancheria: objeto obrigat\xF3rio"];
  chaves(valor, ["casa", "precoBaseCent", "ingredientes", "lanches", "extras", "textos"], "lancheria");
  if (!objeto(valor.casa)) erros.push("casa: objeto obrigat\xF3rio");
  else {
    const c = valor.casa;
    chaves(c, ["nome", "marca", "cidade", "endereco", "telefone", "whatsapp", "fuso", "abre", "fecha", "pagamento", "horarioConfirmado", "horarioTexto", "instagram"], "casa");
    for (const k of ["nome", "marca", "cidade", "endereco", "telefone", "whatsapp", "fuso", "abre", "fecha"]) texto(c[k], `casa.${k}`, !["nome", "marca", "fuso", "abre", "fecha"].includes(k));
    if (c.horarioConfirmado !== void 0 && typeof c.horarioConfirmado !== "boolean") erros.push("casa.horarioConfirmado: booleano obrigat\xF3rio");
    for (const k of ["horarioTexto", "instagram"]) if (c[k] !== void 0) texto(c[k], `casa.${k}`, true);
    for (const k of ["abre", "fecha"]) if (typeof c[k] !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c[k])) erros.push(`casa.${k}: use HH:mm`);
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: String(c.fuso) });
    } catch {
      erros.push("casa.fuso: inv\xE1lido");
    }
    if (c.whatsapp && !/^\d{8,15}$/.test(String(c.whatsapp))) erros.push("casa.whatsapp: use apenas d\xEDgitos com c\xF3digo do pa\xEDs");
    if (!Array.isArray(c.pagamento) || !c.pagamento.length || c.pagamento.length > 12) erros.push("casa.pagamento: lista inv\xE1lida");
    else c.pagamento.forEach((p, i) => texto(p, `casa.pagamento[${i}]`));
  }
  cent(valor.precoBaseCent, "precoBaseCent");
  const ids = /* @__PURE__ */ new Set();
  if (!Array.isArray(valor.ingredientes) || valor.ingredientes.length > CAMADAS.length) erros.push("ingredientes: lista do acervo calibrado obrigat\xF3ria");
  else for (const [i, v] of valor.ingredientes.entries()) {
    if (!objeto(v)) {
      erros.push(`ingredientes[${i}]: objeto inv\xE1lido`);
      continue;
    }
    chaves(v, ["slug", "nome", "precoCent"], `ingredientes[${i}]`);
    if (typeof v.slug !== "string" || !Object.hasOwn(MAPA_CAMADAS, v.slug)) erros.push(`ingredientes[${i}]: camada sem asset calibrado`);
    else {
      if (ids.has(v.slug)) erros.push(`ingredientes[${i}]: slug repetido`);
      ids.add(v.slug);
    }
    texto(v.nome, `ingredientes[${i}].nome`);
    cent(v.precoCent, `ingredientes[${i}].precoCent`);
  }
  for (const c of CAMADAS.filter((c2) => c2.pao)) if (!ids.has(c.slug)) erros.push(`ingredientes: falta o p\xE3o ${c.slug}`);
  const slugs = /* @__PURE__ */ new Set();
  if (!Array.isArray(valor.lanches) || !valor.lanches.length || valor.lanches.length > 60) erros.push("lanches: informe de 1 a 60 receitas");
  else for (const [i, v] of valor.lanches.entries()) {
    if (!objeto(v)) {
      erros.push(`lanches[${i}]: objeto inv\xE1lido`);
      continue;
    }
    chaves(v, ["slug", "nome", "forma", "camadas", "essenciais", "precoCent", "foto"], `lanches[${i}]`);
    if (typeof v.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug) || slugs.has(v.slug)) erros.push(`lanches[${i}].slug: inv\xE1lido ou repetido`);
    slugs.add(String(v.slug));
    texto(v.nome, `lanches[${i}].nome`);
    cent(v.precoCent, `lanches[${i}].precoCent`);
    if (!["prensado", "redondo"].includes(String(v.forma))) erros.push(`lanches[${i}].forma: inv\xE1lida`);
    if (typeof v.foto !== "string" || !/^\/fixos\/[a-z0-9-]+\.webp$/.test(v.foto) || !FIXOS.some((f) => `/fixos/${f.slug}.webp` === v.foto)) erros.push(`lanches[${i}].foto: escolha uma fotografia do acervo`);
    const cam = v.camadas;
    if (!Array.isArray(cam) || cam.length < 2 || cam.length > MAX_CAMADAS || cam.some((s) => typeof s !== "string" || !ids.has(s))) {
      erros.push(`lanches[${i}].camadas: composi\xE7\xE3o inv\xE1lida`);
      continue;
    }
    const paes = CAMADAS.filter((c) => c.pao === v.forma).sort((a, b) => a.ordem - b.ordem);
    if (cam[0] !== paes[0]?.slug || cam.at(-1) !== paes.at(-1)?.slug || cam.filter((s) => MAPA_CAMADAS[s]?.pao).length !== 2) erros.push(`lanches[${i}]: p\xE3es devem estar nas extremidades`);
    if (cam.some((s) => cam.filter((c) => c === s).length > MAX_REPETICOES)) erros.push(`lanches[${i}]: ingrediente acima do limite de repeti\xE7\xF5es`);
    if (cam.some((s, n) => s === "molho" && n !== 1 && n !== cam.length - 2)) erros.push(`lanches[${i}]: molho deve ficar junto ao p\xE3o`);
    if (!Array.isArray(v.essenciais) || v.essenciais.some((s) => !cam.includes(s))) erros.push(`lanches[${i}].essenciais: ingrediente fora da receita`);
  }
  const extrasSlugs = /* @__PURE__ */ new Set();
  if (!Array.isArray(valor.extras) || valor.extras.length > 60) erros.push("extras: lista inv\xE1lida");
  else for (const [i, v] of valor.extras.entries()) {
    if (!objeto(v)) {
      erros.push(`extras[${i}]: objeto inv\xE1lido`);
      continue;
    }
    chaves(v, ["slug", "nome", "grupo", "precoCent", "icone"], `extras[${i}]`);
    if (typeof v.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug) || extrasSlugs.has(v.slug)) erros.push(`extras[${i}].slug: inv\xE1lido ou repetido`);
    extrasSlugs.add(String(v.slug));
    texto(v.slug, `extras[${i}].slug`);
    texto(v.nome, `extras[${i}].nome`);
    cent(v.precoCent, `extras[${i}].precoCent`);
    if (!["bebida", "acompanhamento"].includes(String(v.grupo)) || v.icone !== "") erros.push(`extras[${i}]: grupo ou \xEDcone inv\xE1lido`);
  }
  if (!objeto(valor.textos)) erros.push("textos: objeto obrigat\xF3rio");
  else {
    chaves(valor.textos, Object.keys(TEXTOS_CASA.chapa), "textos");
    for (const k of Object.keys(TEXTOS_CASA.chapa)) {
      const v = valor.textos[k];
      if (k === "historia") {
        if (!Array.isArray(v) || v.some((t) => typeof t !== "string")) erros.push("textos.historia: lista inv\xE1lida");
      } else texto(v, `textos.${k}`, true);
    }
  }
  return erros;
}

// lib/precos.ts
function brl(centavos) {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}
function diferencaCamadas(atual, original) {
  const saldo = original.slice();
  const acrescentadas = atual.filter((slug) => {
    const i = saldo.indexOf(slug);
    if (i < 0) return true;
    saldo.splice(i, 1);
    return false;
  });
  return { acrescentadas, removidas: saldo };
}
function criarPrecos(dados) {
  const MAPA_CAMADAS2 = Object.fromEntries(dados.ingredientes.map((c) => [c.slug, { ...MAPA_CAMADAS[c.slug], slug: c.slug, nome: c.nome, precoCent: c.precoCent }]));
  const MAPA_FIXOS2 = Object.fromEntries(dados.lanches.map((f) => [f.slug, f]));
  const PRECO_BASE_CENT2 = dados.precoBaseCent;
  function precoDaComposicao2(slugs) {
    if (!slugs.length) return 0;
    return slugs.filter((s) => MAPA_CAMADAS2[s]).reduce((soma, s) => soma + MAPA_CAMADAS2[s].precoCent, PRECO_BASE_CENT2);
  }
  function precoDoFixo2(f) {
    return f.precoCent ?? precoDaComposicao2(f.camadas);
  }
  function precoDoLanche2(camadas, fixoSlug) {
    const fixo = fixoSlug ? MAPA_FIXOS2[fixoSlug] : void 0;
    if (!fixo) return precoDaComposicao2(camadas);
    return precoDoFixo2(fixo) + diferencaCamadas(camadas, fixo.camadas).acrescentadas.reduce((total, slug) => total + (MAPA_CAMADAS2[slug]?.precoCent ?? 0), 0);
  }
  function camadaFixa2(slug, fixoSlug) {
    return !!MAPA_CAMADAS2[slug]?.obrigatorio || !!(fixoSlug && MAPA_FIXOS2[fixoSlug]?.essenciais.includes(slug));
  }
  return { precoDaComposicao: precoDaComposicao2, precoDoFixo: precoDoFixo2, precoDoLanche: precoDoLanche2, camadaFixa: camadaFixa2 };
}
var { precoDaComposicao, precoDoFixo, precoDoLanche, camadaFixa } = criarPrecos(DADOS_EXEMPLO);

// lib/pedido.ts
var totalPedido = (pedido) => pedido.reduce((s, p) => s + p.cent * p.qtd, 0);
function criarPedido(dadosCasa) {
  const CASA2 = dadosCasa.casa;
  const MAPA_CAMADAS2 = Object.fromEntries(dadosCasa.ingredientes.map((c) => [c.slug, { ...MAPA_CAMADAS[c.slug], slug: c.slug, nome: c.nome, precoCent: c.precoCent }]));
  const MAPA_FIXOS2 = Object.fromEntries(dadosCasa.lanches.map((f) => [f.slug, f]));
  const EXTRAS2 = dadosCasa.extras;
  const { precoDoLanche: precoDoLanche2 } = criarPrecos(dadosCasa);
  const resumoCamadas2 = (camadas) => camadas.filter((s) => !MAPA_CAMADAS2[s].pao).map((s) => MAPA_CAMADAS2[s].nome).join(", ") || "S\xF3 o p\xE3o";
  function itemLanche2(lanche) {
    const fixo = lanche.fixoSlug ? MAPA_FIXOS2[lanche.fixoSlug] : void 0;
    const observacao = (lanche.observacao ?? "").trim().slice(0, 120);
    return {
      ...lanche,
      observacao,
      chave: JSON.stringify([lanche.fixoSlug ?? "montado", lanche.forma, lanche.camadas, observacao]),
      cent: precoDoLanche2(lanche.camadas, lanche.fixoSlug),
      resumo: resumoCamadas2(lanche.camadas),
      grupo: "lanche",
      foto: fixo?.foto ?? `/fixos/${lanche.forma === "prensado" ? "prensado-completo" : "x-salada"}.webp`
    };
  }
  function itemFixo2(f) {
    return itemLanche2({ nome: f.nome, forma: f.forma, camadas: f.camadas.slice(), fixoSlug: f.slug, chave: "", resumo: "", cent: 0 });
  }
  function itemExtra2(e) {
    return {
      chave: `extra:${e.slug}`,
      nome: e.nome,
      forma: "prensado",
      camadas: [],
      resumo: e.grupo === "bebida" ? "Bebida" : "Acompanhamento",
      cent: e.precoCent,
      grupo: e.grupo,
      foto: ""
    };
  }
  function ganchoDoPedido2(pedido, vistos, dispensados) {
    const lanches = pedido.filter((p) => p.grupo === "lanche");
    if (!lanches.length) return null;
    const candidatos = [];
    if (EXTRAS2.some((e) => e.grupo === "bebida") && !pedido.some((p) => p.grupo === "bebida")) candidatos.push({ id: "bebida", texto: "Sem bebida?", extra: EXTRAS2.find((e) => e.grupo === "bebida") });
    if (EXTRAS2.some((e) => e.grupo === "acompanhamento") && lanches.reduce((s, p) => s + p.qtd, 0) >= 2 && !pedido.some((p) => p.grupo === "acompanhamento")) {
      candidatos.push({ id: "batata", texto: "Dois lanches, nenhum acompanhamento.", extra: EXTRAS2.find((e) => e.grupo === "acompanhamento") });
    }
    const semBacon = lanches.find((p) => p.forma === "prensado" && !p.camadas.includes("bacon") && p.camadas.length < MAX_CAMADAS);
    if (semBacon && MAPA_CAMADAS2.bacon) candidatos.push({ id: "bacon", texto: `${semBacon.nome} sem bacon.`, pedidoId: semBacon.id });
    return candidatos.find((g) => !dispensados.includes(g.id) && (vistos.includes(g.id) || vistos.length < 2)) ?? null;
  }
  function comBacon2(camadas) {
    if (!MAPA_CAMADAS2.bacon || camadas.includes("bacon") || camadas.length >= MAX_CAMADAS) return camadas.slice();
    const novo = camadas.slice();
    let i = novo.findIndex((s, n) => n > 0 && !MAPA_CAMADAS2[s].pao && MAPA_CAMADAS2[s].ordem > MAPA_CAMADAS2.bacon.ordem);
    if (i < 0) i = novo.length - 1;
    if (novo[i - 1] === "molho" && i > 1) i--;
    novo.splice(i, 0, "bacon");
    return novo;
  }
  function validarConfirmacao2(dados) {
    const erros = {};
    if (!dados.nome.trim()) erros.nome = "Falta o nome";
    if (dados.recebimento === "entrega" && !dados.endereco.trim()) erros.endereco = "Falta o endere\xE7o";
    if (!CASA2.pagamento.some((p) => p === dados.pagamento)) erros.pagamento = "Falta a forma de pagamento";
    if (dados.pagamento === "Dinheiro" && dados.troco.trim() && !/^\d+(?:[,.]\d{1,2})?$/.test(dados.troco.trim())) erros.troco = "Confira o valor do troco";
    return erros;
  }
  const umaLinha = (texto) => texto.trim().replace(/\s+/g, " ");
  function resumoPedido2(pedido, dados) {
    const linhas = [`Pedido \u2014 ${CASA2.nome}`, ""];
    for (const p of pedido) {
      linhas.push(`${p.qtd}\xD7 ${p.nome} \u2014 ${brl(p.cent * p.qtd)}`);
      if (p.grupo === "lanche") {
        const original = p.fixoSlug ? MAPA_FIXOS2[p.fixoSlug]?.camadas ?? [] : [];
        const { acrescentadas, removidas } = diferencaCamadas(p.camadas, original);
        if (p.fixoSlug) {
          for (const s of acrescentadas) linhas.push(`   + ${MAPA_CAMADAS2[s].nome.toLowerCase()}`);
          for (const s of removidas) linhas.push(`   \u2212 ${MAPA_CAMADAS2[s].nome.toLowerCase()}`);
        } else linhas.push(`   ${resumoCamadas2(p.camadas)}`);
      }
      if (p.observacao?.trim()) linhas.push(`   obs: ${umaLinha(p.observacao)}`);
      linhas.push("");
    }
    linhas.push(`Total: ${brl(totalPedido(pedido))}`);
    if (dados) {
      linhas.push(
        "",
        `Nome: ${umaLinha(dados.nome)}`,
        dados.recebimento === "entrega" ? `Entrega: ${[dados.endereco, dados.complemento].map(umaLinha).filter(Boolean).join(", ")}` : "Retirada no balc\xE3o",
        `Pagamento: ${dados.pagamento}${dados.pagamento === "Dinheiro" && dados.troco.trim() ? ` (troco para ${brl(Math.round(Number(dados.troco.replace(",", ".")) * 100))})` : ""}`
      );
      if (dados.observacao.trim()) linhas.push(`Obs: ${umaLinha(dados.observacao)}`);
    }
    return linhas.join("\n");
  }
  function urlWhatsApp2(pedido, dados) {
    return `https://wa.me/${CASA2.whatsapp}?text=${encodeURIComponent(resumoPedido2(pedido, dados))}`;
  }
  return { resumoCamadas: resumoCamadas2, itemLanche: itemLanche2, itemFixo: itemFixo2, itemExtra: itemExtra2, ganchoDoPedido: ganchoDoPedido2, comBacon: comBacon2, validarConfirmacao: validarConfirmacao2, resumoPedido: resumoPedido2, urlWhatsApp: urlWhatsApp2 };
}
var { resumoCamadas, itemLanche, itemFixo, itemExtra, ganchoDoPedido, comBacon, validarConfirmacao, resumoPedido, urlWhatsApp } = criarPedido(DADOS_EXEMPLO);

// lib/horario.ts
var minutos = (hora) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};
var horaLegivel = (hora) => {
  const [h, m] = hora.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
};
var faixaHorario = (casa) => casa.horarioConfirmado === false ? casa.horarioTexto || "Hor\xE1rio n\xE3o informado." : `Todos os dias, das ${horaLegivel(casa.abre)} \xE0s ${horaLegivel(casa.fecha)}.`;
function horarioDaCasa(agora = /* @__PURE__ */ new Date(), casa = DADOS_EXEMPLO.casa) {
  if (casa.horarioConfirmado === false) return { aberto: null, ultimos: false, texto: faixaHorario(casa) };
  const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: casa.fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(agora);
  const m = Number(partes.find((p) => p.type === "hour")?.value) * 60 + Number(partes.find((p) => p.type === "minute")?.value);
  const abre = minutos(casa.abre), fecha = minutos(casa.fecha);
  const aberto = abre === fecha || (abre > fecha ? m >= abre || m <= fecha : m >= abre && m <= fecha);
  const ultimos = aberto && (fecha - m + 1440) % 1440 <= 30;
  return { aberto, ultimos, texto: !aberto ? `Fechada. Abre ${abre < fecha && m > fecha ? "amanh\xE3" : "hoje"} \xE0s ${horaLegivel(casa.abre)}.` : ultimos ? "Aberto. \xDAltimos pedidos." : `Aberto. A chapa vai at\xE9 as ${horaLegivel(casa.fecha)}.` };
}
export {
  DADOS_EXEMPLO,
  TEMA,
  TEMAS,
  criarPedido,
  criarPrecos,
  estiloTema,
  exemploLancheria,
  faixaHorario,
  horaLegivel,
  horarioDaCasa,
  selecionarTema,
  validarDadosLancheria
};
