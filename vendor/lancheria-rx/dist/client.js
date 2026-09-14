"use client";
"use client";

// components/TemaAtivo.tsx
import { createContext, useContext } from "react";

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
  heroFoto: true,
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

// temas/index.ts
var TEMA = meia_noite_default;
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

// components/TemaAtivo.tsx
import { jsx } from "react/jsx-runtime";
var TemaAtivo = createContext(TEMA);
var useTema = () => useContext(TemaAtivo);
function ProvedorTema({ tema, children }) {
  return /* @__PURE__ */ jsx(TemaAtivo.Provider, { value: tema, children });
}

// components/NegocioAtivo.tsx
import { createContext as createContext2, useContext as useContext2, useMemo } from "react";

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
function urlCamada(c) {
  return `/${c.arquivo}`;
}

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
var LIMIAR_AVISO_CAMADAS = 10;
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
    historiaFoto: "/chapa/chapa-vazia.webp",
    historiaAlt: "Chapa de ferro vazia, pronta para o pr\xF3ximo lanche",
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
    historiaFoto: "/chapa/chapa-vazia.webp",
    historiaAlt: "Chapa de ferro vazia, pronta para o pr\xF3ximo lanche",
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
    historiaFoto: "/chapa/chapa-vazia.webp",
    historiaAlt: "Chapa de ferro vazia, pronta para o pr\xF3ximo lanche",
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
    historiaFoto: "/chapa/chapa-vazia.webp",
    historiaAlt: "Chapa de ferro vazia, pronta para o pr\xF3ximo lanche",
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

// lib/precos.ts
function brl(centavos) {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}
function diferencaCamadas(atual2, original) {
  const saldo = original.slice();
  const acrescentadas = atual2.filter((slug) => {
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
var CONFIRMACAO_INICIAL = {
  nome: "",
  recebimento: "retirada",
  endereco: "",
  complemento: "",
  pagamento: "",
  troco: "",
  observacao: ""
};
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

// components/NegocioAtivo.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
function criarNegocio(dados) {
  const CAMADAS2 = dados.ingredientes.map((c) => ({ ...CAMADAS.find((f) => f.slug === c.slug), slug: c.slug, nome: c.nome, precoCent: c.precoCent }));
  return {
    dados,
    CASA: dados.casa,
    CAMADAS: CAMADAS2,
    MAPA_CAMADAS: Object.fromEntries(CAMADAS2.map((c) => [c.slug, c])),
    FIXOS: dados.lanches,
    EXTRAS: dados.extras,
    ...criarPrecos(dados),
    ...criarPedido(dados)
  };
}
var NegocioAtivo = createContext2(criarNegocio(DADOS_EXEMPLO));
var useNegocio = () => useContext2(NegocioAtivo);
function ProvedorNegocio({ dados, children }) {
  const negocio = useMemo(() => criarNegocio(dados), [dados]);
  return /* @__PURE__ */ jsx2(NegocioAtivo.Provider, { value: negocio, children });
}

// components/pedido/Balcao.tsx
import { useCallback as useCallback3, useEffect as useEffect10, useRef as useRef11, useState as useState9 } from "react";

// components/letreiro/Letreiro.tsx
import { useLayoutEffect, useRef as useRef2, useState } from "react";

// lib/motion.ts
function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
var pausas = /* @__PURE__ */ new Set();
var ouvintes = /* @__PURE__ */ new Set();
var movimentoPausado = () => pausas.size > 0;
function observarPausa(ouvinte) {
  ouvintes.add(ouvinte);
  ouvinte(movimentoPausado());
  return () => {
    ouvintes.delete(ouvinte);
  };
}
function pausarMovimento() {
  const chave = /* @__PURE__ */ Symbol();
  pausas.add(chave);
  document.documentElement.dataset.movimentoPausado = "1";
  ouvintes.forEach((fn) => fn(true));
  return () => {
    if (!pausas.delete(chave) || pausas.size) return;
    delete document.documentElement.dataset.movimentoPausado;
    ouvintes.forEach((fn) => fn(false));
  };
}

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

// lib/marca.ts
function linhasMarca(marca) {
  const palavras = marca.replace(/-/g, " ").trim().split(/\s+/);
  const corte = Math.ceil(palavras.length / 2);
  return [palavras.slice(0, corte).join(" "), palavras.slice(corte).join(" ")];
}

// components/letreiro/Mascote.tsx
import { createContext as createContext3, useContext as useContext3, useEffect, useRef } from "react";
import { jsx as jsx3, jsxs } from "react/jsx-runtime";
var RaioXAberto = createContext3(false);
var PESO = 0.085;
var DESVIO_MAX = 6.2;
var ALCANCE = 300;
var ACHATA_Y = 0.72;
var RETOMA_MS = 1100;
var FIXA_MIN = 1500;
var FIXA_MAX = 3300;
var CHANCE_ESPECTADOR = 0.3;
var CHANCE_SAIDA = 0.14;
var PISCA_MS = 130;
var PISCA_MIN = 2700;
var PISCA_MAX = 7300;
var CHANCE_DUPLA = 0.18;
var ANTECIPA_DESLIZE = 110;
var ALVOS_PLAUSIVEIS = [
  "[data-abrir-carrinho]",
  "[data-barra-pedido] [data-preco]",
  ".lanche-card [data-preco]",
  ".lanche-card .botao-quente",
  "#intro-pular",
  "#carrinho-fechar",
  "[data-carrinho] .botao-quente"
].join(", ");
var inscritos = /* @__PURE__ */ new Set();
var laco = 0;
var alvo = null;
var ultimoPonteiro = -Infinity;
var trocaEm = 0;
var medidoEm = -Infinity;
var ultimoQuadro = 0;
var piscaInicio = -1;
var proximaPisca = 0;
var encadeadas = 0;
var ultimoToque = null;
var sorte = (a, b) => a + Math.random() * (b - a);
function medirTudo() {
  for (const r of inscritos) {
    r.centros = r.soquetes.map((s, i) => {
      if (!s) return { x: 0, y: 0 };
      const matriz = s.getScreenCTM();
      r.angulos[i] = matriz ? Math.atan2(matriz.b, matriz.a) : 0;
      const c = s.getBoundingClientRect();
      return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
    });
  }
}
function visivel(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
}
function escolherRepouso() {
  if (Math.random() < CHANCE_ESPECTADOR) {
    alvo = null;
    return;
  }
  if (Math.random() < CHANCE_SAIDA) {
    alvo = { x: Math.random() < 0.5 ? -60 : window.innerWidth + 60, y: sorte(0.2, 0.8) * window.innerHeight };
    return;
  }
  const candidatos = [...document.querySelectorAll(ALVOS_PLAUSIVEIS)].filter(visivel);
  if (!candidatos.length) {
    alvo = null;
    return;
  }
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = candidatos[Math.floor(Math.random() * candidatos.length)].getBoundingClientRect();
    const p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (!alvo || Math.hypot(p.x - alvo.x, p.y - alvo.y) > 60) {
      alvo = p;
      return;
    }
  }
}
function aberturaDoOlho(t) {
  if (piscaInicio < 0) {
    if (!proximaPisca) proximaPisca = t + sorte(PISCA_MIN, PISCA_MAX);
    if (t < proximaPisca) return 1;
    piscaInicio = t;
    encadeadas = Math.random() < CHANCE_DUPLA ? 1 : 0;
  }
  const u = (t - piscaInicio) / PISCA_MS;
  if (u >= 1) {
    piscaInicio = -1;
    if (encadeadas > 0) {
      encadeadas--;
      proximaPisca = t + 95;
    } else {
      proximaPisca = t + sorte(PISCA_MIN, PISCA_MAX);
    }
    return 1;
  }
  return Math.max(0.07, Math.abs(u * 2 - 1));
}
function desvioDesejado(centro) {
  if (!alvo) return { x: 0, y: 0 };
  const dx = alvo.x - centro.x;
  const dy = (alvo.y - centro.y) * ACHATA_Y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return { x: 0, y: 0 };
  const k = Math.min(1, d / ALCANCE) ** 0.6;
  return { x: dx / d * DESVIO_MAX * k, y: dy / d * DESVIO_MAX * k };
}
function quadro(t) {
  const dt = Math.min(50, t - ultimoQuadro || 16.7);
  ultimoQuadro = t;
  const f = 1 - (1 - PESO) ** (dt / 16.7);
  if (t - medidoEm > 400) {
    medirTudo();
    medidoEm = t;
  }
  if (t - ultimoPonteiro > RETOMA_MS && t > trocaEm) {
    escolherRepouso();
    trocaEm = t + sorte(FIXA_MIN, FIXA_MAX);
  }
  const abertura = aberturaDoOlho(t);
  for (const r of inscritos) {
    for (let i = 0; i < r.centros.length; i++) {
      const mundo = desvioDesejado(r.centros[i]);
      const a = r.angulos[i];
      const querido = { x: Math.cos(a) * mundo.x + Math.sin(a) * mundo.y, y: -Math.sin(a) * mundo.x + Math.cos(a) * mundo.y };
      const atual2 = r.atuais[i];
      atual2.x += (querido.x - atual2.x) * f;
      atual2.y += (querido.y - atual2.y) * f;
      r.pupilas[i]?.setAttribute("transform", `translate(${atual2.x.toFixed(2)} ${atual2.y.toFixed(2)})`);
      const interno = r.internos[i];
      if (interno) {
        const cy = OLHOS[i]?.cy ?? 0;
        interno.setAttribute("transform", `translate(0 ${(cy * (1 - abertura)).toFixed(2)}) scale(1 ${abertura.toFixed(3)})`);
      }
    }
  }
  laco = requestAnimationFrame(quadro);
}
function aoPonteiro(e) {
  ultimoPonteiro = performance.now();
  const p = { x: e.clientX, y: e.clientY };
  if (e.pointerType === "mouse") {
    alvo = p;
    ultimoToque = null;
    return;
  }
  const agora = performance.now();
  if (ultimoToque && agora - ultimoToque.t > 0 && agora - ultimoToque.t < 120) {
    const dt = agora - ultimoToque.t;
    const vx = (p.x - ultimoToque.p.x) / dt;
    const vy = (p.y - ultimoToque.p.y) / dt;
    alvo = { x: p.x + vx * ANTECIPA_DESLIZE, y: p.y + vy * ANTECIPA_DESLIZE };
  } else {
    alvo = p;
  }
  ultimoToque = { p, t: agora };
}
function ligar() {
  window.addEventListener("pointermove", aoPonteiro, { passive: true });
  window.addEventListener("pointerdown", aoPonteiro, { passive: true });
  const remedir = () => {
    medidoEm = -Infinity;
  };
  window.addEventListener("scroll", remedir, { passive: true, capture: true });
  window.addEventListener("resize", remedir, { passive: true });
  ultimoQuadro = 0;
  medidoEm = -Infinity;
  proximaPisca = performance.now() + sorte(PISCA_MIN, PISCA_MAX);
  piscaInicio = -1;
  laco = requestAnimationFrame(quadro);
  return () => {
    window.removeEventListener("pointermove", aoPonteiro);
    window.removeEventListener("pointerdown", aoPonteiro);
    window.removeEventListener("scroll", remedir, true);
    window.removeEventListener("resize", remedir);
    cancelAnimationFrame(laco);
    laco = 0;
  };
}
var desligar = null;
function useOlhar(qtd, ativo) {
  const reg = useRef({
    soquetes: Array(qtd).fill(null),
    pupilas: Array(qtd).fill(null),
    internos: Array(qtd).fill(null),
    angulos: Array(qtd).fill(0),
    centros: Array.from({ length: qtd }, () => ({ x: 0, y: 0 })),
    atuais: Array.from({ length: qtd }, () => ({ x: 0, y: 0 }))
  });
  useEffect(() => {
    const r = reg.current;
    const soquete = r.soquetes.find(Boolean);
    if (!ativo || !soquete) return;
    let emTela = false;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
    const retirar = () => {
      inscritos.delete(r);
      if (!inscritos.size && desligar) {
        desligar();
        desligar = null;
      }
    };
    const sincronizar = () => {
      if (reduzido.matches) {
        r.pupilas.forEach((p) => p?.removeAttribute("transform"));
        r.internos.forEach((p) => p?.removeAttribute("transform"));
        r.atuais.forEach((p) => {
          p.x = 0;
          p.y = 0;
        });
      }
      if (!emTela || document.hidden || reduzido.matches || movimentoPausado()) {
        retirar();
        return;
      }
      inscritos.add(r);
      if (!desligar) desligar = ligar();
    };
    const io = new IntersectionObserver(([entrada]) => {
      emTela = entrada.isIntersecting;
      sincronizar();
    });
    io.observe(soquete);
    const pararObservacao = observarPausa(sincronizar);
    reduzido.addEventListener("change", sincronizar);
    document.addEventListener("visibilitychange", sincronizar);
    return () => {
      io.disconnect();
      pararObservacao();
      reduzido.removeEventListener("change", sincronizar);
      document.removeEventListener("visibilitychange", sincronizar);
      retirar();
    };
  }, [ativo]);
  return reg;
}
var OLHOS = [
  { cx: 88, cy: 68 },
  { cx: 152, cy: 66 }
];
var amendoa = (cx, cy, rx, ry) => `M${cx - rx} ${cy} C${cx - rx + 4} ${cy - ry - 2} ${cx + rx - 4} ${cy - ry - 2} ${cx + rx} ${cy} C${cx + rx - 5} ${cy + ry} ${cx - rx + 5} ${cy + ry} ${cx - rx} ${cy} Z`;
function DesenhoMascote({ transform, olharAtivo = true }) {
  const tema = useTema();
  const aberto = useContext3(RaioXAberto) || !tema.mascote;
  const reg = useOlhar(OLHOS.length, !aberto && olharAtivo);
  if (aberto) return null;
  return /* @__PURE__ */ jsx3("g", { "data-mascote": true, transform, "aria-hidden": "true", style: { pointerEvents: "none", ...tema.fundo === "claro" ? { "--osso": tema.cores.superficie, "--borra": tema.cores.texto } : {} }, children: /* @__PURE__ */ jsxs("g", { transform: "rotate(-1.4 120 104)", children: [
    /* @__PURE__ */ jsx3("path", { d: "M28 156 L212 156 C221 163 219 182 203 188 C159 195 81 195 37 188 C21 182 19 163 28 156 Z", fill: "var(--latao)" }),
    /* @__PURE__ */ jsx3("path", { d: "M24 130 L216 130 C219 146 208 158 188 159 L52 159 C32 158 21 146 24 130 Z", fill: "var(--latao)" }),
    /* @__PURE__ */ jsxs("g", { fill: "none", stroke: "var(--traco)", strokeLinecap: "round", children: [
      /* @__PURE__ */ jsx3("path", { d: "M24 131 L216 131 C219 146 208 158 188 159 L52 159 C32 158 21 146 24 131", strokeWidth: "3.2" }),
      /* @__PURE__ */ jsx3("path", { d: "M58 146 l36 0", strokeWidth: "3.6" }),
      /* @__PURE__ */ jsx3("path", { d: "M148 144 l34 0", strokeWidth: "3.2" })
    ] }),
    /* @__PURE__ */ jsx3(
      "path",
      {
        d: "M15 102 L226 102 L226 120 C211 132 199 118 185 126 C170 135 159 121 144 129 C129 137 117 122 103 130 C88 138 75 123 61 130 C47 137 28 124 15 126 Z",
        fill: "var(--osso)"
      }
    ),
    /* @__PURE__ */ jsx3("path", { "data-mascote-cabeca": true, d: "M20 106 C22 56 64 22 120 21 C176 20 218 55 220 106 C178 112 62 113 20 106 Z", fill: "var(--latao)" }),
    /* @__PURE__ */ jsxs("g", { stroke: "var(--osso)", strokeWidth: "5.5", strokeLinecap: "round", fill: "none", children: [
      /* @__PURE__ */ jsx3("path", { d: "M70 50 l11 -7" }),
      /* @__PURE__ */ jsx3("path", { d: "M115 38 l12 -2" }),
      /* @__PURE__ */ jsx3("path", { d: "M159 48 l10 7" })
    ] }),
    /* @__PURE__ */ jsx3(
      "path",
      {
        d: "M25 98 C29 55 68 25 120 24 C170 23 211 53 215 95",
        fill: "none",
        stroke: "var(--traco)",
        strokeWidth: "3.6",
        strokeLinecap: "round"
      }
    ),
    /* @__PURE__ */ jsx3("path", { d: "M110 92 C117 98 128 98 134 90", fill: "none", stroke: "var(--traco)", strokeWidth: "3.4", strokeLinecap: "round" }),
    OLHOS.map((o, i) => /* @__PURE__ */ jsx3("g", { ref: (el) => {
      reg.current.soquetes[i] = el;
    }, children: /* @__PURE__ */ jsxs("g", { ref: (el) => {
      reg.current.internos[i] = el;
    }, children: [
      /* @__PURE__ */ jsx3("path", { d: amendoa(o.cx, o.cy, 17 - i, 13), fill: "var(--osso)" }),
      /* @__PURE__ */ jsx3("g", { "data-pupila": i, ref: (el) => {
        reg.current.pupilas[i] = el;
      }, children: /* @__PURE__ */ jsx3("circle", { cx: o.cx, cy: o.cy + 1, r: "6", fill: "var(--borra)" }) })
    ] }) }, i))
  ] }) });
}
function Mascote({ largura = 168, className }) {
  const aberto = useContext3(RaioXAberto) || !useTema().mascote;
  if (aberto) return null;
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className,
      viewBox: "0 0 300 248",
      width: largura,
      height: largura * 248 / 300,
      role: "img",
      "aria-label": "Tabuleta pintada da casa",
      style: { display: "block", transform: "rotate(-.6deg)" },
      children: [
        /* @__PURE__ */ jsx3("rect", { x: "4", y: "4", width: "292", height: "240", rx: "3", fill: "var(--fumo)", stroke: "var(--traco)", strokeWidth: "2" }),
        /* @__PURE__ */ jsx3("rect", { x: "14", y: "14", width: "272", height: "220", rx: "2", fill: "var(--borra)", stroke: "var(--traco)" }),
        /* @__PURE__ */ jsx3(DesenhoMascote, { transform: "translate(34 26)" })
      ]
    }
  );
}

// components/letreiro/sequencia.ts
var CHAVE_SESSAO = "lm:letreiro-aceso";
var TREMOR_GRUPOS = [
  { id: "lt-tremor", duracaoS: 4, atrasoS: -1.2 },
  { id: "lt-tubo-a", duracaoS: 4.3, atrasoS: -2.6 },
  { id: "lt-tubo-b", duracaoS: 3.7, atrasoS: -0.4 },
  { id: "lt-texto", duracaoS: 4.6, atrasoS: -3.1 }
];
var DURACAO_IGNICAO_MS = 800;
var DURACAO_ENTRADA_MS = 420;
var DURACAO_TOTAL_MS = DURACAO_IGNICAO_MS + DURACAO_ENTRADA_MS;
var SCRIPT_ENTRADA = `(function(){
  var raiz=document.documentElement, inicio=performance.now(), pronta=false;
  raiz.setAttribute('data-lt-inicio',String(inicio));
  try{pronta=sessionStorage.getItem('${CHAVE_SESSAO}')==='1'}catch(e){}
  pronta=pronta||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function concluir(){
    raiz.setAttribute('data-lt-aceso','1');
    try{sessionStorage.setItem('${CHAVE_SESSAO}','1')}catch(e){}
  }
  if(pronta) concluir();
  else window.setTimeout(concluir,${DURACAO_TOTAL_MS});
})();`;

// components/letreiro/LetreiroSvg.tsx
import { jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var tremorPorId = Object.fromEntries(TREMOR_GRUPOS.map((g) => [g.id, g]));
function animacaoTremor(id) {
  const g = tremorPorId[id];
  return { animation: `lt-tremor ${g.duracaoS}s linear infinite`, animationDelay: `${g.atrasoS}s` };
}
var arestaDoCorte = {
  fill: "none",
  stroke: "var(--traco)",
  strokeWidth: 1.5,
  strokeOpacity: 1
};
var fonteLetreiro = {
  fontFamily: "var(--fonte-display), Georgia, serif",
  fontSize: "260px",
  fontVariationSettings: "'opsz' 144, 'wght' 900, 'SOFT' 12, 'WONK' 1",
  textAnchor: "middle"
};
function LetreiroSvg() {
  const { CASA: CASA2 } = useNegocio();
  const [linha1, linha2] = linhasMarca(CASA2.marca);
  return /* @__PURE__ */ jsxs2(
    "svg",
    {
      id: "lt-svg",
      viewBox: "0 0 1000 1210",
      role: "img",
      "aria-label": `Letreiro de ${CASA2.nome}. Das ${horaLegivel(CASA2.abre)} \xE0s ${horaLegivel(CASA2.fecha)}.`,
      style: { width: "100%", height: "auto", display: "block" },
      children: [
        /* @__PURE__ */ jsxs2("defs", { children: [
          /* @__PURE__ */ jsxs2("radialGradient", { id: "lt-luz", cx: "50%", cy: "47%", r: "70%", children: [
            /* @__PURE__ */ jsx4("stop", { offset: "0%", stopColor: "var(--letreiro)", stopOpacity: "0.98" }),
            /* @__PURE__ */ jsx4("stop", { offset: "55%", stopColor: "var(--letreiro)", stopOpacity: "0.93" }),
            /* @__PURE__ */ jsx4("stop", { offset: "100%", stopColor: "var(--letreiro)", stopOpacity: "0.82" })
          ] }),
          /* @__PURE__ */ jsxs2(
            "radialGradient",
            {
              id: "lt-luz-face",
              cx: "50%",
              cy: "47%",
              r: "62%",
              gradientTransform: "translate(0.5 0.5) scale(1 0.80) translate(-0.5 -0.5)",
              children: [
                /* @__PURE__ */ jsx4("stop", { offset: "0%", stopColor: "var(--letreiro)", stopOpacity: "0.90" }),
                /* @__PURE__ */ jsx4("stop", { offset: "45%", stopColor: "var(--letreiro)", stopOpacity: "0.54" }),
                /* @__PURE__ */ jsx4("stop", { offset: "78%", stopColor: "var(--letreiro)", stopOpacity: "0.20" }),
                /* @__PURE__ */ jsx4("stop", { offset: "100%", stopColor: "var(--letreiro)", stopOpacity: "0.02" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs2("linearGradient", { id: "lt-tubo-luz", x1: "0", y1: "0", x2: "0", y2: "1", children: [
            /* @__PURE__ */ jsx4("stop", { offset: "0%", stopColor: "var(--letreiro)", stopOpacity: "0" }),
            /* @__PURE__ */ jsx4("stop", { offset: "50%", stopColor: "var(--letreiro)", stopOpacity: "1" }),
            /* @__PURE__ */ jsx4("stop", { offset: "100%", stopColor: "var(--letreiro)", stopOpacity: "0" })
          ] }),
          /* @__PURE__ */ jsx4("mask", { id: "lt-recorte-acrilico", maskUnits: "userSpaceOnUse", x: "86", y: "66", width: "828", height: "628", children: /* @__PURE__ */ jsxs2("g", { style: fonteLetreiro, children: [
            /* @__PURE__ */ jsx4("text", { x: "500", y: "360", textLength: "660", lengthAdjust: "spacingAndGlyphs", fill: "#ffffff", children: linha1.toUpperCase() }),
            /* @__PURE__ */ jsx4("text", { x: "500", y: "620", textLength: "660", lengthAdjust: "spacingAndGlyphs", fill: "#ffffff", children: linha2.toUpperCase() })
          ] }) }),
          /* @__PURE__ */ jsx4("mask", { id: "lt-recorte-bloom", maskUnits: "userSpaceOnUse", x: "60", y: "40", width: "880", height: "680", children: /* @__PURE__ */ jsxs2(
            "g",
            {
              transform: "translate(500 490) scale(1.015) translate(-500 -490)",
              style: fonteLetreiro,
              children: [
                /* @__PURE__ */ jsx4("text", { x: "500", y: "360", textLength: "660", lengthAdjust: "spacingAndGlyphs", fill: "#575757", children: linha1.toUpperCase() }),
                /* @__PURE__ */ jsx4("text", { x: "500", y: "620", textLength: "660", lengthAdjust: "spacingAndGlyphs", fill: "#575757", children: linha2.toUpperCase() })
              ]
            }
          ) }),
          /* @__PURE__ */ jsxs2(
            "radialGradient",
            {
              id: "lt-vinheta",
              cx: "50%",
              cy: "50%",
              r: "58%",
              gradientTransform: "translate(0.5 0.5) scale(1 0.78) translate(-0.5 -0.5)",
              children: [
                /* @__PURE__ */ jsx4("stop", { offset: "0%", stopColor: "var(--borra)", stopOpacity: "0" }),
                /* @__PURE__ */ jsx4("stop", { offset: "62%", stopColor: "var(--borra)", stopOpacity: "0" }),
                /* @__PURE__ */ jsx4("stop", { offset: "100%", stopColor: "var(--borra)", stopOpacity: "0.92" })
              ]
            }
          ),
          /* @__PURE__ */ jsx4("clipPath", { id: "lt-recorte-painel", children: /* @__PURE__ */ jsx4("rect", { x: "86", y: "66", width: "828", height: "628", rx: "3" }) })
        ] }),
        /* @__PURE__ */ jsxs2("g", { transform: "rotate(-0.4 500 400)", children: [
          /* @__PURE__ */ jsxs2("g", { id: "lt-caixa", children: [
            /* @__PURE__ */ jsx4("rect", { x: "60", y: "40", width: "880", height: "680", rx: "4", fill: "var(--fumo)", stroke: "var(--traco)", strokeWidth: "2" }),
            /* @__PURE__ */ jsx4("path", { d: "M938 42 L938 718", stroke: "var(--traco)", strokeWidth: "5" }),
            /* @__PURE__ */ jsx4("rect", { x: "86", y: "66", width: "828", height: "628", rx: "3", fill: "var(--borra)", stroke: "var(--traco)", strokeWidth: "1" }),
            /* @__PURE__ */ jsx4("path", { d: "M120 720 L120 766 M880 720 L880 766", stroke: "var(--traco)", strokeWidth: "2" })
          ] }),
          /* @__PURE__ */ jsxs2("g", { id: "lt-tabuleta", children: [
            /* @__PURE__ */ jsx4("rect", { x: "60", y: "764", width: "880", height: "430", rx: "4", fill: "var(--fumo)", stroke: "var(--traco)", strokeWidth: "2" }),
            /* @__PURE__ */ jsx4("rect", { x: "84", y: "786", width: "832", height: "386", rx: "2", fill: "var(--borra)", stroke: "var(--traco)" }),
            /* @__PURE__ */ jsx4(DesenhoMascote, { transform: "translate(60 784) scale(2.04)" }),
            /* @__PURE__ */ jsxs2(
              "g",
              {
                fill: "var(--osso)",
                textAnchor: "middle",
                style: {
                  fontFamily: "var(--fonte-display), Georgia, serif",
                  fontSize: "96px",
                  fontVariationSettings: "'opsz' 96, 'wght' 820, 'SOFT' 14, 'WONK' 1"
                },
                children: [
                  /* @__PURE__ */ jsx4("text", { x: "752", y: "944", textLength: "300", lengthAdjust: "spacingAndGlyphs", children: CASA2.horarioConfirmado === false ? "HOR\xC1RIO" : `DAS ${horaLegivel(CASA2.abre).toUpperCase()}` }),
                  /* @__PURE__ */ jsx4("text", { x: "752", y: "1046", textLength: "234", lengthAdjust: "spacingAndGlyphs", children: CASA2.horarioConfirmado === false ? "NA CASA" : `\xC0S ${horaLegivel(CASA2.fecha).toUpperCase()}` })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs2("g", { id: "lt-tremor", style: animacaoTremor("lt-tremor"), children: [
            /* @__PURE__ */ jsxs2(
              "g",
              {
                id: "lt-halo",
                clipPath: "url(#lt-recorte-painel)",
                "aria-hidden": "true",
                children: [
                  /* @__PURE__ */ jsx4("rect", { x: "86", y: "66", width: "828", height: "628", fill: "url(#lt-luz-face)", style: { opacity: 0.42 } }),
                  /* @__PURE__ */ jsx4("g", { id: "lt-tubo-a", style: animacaoTremor("lt-tubo-a"), children: /* @__PURE__ */ jsx4("rect", { x: "86", y: "112", width: "828", height: "220", fill: "url(#lt-tubo-luz)", style: { opacity: 0.26 } }) }),
                  /* @__PURE__ */ jsx4("g", { id: "lt-tubo-b", style: animacaoTremor("lt-tubo-b"), children: /* @__PURE__ */ jsx4("rect", { x: "86", y: "424", width: "828", height: "220", fill: "url(#lt-tubo-luz)", style: { opacity: 0.244 } }) }),
                  /* @__PURE__ */ jsx4("rect", { x: "86", y: "66", width: "828", height: "628", fill: "url(#lt-vinheta)" })
                ]
              }
            ),
            /* @__PURE__ */ jsxs2("g", { "aria-hidden": "true", style: fonteLetreiro, children: [
              /* @__PURE__ */ jsx4(
                "text",
                {
                  x: "500",
                  y: "360",
                  textLength: "660",
                  lengthAdjust: "spacingAndGlyphs",
                  fill: "#171110",
                  stroke: "var(--traco)",
                  strokeWidth: "1.5",
                  children: linha1.toUpperCase()
                }
              ),
              /* @__PURE__ */ jsx4(
                "text",
                {
                  x: "500",
                  y: "620",
                  textLength: "660",
                  lengthAdjust: "spacingAndGlyphs",
                  fill: "#171110",
                  stroke: "var(--traco)",
                  strokeWidth: "1.5",
                  children: linha2.toUpperCase()
                }
              )
            ] }),
            /* @__PURE__ */ jsx4("g", { id: "lt-texto", style: animacaoTremor("lt-texto"), children: /* @__PURE__ */ jsxs2("g", { id: "lt-letras-acesas", children: [
              /* @__PURE__ */ jsx4(
                "rect",
                {
                  x: "60",
                  y: "40",
                  width: "880",
                  height: "680",
                  fill: "url(#lt-luz)",
                  mask: "url(#lt-recorte-bloom)",
                  style: { opacity: 0.15 }
                }
              ),
              /* @__PURE__ */ jsx4("rect", { x: "86", y: "66", width: "828", height: "628", fill: "url(#lt-luz)", mask: "url(#lt-recorte-acrilico)" }),
              /* @__PURE__ */ jsxs2("g", { style: { ...fonteLetreiro, ...arestaDoCorte }, children: [
                /* @__PURE__ */ jsx4("text", { x: "500", y: "360", textLength: "660", lengthAdjust: "spacingAndGlyphs", children: linha1.toUpperCase() }),
                /* @__PURE__ */ jsx4("text", { x: "500", y: "620", textLength: "660", lengthAdjust: "spacingAndGlyphs", children: linha2.toUpperCase() })
              ] })
            ] }) })
          ] })
        ] })
      ]
    }
  );
}

// components/letreiro/Letreiro.tsx
import { Fragment, jsx as jsx5, jsxs as jsxs3 } from "react/jsx-runtime";
function Letreiro({ onConcluir }) {
  const [fim, setFim] = useState(false);
  const concluir = useRef2(onConcluir);
  concluir.current = onConcluir;
  const encerrar = useRef2(() => {
  });
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    const retomar = pausarMovimento();
    let encerrado = false;
    const terminar = () => {
      if (encerrado) return;
      encerrado = true;
      raiz.setAttribute("data-lt-aceso", "1");
      try {
        sessionStorage.setItem(CHAVE_SESSAO, "1");
      } catch {
      }
      retomar();
      setFim(true);
      concluir.current();
    };
    encerrar.current = terminar;
    const inicio = Number(raiz.getAttribute("data-lt-inicio") ?? performance.now());
    const restante = Math.max(0, DURACAO_TOTAL_MS - (performance.now() - inicio));
    if (raiz.getAttribute("data-lt-aceso") === "1" || restante === 0) {
      terminar();
      return;
    }
    const timer2 = window.setTimeout(terminar, restante);
    return () => {
      window.clearTimeout(timer2);
      retomar();
    };
  }, []);
  return /* @__PURE__ */ jsxs3(Fragment, { children: [
    /* @__PURE__ */ jsx5("script", { dangerouslySetInnerHTML: { __html: SCRIPT_ENTRADA } }),
    /* @__PURE__ */ jsx5("style", { children: `
      html:not([data-lt-aceso='1']) #lt-halo { animation: lt-ignicao ${DURACAO_IGNICAO_MS}ms linear both; }
      html:not([data-lt-aceso='1']) #lt-letras-acesas { animation: lt-ignicao-letras ${DURACAO_IGNICAO_MS}ms linear both; }
      html:not([data-lt-aceso='1']) #intro { animation: lt-cruzar ${DURACAO_ENTRADA_MS}ms cubic-bezier(.32,0,.2,1) ${DURACAO_IGNICAO_MS}ms both; }
      html:not([data-lt-aceso='1']) #conteudo { animation: lt-entrar ${DURACAO_ENTRADA_MS}ms cubic-bezier(.32,0,.2,1) ${DURACAO_IGNICAO_MS}ms both; }
    ` }),
    /* @__PURE__ */ jsxs3("div", { id: "intro", hidden: fim, onAnimationEnd: (e) => {
      if (e.animationName === "lt-cruzar") encerrar.current();
    }, children: [
      /* @__PURE__ */ jsx5("div", { className: "intro-letreiro", children: /* @__PURE__ */ jsx5(LetreiroSvg, {}) }),
      /* @__PURE__ */ jsx5("button", { id: "intro-pular", className: "botao-texto", onClick: () => encerrar.current(), children: "Entrar no card\xE1pio" })
    ] })
  ] });
}

// lib/avisoOrdem.ts
var CHAVE_AVISO_ORDEM = "lm:ordem-desenho-v1";
var TEXTO_AVISO_ORDEM = "A ordem \xE9 s\xF3 do desenho. Na chapa, o lanche \xE9 montado do jeito da casa.";
var AVISO_ORDEM_MS = 7e3;
var mostradoNestaPagina = false;
function consumirAvisoOrdem() {
  if (mostradoNestaPagina) return false;
  mostradoNestaPagina = true;
  try {
    if (sessionStorage.getItem(CHAVE_AVISO_ORDEM)) return false;
    sessionStorage.setItem(CHAVE_AVISO_ORDEM, "1");
  } catch {
  }
  return true;
}

// components/raio-x/RaioX.tsx
import { useCallback, useEffect as useEffect2, useLayoutEffect as useLayoutEffect2, useRef as useRef3, useState as useState2 } from "react";

// lib/transicoes.ts
import { flushSync } from "react-dom";
var GRADE_TOTAL_MS = 200;
var TRANSICOES = {
  "rx-entra": { ms: 240 },
  "rx-sai": { ms: 200, sai: ".rx-modal" },
  "carrinho-entra": { ms: 220 },
  "carrinho-sai": { ms: 180, sai: ".carrinho-modal" },
  "folha-entra": { ms: 200 },
  "folha-sai": { ms: 180, sai: "#rx-trilho-cortina" },
  "confirma-entra": { ms: 220 },
  "confirma-sai": { ms: 180, sai: "[data-passo-pedido]" }
};
var origemEl = null;
var origemRect = null;
function lembrarOrigem(el) {
  origemEl = el ? new WeakRef(el) : null;
  origemRect = el ? el.getBoundingClientRect() : null;
}
function origemAtual() {
  const el = origemEl?.deref();
  if (el?.isConnected) return el.getBoundingClientRect();
  return origemRect;
}
function escreverOrigem(raiz, r) {
  const x = r ? r.left + r.width / 2 : innerWidth / 2;
  const y = r ? r.top + r.height / 2 : innerHeight;
  raiz.style.setProperty("--tr-dx", `${Math.round((x - innerWidth / 2) * 0.08)}px`);
  raiz.style.setProperty("--tr-dy", `${Math.round((y - innerHeight / 2) * 0.08)}px`);
  raiz.style.setProperty("--tr-origem-x", `${Math.round(x)}px`);
  raiz.style.setProperty("--tr-origem-y", `${Math.round(y)}px`);
}
var emCurso = false;
function transicionar(nome, mutar, origem) {
  if (emCurso) return;
  const raiz = document.documentElement;
  if (prefersReducedMotion()) {
    mutar();
    return;
  }
  emCurso = true;
  const retomar = pausarMovimento();
  const { ms: padraoMs, sai } = TRANSICOES[nome];
  const config = document.querySelector("[data-lancheria-app]") ?? raiz;
  const ms = Number(config.dataset.transicaoMs) || padraoMs;
  const doc = document;
  const captura = config.dataset.captura !== "false" && nome.startsWith("rx-") && window.matchMedia("(min-width: 900px) and (pointer: fine)").matches && typeof doc.startViewTransition === "function";
  escreverOrigem(raiz, origem instanceof Element ? origem.getBoundingClientRect() : origem ?? null);
  raiz.style.setProperty("--tr-ms", `${ms}ms`);
  raiz.dataset.transicao = nome;
  if (captura) raiz.dataset.vt = "1";
  else delete raiz.dataset.vt;
  let terminou = false;
  let mutado = false;
  let timer2 = 0;
  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mudar = () => {
    if (!mutado) {
      mutado = true;
      flushSync(mutar);
    }
  };
  const limpar = () => {
    if (terminou) return;
    terminou = true;
    clearTimeout(timer2);
    raiz.removeEventListener("animationend", aoFim);
    reduzir.removeEventListener("change", aoReduzir);
    window.removeEventListener("pagehide", finalizar);
    delete raiz.dataset.transicao;
    delete raiz.dataset.vt;
    raiz.style.removeProperty("--tr-ms");
    retomar();
    emCurso = false;
  };
  const finalizar = () => {
    try {
      mudar();
    } finally {
      limpar();
    }
  };
  const aoReduzir = () => {
    if (reduzir.matches) finalizar();
  };
  const alvo2 = nome.startsWith("rx-") ? ".rx-modal" : nome.startsWith("carrinho-") ? ".carrinho-folha" : nome.startsWith("folha-") ? "#rx-trilho-folha" : "[data-passo-pedido]";
  const aoFim = (e) => {
    if (e.animationName.startsWith("tr-") && e.target instanceof Element && e.target.matches(alvo2)) finalizar();
  };
  reduzir.addEventListener("change", aoReduzir);
  window.addEventListener("pagehide", finalizar);
  if (captura) {
    try {
      const vt = doc.startViewTransition(mudar);
      void vt.finished.then(finalizar, finalizar);
    } catch {
      finalizar();
    }
    return;
  }
  raiz.addEventListener("animationend", aoFim);
  timer2 = window.setTimeout(finalizar, ms + 80);
  if (!sai || !document.querySelector(sai)) {
    try {
      mudar();
    } catch (erro) {
      limpar();
      throw erro;
    }
  }
}

// data/baselines.json
var baselines_default = { "pao-base": { caixa: [300, 457, 1699, 741], base: [0.4859, 0.5634, 0.6162, 0.662, 0.6972, 0.7289, 0.7535, 0.7746, 0.7958, 0.8134, 0.8275, 0.8415, 0.8556, 0.8662, 0.8768, 0.8838, 0.8944, 0.9014, 0.9085, 0.9155, 0.9225, 0.9261, 0.9296, 0.9366, 0.9366, 0.9401, 0.9437, 0.9472, 0.9507, 0.9542, 0.9577, 0.9613, 0.9648, 0.9718, 0.9718, 0.9754, 0.9754, 0.9824, 0.9824, 0.9859, 0.9859, 0.9859, 0.9894, 0.9894, 0.9894, 0.9894, 0.9894, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.9894, 0.9894, 0.9894, 0.9894, 0.9894, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 1, 0.9965, 0.9965, 1, 1, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.993, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.993, 0.993, 0.993, 0.993, 0.993, 0.9965, 0.9965, 0.9965, 0.9965, 1, 1, 1, 1, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.993, 0.993, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 1, 1, 1, 1, 1, 1, 1, 1, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 0.9965, 1, 1, 0.9965, 0.9965, 0.9965, 0.9965, 0.993, 0.993, 0.993, 0.9894, 0.9894, 0.9894, 0.9894, 0.9894, 0.9894, 0.9859, 0.9859, 0.9859, 0.9859, 0.9859, 0.9824, 0.9859, 0.9859, 0.9824, 0.9824, 0.9824, 0.9824, 0.9789, 0.9789, 0.9754, 0.9718, 0.9718, 0.9718, 0.9683, 0.9683, 0.9648, 0.9613, 0.9613, 0.9577, 0.9542, 0.9542, 0.9542, 0.9507, 0.9472, 0.9437, 0.9401, 0.9366, 0.9366, 0.9296, 0.9261, 0.9225, 0.9155, 0.9085, 0.9049, 0.8979, 0.8944, 0.8873, 0.8803, 0.8768, 0.8697, 0.8592, 0.8521, 0.8415, 0.831, 0.8204, 0.8063, 0.7923, 0.7782, 0.7606, 0.743, 0.7183, 0.6972, 0.669, 0.6444, 0.6092, 0.5669, 0.5246, 0.4648] }, molho: { caixa: [425, 546, 1574, 653], base: [0.8785, 0.9065, 0.9252, 0.9252, 0.9065, 0.9346, 0.9533, 0.9626, 0.9813, 0.9813, 0.9813, 0.9813, 0.9813, 0.9813, 0.9813, 0.9813, 0.9813, 0.9813, 0.9813, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9907, 0.9813, 0.9813, 0.9813, 0.9626, 0.972, 0.9813, 0.9813, 0.9626, 0.9626, 0.9626, 0.9626, 0.9626, 0.9626, 0.9626, 0.9626, 0.9813, 0.9813, 0.9813, 0.9813, 0.9813, 0.9813, 0.9907, 0.9907, 0.9907, 0.9907, 1, 1, 1, 1, 0.9907, 1, 0.9813, 0.9813, 0.9626, 0.9626, 0.9626, 0.9626, 0.9626, 0.9626, 0.9626, 0.9626, 0.9626, 0.9533, 0.9533, 0.9533, 0.9533, 0.9626, 0.9533, 0.9533, 0.9813, 0.9813, 0.9813, 0.9813, 0.9533, 0.9533, 0.9346, 0.9346, 0.9346, 0.9346, 0.9252, 0.9252, 0.9252, 0.9252, 0.9065, 0.9065, 0.8972, 0.9065, 0.9065, 0.8972, 0.9065, 0.9065, 0.9065, 0.8972, 0.9065, 0.8972, 0.8972, 0.8972, 0.8972, 0.8972, 0.8972, 0.8972, 0.8972, 0.8972, 0.8972, 0.8972, 0.8972, 0.8972, 0.9065, 0.9065, 0.9065, 0.9065, 0.9065, 0.9065, 0.8785, 0.8785, 0.8692, 0.8692, 0.8692, 0.8692, 0.8692, 0.8692, 0.8505, 0.8411, 0.8411, 0.8505, 0.8505, 0.8692, 0.8505, 0.8692, 0.8692, 0.8692, 0.8692, 0.8692, 0.8692, 0.8692, 0.8505, 0.8505, 0.8505, 0.8505, 0.8505, 0.8505, 0.8411, 0.8411, 0.8505, 0.8505, 0.8598, 0.8692, 0.8692, 0.8692, 0.8785, 0.8785, 0.8785, 0.8785, 0.8785, 0.8785, 0.8785, 0.8879, 0.8972, 0.8972, 0.8972, 0.9065, 0.8972, 0.9065, 0.9065, 0.9065, 0.9252, 0.9252, 0.9252, 0.9252, 0.9065, 0.9065, 0.8972, 0.8972, 0.8972, 0.8972, 0.8879, 0.8692, 0.8505, 0.8505, 0.8505, 0.8505, 0.8505, 0.8505, 0.8505, 0.8224, 0.8224, 0.8411, 0.8411, 0.8224, 0.8224, 0.8131, 0.8131, 0.7944, 0.7944, 0.7944, 0.7944, 0.785, 0.785, 0.785, 0.785, 0.785, 0.7664, 0.757, 0.757, 0.757, 0.7383, 0.7383, 0.729, 0.7103, 0.7009, 0.6729, 0.6729, 0.6075, 0.5607, 0.5047, 0.5327, 0.5607, 0.5607, 0.5514, 0.9533, 0.5234] }, alface: { caixa: [220, 366, 1779, 832], base: [0.6159, 0.6888, 0.7833, 0.8026, 0.8133, 0.8219, 0.824, 0.8605, 0.8648, 0.8648, 0.8648, 0.8519, 0.9163, 0.9185, 0.9185, 0.9185, 0.9227, 0.9185, 0.9464, 0.9464, 0.9356, 0.9249, 0.912, 0.7597, 0.7446, 0.7253, 0.7253, 0.7296, 0.7403, 0.7489, 0.8069, 0.8069, 0.8112, 0.8133, 0.8133, 0.809, 0.8069, 0.8176, 0.8176, 0.7983, 0.7854, 0.7983, 0.8219, 0.8369, 0.8326, 0.8305, 0.8219, 0.8155, 0.809, 0.8069, 0.7897, 0.6931, 0.6867, 0.6631, 0.6738, 0.6738, 0.6695, 0.6588, 0.6395, 0.6416, 0.6459, 0.6459, 0.6502, 0.6545, 0.6588, 0.6631, 0.6652, 0.6652, 0.6695, 0.6738, 0.6738, 0.6803, 0.6845, 0.6888, 0.6974, 0.7017, 0.706, 0.7082, 0.7146, 0.7167, 0.721, 0.7253, 0.7275, 0.7318, 0.7318, 0.7361, 0.7361, 0.7403, 0.7403, 0.7403, 0.7403, 0.7403, 0.7403, 0.7361, 0.7361, 0.7361, 0.7318, 0.7318, 0.7275, 0.7275, 0.7253, 0.721, 0.721, 0.7167, 0.7124, 0.7124, 0.706, 0.7017, 0.6974, 0.6931, 0.6888, 0.6824, 0.6781, 0.6738, 0.6695, 0.6824, 0.6888, 0.6888, 0.6845, 0.6824, 0.6803, 0.6931, 0.7511, 0.7511, 0.7296, 0.7253, 0.7275, 0.7275, 0.6888, 0.6931, 0.6738, 0.6459, 0.6545, 0.6567, 0.6609, 0.6674, 0.676, 0.6781, 0.6781, 0.6781, 0.6781, 0.6824, 0.6824, 0.6845, 0.6845, 0.6845, 0.6845, 0.6845, 0.6845, 0.6845, 0.6845, 0.6845, 0.6824, 0.6824, 0.6824, 0.6824, 0.6781, 0.6781, 0.6781, 0.6738, 0.6738, 0.6695, 0.6695, 0.6652, 0.6652, 0.6652, 0.6695, 0.6695, 0.6695, 0.6695, 0.6695, 0.6695, 0.7361, 0.7554, 0.7661, 0.779, 0.7876, 0.7833, 0.779, 0.7661, 0.7489, 0.8326, 0.8369, 0.8412, 0.8498, 0.8498, 0.8498, 0.8455, 0.8412, 0.8412, 0.8326, 0.8305, 0.8305, 0.8283, 0.7876, 0.7511, 0.6867, 0.6931, 0.706, 0.7189, 0.7318, 0.7446, 0.7554, 0.7811, 0.9421, 0.9549, 0.9614, 0.9657, 0.97, 0.97, 0.9657, 0.9614, 0.9871, 1, 1, 0.9635, 0.9742, 0.97, 0.97, 0.97, 0.97, 0.9657, 0.9549, 0.912, 0.9013, 0.8798, 0.867, 0.8562, 0.8455, 0.8069, 0.7682, 0.7253, 0.7082, 0.6609, 0.6652, 0.6502, 0.6352, 0.6266, 0.5601, 0.5343] }, tomate: { caixa: [390, 530, 1609, 668], base: [0.8696, 0.8841, 0.8913, 0.8986, 0.8986, 0.9058, 0.913, 0.913, 0.9275, 0.9348, 0.942, 0.942, 0.9493, 0.9493, 0.942, 0.942, 0.942, 0.9493, 0.9493, 0.9565, 0.9565, 0.9565, 0.9565, 0.9565, 0.9565, 0.9565, 0.9638, 0.9638, 0.9565, 0.9638, 0.9638, 0.9565, 0.9493, 0.9493, 0.9565, 0.9565, 0.9565, 0.9638, 0.9638, 0.971, 0.9638, 0.9638, 0.9638, 0.9638, 0.9638, 0.9638, 0.9638, 0.9638, 0.9638, 0.9638, 0.9638, 0.9638, 0.9638, 0.971, 0.9783, 0.9783, 0.9783, 0.9783, 0.9855, 0.9855, 0.9783, 0.9783, 0.9783, 0.9783, 0.971, 0.971, 0.971, 0.971, 0.9783, 0.9783, 0.9783, 0.9783, 0.9783, 0.9855, 0.9855, 0.9928, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 0.9855, 0.9855, 0.9855, 0.9855, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 1, 1, 1, 1, 1, 1, 0.9928, 0.9928, 0.9928, 0.9855, 0.9928, 0.9928, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.9928, 0.9928, 0.9855, 0.9855, 0.9855, 0.9855, 0.9855, 0.9783, 0.9783, 0.9783, 0.9783, 0.9855, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 0.9928, 0.9855, 0.9855, 0.9855, 0.9783, 0.9783, 0.9783, 0.9783, 0.9783, 0.971, 0.971, 0.9638, 0.9638, 0.9638, 0.9638, 0.971, 0.971, 0.971, 0.971, 0.971, 0.971, 0.971, 0.971, 0.971, 0.971, 0.971, 0.9638, 0.9638, 0.9638, 0.9565, 0.9565, 0.9565, 0.9493, 0.9565, 0.9565, 0.9565, 0.9638, 0.9638, 0.9638, 0.9565, 0.9565, 0.9565, 0.9565, 0.9493, 0.942, 0.942, 0.9275, 0.9275, 0.9203, 0.9058, 0.8768, 0.8768, 0.8696, 0.8696, 0.8696, 0.8623, 0.8623, 0.8623, 0.8623, 0.8696, 0.8696, 0.8696, 0.8696, 0.8696, 0.8696, 0.8696, 0.8696, 0.8696, 0.8623, 0.8623, 0.8623, 0.8623, 0.8551, 0.8478, 0.8478, 0.8478, 0.8478, 0.8478, 0.8478, 0.8478, 0.8478, 0.8406, 0.8406, 0.8333, 0.8333, 0.8333, 0.8188, 0.8116, 0.8043, 0.6739] }, cebola: { caixa: [420, 400, 1579, 798], base: [0.5678, 0.5704, 0.5754, 0.5804, 0.5879, 0.6005, 0.608, 0.608, 0.6106, 0.6106, 0.6156, 0.6206, 0.6206, 0.6206, 0.6206, 0.6206, 0.9824, 0.9975, 1, 1, 1, 0.9925, 0.9899, 0.9849, 0.9724, 0.9623, 0.8518, 0.8266, 0.7739, 0.7412, 0.7111, 0.701, 0.6884, 0.6583, 0.6583, 0.6583, 0.6709, 0.706, 0.706, 0.7111, 0.7111, 0.7111, 0.706, 0.706, 0.706, 0.706, 0.706, 0.706, 0.706, 0.7035, 0.7085, 0.7111, 0.706, 0.7236, 0.7312, 0.7387, 0.7462, 0.7462, 0.7513, 0.7538, 0.7538, 0.7588, 0.7638, 0.7663, 0.7638, 0.7538, 0.7513, 0.7462, 0.7387, 0.7437, 0.7437, 0.7437, 0.7387, 0.7337, 0.7312, 0.7261, 0.7261, 0.7236, 0.7261, 0.7261, 0.7236, 0.7186, 0.7186, 0.7186, 0.7186, 0.7236, 0.7312, 0.7337, 0.7387, 0.7487, 0.7538, 0.7588, 0.7588, 0.7588, 0.7613, 0.7638, 0.7638, 0.7638, 0.7588, 0.7588, 0.7588, 0.7588, 0.7588, 0.7613, 0.7638, 0.7638, 0.7638, 0.7638, 0.7638, 0.7638, 0.7638, 0.7638, 0.7638, 0.7638, 0.7638, 0.7638, 0.7613, 0.7538, 0.7513, 0.7462, 0.7462, 0.7462, 0.7437, 0.7337, 0.7286, 0.7236, 0.7161, 0.7111, 0.7111, 0.706, 0.7111, 0.7111, 0.7161, 0.7161, 0.7186, 0.7186, 0.7186, 0.7236, 0.7236, 0.7236, 0.7236, 0.7236, 0.7236, 0.7286, 0.7337, 0.7387, 0.7387, 0.7437, 0.7462, 0.7462, 0.7513, 0.7513, 0.7513, 0.7588, 0.7588, 0.7588, 0.7538, 0.7437, 0.7437, 0.7337, 0.7312, 0.7387, 0.7387, 0.7387, 0.7312, 0.7337, 0.7337, 0.7387, 0.7387, 0.7437, 0.7437, 0.7437, 0.7437, 0.7437, 0.7437, 0.7437, 0.7437, 0.7387, 0.7337, 0.7337, 0.7312, 0.7261, 0.7236, 0.7186, 0.7136, 0.706, 0.7035, 0.701, 0.7035, 0.7035, 0.7136, 0.7161, 0.7186, 0.7186, 0.7186, 0.7186, 0.897, 0.9095, 0.9221, 0.9271, 0.9322, 0.9347, 0.9422, 0.9447, 0.9497, 0.9497, 0.9497, 0.9497, 0.9372, 0.8894, 0.799, 0.706, 0.706, 0.706, 0.706, 0.7111, 0.7111, 0.7111, 0.7111, 0.7111, 0.706, 0.701, 0.6935, 0.6859, 0.6834, 0.6834, 0.6834, 0.6784, 0.6784, 0.6784, 0.6784, 0.6784, 0.6784, 0.6759, 0.6709, 0.6709, 0.6583, 0.6508, 0.6457, 0.6382] }, carne: { caixa: [275, 409, 1724, 789], base: [0.8395, 0.8395, 0.8395, 0.8474, 0.8447, 0.8342, 0.8447, 0.8526, 0.8526, 0.8526, 0.8526, 0.8395, 0.8342, 0.8184, 0.8289, 0.8342, 0.8553, 0.8658, 0.8763, 0.8763, 0.8974, 0.8974, 0.8974, 0.8921, 0.8895, 0.8921, 0.8921, 0.8921, 0.8868, 0.8868, 0.8921, 0.8974, 0.8974, 0.8974, 0.8974, 0.8921, 0.8921, 0.9053, 0.9105, 0.9105, 0.9053, 0.8974, 0.8974, 0.9079, 0.9158, 0.9158, 0.9158, 0.9053, 0.9105, 0.9105, 0.9105, 0.9158, 0.9158, 0.9947, 1, 1, 1, 0.9974, 0.9947, 0.9895, 0.9895, 0.9895, 0.9789, 0.9632, 0.9553, 0.9447, 0.9263, 0.9211, 0.9211, 0.9263, 0.9263, 0.9211, 0.9211, 0.9211, 0.9105, 0.9158, 0.9158, 0.9158, 0.9237, 0.9316, 0.9395, 0.9395, 0.9447, 0.9447, 0.95, 0.95, 0.95, 0.95, 0.95, 0.9395, 0.9395, 0.9447, 0.95, 0.95, 0.9474, 0.9421, 0.9395, 0.9421, 0.9447, 0.9421, 0.9395, 0.9395, 0.9368, 0.9263, 0.9263, 0.9316, 0.9316, 0.9395, 0.9395, 0.9395, 0.9395, 0.9368, 0.9395, 0.9395, 0.9395, 0.9395, 0.9447, 0.95, 0.9605, 0.9605, 0.9684, 0.9737, 0.9737, 0.9684, 0.9632, 0.9579, 0.9553, 0.9553, 0.9553, 0.9553, 0.9553, 0.9553, 0.9553, 0.9447, 0.9447, 0.9553, 0.9737, 0.9684, 0.9658, 0.9605, 0.9605, 0.95, 0.9447, 0.9368, 0.9395, 0.9447, 0.9553, 0.9553, 0.95, 0.95, 0.9395, 0.9395, 0.9395, 0.9395, 0.9395, 0.9395, 0.9395, 0.9395, 0.9395, 0.9342, 0.9263, 0.9395, 0.9368, 0.9395, 0.9211, 0.9158, 0.9053, 0.9053, 0.8921, 0.8921, 0.8921, 0.8921, 0.8921, 0.8974, 0.9105, 0.9105, 0.9158, 0.9053, 0.9105, 0.9211, 0.9368, 0.9447, 0.95, 0.9553, 0.9553, 0.9553, 0.9526, 0.9421, 0.9211, 0.9158, 0.9105, 0.9079, 0.9105, 0.9105, 0.9079, 0.9053, 0.9053, 0.9, 0.9026, 0.9105, 0.9105, 0.9105, 0.9105, 0.9105, 0.9105, 0.9105, 0.9053, 0.8974, 0.9105, 0.9105, 0.9105, 0.9105, 0.8921, 0.8895, 0.8868, 0.8816, 0.8763, 0.8763, 0.8763, 0.8763, 0.8526, 0.8474, 0.8342, 0.8342, 0.8105, 0.8053, 0.7816, 0.7474, 0.7553, 0.7553, 0.7474, 0.7368, 0.7211, 0.7132, 0.7237, 0.7316, 0.7316, 0.7289, 0.7184, 0.7079] }, queijo: { caixa: [350, 390, 1649, 809], base: [0.4391, 0.4893, 0.5394, 0.5847, 0.6277, 0.6897, 0.8663, 0.8878, 0.8926, 0.8974, 0.8974, 0.9069, 0.9069, 0.9117, 0.9117, 0.9021, 0.8831, 0.8592, 0.8353, 0.8091, 0.7804, 0.7446, 0.7064, 0.6158, 0.58, 0.5418, 0.5155, 0.4869, 0.4582, 0.4391, 0.4248, 0.4081, 0.3938, 0.3819, 0.3723, 0.3675, 0.3532, 0.3413, 0.3341, 0.3222, 0.3126, 0.3103, 0.3079, 0.3031, 0.2959, 0.2959, 0.2912, 0.2864, 0.2864, 0.2816, 0.2816, 0.2816, 0.2768, 0.2768, 0.2768, 0.2768, 0.2745, 0.2745, 0.2745, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2745, 0.2745, 0.2745, 0.2745, 0.2745, 0.2745, 0.2745, 0.2745, 0.2745, 0.2768, 0.2768, 0.2768, 0.2768, 0.2768, 0.2768, 0.2768, 0.2768, 0.2768, 0.2768, 0.2768, 0.2768, 0.2745, 0.2745, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2697, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2625, 0.2601, 0.2601, 0.2649, 0.2649, 0.2649, 0.2649, 0.2649, 0.2697, 0.2697, 0.2697, 0.2697, 0.2745, 0.2745, 0.2745, 0.2768, 0.2816, 0.2816, 0.2864, 0.2912, 0.2959, 0.3007, 0.3055, 0.3103, 0.3174, 0.3246, 0.3317, 0.3413, 0.3508, 0.358, 0.3699, 0.3819, 0.3938, 0.4057, 0.4177, 0.4344, 0.4511, 0.4678, 0.5012, 0.5274, 0.5513, 0.5823, 0.6181, 0.6468, 0.6826, 0.716, 0.7399, 0.7661, 0.7924, 0.8162, 0.8473, 0.8663, 0.8878, 0.9069, 0.9165, 0.9332, 0.9427, 0.9475, 0.9618, 0.9976, 1, 1, 0.9881, 0.9761, 0.9594, 0.9475, 0.9045, 0.5656, 0.4845] }, presunto: { caixa: [320, 392, 1679, 807], base: [0.6361, 0.6771, 0.7157, 0.7422, 0.7614, 0.7855, 0.8, 0.8145, 0.8241, 0.8337, 0.841, 0.8482, 0.853, 0.8602, 0.8627, 0.8675, 0.8723, 0.8771, 0.8819, 0.8819, 0.8867, 0.8867, 0.8916, 0.8964, 0.8964, 0.8988, 0.8988, 0.9036, 0.9084, 0.9084, 0.9133, 0.9133, 0.9181, 0.9181, 0.9229, 0.9229, 0.9277, 0.9277, 0.9301, 0.9325, 0.9373, 0.9373, 0.9422, 0.9422, 0.947, 0.947, 0.947, 0.947, 0.9518, 0.9494, 0.947, 0.947, 0.947, 0.947, 0.947, 0.947, 0.947, 0.947, 0.947, 0.947, 0.9494, 0.9518, 0.9518, 0.9542, 0.9566, 0.959, 0.9614, 0.9639, 0.9687, 0.9687, 0.9687, 0.9735, 0.9735, 0.9783, 0.9783, 0.9783, 0.9831, 0.9831, 0.9831, 0.9831, 0.9831, 0.9831, 0.988, 0.988, 0.988, 0.988, 0.988, 0.988, 0.988, 0.988, 0.988, 0.988, 0.9928, 0.9928, 0.988, 0.988, 0.988, 0.988, 0.988, 0.988, 0.988, 0.9928, 0.9928, 0.9928, 0.9928, 0.9952, 0.9976, 0.9976, 0.9976, 0.9976, 0.9976, 0.9976, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.9976, 0.9976, 0.9952, 0.9928, 0.988, 0.9831, 0.9735, 0.9687, 0.959, 0.947, 0.9349, 0.9157, 0.8916, 0.8723, 0.853, 0.8241, 0.8072, 0.7783, 0.7398, 0.6867, 0.6867, 0.6916, 0.7012, 0.706, 0.7157, 0.7229, 0.7325, 0.7422, 0.747, 0.7566, 0.7614, 0.7711, 0.7783, 0.7855, 0.788, 0.7928, 0.7976, 0.8024, 0.812, 0.812, 0.8169, 0.8217, 0.8265, 0.8313, 0.8361, 0.841, 0.8434, 0.8482, 0.853, 0.853, 0.8578, 0.8627, 0.8627, 0.8675, 0.8675, 0.8723, 0.8723, 0.8771, 0.8771, 0.8771, 0.8819, 0.8819, 0.8819, 0.8819, 0.8819, 0.8819, 0.8819, 0.8819, 0.8819, 0.8819, 0.8771, 0.8771, 0.8771, 0.8771, 0.8771, 0.8723, 0.8723, 0.8675, 0.8675, 0.8627, 0.8627, 0.8627, 0.8578, 0.8554, 0.853, 0.8482, 0.8482, 0.8482, 0.8434, 0.841, 0.841, 0.8361, 0.8313, 0.8265, 0.8265, 0.8217, 0.8193, 0.812, 0.8072, 0.8072, 0.8024, 0.8, 0.7976, 0.788, 0.7807, 0.7759, 0.7566, 0.747, 0.7301, 0.7133, 0.6916, 0.6651, 0.6361, 0.5904] }, bacon: { caixa: [240, 447, 1759, 751], base: [0.7961, 0.8355, 0.8421, 0.8421, 0.8421, 0.8487, 0.8553, 0.8914, 0.9112, 0.9178, 0.9112, 0.9112, 0.9079, 0.9112, 0.9046, 0.9046, 0.9013, 0.8914, 0.898, 0.9178, 0.9243, 0.9243, 0.9309, 0.9309, 0.9309, 0.9375, 0.9441, 0.9441, 0.9441, 0.9507, 0.9507, 0.9441, 0.9441, 0.9441, 0.9507, 0.9507, 0.9572, 0.9572, 0.9638, 0.9638, 0.9572, 0.9638, 0.9638, 0.9704, 0.9704, 0.9704, 0.9704, 0.9638, 0.9638, 0.9572, 0.9572, 0.9507, 0.9441, 0.9441, 0.9375, 0.9375, 0.9309, 0.9243, 0.9178, 0.898, 0.8914, 0.8849, 0.8816, 0.875, 0.8618, 0.8553, 0.8487, 0.8355, 0.8158, 0.8092, 0.7961, 0.7401, 0.7401, 0.7401, 0.7434, 0.75, 0.7632, 0.7697, 0.7763, 0.7763, 0.7829, 0.7895, 0.7961, 0.8026, 0.8092, 0.8092, 0.8092, 0.8158, 0.8289, 0.8355, 0.8421, 0.852, 0.8586, 0.8618, 0.8684, 0.875, 0.875, 0.875, 0.8816, 0.8816, 0.875, 0.8783, 0.8816, 0.8816, 0.8816, 0.8783, 0.875, 0.8684, 0.8618, 0.8553, 0.8487, 0.8421, 0.8421, 0.8289, 0.8224, 0.8158, 0.8026, 0.7961, 0.7763, 0.7763, 0.7697, 0.7599, 0.75, 0.75, 0.7566, 0.7632, 0.7697, 0.7763, 0.7829, 0.7895, 0.8224, 0.8487, 0.8618, 0.8684, 0.8882, 0.9079, 0.9276, 0.9441, 0.9572, 0.9638, 0.9638, 0.9704, 0.977, 0.9836, 0.9901, 1, 1, 1, 1, 0.9967, 0.9901, 0.9901, 0.9836, 0.9836, 0.977, 0.977, 0.9704, 0.9638, 0.9507, 0.9309, 0.9112, 0.898, 0.8783, 0.8586, 0.8388, 0.8191, 0.8059, 0.7796, 0.7697, 0.7632, 0.7566, 0.75, 0.7566, 0.7632, 0.7697, 0.7829, 0.7895, 0.8092, 0.8224, 0.8388, 0.8553, 0.8717, 0.8816, 0.898, 0.9046, 0.9112, 0.9178, 0.9243, 0.9309, 0.9375, 0.9375, 0.9375, 0.9243, 0.9178, 0.9112, 0.9112, 0.898, 0.8882, 0.875, 0.8618, 0.8487, 0.8224, 0.8026, 0.7829, 0.7697, 0.7566, 0.75, 0.7434, 0.7336, 0.727, 0.7368, 0.7401, 0.7434, 0.75, 0.75, 0.75, 0.7566, 0.7697, 0.7829, 0.7895, 0.8026, 0.8224, 0.8355, 0.8421, 0.8553, 0.8586, 0.8651, 0.8684, 0.8618, 0.8684, 0.8684, 0.8684, 0.8618, 0.8684, 0.8651, 0.8684, 0.8684, 0.8618, 0.852, 0.8322] }, ovo: { caixa: [300, 449, 1699, 749], base: [0.7633, 0.7833, 0.8033, 0.81, 0.81, 0.8233, 0.8433, 0.85, 0.85, 0.8567, 0.8633, 0.87, 0.87, 0.8767, 0.8767, 0.8767, 0.8767, 0.8767, 0.8767, 0.8767, 0.8767, 0.8767, 0.8767, 0.89, 0.8967, 0.8967, 0.9033, 0.91, 0.9167, 0.9233, 0.93, 0.9333, 0.9367, 0.9367, 0.9433, 0.9433, 0.95, 0.9433, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.9567, 0.9567, 0.9567, 0.9567, 0.9567, 0.9567, 0.95, 0.95, 0.9433, 0.95, 0.95, 0.95, 0.95, 0.9433, 0.9433, 0.9367, 0.9433, 0.9433, 0.9433, 0.9433, 0.9367, 0.93, 0.9233, 0.9233, 0.93, 0.9367, 0.9433, 0.95, 0.9633, 0.97, 0.9767, 0.9767, 0.9833, 0.9833, 0.9833, 0.9833, 0.99, 0.99, 0.9967, 1, 1, 0.99, 0.99, 0.99, 0.99, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.99, 0.99, 0.99, 0.99, 0.99, 0.9967, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.9967, 0.9967, 0.9967, 0.99, 0.9833, 0.9833, 0.9833, 0.9833, 0.9767, 0.97, 0.9767, 0.9767, 0.9833, 0.9833, 0.9833, 0.9833, 0.9833, 0.9833, 0.9833, 0.99, 0.99, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.99, 0.99, 0.99, 0.99, 0.99, 0.9833, 0.9833, 0.9833, 0.9767, 0.97, 0.9667, 0.97, 0.97, 0.97, 0.97, 0.97, 0.9767, 0.97, 0.97, 0.9633, 0.9633, 0.9633, 0.9633, 0.9633, 0.9633, 0.9633, 0.96, 0.9633, 0.96, 0.9567, 0.9567, 0.9567, 0.95, 0.94, 0.9367, 0.9367, 0.93, 0.9233, 0.9167, 0.9033, 0.8967, 0.9033, 0.91, 0.9167, 0.9167, 0.9233, 0.9233, 0.9233, 0.9233, 0.9233, 0.9233, 0.9167, 0.9167, 0.9167, 0.9167, 0.9167, 0.9167, 0.9167, 0.9167, 0.9167, 0.9167, 0.91, 0.9033, 0.9033, 0.9033, 0.9033, 0.9033, 0.9033, 0.8967, 0.8833, 0.8767, 0.8767, 0.8767, 0.8767, 0.87, 0.8633, 0.8633, 0.85, 0.8433, 0.8367, 0.8267, 0.8233, 0.82, 0.8167, 0.8133, 0.8033, 0.7933, 0.79, 0.7833, 0.7767, 0.7633, 0.7633, 0.7567, 0.75, 0.7367, 0.73, 0.7033, 0.6867, 0.66] }, "batata-palha": { caixa: [370, 438, 1629, 760], base: [0.5311, 0.854, 0.8602, 0.8509, 0.8385, 0.823, 0.8106, 0.882, 0.8882, 0.8882, 0.8882, 0.882, 0.8727, 0.8634, 0.8571, 0.8478, 0.8509, 0.854, 0.8602, 0.9099, 0.9099, 0.8975, 0.8789, 0.8758, 0.8789, 0.8789, 0.8789, 0.8789, 0.8789, 0.8789, 0.9006, 0.9193, 0.9286, 0.9161, 0.9068, 0.8975, 0.8913, 0.8882, 0.8882, 0.8913, 0.8913, 0.8975, 0.9068, 0.9099, 0.9161, 0.9161, 0.9099, 0.8882, 0.8602, 0.8416, 0.8478, 0.8509, 0.8727, 0.8789, 0.8758, 0.8696, 0.8696, 0.8696, 0.8634, 0.854, 0.8696, 0.8727, 0.8602, 0.8571, 0.8634, 0.8634, 0.8913, 0.8913, 0.8913, 0.8882, 0.8882, 0.882, 0.8789, 0.8727, 0.8727, 0.8758, 0.8789, 0.882, 0.882, 0.882, 0.882, 0.882, 0.882, 0.882, 0.8882, 0.8882, 0.8913, 0.8913, 0.8913, 0.8913, 0.8975, 0.8975, 0.8975, 0.8975, 0.8975, 0.8975, 0.8975, 0.8975, 0.9006, 0.9006, 0.9006, 0.9006, 0.9006, 0.8975, 0.8975, 0.8913, 0.8913, 0.8882, 0.8851, 0.8789, 0.8789, 0.8727, 0.8696, 0.8696, 0.8696, 0.8727, 0.8789, 0.8727, 0.8447, 0.8509, 0.8602, 0.8634, 0.8696, 0.8727, 0.8789, 0.8789, 0.882, 0.882, 0.882, 0.8851, 0.8882, 0.8882, 0.8882, 0.8789, 0.8789, 0.8758, 0.8727, 0.8727, 0.8696, 0.8696, 0.8696, 0.8602, 0.854, 0.8602, 0.8634, 0.8634, 0.8696, 0.8727, 0.8789, 0.882, 0.8882, 0.8882, 0.8913, 0.8975, 0.8975, 0.8975, 0.8913, 0.8571, 0.8571, 0.8571, 0.9193, 0.9286, 0.9286, 0.9193, 0.8944, 0.8789, 0.8665, 0.8696, 0.8696, 0.8602, 0.8416, 0.8416, 0.8385, 0.8416, 0.8416, 0.8478, 0.8509, 0.8882, 0.9161, 0.9099, 0.9006, 0.8602, 0.8602, 0.8571, 0.8696, 0.8727, 0.8727, 0.8634, 0.8634, 0.8634, 0.8696, 0.8696, 0.8696, 0.8696, 0.9006, 0.9099, 0.9099, 0.8975, 0.8571, 0.8789, 0.8727, 0.8665, 0.8602, 0.8602, 0.8634, 0.8634, 0.8696, 0.8727, 0.8727, 0.8789, 0.8789, 0.882, 0.9255, 0.9286, 0.9099, 0.8913, 0.8913, 0.882, 0.882, 0.8882, 0.8758, 0.8292, 0.823, 0.8789, 0.9348, 1, 1, 0.9969, 0.8137, 0.8043, 0.7857, 0.7733, 0.764, 0.7112, 0.7112, 0.7112, 0.7112, 0.7143, 0.7143, 0.7112] }, "pao-topo": { caixa: [300, 372, 1699, 827], base: [0.9604, 0.9736, 0.9736, 0.9736, 0.9758, 0.9802, 0.9802, 0.9802, 0.9824, 0.9824, 0.9824, 0.9846, 0.9846, 0.9868, 0.9868, 0.9846, 0.9868, 0.9868, 0.989, 0.989, 0.989, 0.989, 0.989, 0.989, 0.989, 0.9912, 0.9912, 0.9912, 0.9912, 0.9912, 0.9912, 0.9934, 0.9934, 0.9934, 0.9934, 0.9912, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9956, 0.9956, 0.9956, 0.9934, 0.9934, 0.9956, 0.9956, 0.9934, 0.9912, 0.9912, 0.9934, 0.9956, 0.9978, 0.9978, 0.9956, 0.9934, 0.9956, 0.9956, 0.9978, 0.9956, 0.9956, 0.9956, 0.9956, 0.9934, 0.9956, 0.9934, 0.9934, 0.9934, 0.9934, 0.9956, 0.9956, 0.9956, 0.9956, 0.9912, 0.9846, 0.9912, 0.9956, 0.9956, 0.9846, 0.9824, 0.9824, 0.9934, 0.9934, 0.9868, 0.9824, 0.9868, 0.9934, 0.9934, 0.9956, 0.9912, 0.9868, 0.9934, 0.9934, 0.9934, 0.9956, 0.9956, 0.9846, 0.9824, 0.9868, 0.9912, 0.9912, 0.989, 0.9956, 0.9978, 1, 1, 1, 0.9934, 0.9934, 0.9912, 0.9934, 0.9934, 0.9934, 0.9934, 0.9956, 0.9956, 0.9934, 0.9934, 0.9934, 0.9956, 0.9956, 0.9934, 0.9956, 0.9956, 0.9934, 0.9934, 0.9956, 0.9934, 0.9934, 0.9934, 0.9956, 0.9978, 0.9978, 0.9956, 0.9934, 0.9868, 0.9802, 0.9912, 0.9912, 0.9824, 0.989, 0.9912, 0.9956, 0.9978, 0.9978, 0.9978, 0.9912, 0.9934, 0.9934, 0.9956, 0.9934, 0.9934, 0.9956, 0.9956, 0.9934, 0.9934, 0.9956, 0.9956, 0.9956, 0.9934, 0.9956, 0.9934, 0.9956, 0.9934, 0.9912, 0.989, 0.9934, 0.9956, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9956, 0.9956, 0.9934, 0.9934, 0.9934, 0.9934, 0.9934, 0.9956, 0.9934, 0.9934, 0.9934, 0.9934, 0.9956, 0.9956, 0.9912, 0.9934, 0.9934, 0.9934, 0.9956, 0.9912, 0.989, 0.989, 0.989, 0.989, 0.989, 0.9912, 0.9912, 0.9912, 0.989, 0.989, 0.989, 0.989, 0.989, 0.9912, 0.989, 0.989, 0.9868, 0.989, 0.9868, 0.9846, 0.9846, 0.9846, 0.9846, 0.9846, 0.9824, 0.9802, 0.9802, 0.978, 0.978, 0.978, 0.9758, 0.9714, 0.9626, 0.9582] }, "pao-prensado-base": { caixa: [125, 446, 1874, 752], base: [0.6373, 0.7059, 0.7614, 0.8039, 0.8399, 0.8725, 0.8987, 0.9216, 0.9379, 0.951, 0.9641, 0.9706, 0.9771, 0.9804, 0.9869, 0.9869, 0.9902, 0.9935, 0.9935, 0.9935, 0.9967, 0.9967, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.9967, 0.9967, 0.9967, 0.9967, 0.9935, 0.9935, 0.9935, 0.9902, 0.9902, 0.9902, 0.9869, 0.9902, 0.9902, 0.9902, 0.9902, 0.9902, 0.9902, 0.9902, 0.9902, 0.9935, 0.9902, 0.9902, 0.9935, 0.9935, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9935, 0.9935, 0.9935, 0.9935, 0.9902, 0.9902, 0.9902, 0.9935, 0.9902, 0.9935, 0.9935, 0.9935, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9935, 0.9935, 0.9935, 0.9935, 0.9935, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 0.9935, 0.9935, 0.9935, 0.9935, 0.9935, 0.9935, 0.9935, 0.9935, 0.9902, 0.9902, 0.9902, 0.9902, 0.9902, 0.9869, 0.9869, 0.9869, 0.9869, 0.9869, 0.9869, 0.9869, 0.9869, 0.9869, 0.9869, 0.9869, 0.9869, 0.9869, 0.9804, 0.9804, 0.9771, 0.9771, 0.9771, 0.9771, 0.9771, 0.9771, 0.9771, 0.9771, 0.9771, 0.9771, 0.9771, 0.9771, 0.9771, 0.9771, 0.9739, 0.9706, 0.9673, 0.9673, 0.9673, 0.9739, 0.9771, 0.9804, 0.9804, 0.9869, 0.9869, 0.9869, 0.9902, 0.9902, 0.9935, 0.9935, 0.9935, 0.9935, 0.9967, 0.9967, 0.9967, 0.9967, 0.9967, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.9967, 0.9935, 0.9935, 0.9902, 0.9804, 0.9771, 0.9706, 0.9641, 0.951, 0.9379, 0.9216, 0.9052, 0.8824, 0.8562, 0.8301, 0.7941, 0.7582, 0.7157, 0.6634, 0.5915] }, "pao-prensado-topo": { caixa: [125, 442, 1874, 756], base: [0.8439, 0.8822, 0.8981, 0.9204, 0.9268, 0.9299, 0.9331, 0.9331, 0.9459, 0.949, 0.9459, 0.9459, 0.9427, 0.9618, 0.9618, 0.9522, 0.9522, 0.9554, 0.9554, 0.9522, 0.9554, 0.9618, 0.9682, 0.965, 0.9618, 0.9618, 0.9618, 0.9618, 0.9618, 0.9586, 0.9618, 0.9618, 0.9618, 0.9682, 0.965, 0.9682, 0.965, 0.965, 0.965, 0.9682, 0.9682, 0.9713, 0.9713, 0.9745, 0.9745, 0.9777, 0.9745, 0.9777, 0.9777, 0.9745, 0.9745, 0.9745, 0.9745, 0.9713, 0.9682, 0.9682, 0.9777, 0.9873, 0.9873, 0.9841, 0.9809, 0.9745, 0.9777, 0.9841, 0.9841, 0.9873, 0.9873, 0.9873, 0.9873, 0.9873, 0.9904, 0.9904, 0.9841, 0.9904, 0.9904, 0.9873, 0.9841, 0.9873, 0.9841, 0.9745, 0.9936, 0.9936, 0.9904, 0.9936, 0.9904, 0.9904, 0.9904, 0.9904, 0.9936, 0.9873, 0.9777, 0.9777, 0.9841, 0.9873, 1, 1, 0.9968, 0.9904, 0.9936, 0.9904, 0.9904, 0.9873, 0.9841, 0.9904, 0.9904, 0.9904, 0.9904, 0.9904, 0.9936, 0.9968, 0.9968, 0.9968, 0.9968, 0.9968, 1, 1, 0.9936, 0.9809, 0.9841, 0.9841, 0.9904, 0.9904, 0.9873, 0.9873, 0.9873, 0.9841, 0.9873, 0.9904, 0.9936, 0.9936, 0.9873, 0.9841, 0.9777, 0.9873, 0.9936, 0.9936, 0.9904, 0.9873, 0.9904, 0.9904, 0.9904, 0.9777, 0.9777, 0.9745, 0.9841, 0.9841, 0.9904, 0.9904, 0.9904, 0.9904, 0.9936, 0.9936, 0.9841, 0.9745, 0.9745, 0.9777, 0.9809, 0.9873, 0.9841, 0.9745, 0.9745, 0.9713, 0.9841, 0.9873, 0.9873, 0.9809, 0.9873, 0.9841, 0.9873, 0.9873, 0.9809, 0.9777, 0.9777, 0.9777, 0.9745, 0.9841, 0.9777, 0.9809, 0.9809, 0.9745, 0.9745, 0.9745, 0.965, 0.965, 0.9809, 0.9904, 0.9904, 0.9841, 0.9841, 0.9713, 0.9745, 0.9713, 0.9745, 0.9713, 0.9777, 0.9777, 0.9745, 0.9745, 0.9745, 0.9841, 0.9841, 0.9777, 0.9745, 0.9745, 0.9777, 0.9777, 0.9745, 0.9777, 0.9777, 0.9745, 0.9745, 0.9745, 0.9841, 0.9777, 0.9777, 0.9777, 0.9713, 0.9713, 0.9777, 0.9777, 0.9777, 0.965, 0.965, 0.965, 0.965, 0.9713, 0.9713, 0.9713, 0.9586, 0.949, 0.9618, 0.9618, 0.9554, 0.949, 0.9363, 0.9236, 0.914, 0.8726, 0.8185, 0.742] }, calabresa: { caixa: [300, 488, 1699, 711], base: [0.704, 0.843, 0.9193, 0.9417, 0.9462, 0.9552, 0.9596, 0.9641, 0.9641, 0.9641, 0.9641, 0.9641, 0.9641, 0.9686, 0.9641, 0.9686, 0.9686, 0.9641, 0.9641, 0.9686, 0.9686, 0.9686, 0.9641, 0.9686, 0.9686, 0.9686, 0.9686, 0.9641, 0.9641, 0.9641, 0.9596, 0.9596, 0.9552, 0.9507, 0.9462, 0.9462, 0.9372, 0.9283, 0.9193, 0.9148, 0.9193, 0.9193, 0.9283, 0.9372, 0.9417, 0.9462, 0.9417, 0.9462, 0.9462, 0.9462, 0.9462, 0.9462, 0.9552, 0.9686, 0.9731, 0.9776, 0.9865, 0.991, 0.991, 0.9955, 0.9955, 0.9955, 1, 1, 1, 1, 0.9955, 0.9955, 0.9955, 0.9865, 0.9821, 0.9731, 0.9686, 0.9552, 0.9238, 0.9013, 0.9013, 0.8969, 0.8969, 0.8924, 0.8969, 0.8969, 0.8969, 0.9058, 0.9148, 0.9238, 0.9283, 0.9283, 0.9283, 0.9327, 0.9327, 0.9417, 0.9462, 0.9552, 0.9686, 0.9731, 0.9821, 0.9865, 0.991, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.991, 0.9821, 0.9776, 0.9821, 0.9821, 0.9865, 0.9865, 0.9865, 0.991, 0.991, 0.991, 0.9955, 0.991, 0.991, 0.991, 0.991, 0.991, 0.991, 0.991, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.991, 0.991, 0.9865, 0.9821, 0.9776, 0.9731, 0.9686, 0.9641, 0.9641, 0.9641, 0.9731, 0.9821, 0.991, 0.991, 0.9955, 0.9955, 0.991, 0.991, 0.9865, 0.9821, 0.9776, 0.9731, 0.9776, 0.9776, 0.9821, 0.9821, 0.9821, 0.9865, 0.9865, 0.991, 0.991, 0.991, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.991, 0.9955, 0.9955, 0.991, 0.9955, 0.991, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.9955, 0.991, 0.9865, 0.9865, 0.9865, 0.9821, 0.9821, 0.9776, 0.9776, 0.9776, 0.9686, 0.9686, 0.9596, 0.9417, 0.9417, 0.9417, 0.9462, 0.9507, 0.9507, 0.9552, 0.9596, 0.9641, 0.9641, 0.9686, 0.9731, 0.9731, 0.9776, 0.9776, 0.9776, 0.9821, 0.9821, 0.9776, 0.9821, 0.9821, 0.9821, 0.9821, 0.9776, 0.9776, 0.9731, 0.9686, 0.9686, 0.9552, 0.9641, 0.9731, 0.9776, 0.9776, 0.9776, 0.9686, 0.9641, 0.9462, 0.861, 0.7848, 0.722, 0.6368, 0.5695] }, salsicha: { caixa: [300, 435, 1699, 764], base: [0.7508, 0.7994, 0.8389, 0.8663, 0.8875, 0.9088, 0.921, 0.9301, 0.9392, 0.9483, 0.9544, 0.9605, 0.9666, 0.9696, 0.9757, 0.9787, 0.9787, 0.9818, 0.9848, 0.9848, 0.9878, 0.9878, 0.9878, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9939, 0.9939, 0.9939, 0.9939, 0.9939, 0.9939, 0.9939, 0.9939, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9909, 0.9939, 0.9939, 0.9939, 0.9939, 0.9939, 0.9939, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.997, 0.9939, 0.9939, 0.9939, 0.9909, 0.9909, 0.9878, 0.9848, 0.9818, 0.9787, 0.9757, 0.9696, 0.9635, 0.9574, 0.9483, 0.9362, 0.921, 0.9119, 0.8906, 0.8784, 0.8511, 0.8085, 0.7538] }, "frango-desfiado": { caixa: [250, 452, 1749, 747], base: [0.7695, 0.9186, 0.9492, 0.9627, 0.9627, 0.9763, 0.9763, 0.9763, 0.9729, 0.9729, 0.9627, 0.9627, 0.9559, 0.9593, 0.9831, 0.9831, 0.9831, 0.9831, 0.9797, 0.9729, 0.9627, 0.9627, 0.9627, 0.9627, 0.9627, 0.9627, 0.9661, 0.9661, 0.9627, 0.9695, 0.9729, 0.9729, 0.9729, 0.9695, 0.9729, 0.9763, 0.9763, 0.9729, 0.9729, 0.9763, 0.9763, 0.9763, 0.9763, 0.9763, 0.9763, 0.9763, 0.9763, 0.9763, 0.9729, 0.9729, 0.9729, 0.9695, 0.9627, 0.9661, 0.9661, 0.9695, 0.9695, 0.9695, 0.9729, 0.9797, 0.9831, 0.9831, 0.9831, 0.9797, 0.9729, 0.9695, 0.9695, 0.9695, 0.9695, 0.9695, 0.9661, 0.9661, 0.9695, 0.9763, 0.9729, 0.9695, 0.9695, 0.9729, 0.9763, 0.9763, 0.9763, 0.9763, 0.9763, 0.9763, 0.9763, 0.9797, 0.9797, 0.9797, 0.9797, 0.9763, 0.9763, 0.9695, 0.9729, 0.9729, 0.9729, 0.9763, 0.9763, 0.9763, 0.9763, 0.9729, 0.9797, 0.9864, 0.9864, 0.9864, 0.9831, 0.9831, 0.9831, 0.9864, 0.9864, 0.9864, 0.9831, 0.9831, 0.9831, 0.9864, 0.9864, 0.9864, 0.9831, 0.9831, 0.9831, 0.9831, 0.9864, 0.9864, 0.9898, 0.9898, 0.9864, 0.9695, 0.9695, 0.9695, 0.9729, 0.9729, 0.9729, 0.9695, 0.9695, 0.9695, 0.9729, 0.9729, 0.9695, 0.9695, 0.9695, 0.9695, 0.9695, 0.9661, 0.9661, 0.9661, 0.9661, 0.9627, 0.9627, 0.9661, 0.9661, 0.9661, 0.9695, 0.9797, 0.9864, 0.9898, 0.9898, 0.9898, 0.9864, 0.9898, 0.9831, 0.9763, 0.9797, 0.9797, 0.9797, 0.9831, 0.9831, 0.9797, 0.9797, 0.9763, 0.9763, 0.9763, 0.9729, 0.9932, 0.9932, 0.9932, 0.9966, 1, 1, 1, 0.9966, 0.9797, 0.9797, 0.9797, 0.9797, 0.9797, 0.9797, 0.9797, 0.9797, 0.9797, 0.9797, 0.9763, 0.9763, 0.9729, 0.9763, 0.9763, 0.9763, 0.9763, 0.9763, 0.9797, 0.9797, 0.9763, 0.9729, 0.9695, 0.9729, 0.9729, 0.9695, 0.9695, 0.9729, 0.9729, 0.9695, 0.9661, 0.9661, 0.9661, 0.9661, 0.9661, 0.9661, 0.9627, 0.9627, 0.9627, 0.9763, 0.9831, 0.9864, 0.9864, 0.9864, 0.9831, 0.9864, 0.9864, 0.9864, 0.9831, 0.9661, 0.9627, 0.9593, 0.9627, 0.9627, 0.9627, 0.9525, 0.9356, 0.878, 0.8746, 0.8678, 0.8542] }, milho: { caixa: [325, 499, 1674, 700], base: [0.8955, 0.9204, 0.9353, 0.9502, 0.9602, 0.9602, 0.9701, 0.9701, 0.9701, 0.9701, 0.9701, 0.9552, 0.9751, 0.9801, 0.9801, 0.9801, 0.9851, 0.9851, 0.9851, 0.99, 0.99, 0.99, 0.99, 0.99, 0.9851, 0.9801, 0.9701, 0.9502, 0.9303, 0.9104, 0.9353, 0.9652, 0.9851, 0.99, 0.99, 0.99, 0.995, 0.995, 0.995, 0.995, 0.9851, 0.9751, 0.9602, 0.9502, 0.9403, 0.9652, 0.9801, 0.9851, 0.9851, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 1, 1, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.99, 0.99, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.9851, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.995, 0.99, 0.99, 0.995, 0.995, 0.99, 0.99, 0.99, 0.99, 0.995, 0.995, 0.99, 0.99, 0.99, 0.99, 0.99, 0.9851, 0.9801, 0.9851, 0.9801, 0.9751, 0.9801, 0.9801, 0.9801, 0.9801, 0.9801, 0.9801, 0.9801, 0.9751, 0.9751, 0.9652, 0.9353, 0.9005, 0.8507] }, "queijo-ralado": { caixa: [275, 469, 1724, 729], base: [0.85, 0.8538, 0.8462, 0.9808, 0.9808, 0.9808, 0.9731, 0.9731, 0.9731, 0.9731, 0.9885, 0.9885, 0.9885, 0.9885, 0.9885, 0.9885, 0.9846, 0.9846, 0.9846, 0.9808, 0.9885, 0.9923, 0.9923, 0.9923, 0.9923, 0.9923, 0.9885, 0.9846, 0.9846, 0.9846, 0.9923, 0.9923, 0.9923, 0.9923, 0.9885, 0.9885, 0.9885, 0.9846, 0.9885, 0.9846, 0.9808, 0.9808, 0.9846, 0.9808, 0.9808, 0.9846, 0.9846, 0.9808, 0.9808, 0.9846, 0.9846, 0.9808, 0.9808, 0.9846, 0.9962, 1, 1, 1, 1, 0.9885, 0.9885, 0.9885, 0.9885, 0.9885, 0.9885, 0.9846, 0.9808, 0.9808, 0.9808, 0.9808, 0.9846, 0.9846, 0.9808, 0.9846, 0.9846, 0.9885, 0.9923, 0.9923, 0.9923, 0.9923, 0.9885, 0.9923, 0.9885, 0.9962, 0.9962, 0.9962, 0.9885, 0.9808, 0.9846, 0.9846, 0.9846, 0.9846, 0.9846, 0.9808, 0.9808, 0.9846, 0.9846, 0.9885, 0.9885, 0.9846, 0.9846, 0.9846, 0.9846, 0.9808, 0.9808, 0.9846, 0.9885, 0.9885, 0.9846, 1, 1, 1, 1, 0.9962, 0.9962, 0.9962, 0.9962, 0.9923, 0.9846, 0.9808, 0.9808, 0.9808, 0.9808, 0.9846, 0.9846, 0.9808, 0.9808, 0.9808, 0.9885, 0.9885, 0.9885, 0.9885, 0.9885, 0.9923, 0.9923, 0.9885, 0.9885, 0.9923, 0.9962, 0.9962, 0.9962, 0.9962, 0.9885, 0.9846, 0.9808, 0.9846, 0.9808, 0.9808, 0.9923, 0.9962, 0.9962, 0.9962, 0.9923, 0.9962, 0.9962, 0.9962, 0.9923, 0.9923, 0.9923, 0.9923, 0.9923, 0.9885, 0.9808, 0.9808, 0.9808, 0.9808, 0.9808, 0.9808, 0.9846, 0.9885, 0.9885, 0.9846, 0.9885, 0.9885, 0.9846, 0.9808, 0.9808, 0.9808, 0.9808, 0.9808, 0.9846, 0.9846, 0.9808, 0.9846, 0.9885, 0.9885, 0.9846, 0.9846, 0.9846, 0.9846, 0.9846, 0.9846, 0.9846, 0.9846, 0.9808, 0.9808, 0.9885, 0.9885, 0.9885, 0.9923, 0.9923, 0.9923, 0.9923, 0.9885, 0.9885, 0.9885, 0.9885, 0.9885, 0.9885, 0.9885, 0.9808, 0.9808, 0.9808, 0.9808, 0.9808, 0.9769, 0.9808, 0.9769, 0.9808, 0.9808, 0.9769, 0.9769, 0.9808, 0.9808, 0.9808, 0.9808, 0.9808, 0.9808, 0.9808, 0.9808, 0.9808, 0.9808, 0.9692, 0.9692, 0.9692, 0.9731, 0.9731, 0.9731, 0.9538, 0.8462] } };

// components/raio-x/sombra.ts
var BORRAO_PX = 10;
var DESLOCAMENTO_PX = 14;
var OPACIDADE = 0.37;
var FOLGA_PX = 16;
var BASELINES = baselines_default;
function caixaX0(slug) {
  return BASELINES[slug]?.caixa[0] ?? 0;
}
function larguraCaixa(slug) {
  const b = BASELINES[slug];
  return b ? b.caixa[2] - b.caixa[0] : 0;
}
var cache = /* @__PURE__ */ new Map();
function sombraDe(slug, k) {
  const b = BASELINES[slug];
  if (!b || typeof document === "undefined") return null;
  const chave = `${slug}:${k.toFixed(4)}`;
  const guardada = cache.get(chave);
  if (guardada) return guardada;
  const caixa = b.caixa;
  const w = Math.max(8, Math.round((caixa[2] - caixa[0]) * k));
  const alturaCaixa = (caixa[3] - caixa[1]) * k;
  const minBase = b.base.reduce((m, v) => v < m ? v : m, 1);
  const amplitude = Math.max(6, (1 - minBase) * alturaCaixa);
  const h = Math.round(amplitude + FOLGA_PX * 2 + 2);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const baseY = h - FOLGA_PX;
  ctx.filter = `blur(${BORRAO_PX}px)`;
  ctx.fillStyle = "#120D0B";
  ctx.beginPath();
  ctx.moveTo(0, h);
  b.base.forEach((v, j) => {
    ctx.lineTo(j / (b.base.length - 1) * w, baseY - (1 - v) * alturaCaixa);
  });
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  const dado = { url: cv.toDataURL(), w, h, baseY, x0Caixa: caixa[0] * k };
  cache.set(chave, dado);
  return dado;
}

// components/raio-x/prensa.ts
var GAP = 46;
var PRENSA_ESPACAMENTO = 0.3;
var SELADO_ESPACAMENTO = 0.4;
var MEDIDA_MAX_U = 2200;
var PRENSA_MS = 340;
var PRENSA_CURVA = "cubic-bezier(.14,.92,.24,1)";
var ESPALHA_X_MIN = 1.16;
var ESPALHA_X_MAX = 1.3;
var ESPALHA_Y = 0.8;
var ASSENTA_Y = 0.9;
var AFUNDAMENTO_TOPO_MAX = 0.65;
var TETO_SOBRE_A_DE_BAIXO = 0.55;
var FATOR_RESPIRO_ALTURA = 0.94;
var PISO_ESCALA = 0.7;
var PISO_FOLGA = 0.4;
function paesDe(forma) {
  const p = CAMADAS.filter((c) => c.pao === forma).sort((a, b) => a.ordem - b.ordem);
  return [p[0].slug, p[p.length - 1].slug];
}
var PAES = {
  prensado: paesDe("prensado"),
  redondo: paesDe("redondo")
};
function ehPao(slug) {
  return !!MAPA_CAMADAS[slug]?.pao;
}
function afundamentoPx(slugs, i) {
  if (i === 0) return 0;
  const c = MAPA_CAMADAS[slugs[i]];
  const abaixo = MAPA_CAMADAS[slugs[i - 1]];
  if (!c || !abaixo) return 0;
  const noTopo = i === slugs.length - 1;
  const af = noTopo ? Math.min(c.afundamento, AFUNDAMENTO_TOPO_MAX) : c.afundamento;
  return Math.min(c.alturaPx * af, abaixo.alturaPx * TETO_SOBRE_A_DE_BAIXO);
}
function visivelPx(slugs, i) {
  const c = MAPA_CAMADAS[slugs[i]];
  return c ? c.alturaPx - afundamentoPx(slugs, i) : 0;
}
function expostoPx(slugs, i) {
  const c = MAPA_CAMADAS[slugs[i]];
  if (!c) return 0;
  if (i === slugs.length - 1) return c.alturaPx;
  return c.alturaPx - afundamentoPx(slugs, i + 1);
}
function fatorFechado(forma) {
  return forma === "prensado" ? PRENSA_ESPACAMENTO : SELADO_ESPACAMENTO;
}
function espalhaXDe(slugs) {
  const paoSlug = slugs.find((s) => ehPao(s));
  const larguraPao = paoSlug ? larguraCaixa(paoSlug) : 0;
  const maiorRecheio = slugs.filter((s) => !ehPao(s)).reduce((max, s) => Math.max(max, larguraCaixa(s)), 0);
  if (!larguraPao || !maiorRecheio) return ESPALHA_X_MIN;
  return Math.min(ESPALHA_X_MAX, Math.max(ESPALHA_X_MIN, larguraPao / maiorRecheio));
}
function unidadesPilha(slugs, fator) {
  const com = slugs.filter((s) => MAPA_CAMADAS[s] && MAPA_CAMADAS[s].alturaPx > 0);
  if (!com.length) return 0;
  let u = MAPA_CAMADAS[com[0]].alturaPx;
  for (let i = 1; i < com.length; i++) u += visivelPx(com, i) * fator;
  return u;
}
var CORTE_AMPLO = 900;
function geometria(opcoes) {
  const { slugs, areaW, areaH, comprimido, forma, chamadas } = opcoes;
  const colW = chamadas ? Math.min(200, Math.max(80, areaW * 0.28)) : 0;
  const x0 = chamadas ? colW + 18 : 0;
  const larguraPilha = Math.max(130, areaW - x0 - (chamadas ? 10 : 0));
  const prensa = comprimido && forma === "prensado";
  const assenta = comprimido && forma !== "prensado";
  const somaAlturas = slugs.reduce((soma, s) => soma + (MAPA_CAMADAS[s]?.alturaPx ?? 0), 0);
  const gapsBase = Math.max(0, slugs.length - 1) * GAP;
  const escalaNatural = larguraPilha / 2e3;
  const alturaAlvo = areaH * FATOR_RESPIRO_ALTURA;
  const cabeNaAltura = (folgaFracao, escala) => escala * (somaAlturas + gapsBase * folgaFracao) <= alturaAlvo;
  let folga = 1;
  let k = escalaNatural;
  let estourou = false;
  if (!cabeNaAltura(1, escalaNatural)) {
    if (gapsBase > 0) {
      folga = Math.min(
        1,
        Math.max(PISO_FOLGA, (alturaAlvo / escalaNatural - somaAlturas) / gapsBase)
      );
    }
    if (!cabeNaAltura(folga, escalaNatural)) {
      const unidadesComFolgaMin = somaAlturas + gapsBase * folga;
      const kAltura = unidadesComFolgaMin ? alturaAlvo / unidadesComFolgaMin : escalaNatural;
      const piso = escalaNatural * PISO_ESCALA;
      estourou = kAltura < piso - 1e-3;
      k = Math.max(piso, kAltura);
    }
  }
  const tops = [];
  let cursor = 0;
  slugs.forEach((s, i) => {
    const c = MAPA_CAMADAS[s];
    if (i === 0) cursor = -(c?.alturaPx ?? 0);
    else if (comprimido) cursor -= visivelPx(slugs, i) * fatorFechado(forma);
    else cursor -= (c?.alturaPx ?? 0) + GAP * folga;
    tops.push(cursor);
  });
  const minTop = tops.length ? tops[tops.length - 1] : 0;
  const offsetY = estourou ? 0 : (areaH - -minTop * k) / 2;
  const espalhaX = prensa ? espalhaXDe(slugs) : ESPALHA_X_MIN;
  return {
    colW,
    x0,
    larguraPilha,
    k,
    tops,
    minTop,
    offsetY,
    prensa,
    assenta,
    espalhaX,
    escalaNatural,
    estourou,
    folga
  };
}

// components/raio-x/Camada.tsx
import { Fragment as Fragment2, jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
var TOQUE_MIN = 44;
function medidas(camada, indice, g) {
  const wTop = g.tops[indice] - g.minTop;
  return {
    /** Topo do embrulho: recua meio quadro para o objeto pousar em `topoObjeto`. */
    topoEmbrulho: g.offsetY + (wTop - (600 - camada.alturaPx / 2)) * g.k,
    topoObjeto: g.offsetY + wTop * g.k,
    baseObjeto: g.offsetY + (wTop + camada.alturaPx) * g.k
  };
}
function Camada({ camada, uid, n, indice, slugs, g, estado, transicao }) {
  const { comprimido, selando, selado, marca, forma } = estado;
  const { topoEmbrulho, baseObjeto } = medidas(camada, indice, g);
  const parado = comprimido || selando || selado;
  const estilo = {
    position: "absolute",
    left: g.x0,
    width: g.larguraPilha,
    top: 0,
    transform: `translateY(${topoEmbrulho}px)`,
    height: 1200 * g.k,
    zIndex: 10 + indice,
    cursor: "grab",
    touchAction: "none",
    transformOrigin: "50% 50%",
    transition: `${transicao}, opacity 200ms linear`
  };
  const visual = { position: "absolute", inset: 0, transition: transicao };
  if (!parado) visual.animation = `rx-osc ${6.4 + indice * 0.7}s ease-in-out ${-indice * 1.3}s infinite`;
  if (g.prensa && !camada.pao) visual.transform = `scaleX(${g.espalhaX}) scaleY(${ESPALHA_Y})`;
  else if (g.assenta && !camada.pao && !camada.firme) visual.transform = `scaleY(${ASSENTA_Y})`;
  const sombra = comprimido ? sombraDe(camada.slug, g.k) : null;
  const arquivo = urlCamada(camada);
  return /* @__PURE__ */ jsx6(
    "div",
    {
      id: `rx-camada-${camada.slug}-${n}`,
      "data-inst": uid,
      "data-altura-px": camada.alturaPx,
      "data-exposto-px": expostoPx(slugs, indice).toFixed(2),
      style: estilo,
      children: /* @__PURE__ */ jsxs4("div", { className: "camada-visual", style: visual, children: [
        sombra && /* @__PURE__ */ jsx6(
          "div",
          {
            "aria-hidden": "true",
            style: {
              position: "absolute",
              left: sombra.x0Caixa,
              top: baseObjeto - topoEmbrulho - sombra.baseY + DESLOCAMENTO_PX,
              width: sombra.w,
              height: sombra.h,
              opacity: OPACIDADE,
              pointerEvents: "none",
              background: `center/100% 100% no-repeat url("${sombra.url}")`
            }
          }
        ),
        /* @__PURE__ */ jsx6(
          "div",
          {
            role: "img",
            "aria-label": camada.alt,
            draggable: false,
            "data-foto-camada": true,
            style: {
              position: "absolute",
              inset: 0,
              background: `center/contain no-repeat url("${arquivo}")`,
              userSelect: "none"
            }
          }
        ),
        forma === "prensado" && camada.pao && /* @__PURE__ */ jsx6(
          "div",
          {
            "aria-hidden": "true",
            style: {
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              mixBlendMode: "multiply",
              opacity: marca ? 0.27 : 0.12,
              transition: "opacity 200ms linear",
              background: "repeating-linear-gradient(97deg, transparent 0 24px, color-mix(in srgb, var(--latao) 92%, transparent) 24px 36px, transparent 36px 58px)",
              WebkitMaskImage: `url("${arquivo}")`,
              maskImage: `url("${arquivo}")`,
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center"
            }
          }
        )
      ] })
    }
  );
}
function TiraDeToque({
  indice,
  topo,
  base,
  alturaArea
}) {
  const faixa = Math.max(0, base - topo);
  const altura = Math.max(TOQUE_MIN, faixa);
  const y = Math.min(
    Math.max(0, alturaArea - altura),
    Math.max(0, topo + (faixa - altura) / 2)
  );
  return /* @__PURE__ */ jsx6(
    "button",
    {
      type: "button",
      "data-toque": indice,
      "data-faixa": faixa.toFixed(1),
      tabIndex: -1,
      "aria-hidden": "true",
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        height: altura,
        padding: 0,
        background: "none",
        border: 0,
        cursor: "grab",
        touchAction: "none",
        pointerEvents: "auto",
        zIndex: Math.round(Math.max(0, TOQUE_MIN - faixa))
      }
    }
  );
}
var nomeDaChamada = {
  fontVariationSettings: "'wdth' 92, 'wght' 500",
  fontSize: "0.8125rem",
  color: "var(--osso)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};
function Chamada({
  camada,
  n,
  indice,
  g,
  rotuloTop,
  fixa
}) {
  const { topoObjeto } = medidas(camada, indice, g);
  const pontoX = g.x0 + caixaX0(camada.slug) * g.k;
  const x1 = g.colW + 6;
  const y1 = rotuloTop + TOQUE_MIN / 2;
  const dx = pontoX - x1;
  const dy = topoObjeto - y1;
  const comprimento = Math.hypot(dx, dy);
  const angulo = Math.atan2(dy, dx) * 180 / Math.PI;
  return /* @__PURE__ */ jsxs4(Fragment2, { children: [
    /* @__PURE__ */ jsx6(
      "div",
      {
        "aria-hidden": "true",
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          background: "var(--letreiro)",
          opacity: 0.6,
          pointerEvents: "none",
          zIndex: 26,
          transformOrigin: "0 0",
          transform: `translate(${x1}px, ${y1}px) rotate(${angulo}deg) scaleX(${Math.max(0, comprimento)})`,
          transition: "transform 300ms linear"
        }
      }
    ),
    /* @__PURE__ */ jsx6(
      "div",
      {
        "aria-hidden": "true",
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${pontoX - 1.5}px, ${topoObjeto - 1.5}px)`,
          width: 3,
          height: 3,
          background: "var(--letreiro)",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 27,
          transition: "transform 300ms linear"
        }
      }
    ),
    /* @__PURE__ */ jsx6(
      "button",
      {
        id: `rx-chamada-${camada.slug}-${n}`,
        type: "button",
        "data-chamada": indice,
        "aria-label": `${camada.nome}. ${fixa ? "Camada fixa." : "Setas movem, Delete tira."}`,
        style: {
          position: "absolute",
          left: 0,
          width: g.colW,
          top: 0,
          transform: `translateY(${rotuloTop}px)`,
          minHeight: TOQUE_MIN,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 0,
          background: "none",
          border: 0,
          cursor: "grab",
          textAlign: "left",
          zIndex: 28,
          touchAction: "none",
          transition: "transform 300ms linear"
        },
        children: /* @__PURE__ */ jsxs4("span", { style: nomeDaChamada, children: [
          camada.nome,
          fixa && /* @__PURE__ */ jsx6("small", { className: "camada-fixa", children: "fixa" })
        ] })
      }
    )
  ] });
}
function ChamadaChip({
  camada,
  n,
  indice,
  g,
  alturaArea,
  onTirar,
  fixa
}) {
  const { topoObjeto } = medidas(camada, indice, g);
  const pontoX = g.x0 + caixaX0(camada.slug) * g.k;
  const y = Math.min(Math.max(0, alturaArea - TOQUE_MIN), Math.max(0, topoObjeto - TOQUE_MIN / 2));
  return /* @__PURE__ */ jsxs4(Fragment2, { children: [
    /* @__PURE__ */ jsx6(
      "div",
      {
        "aria-hidden": "true",
        style: {
          position: "absolute",
          left: pontoX - 2,
          top: topoObjeto - 2,
          width: 5,
          height: 5,
          background: "var(--letreiro)",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 27
        }
      }
    ),
    /* @__PURE__ */ jsxs4(
      "div",
      {
        style: {
          position: "absolute",
          left: 6,
          top: y,
          maxWidth: "calc(100% - 12px)",
          display: "flex",
          alignItems: "stretch",
          background: "var(--fumo)",
          border: "1px solid var(--traco)",
          borderRadius: 2,
          zIndex: 28
        },
        children: [
          /* @__PURE__ */ jsx6(
            "button",
            {
              id: `rx-chamada-${camada.slug}-${n}`,
              type: "button",
              "data-chamada": indice,
              "aria-label": `${camada.nome}. ${fixa ? "Camada fixa." : "Setas movem, Delete tira."}`,
              style: {
                display: "flex",
                alignItems: "center",
                minHeight: TOQUE_MIN,
                minWidth: TOQUE_MIN,
                padding: "0 12px",
                background: "none",
                border: 0,
                cursor: "grab",
                textAlign: "left",
                touchAction: "none"
              },
              children: /* @__PURE__ */ jsxs4("span", { style: nomeDaChamada, children: [
                camada.nome,
                fixa && /* @__PURE__ */ jsx6("small", { className: "camada-fixa", children: "fixa" })
              ] })
            }
          ),
          !fixa && /* @__PURE__ */ jsx6(
            "button",
            {
              type: "button",
              "data-tirar": indice,
              "aria-label": `Tirar ${camada.nome.toLowerCase()}`,
              onPointerDown: (e) => e.stopPropagation(),
              onClick: () => onTirar(indice),
              style: {
                width: TOQUE_MIN,
                minHeight: TOQUE_MIN,
                flex: "0 0 auto",
                padding: 0,
                background: "none",
                border: 0,
                borderLeft: "1px solid var(--traco)",
                color: "var(--osso)",
                fontSize: "1.125rem",
                lineHeight: 1,
                cursor: "pointer"
              },
              children: "\xD7"
            }
          )
        ]
      }
    )
  ] });
}

// components/raio-x/Composicao.tsx
import { jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
function Composicao({ pilha, fixa, onTirar, onMover, onFechar }) {
  const { MAPA_CAMADAS: MAPA_CAMADAS2 } = useNegocio();
  const linhas = pilha.map((inst, indice) => ({ inst, indice })).reverse();
  return /* @__PURE__ */ jsxs5("div", { id: "rx-composicao", role: "group", "aria-label": "Composi\xE7\xE3o do lanche", children: [
    /* @__PURE__ */ jsxs5(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "6px 6px 6px clamp(12px, 4vw, 20px)",
          borderBottom: "1px solid var(--traco)"
        },
        children: [
          /* @__PURE__ */ jsx7("span", { style: { fontVariationSettings: "'wdth' 92, 'wght' 600", fontSize: "0.875rem" }, children: "Composi\xE7\xE3o" }),
          /* @__PURE__ */ jsx7(
            "button",
            {
              id: "rx-fechar-composicao",
              type: "button",
              onClick: onFechar,
              "aria-label": "Fechar a composi\xE7\xE3o",
              style: {
                width: TOQUE_MIN,
                minHeight: TOQUE_MIN,
                padding: 0,
                background: "none",
                border: 0,
                color: "var(--osso)",
                fontSize: "1.125rem",
                lineHeight: 1,
                cursor: "pointer"
              },
              children: "\xD7"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx7(
      "ul",
      {
        style: {
          margin: 0,
          padding: 0,
          listStyle: "none",
          overflowY: "auto",
          overscrollBehavior: "contain"
        },
        children: linhas.map(({ inst, indice }) => {
          const c = MAPA_CAMADAS2[inst.slug];
          return /* @__PURE__ */ jsxs5(
            "li",
            {
              className: "composicao-linha",
              "data-slug": inst.slug,
              "data-fixa": fixa(inst.slug) ? "" : void 0,
              style: {
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: TOQUE_MIN,
                padding: "0 6px 0 clamp(12px, 4vw, 20px)",
                borderBottom: "1px solid var(--traco)"
              },
              children: [
                /* @__PURE__ */ jsx7(
                  "span",
                  {
                    style: {
                      flex: "1 1 auto",
                      fontVariationSettings: "'wdth' 92, 'wght' 500",
                      fontSize: "0.9375rem",
                      color: "var(--osso)"
                    },
                    children: c.nome
                  }
                ),
                /* @__PURE__ */ jsx7(
                  "span",
                  {
                    "data-preco": true,
                    style: {
                      fontFamily: "var(--fonte-medida)",
                      fontWeight: 500,
                      fontVariantNumeric: "var(--numerais)",
                      fontSize: "0.8125rem",
                      color: "var(--latao)",
                      opacity: c.precoCent ? 1 : 0.4
                    },
                    children: c.precoCent ? brl(c.precoCent) : "\u2014"
                  }
                ),
                !c.obrigatorio && /* @__PURE__ */ jsxs5("div", { className: "composicao-mover", children: [
                  /* @__PURE__ */ jsx7("button", { type: "button", className: "botao-texto", "data-mover-cima": indice, "aria-label": `Subir ${c.nome.toLowerCase()}`, disabled: indice >= pilha.length - 2, onClick: () => onMover(indice, 1), children: "\u2191" }),
                  /* @__PURE__ */ jsx7("button", { type: "button", className: "botao-texto", "data-mover-baixo": indice, "aria-label": `Descer ${c.nome.toLowerCase()}`, disabled: indice <= 1, onClick: () => onMover(indice, -1), children: "\u2193" })
                ] }),
                fixa(inst.slug) ? /* @__PURE__ */ jsx7(
                  "span",
                  {
                    style: {
                      width: TOQUE_MIN,
                      textAlign: "center",
                      fontVariationSettings: "'wdth' 92, 'wght' 500",
                      fontSize: "0.6875rem",
                      color: "var(--osso)",
                      opacity: 0.4
                    },
                    children: "fixa"
                  }
                ) : /* @__PURE__ */ jsx7(
                  "button",
                  {
                    type: "button",
                    "data-tirar": indice,
                    onClick: () => onTirar(indice),
                    "aria-label": `Tirar ${c.nome.toLowerCase()}`,
                    style: {
                      width: TOQUE_MIN,
                      minHeight: TOQUE_MIN,
                      flex: "0 0 auto",
                      padding: 0,
                      background: "none",
                      border: 0,
                      color: "var(--osso)",
                      fontSize: "1.125rem",
                      lineHeight: 1,
                      cursor: "pointer"
                    },
                    children: "\xD7"
                  }
                )
              ]
            },
            inst.uid
          );
        })
      }
    ),
    /* @__PURE__ */ jsx7(
      "p",
      {
        style: {
          margin: 0,
          padding: "8px clamp(12px, 4vw, 20px)",
          fontVariationSettings: "'wdth' 92, 'wght' 500",
          fontSize: "0.75rem",
          lineHeight: 1.5,
          color: "var(--osso)",
          opacity: 0.5
        },
        children: "Toque no trilho para p\xF4r. Toque numa camada da pilha para ver o nome dela. No teclado: setas movem, Delete tira. Os bot\xF5es \u2191 e \u2193 tamb\xE9m mudam a ordem."
      }
    )
  ] });
}

// components/raio-x/Medidor.tsx
import { jsx as jsx8, jsxs as jsxs6 } from "react/jsx-runtime";
var mono = {
  fontFamily: "var(--fonte-medida)",
  fontWeight: 500,
  fontVariantNumeric: "var(--numerais)",
  lineHeight: 1
};
var miudo = {
  fontVariationSettings: "'wdth' 92, 'wght' 500",
  fontSize: "0.75rem",
  lineHeight: 1.35,
  color: "var(--osso)"
};
function Medidor({
  precoCent,
  camadas,
  pct,
  aviso,
  recado,
  avisoOrdem,
  onDispensarOrdem,
  transicaoBarra,
  onVerComposicao,
  flutuaRef
}) {
  const contagem = camadas === 0 ? "painel vazio" : camadas === 1 ? "1 camada" : `${camadas} camadas`;
  return /* @__PURE__ */ jsxs6("div", { id: "rx-medidor", children: [
    /* @__PURE__ */ jsxs6("div", { id: "rx-medidor-linha", children: [
      /* @__PURE__ */ jsx8(
        "span",
        {
          id: "rx-preco-valor",
          "data-preco": true,
          style: { ...mono, fontSize: "1.75rem", letterSpacing: "-0.02em", color: "var(--latao)" },
          children: brl(precoCent)
        }
      ),
      /* @__PURE__ */ jsxs6(
        "button",
        {
          id: "rx-ver-composicao",
          type: "button",
          disabled: camadas === 0,
          onClick: onVerComposicao,
          style: {
            display: "grid",
            gap: 3,
            justifyItems: "end",
            padding: 0,
            background: "none",
            border: 0,
            cursor: camadas === 0 ? "default" : "pointer",
            textAlign: "right",
            opacity: camadas === 0 ? 0.45 : 1
          },
          children: [
            /* @__PURE__ */ jsx8(
              "span",
              {
                id: "rx-camadas-valor",
                "data-medida": true,
                style: { ...mono, fontSize: "1.125rem", color: "var(--letreiro)" },
                children: contagem
              }
            ),
            /* @__PURE__ */ jsx8("span", { style: { ...miudo, fontSize: "0.6875rem", opacity: 0.6 }, children: "ver composi\xE7\xE3o" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx8(
      "div",
      {
        id: "rx-medida",
        "data-medida": true,
        role: "img",
        "aria-label": `Altura da pilha: ${Math.round(pct)} por cento do medidor`,
        style: {
          height: 8,
          background: "var(--borra)",
          border: "1px solid var(--traco)",
          borderRadius: 1,
          overflow: "hidden"
        },
        children: /* @__PURE__ */ jsx8(
          "div",
          {
            style: {
              width: "100%",
              transform: `scaleX(${pct / 100})`,
              transformOrigin: "left center",
              height: "100%",
              background: "var(--letreiro)",
              transition: `transform ${transicaoBarra}`
            }
          }
        )
      }
    ),
    /* @__PURE__ */ jsxs6("div", { id: "rx-flutua", ref: flutuaRef, children: [
      /* @__PURE__ */ jsx8("div", { className: "aviso-ordem-regiao", role: "status", "aria-live": "polite", children: avisoOrdem && /* @__PURE__ */ jsx8(
        "button",
        {
          type: "button",
          "data-aviso-ordem": true,
          onClick: onDispensarOrdem,
          "aria-label": `${TEXTO_AVISO_ORDEM} Toque para fechar.`,
          children: TEXTO_AVISO_ORDEM
        }
      ) }),
      /* @__PURE__ */ jsx8(
        "span",
        {
          id: "rx-aviso",
          "data-aviso": aviso ? "" : void 0,
          style: { ...miudo, color: aviso ? "var(--latao)" : "var(--osso)", opacity: aviso ? 1 : 0.5 },
          children: aviso ? "Risco de desmontar. Segue por sua conta." : `at\xE9 ${LIMIAR_AVISO_CAMADAS} camadas a pilha para em p\xE9`
        }
      ),
      /* @__PURE__ */ jsx8("p", { id: "rx-recado", "aria-live": "polite", style: { ...miudo, margin: 0, fontSize: "0.8125rem", opacity: 0.78 }, children: recado }),
      /* @__PURE__ */ jsx8("p", { id: "rx-ajuda", style: { ...miudo, margin: 0, lineHeight: 1.5, opacity: 0.5 }, children: "Toque para adicionar. Arraste para reordenar, ou para fora para tirar. No teclado: setas movem, Delete tira." })
    ] })
  ] });
}
function BotaoSelar({
  podeFechar,
  texto,
  onSelar
}) {
  return /* @__PURE__ */ jsx8(
    "button",
    {
      id: "rx-selar",
      type: "button",
      disabled: !podeFechar,
      onClick: onSelar,
      style: {
        background: podeFechar ? "var(--latao)" : "var(--fumo)",
        color: podeFechar ? "var(--borra)" : "var(--osso)",
        border: `1px solid ${podeFechar ? "var(--latao)" : "var(--traco)"}`,
        borderRadius: 2,
        fontFamily: "var(--fonte-corpo), sans-serif",
        fontSize: "1rem",
        fontVariationSettings: "'wght' 600",
        cursor: podeFechar ? "pointer" : "default",
        opacity: podeFechar ? 1 : 0.45
      },
      children: texto
    }
  );
}

// components/raio-x/rotulos.ts
var ESPACO_MIN_ROTULO = 22;
function distribuirRotulos(topos, alturaRotulo, espacoMin = ESPACO_MIN_ROTULO) {
  const n = topos.length;
  if (n <= 1) return topos.slice();
  const passo = alturaRotulo + espacoMin;
  const alvos = topos.map((t, i) => t - i * passo);
  const blocos = [];
  for (let i = 0; i < n; i++) {
    let bloco = { soma: alvos[i], peso: 1, tamanho: 1, valor: alvos[i] };
    while (blocos.length && blocos[blocos.length - 1].valor > bloco.valor) {
      const anterior = blocos.pop();
      const soma = anterior.soma + bloco.soma;
      const peso = anterior.peso + bloco.peso;
      bloco = { soma, peso, tamanho: anterior.tamanho + bloco.tamanho, valor: soma / peso };
    }
    blocos.push(bloco);
  }
  const nivelado = [];
  for (const bloco of blocos) {
    for (let k = 0; k < bloco.tamanho; k++) nivelado.push(bloco.valor);
  }
  return nivelado.map((v, i) => v + i * passo);
}

// components/raio-x/Trilho.tsx
import { jsx as jsx9, jsxs as jsxs7 } from "react/jsx-runtime";
var RECHEIOS = CAMADAS.filter((c) => !c.pao).sort((a, b) => a.ordem - b.ordem);
function Trilho({
  contarSlug,
  ausentes,
  bloqueado,
  cheio,
  onAdicionar,
  onArrastar,
  folha
}) {
  const { CAMADAS: CAMADAS2 } = useNegocio();
  const recheios = CAMADAS2.filter((c) => !c.pao).sort((a, b) => a.ordem - b.ordem);
  return /* @__PURE__ */ jsx9("div", { id: "rx-trilho", "data-folha": folha ? "" : void 0, role: "group", "aria-label": "Ingredientes dispon\xEDveis", children: recheios.map((c) => {
    const n = contarSlug(c.slug);
    const ausente = !!ausentes[c.slug];
    const off = bloqueado || ausente || cheio || n >= MAX_REPETICOES;
    return /* @__PURE__ */ jsxs7(
      "button",
      {
        type: "button",
        "data-slug": c.slug,
        disabled: off,
        "aria-label": `${c.nome}, ${ausente ? "em falta" : brl(c.precoCent)}${n ? `, ${n} na pilha` : ""}`,
        onClick: () => onAdicionar(c.slug),
        onPointerDown: (e) => {
          if (!folha || e.pointerType === "mouse") onArrastar(e, c.slug);
        },
        style: {
          display: "grid",
          gap: 2,
          justifyItems: "start",
          alignContent: "start",
          background: "var(--fumo)",
          border: "1px solid var(--traco)",
          borderRadius: 2,
          cursor: off ? "default" : "pointer",
          textAlign: "left",
          touchAction: folha ? "pan-y" : "none",
          opacity: off ? 0.34 : 1
        },
        children: [
          /* @__PURE__ */ jsx9(
            "span",
            {
              "data-ficha-foto": true,
              "aria-hidden": "true",
              style: {
                background: ausente ? "none" : `center/contain no-repeat url("${c.ficha}")`
              }
            }
          ),
          /* @__PURE__ */ jsx9(
            "span",
            {
              "data-ficha-nome": true,
              "aria-hidden": "true",
              style: {
                fontVariationSettings: "'wdth' 92, 'wght' 500",
                fontSize: "0.6875rem",
                lineHeight: 1,
                color: "var(--osso)",
                width: "100%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              },
              children: c.nome
            }
          ),
          /* @__PURE__ */ jsxs7("span", { "data-ficha-texto": true, "aria-hidden": "true", children: [
            /* @__PURE__ */ jsx9(
              "span",
              {
                style: {
                  fontVariationSettings: "'wdth' 92, 'wght' 500",
                  fontSize: "0.8125rem",
                  color: "var(--osso)"
                },
                children: c.nome
              }
            ),
            /* @__PURE__ */ jsx9(
              "span",
              {
                "data-preco": true,
                style: {
                  fontSize: "0.75rem",
                  fontVariantNumeric: "var(--numerais)",
                  color: "var(--latao)"
                },
                children: brl(c.precoCent)
              }
            )
          ] }),
          (ausente || n > 0) && /* @__PURE__ */ jsx9(
            "span",
            {
              "data-ficha-conta": true,
              "aria-hidden": "true",
              style: {
                fontVariationSettings: "'wght' 500",
                fontSize: "0.75rem",
                fontVariantNumeric: "var(--numerais)",
                color: "var(--letreiro)"
              },
              children: ausente ? "em falta" : `${n}\xD7`
            }
          )
        ]
      },
      c.slug
    );
  }) });
}

// components/raio-x/RaioX.tsx
import { Fragment as Fragment3, jsx as jsx10, jsxs as jsxs8 } from "react/jsx-runtime";
var CURVA_ASSENTA = "cubic-bezier(.32,.02,.24,1)";
var CURVA_EXPLODE = "cubic-bezier(.22,1.24,.36,1)";
function RaioX({ nome, forma, camadasIniciais, onFechar, onSair, editando, fixoSlug, observacaoInicial = "" }) {
  const { CAMADAS: CAMADAS2, MAPA_CAMADAS: MAPA_CAMADAS2, precoDoLanche: precoDoLanche2, camadaFixa: camadaFixa2 } = useNegocio();
  const [observacao, setObservacao] = useState2(observacaoInicial.slice(0, 120));
  const fixa = useCallback((slug) => camadaFixa2(slug, fixoSlug), [fixoSlug]);
  const uidRef = useRef3(1);
  const instanciar = useCallback(
    (slugs2) => slugs2.filter((s) => MAPA_CAMADAS2[s]).map((s) => ({ slug: s, uid: uidRef.current++ })),
    []
  );
  const [pilha, setPilha] = useState2(() => instanciar(camadasIniciais));
  const [modoMontador] = useState2(() => camadasIniciais.length === 0);
  const [trilhoAberto, setTrilhoAberto] = useState2(modoMontador);
  const [comprimido, setComprimido] = useState2(false);
  const [marca, setMarca] = useState2(false);
  const [selando, setSelando] = useState2(false);
  const [selado, setSelado] = useState2(false);
  const [varrendo, setVarrendo] = useState2(false);
  const [recado, setRecado] = useState2("");
  const [avisoOrdem, setAvisoOrdem] = useState2(false);
  const [area, setArea] = useState2({ w: 0, h: 0 });
  const [amplo, setAmplo] = useState2(false);
  const [revelada, setRevelada] = useState2(null);
  const [composicao, setComposicao] = useState2(false);
  const [ausentes, setAusentes] = useState2({});
  const [flutuaH, setFlutuaH] = useState2(0);
  const desenhoRef = useRef3(null);
  const flutuaRef = useRef3(null);
  const timers = useRef3([]);
  const agendar = useCallback((fn, ms) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const vivo = useRef3({ pilha, selando, selado, area, forma });
  useLayoutEffect2(() => {
    vivo.current = { pilha, selando, selado, area, forma };
  });
  useEffect2(() => {
    const alvo2 = desenhoRef.current;
    if (!alvo2) return;
    const medir = () => {
      const r = alvo2.getBoundingClientRect();
      setArea((a) => Math.abs(r.width - a.w) > 1 || Math.abs(r.height - a.h) > 1 ? { w: r.width, h: r.height } : a);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(alvo2);
    return () => ro.disconnect();
  }, []);
  useEffect2(() => {
    const alvo2 = flutuaRef.current;
    if (!alvo2) return;
    const medir = () => {
      const r = alvo2.getBoundingClientRect();
      setFlutuaH((h) => Math.abs(r.height - h) > 0.5 ? r.height : h);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(alvo2);
    return () => ro.disconnect();
  }, []);
  useEffect2(() => {
    CAMADAS2.filter((c) => c.alturaPx === 0).forEach((c) => {
      const im = new Image();
      im.onerror = () => setAusentes((a) => ({ ...a, [c.slug]: true }));
      im.src = urlCamada(c);
    });
  }, []);
  useEffect2(() => {
    const pendentes = timers.current;
    return () => pendentes.forEach(window.clearTimeout);
  }, []);
  useEffect2(() => {
    const mq = window.matchMedia(`(min-width: ${CORTE_AMPLO}px)`);
    const ler2 = () => setAmplo(mq.matches);
    ler2();
    mq.addEventListener("change", ler2);
    return () => mq.removeEventListener("change", ler2);
  }, []);
  useEffect2(() => {
    if (!composicao) return;
    const aoTeclarFora = (e) => {
      if (e.key === "Escape") setComposicao(false);
    };
    window.addEventListener("keydown", aoTeclarFora);
    return () => window.removeEventListener("keydown", aoTeclarFora);
  }, [composicao]);
  useEffect2(() => {
    if (modoMontador || !trilhoAberto) return;
    const aoTeclarFora = (e) => {
      if (e.key === "Escape") transicionar("folha-sai", () => setTrilhoAberto(false));
    };
    window.addEventListener("keydown", aoTeclarFora);
    return () => window.removeEventListener("keydown", aoTeclarFora);
  }, [modoMontador, trilhoAberto]);
  const valida = useCallback(
    (arr) => {
      if (!arr.length) return true;
      if (arr.length > MAX_CAMADAS) return false;
      const paes = PAES[forma];
      if (arr[0].slug !== paes[0] || arr[arr.length - 1].slug !== paes[1]) return false;
      if (arr.filter((i) => MAPA_CAMADAS2[i.slug]?.pao).length !== 2) return false;
      const contagem = {};
      for (const i of arr) {
        contagem[i.slug] = (contagem[i.slug] || 0) + 1;
        if (contagem[i.slug] > MAX_REPETICOES) return false;
      }
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].slug !== "molho") continue;
        if (i !== 1 && i !== arr.length - 2) return false;
      }
      return true;
    },
    [forma]
  );
  const trocarPilha = useCallback((arr) => {
    vivo.current.pilha = arr;
    setPilha(arr);
    setRecado("");
    setComprimido(false);
  }, []);
  const adicionar = useCallback(
    (slug) => {
      const v = vivo.current;
      if (v.selando || v.selado) return;
      const c = MAPA_CAMADAS2[slug];
      if (!c || ausentes[slug] || c.pao) return;
      if (v.pilha.length >= MAX_CAMADAS) {
        setRecado("Dezesseis camadas \xE9 o teto. Tire uma antes.");
        return;
      }
      let arr = v.pilha.slice();
      if (!arr.length) arr = instanciar(PAES[forma]);
      const uid = uidRef.current++;
      const meio = arr.slice(1, -1);
      meio.push({ slug, uid });
      meio.sort((a, b) => MAPA_CAMADAS2[a.slug].ordem - MAPA_CAMADAS2[b.slug].ordem);
      arr = [arr[0], ...meio, arr[arr.length - 1]];
      if (!valida(arr)) {
        setRecado("O molho s\xF3 entra ao lado de um p\xE3o.");
        return;
      }
      trocarPilha(arr);
      if (arr.filter((i) => i.slug === slug).length === MAX_REPETICOES) {
        setRecado(`Tr\xEAs ${c.nome.toLowerCase()} j\xE1 \xE9 exagero. O quarto n\xE3o entra.`);
      }
      setRevelada(arr.findIndex((x) => x.uid === uid));
    },
    [ausentes, forma, instanciar, trocarPilha, valida]
  );
  const aoEscolherDoTrilho = useCallback(
    (slug) => {
      adicionar(slug);
      setTrilhoAberto(false);
    },
    [adicionar]
  );
  const remover = useCallback(
    (i) => {
      const arr = vivo.current.pilha.slice();
      const inst = arr[i];
      if (!inst) return;
      if (fixa(inst.slug)) {
        setRecado("Camada fixa.");
        return;
      }
      arr.splice(i, 1);
      for (let j = 0; j < arr.length; j++) {
        if (arr[j].slug === "molho" && j > 1 && j < arr.length - 2) {
          const m = arr.splice(j, 1)[0];
          arr.splice(1, 0, m);
          break;
        }
      }
      trocarPilha(arr.length === 2 ? [] : arr);
      setRevelada(null);
    },
    [trocarPilha, fixa]
  );
  const mover = useCallback(
    (i, delta) => {
      const arr = vivo.current.pilha.slice();
      const j = i + delta;
      if (j < 1 || j > arr.length - 2 || i < 1 || i > arr.length - 2) return -1;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      if (!valida(arr)) {
        setRecado("O molho s\xF3 entra ao lado de um p\xE3o.");
        return -1;
      }
      trocarPilha(arr);
      setRevelada((r) => r === i ? j : r === j ? i : r);
      if (consumirAvisoOrdem()) {
        setAvisoOrdem(true);
        agendar(() => setAvisoOrdem(false), AVISO_ORDEM_MS);
      }
      return j;
    },
    [trocarPilha, valida, agendar]
  );
  const arrastarDoTrilho = useCallback(
    (e, slug) => {
      const c = MAPA_CAMADAS2[slug];
      if (!c) return;
      const painel = document.getElementById("rx-painel");
      const x0 = e.clientX;
      const y0 = e.clientY;
      let fantasma = null;
      const mover_ = (ev) => {
        const dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        if (!fantasma && Math.hypot(dx, dy) > 10) {
          fantasma = document.createElement("div");
          fantasma.style.cssText = "position:fixed;left:0;top:0;z-index:40;width:180px;height:108px;pointer-events:none;opacity:.85;background:center/contain no-repeat;";
          fantasma.style.backgroundImage = `url("${urlCamada(c)}")`;
          document.body.appendChild(fantasma);
        }
        if (fantasma) {
          fantasma.style.transform = `translate(${ev.clientX - 90}px, ${ev.clientY - 54}px)`;
        }
      };
      const soltar = (ev) => {
        window.removeEventListener("pointermove", mover_);
        window.removeEventListener("pointerup", soltar);
        if (!fantasma) return;
        fantasma.remove();
        const r = painel?.getBoundingClientRect();
        const dentro = !!r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
        if (dentro) aoEscolherDoTrilho(slug);
      };
      window.addEventListener("pointermove", mover_);
      window.addEventListener("pointerup", soltar);
    },
    [aoEscolherDoTrilho]
  );
  const arrastarCamada = useCallback(
    (e) => {
      const v = vivo.current;
      if (v.selando || v.selado) return;
      const alvo2 = e.target.closest(
        "[data-toque], [data-inst], [data-chamada]"
      );
      if (!alvo2) {
        setRevelada(null);
        return;
      }
      const i = alvo2.dataset.toque !== void 0 ? Number(alvo2.dataset.toque) : alvo2.dataset.chamada !== void 0 ? Number(alvo2.dataset.chamada) : v.pilha.findIndex((x) => String(x.uid) === alvo2.dataset.inst);
      if (i < 0) return;
      const painel = document.getElementById("rx-painel");
      const x0 = e.clientX;
      const y0 = e.clientY;
      let base = y0;
      let idx = i;
      let removendo = false;
      let mexeu = false;
      const passo = Math.max(28, v.area.h / Math.max(6, v.pilha.length * 1.6));
      const elDe = () => {
        const inst = vivo.current.pilha[idx];
        return inst ? document.querySelector(`[data-inst="${inst.uid}"]`) : null;
      };
      const mover_ = (ev) => {
        const dy = ev.clientY - base;
        const dx = ev.clientX - x0;
        if (Math.hypot(dx, ev.clientY - y0) > 8) mexeu = true;
        const r = painel?.getBoundingClientRect();
        const fora = !fixa(vivo.current.pilha[idx]?.slug) && !!r && (ev.clientX < r.left - 40 || ev.clientX > r.right + 40 || Math.abs(dx) > 150);
        if (fora !== removendo) {
          removendo = fora;
          const el = elDe();
          if (el) el.style.opacity = removendo ? "0.45" : "1";
          setRecado(removendo ? "Solte para tirar." : "");
        }
        if (Math.abs(dy) >= passo && !removendo) {
          const j = mover(idx, dy > 0 ? -1 : 1);
          if (j >= 0) idx = j;
          base = ev.clientY;
        }
      };
      const soltar = (ev) => {
        window.removeEventListener("pointermove", mover_);
        window.removeEventListener("pointerup", soltar);
        const inst = vivo.current.pilha[idx];
        const el = elDe();
        if (removendo && inst && !fixa(inst.slug)) {
          if (el) {
            const dir = ev.clientX < x0 ? -1 : 1;
            el.style.transition = "transform 220ms cubic-bezier(.4,0,1,1), opacity 220ms linear";
            el.style.transform = `${el.style.transform} translateX(${dir * 340}px)`;
            el.style.opacity = "0";
          }
          agendar(() => remover(idx), el ? 200 : 0);
        } else {
          if (el) el.style.opacity = "1";
          if (removendo) setRecado("Camada fixa.");
          else if (!mexeu) {
            setRecado("");
            setRevelada((r) => r === idx ? null : idx);
          }
        }
      };
      window.addEventListener("pointermove", mover_);
      window.addEventListener("pointerup", soltar);
    },
    [agendar, mover, remover, fixa]
  );
  const aoTeclar = useCallback(
    (e) => {
      const b = e.target.closest("[data-chamada]");
      if (!b) return;
      const i = Number(b.dataset.chamada);
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const j = mover(i, e.key === "ArrowUp" ? 1 : -1);
        if (j >= 0) {
          agendar(() => document.querySelector(`[data-chamada="${j}"]`)?.focus(), 20);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remover(i);
      }
    },
    [agendar, mover, remover, fixa]
  );
  const despachar = useCallback(() => {
    const arr = vivo.current.pilha;
    const camadas = arr.map((i) => i.slug);
    if (!camadas.length) return;
    let origem = null;
    const el = document.querySelector(`[data-inst="${arr[0].uid}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width) {
        const kk = r.width / 2e3;
        origem = {
          centroX: r.left + r.width / 2,
          baseY: r.top + (600 + MAPA_CAMADAS2[arr[0].slug].alturaPx / 2) * kk,
          kk
        };
      }
    }
    const recheio = camadas.filter((s) => !MAPA_CAMADAS2[s]?.pao).map((s) => MAPA_CAMADAS2[s].nome);
    const item = {
      chave: `montado:${forma}:${camadas.join(".")}`,
      nome,
      forma,
      camadas,
      resumo: recheio.length ? recheio.join(", ") : "S\xF3 o p\xE3o",
      cent: precoDoLanche2(camadas, fixoSlug),
      fixoSlug,
      observacao: observacao.trim()
    };
    vivo.current.pilha = [];
    setPilha([]);
    setComprimido(false);
    setMarca(false);
    setSelando(false);
    setSelado(false);
    setRecado("");
    setRevelada(null);
    setComposicao(false);
    onFechar(item, origem);
  }, [forma, nome, onFechar, fixoSlug, observacao]);
  const prensar = useCallback(() => {
    if (prefersReducedMotion()) {
      setComprimido(true);
      setMarca(true);
      setSelado(true);
      agendar(despachar, 140);
      return;
    }
    setSelando(true);
    setRecado("");
    agendar(() => setComprimido(true), 60);
    agendar(() => setMarca(true), 60 + PRENSA_MS);
    agendar(() => {
      setSelando(false);
      setSelado(true);
      despachar();
    }, 60 + PRENSA_MS + 260);
  }, [agendar, despachar]);
  const selar = useCallback(() => {
    setSelando(true);
    setRecado("");
    if (prefersReducedMotion()) {
      setComprimido(true);
      setSelando(false);
      setSelado(true);
      agendar(despachar, 140);
      return;
    }
    agendar(() => setComprimido(true), 200);
    agendar(() => setVarrendo(true), 500);
    agendar(() => {
      setVarrendo(false);
      setSelando(false);
      setSelado(true);
      despachar();
    }, 1740);
  }, [agendar, despachar]);
  const fechamento = useCallback(() => {
    const v = vivo.current;
    if (!v.pilha.length || v.selando || v.selado) return;
    if (forma === "prensado") prensar();
    else selar();
  }, [forma, prensar, selar]);
  const lista = pilha.filter((i) => !ausentes[i.slug] && MAPA_CAMADAS2[i.slug].alturaPx > 0);
  const slugs = lista.map((i) => i.slug);
  const alturaDisponivel = Math.max(0, area.h - (amplo ? 0 : flutuaH));
  const g = geometria({ slugs, areaW: area.w, areaH: alturaDisponivel, comprimido, forma, chamadas: amplo });
  const pronto = area.w > 0 && area.h > 0;
  const transicao = g.prensa ? `transform ${PRENSA_MS}ms ${PRENSA_CURVA}` : selando || comprimido ? `transform 320ms ${CURVA_ASSENTA}` : `transform 420ms ${CURVA_EXPLODE}`;
  const n = pilha.length;
  const aviso = n > LIMIAR_AVISO_CAMADAS;
  const unidades = unidadesPilha(slugs, comprimido ? fatorFechado(forma) : 1);
  const pct = Math.max(n ? 2 : 0, Math.min(100, unidades / MEDIDA_MAX_U * 100));
  const ehPrensado = forma === "prensado";
  const ordinais = {};
  const numerada = lista.map((inst) => {
    ordinais[inst.slug] = (ordinais[inst.slug] || 0) + 1;
    return { inst, n: ordinais[inst.slug] };
  });
  const estado = { comprimido, selando, selado, marca, forma };
  const faixaDe = (i) => {
    const topo = g.offsetY + (g.tops[i] - g.minTop) * g.k;
    const base = i > 0 ? g.offsetY + (g.tops[i - 1] - g.minTop) * g.k : topo + MAPA_CAMADAS2[slugs[i]].alturaPx * g.k;
    return { topo, base };
  };
  const aberta = revelada !== null && revelada >= 0 && revelada < numerada.length ? revelada : null;
  const chamadasNaTela = pronto && !comprimido && !selando;
  const contarSlug = (s) => pilha.filter((i) => i.slug === s).length;
  const rotuloTopPorIndice = [];
  if (chamadasNaTela && amplo && numerada.length) {
    const doTopoParaBase = numerada.map((_, i) => i).reverse();
    const ideais = doTopoParaBase.map(
      (i) => medidas(MAPA_CAMADAS2[slugs[i]], i, g).topoObjeto - TOQUE_MIN / 2
    );
    const distribuidos = distribuirRotulos(ideais, TOQUE_MIN);
    doTopoParaBase.forEach((i, j) => {
      rotuloTopPorIndice[i] = distribuidos[j];
    });
  }
  return /* @__PURE__ */ jsxs8("div", { id: "rx-takeover", "aria-label": `Raio-x do ${nome}`, children: [
    /* @__PURE__ */ jsxs8(
      "header",
      {
        id: "rx-cabeca",
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: "12px 24px",
          alignItems: "baseline",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--traco)"
        },
        children: [
          /* @__PURE__ */ jsx10(
            "h2",
            {
              style: {
                margin: 0,
                fontFamily: "var(--fonte-display), Georgia, serif",
                fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                fontVariationSettings: "'opsz' 72, 'wght' 780, 'SOFT' 12, 'WONK' 1",
                lineHeight: 1,
                color: "var(--osso)"
              },
              children: nome
            }
          ),
          /* @__PURE__ */ jsx10("button", { id: "rx-fechar", className: "botao-texto", type: "button", onClick: onSair, children: "Voltar" })
        ]
      }
    ),
    /* @__PURE__ */ jsxs8(
      "div",
      {
        id: "rx-painel",
        "data-prensado": g.prensa ? "" : void 0,
        "data-estourou": g.estourou ? "" : void 0,
        "data-escala": pronto ? g.k.toFixed(4) : void 0,
        "data-escala-natural": pronto ? g.escalaNatural.toFixed(4) : void 0,
        "data-folga": pronto ? g.folga.toFixed(4) : void 0,
        style: g.estourou ? { overflowY: "auto", overflowX: "hidden" } : void 0,
        children: [
          /* @__PURE__ */ jsx10(
            "img",
            {
              src: "/macro/macro-chapa.webp",
              alt: "",
              "aria-hidden": "true",
              width: 2e3,
              height: 1333,
              style: {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.1,
                pointerEvents: "none"
              }
            }
          ),
          /* @__PURE__ */ jsxs8("div", { ref: desenhoRef, id: "rx-desenho", onPointerDown: arrastarCamada, onKeyDown: aoTeclar, children: [
            /* @__PURE__ */ jsx10(
              "img",
              {
                id: "rx-chapa-fundo",
                src: "/chapa/chapa-vazia.webp",
                alt: "",
                "aria-hidden": "true",
                width: 2400,
                height: 1600,
                style: {
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: selando || selado ? 0.9 : 0,
                  transition: "opacity 200ms linear",
                  pointerEvents: "none"
                }
              }
            ),
            n === 0 && /* @__PURE__ */ jsx10(
              "p",
              {
                style: {
                  position: "absolute",
                  inset: 0,
                  margin: 0,
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  color: "var(--osso)",
                  opacity: 0.5
                },
                children: "Comece pelo p\xE3o: toque num ingrediente."
              }
            ),
            /* @__PURE__ */ jsx10("div", { id: "rx-pilha", style: { position: "absolute", inset: 0 }, children: pronto && numerada.map(({ inst, n: ord }, i) => /* @__PURE__ */ jsx10(
              Camada,
              {
                camada: MAPA_CAMADAS2[inst.slug],
                uid: inst.uid,
                n: ord,
                indice: i,
                slugs,
                g,
                estado,
                transicao
              },
              inst.uid
            )) }),
            pronto && !selando && !selado && /* @__PURE__ */ jsx10(
              "div",
              {
                id: "rx-toques",
                style: { position: "absolute", inset: 0, zIndex: 26, pointerEvents: "none" },
                children: numerada.map(({ inst }, i) => {
                  const { topo, base } = faixaDe(i);
                  return /* @__PURE__ */ jsx10(TiraDeToque, { indice: i, topo, base, alturaArea: area.h }, inst.uid);
                })
              }
            ),
            chamadasNaTela && amplo && numerada.map(({ inst, n: ord }, i) => /* @__PURE__ */ jsx10(
              Chamada,
              {
                camada: MAPA_CAMADAS2[inst.slug],
                n: ord,
                indice: i,
                g,
                rotuloTop: rotuloTopPorIndice[i],
                fixa: fixa(inst.slug)
              },
              inst.uid
            )),
            chamadasNaTela && !amplo && aberta !== null && /* @__PURE__ */ jsx10(
              ChamadaChip,
              {
                camada: MAPA_CAMADAS2[numerada[aberta].inst.slug],
                n: numerada[aberta].n,
                indice: aberta,
                g,
                alturaArea: area.h,
                fixa: fixa(numerada[aberta].inst.slug),
                onTirar: remover
              },
              numerada[aberta].inst.uid
            ),
            varrendo && /* @__PURE__ */ jsxs8(Fragment3, { children: [
              /* @__PURE__ */ jsx10(
                "div",
                {
                  id: "rx-varredura",
                  "aria-hidden": "true",
                  style: {
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: "46%",
                    pointerEvents: "none",
                    background: "linear-gradient(to top, transparent 0%, color-mix(in srgb, var(--latao) 50%, transparent) 46%, transparent 100%)",
                    mixBlendMode: "screen",
                    animation: "rx-varredura 1200ms ease-out forwards"
                  }
                }
              ),
              /* @__PURE__ */ jsx10(
                "div",
                {
                  id: "rx-ar",
                  "aria-hidden": "true",
                  style: {
                    position: "absolute",
                    left: "8%",
                    right: "8%",
                    top: "4%",
                    height: "14%",
                    pointerEvents: "none",
                    transformOrigin: "bottom center",
                    background: "linear-gradient(to top, color-mix(in srgb, var(--latao) 22%, transparent), transparent)",
                    animation: "rx-ar 1200ms ease-in-out forwards"
                  }
                }
              )
            ] })
          ] })
        ]
      }
    ),
    composicao && /* @__PURE__ */ jsx10(Composicao, { fixa, pilha, onMover: mover, onTirar: remover, onFechar: () => setComposicao(false) }),
    /* @__PURE__ */ jsxs8("label", { id: "rx-observacao", htmlFor: "observacao-item", children: [
      /* @__PURE__ */ jsx10("span", { children: "Observa\xE7\xE3o" }),
      /* @__PURE__ */ jsx10(
        "input",
        {
          id: "observacao-item",
          type: "text",
          maxLength: 120,
          value: observacao,
          placeholder: "Bem passado",
          disabled: selando || selado,
          onChange: (e) => setObservacao(e.target.value)
        }
      )
    ] }),
    /* @__PURE__ */ jsx10(
      Medidor,
      {
        precoCent: precoDoLanche2(pilha.map((i) => i.slug), fixoSlug),
        camadas: n,
        pct,
        aviso,
        recado,
        avisoOrdem,
        onDispensarOrdem: () => setAvisoOrdem(false),
        transicaoBarra: g.prensa ? `${PRENSA_MS}ms ${PRENSA_CURVA}` : "420ms cubic-bezier(.2,.7,.3,1)",
        onVerComposicao: () => {
          setTrilhoAberto(modoMontador);
          setComposicao((v) => !v);
        },
        flutuaRef
      }
    ),
    modoMontador ? /* @__PURE__ */ jsx10(
      Trilho,
      {
        contarSlug,
        ausentes,
        bloqueado: selando || selado,
        cheio: n >= MAX_CAMADAS,
        onAdicionar: aoEscolherDoTrilho,
        onArrastar: arrastarDoTrilho
      }
    ) : /* @__PURE__ */ jsx10(
      "button",
      {
        id: "rx-abrir-trilho",
        type: "button",
        disabled: selando || selado,
        onClick: () => {
          setComposicao(false);
          transicionar("folha-entra", () => setTrilhoAberto(true));
        },
        children: "Acrescentar ingrediente"
      }
    ),
    !modoMontador && trilhoAberto && /* @__PURE__ */ jsx10(
      "div",
      {
        id: "rx-trilho-cortina",
        role: "presentation",
        onClick: (e) => {
          if (e.target === e.currentTarget) transicionar("folha-sai", () => setTrilhoAberto(false));
        },
        children: /* @__PURE__ */ jsxs8("div", { id: "rx-trilho-folha", role: "group", "aria-label": "Ingredientes dispon\xEDveis", children: [
          /* @__PURE__ */ jsxs8("div", { id: "rx-trilho-folha-cabeca", children: [
            /* @__PURE__ */ jsx10("span", { style: { fontVariationSettings: "'wdth' 92, 'wght' 600", fontSize: "0.875rem" }, children: "Ingredientes" }),
            /* @__PURE__ */ jsx10(
              "button",
              {
                id: "rx-fechar-trilho",
                type: "button",
                onClick: () => transicionar("folha-sai", () => setTrilhoAberto(false)),
                "aria-label": "Fechar ingredientes",
                style: {
                  width: TOQUE_MIN,
                  minHeight: TOQUE_MIN,
                  padding: 0,
                  background: "none",
                  border: 0,
                  color: "var(--osso)",
                  fontSize: "1.125rem",
                  lineHeight: 1,
                  cursor: "pointer"
                },
                children: "\xD7"
              }
            )
          ] }),
          /* @__PURE__ */ jsx10(
            Trilho,
            {
              folha: true,
              contarSlug,
              ausentes,
              bloqueado: selando || selado,
              cheio: n >= MAX_CAMADAS,
              onAdicionar: aoEscolherDoTrilho,
              onArrastar: arrastarDoTrilho
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx10(
      BotaoSelar,
      {
        podeFechar: n > 0 && !selado && !selando,
        texto: selado ? "No papel" : selando ? ehPrensado ? "Prensando\u2026" : "Selando\u2026" : ehPrensado ? editando ? "Prensar e salvar" : "Prensar na chapa" : editando ? "Selar e salvar" : "Selar na chapa",
        onSelar: fechamento
      }
    )
  ] });
}

// components/raio-x/salto.ts
var ANTECIPA_MS = 90;
var IMPULSO_MS = 200;
var QUEDA_MS = 360;
var ESCADA_MS = 45;
var CHEGADA_MS = 560;
var sorteios = /* @__PURE__ */ new Map();
function sortear(chave, n) {
  const k = `${chave}:${n}`;
  const guardado = sorteios.get(k);
  if (guardado) return guardado;
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rnd = () => {
    h = Math.imul(h ^ h >>> 15, 2246822507);
    h ^= h >>> 13;
    return (h >>> 0) % 1e4 / 1e4;
  };
  const itens = [];
  for (let i = 0; i < n; i++) {
    itens.push({ rot: rnd() * 28 - 14, deriva: (i % 2 ? 1 : -1) * (8 + rnd() * 32) });
  }
  const dado = { lado: rnd() > 0.5 ? 1 : -1, itens };
  sorteios.set(k, dado);
  return dado;
}
function salto(item, origem, aoChegar) {
  const slugs = item.camadas.filter((s) => MAPA_CAMADAS[s] && MAPA_CAMADAS[s].alturaPx > 0);
  const cont = document.createElement("div");
  if (prefersReducedMotion() || !origem || !slugs.length || !cont.animate) {
    aoChegar();
    return () => {
    };
  }
  const retomar = pausarMovimento();
  const kk = origem.kk;
  const largura = 2e3 * kk;
  const fator = fatorFechado(item.forma);
  cont.setAttribute("aria-hidden", "true");
  cont.setAttribute("data-salto", "");
  cont.style.cssText = `position: fixed; left: ${origem.centroX - largura / 2}px; top: ${origem.baseY}px; width: ${largura}px; height: 0; z-index: 45; pointer-events: none; transform-origin: 50% 0;`;
  const par = sortear(item.chave, slugs.length);
  const pecas = [];
  let topo = MAPA_CAMADAS[slugs[0]].alturaPx;
  slugs.forEach((s, i) => {
    const c = MAPA_CAMADAS[s];
    if (i > 0) topo += visivelPx(slugs, i) * fator;
    const el = document.createElement("div");
    el.style.cssText = `position: absolute; left: 0; width: 100%; height: ${1200 * kk}px; bottom: ${(topo - c.alturaPx / 2 - 600) * kk}px; z-index: ${i}; background: center/contain no-repeat url("${urlCamada(c)}"); will-change: transform;`;
    cont.appendChild(el);
    pecas.push(el);
  });
  document.body.appendChild(cont);
  const subida = window.innerHeight * 0.12;
  cont.animate(
    [
      { transform: "translateY(0px) scale(1, 1) rotate(0deg)", easing: "cubic-bezier(.25,.75,.4,1)" },
      // Antecipação: agacha antes de subir.
      {
        transform: "translateY(8px) scale(1.04, 0.86) rotate(0deg)",
        offset: ANTECIPA_MS / IMPULSO_MS,
        easing: "cubic-bezier(.16,.84,.44,1)"
      },
      { transform: `translateY(${-subida}px) scale(0.97, 1.08) rotate(${par.lado * 4}deg)` }
    ],
    { duration: IMPULSO_MS, fill: "forwards" }
  );
  const queda = window.innerHeight - origem.baseY + subida + 1200 * kk + 80;
  pecas.forEach((el, i) => {
    const p = par.itens[i];
    const animacao = el.animate(
      [
        { transform: "translate(0px, 0px) rotate(0deg)" },
        { transform: `translate(${p.deriva.toFixed(1)}px, ${queda.toFixed(0)}px) rotate(${p.rot.toFixed(1)}deg)` }
      ],
      {
        duration: QUEDA_MS + 20,
        delay: IMPULSO_MS + i * ESCADA_MS,
        // Aceleração de gravidade: sai devagar, chega rápido.
        easing: "cubic-bezier(.36,0,.86,.36)",
        fill: "forwards"
      }
    );
    void animacao.finished.then(() => el.style.removeProperty("will-change"), () => el.style.removeProperty("will-change"));
  });
  const timers = [
    window.setTimeout(aoChegar, CHEGADA_MS),
    window.setTimeout(() => {
      cont.remove();
      retomar();
    }, IMPULSO_MS + pecas.length * ESCADA_MS + QUEDA_MS + 100)
  ];
  return () => {
    timers.forEach(window.clearTimeout);
    cont.remove();
    retomar();
  };
}

// components/cardapio/Cardapio.tsx
import { useEffect as useEffect3, useState as useState3 } from "react";
import { Fragment as Fragment4, jsx as jsx11, jsxs as jsxs9 } from "react/jsx-runtime";
var reencaixe = (n) => ({ "--tr-itens": n });
var naFila = (i) => ({ "--tr-i": i });
function Cardapio({ onAdicionar, onMontar, onModificar, pedido }) {
  const { CAMADAS: CAMADAS2, FIXOS: FIXOS2, precoDoFixo: precoDoFixo2, resumoCamadas: resumoCamadas2 } = useNegocio();
  const tema = useTema();
  const [forma, setForma] = useState3(tema.filtroInicial === "todos" ? "todos" : FIXOS2[0]?.forma ?? "prensado");
  const [ingredientes, setIngredientes] = useState3([]);
  const [filtroAberto, setFiltroAberto] = useState3(false);
  useEffect3(() => {
    if (!tema.movimento.grade || prefersReducedMotion() || !window.matchMedia("(min-width: 900px)").matches) return;
    const retomar = pausarMovimento();
    const timer2 = window.setTimeout(retomar, GRADE_TOTAL_MS);
    return () => {
      clearTimeout(timer2);
      retomar();
    };
  }, [forma, ingredientes, tema.movimento.grade]);
  const visiveis = FIXOS2.filter((f) => (forma === "todos" || f.forma === forma) && ingredientes.every((s) => f.camadas.includes(s)));
  return /* @__PURE__ */ jsxs9("section", { id: "cardapio", "data-d-secao": "cardapio", "data-cardapio": true, className: "cardapio moldura", children: [
    /* @__PURE__ */ jsxs9("div", { className: "cabecalho-secao", children: [
      /* @__PURE__ */ jsx11("h2", { children: "Card\xE1pio" }),
      /* @__PURE__ */ jsx11("span", { className: "nota", children: "Direto da chapa." })
    ] }),
    /* @__PURE__ */ jsxs9("div", { className: "filtros-forma", role: "group", "aria-label": "Forma do lanche", children: [
      tema.filtroInicial === "todos" && /* @__PURE__ */ jsx11("button", { "data-filtro-forma": "todos", "aria-pressed": forma === "todos", onClick: () => setForma("todos"), children: "Todos" }),
      ["prensado", "redondo", "monte"].map((f, i) => /* @__PURE__ */ jsx11("button", { "data-filtro-forma": f, "aria-pressed": forma === f, onClick: () => setForma(f), children: ["Prensados", "Redondos", "Monte o seu"][i] }, f))
    ] }),
    forma !== "monte" && /* @__PURE__ */ jsxs9(Fragment4, { children: [
      /* @__PURE__ */ jsxs9("div", { className: "filtro-resumo", children: [
        /* @__PURE__ */ jsxs9("button", { className: "botao-texto", "aria-expanded": filtroAberto, "aria-controls": "filtro-ingredientes", onClick: () => setFiltroAberto(!filtroAberto), children: [
          "Ingredientes",
          ingredientes.length ? ` (${ingredientes.length})` : "",
          " ",
          /* @__PURE__ */ jsx11("span", { "aria-hidden": "true", children: filtroAberto ? "\u2212" : "+" })
        ] }),
        /* @__PURE__ */ jsxs9("span", { className: "nota", role: "status", children: [
          visiveis.length,
          " ",
          visiveis.length === 1 ? "lanche" : "lanches"
        ] })
      ] }),
      filtroAberto && /* @__PURE__ */ jsxs9("div", { id: "filtro-ingredientes", className: "filtro-ingredientes", role: "group", "aria-label": "Lanches com estes ingredientes", children: [
        /* @__PURE__ */ jsx11("p", { children: "Com todos os ingredientes marcados." }),
        /* @__PURE__ */ jsx11("div", { className: "ingredientes-grade", children: CAMADAS2.filter((c) => !c.pao).map((c) => /* @__PURE__ */ jsxs9("button", { "data-filtro-ingrediente": c.slug, "aria-pressed": ingredientes.includes(c.slug), onClick: () => setIngredientes((a) => a.includes(c.slug) ? a.filter((s) => s !== c.slug) : [...a, c.slug]), children: [
          /* @__PURE__ */ jsx11("img", { src: c.ficha, alt: "", width: 44, height: 44 }),
          /* @__PURE__ */ jsx11("span", { children: c.nome })
        ] }, c.slug)) }),
        !!ingredientes.length && /* @__PURE__ */ jsx11("button", { className: "botao-texto", onClick: () => setIngredientes([]), children: "Limpar ingredientes" })
      ] }),
      /* @__PURE__ */ jsx11("div", { className: "cardapio-grade", "data-troca": true, style: reencaixe(visiveis.length), children: visiveis.map((f, i) => {
        const adicionado = pedido.find((p) => p.grupo === "lanche" && p.fixoSlug === f.slug);
        const foto = /* @__PURE__ */ jsx11("img", { className: "lanche-icone", "data-foto": f.slug, src: f.foto ?? `/fixos/${f.slug}.webp`, alt: f.nome, width: 2e3, height: 2e3 });
        return /* @__PURE__ */ jsxs9("article", { "data-item-cardapio": f.slug, className: "lanche-card", style: naFila(i), children: [
          tema.cardapio === "folha" && /* @__PURE__ */ jsxs9("div", { className: "menu-nome-preco", children: [
            /* @__PURE__ */ jsx11("h3", { children: f.nome }),
            /* @__PURE__ */ jsx11("span", { className: "menu-pontilhado", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx11("span", { "data-preco": true, children: brl(precoDoFixo2(f)) })
          ] }),
          tema.abrirComposicao === "pela-foto" ? /* @__PURE__ */ jsxs9("details", { className: "diner-recheio", children: [
            /* @__PURE__ */ jsxs9("summary", { "aria-label": `Ver ingredientes de ${f.nome}`, children: [
              foto,
              /* @__PURE__ */ jsx11("span", { "aria-hidden": "true", children: "Recheio +" })
            ] }),
            /* @__PURE__ */ jsx11("p", { children: resumoCamadas2(f.camadas) })
          ] }) : foto,
          tema.cardapio !== "folha" && /* @__PURE__ */ jsx11("h3", { children: f.nome }),
          tema.abrirComposicao === "nenhuma" && /* @__PURE__ */ jsx11("p", { className: "ingredientes-linha", title: resumoCamadas2(f.camadas), children: resumoCamadas2(f.camadas) }),
          tema.abrirComposicao === "pelo-rotulo" && /* @__PURE__ */ jsxs9("details", { className: "composicao-rotulo", children: [
            /* @__PURE__ */ jsx11("summary", { children: "Recheio" }),
            /* @__PURE__ */ jsx11("p", { children: resumoCamadas2(f.camadas) })
          ] }),
          tema.cardapio !== "folha" && /* @__PURE__ */ jsx11("span", { "data-preco": true, children: brl(precoDoFixo2(f)) }),
          /* @__PURE__ */ jsxs9("button", { className: "botao-quente", "data-add": f.slug, onClick: (e) => onAdicionar(f, e.currentTarget.closest("article")), "aria-label": `Adicionar ${f.nome}`, children: [
            /* @__PURE__ */ jsx11("span", { className: "adicionar-label", children: "Adicionar" }),
            tema.adicionarIcone && /* @__PURE__ */ jsx11("span", { className: "adicionar-mais", "aria-hidden": "true", children: "+" })
          ] }),
          adicionado && /* @__PURE__ */ jsx11("button", { className: "modificar-card botao-texto", "data-modificar": adicionado.id, onClick: (e) => onModificar(adicionado.id, e.currentTarget.closest("article")), children: tema.rotulos.modificar })
        ] }, f.slug);
      }) }, `${forma}|${ingredientes.join(",")}`),
      !visiveis.length && /* @__PURE__ */ jsxs9("div", { className: "vazio", children: [
        /* @__PURE__ */ jsx11("p", { children: "Nenhum lanche com essa combina\xE7\xE3o." }),
        /* @__PURE__ */ jsx11("button", { className: "botao-texto", onClick: () => setIngredientes([]), children: "Limpar ingredientes" })
      ] })
    ] }),
    forma === "monte" && /* @__PURE__ */ jsx11("div", { className: "cardapio-grade monte-grade", "data-troca": true, style: reencaixe(2), children: ["prensado", "redondo"].map((f, i) => /* @__PURE__ */ jsxs9("article", { className: "lanche-card", style: naFila(i), children: [
      /* @__PURE__ */ jsx11("img", { className: "lanche-icone", src: `/camadas/${f === "prensado" ? "pao-prensado-topo" : "pao-topo"}.webp`, alt: "", width: 2e3, height: 1200 }),
      /* @__PURE__ */ jsxs9("h3", { children: [
        f === "prensado" ? "Prensado" : "Redondo",
        " do seu jeito"
      ] }),
      /* @__PURE__ */ jsx11("p", { children: "Escolha o recheio. O p\xE3o j\xE1 entra junto." }),
      /* @__PURE__ */ jsx11("button", { id: `abrir-livre-${f}`, className: "botao-quente", onClick: (e) => onMontar(f, e.currentTarget.closest("article")), children: "Come\xE7ar a montar" })
    ] }, f)) }, "monte")
  ] });
}

// components/cardapio/TrilhoLanches.tsx
import { useEffect as useEffect4, useLayoutEffect as useLayoutEffect3, useRef as useRef4, useState as useState4 } from "react";
import { jsx as jsx12, jsxs as jsxs10 } from "react/jsx-runtime";
function Pilha({ fixo }) {
  const ref = useRef4(null);
  const [caixa, setCaixa] = useState4({ w: 0, h: 0 });
  useLayoutEffect3(() => {
    const el = ref.current;
    const medir = () => setCaixa({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const aberto = unidadesPilha(fixo.camadas, 1);
  const k = Math.min(caixa.w * 0.92 / 2e3, caixa.h * 0.96 / aberto);
  let pos = 0;
  return /* @__PURE__ */ jsx12("div", { ref, "data-camadas": true, "data-k": k, "data-altura-aberta": aberto, "data-espalha": espalhaXDe(fixo.camadas), className: "trilho-pilha", "aria-hidden": "true", children: fixo.camadas.map((s, i) => {
    const c = MAPA_CAMADAS[s];
    pos += i ? visivelPx(fixo.camadas, i) : c.alturaPx;
    return /* @__PURE__ */ jsx12(
      "div",
      {
        "data-peca": true,
        "data-slug": s,
        "data-aberto": pos,
        "data-visivel": i ? visivelPx(fixo.camadas, i) : 0,
        "data-pao": !!c.pao,
        "data-altura": c.alturaPx,
        style: {
          position: "absolute",
          left: "50%",
          width: 2e3 * k,
          height: 1200 * k,
          marginLeft: -1e3 * k,
          bottom: (pos - c.alturaPx / 2 - 600) * k + (caixa.h - aberto * k) / 2,
          zIndex: i,
          background: `center / contain no-repeat url("${urlCamada(c)}")`
        }
      },
      `${s}-${i}`
    );
  }) });
}
function TrilhoLanches({ onAdicionar }) {
  const { FIXOS: FIXOS2, precoDoFixo: precoDoFixo2, resumoCamadas: resumoCamadas2 } = useNegocio();
  const LANCHES = FIXOS2.filter((f) => f.forma === "prensado");
  const ref = useRef4(null);
  const [centro, setCentro] = useState4(1);
  const [ativo, setAtivo] = useState4(false);
  const centroRef = useRef4(1);
  const atualizar = useRef4(() => {
  });
  useEffect4(() => {
    const rail = ref.current;
    if (!rail) return;
    const io = new IntersectionObserver((entradas) => {
      setAtivo(entradas.some((e) => e.isIntersecting));
    }, { rootMargin: "120px" });
    io.observe(rail);
    const cards = [...rail.querySelectorAll("[data-item-trilho]")];
    let frame = 0;
    const pintar = () => {
      frame = 0;
      const r = rail.getBoundingClientRect();
      const meio = r.left + r.width / 2;
      const distancias = cards.map((c) => {
        const b = c.getBoundingClientRect();
        return Math.abs(b.left + b.width / 2 - meio);
      });
      const escolhido = distancias.indexOf(Math.min(...distancias));
      if (centroRef.current !== escolhido) {
        centroRef.current = escolhido;
        setCentro(escolhido);
      }
      cards.forEach((card, i) => {
        const t = prefersReducedMotion() ? i === escolhido ? 0 : 1 : Math.min(1, distancias[i] / card.offsetWidth);
        card.dataset.t = t.toFixed(4);
        const host = card.querySelector("[data-camadas]");
        if (!host) return;
        const k = Number(host.dataset.k), aberto = Number(host.dataset.alturaAberta), espalha = Number(host.dataset.espalha);
        const fator = PRENSA_ESPACAMENTO + (1 - PRENSA_ESPACAMENTO) * t;
        const sx = espalha - (espalha - 1) * t, sy = ESPALHA_Y + (1 - ESPALHA_Y) * t;
        let pos = 0;
        host.querySelectorAll("[data-peca]").forEach((el, j) => {
          pos += j ? Number(el.dataset.visivel) * fator : Number(el.dataset.altura);
          const dy = (Number(el.dataset.aberto) - pos) * k;
          el.style.transform = `translateY(${dy}px)${el.dataset.pao === "true" ? "" : ` scaleX(${sx}) scaleY(${sy})`}`;
        });
        host.style.transform = `translateY(${(pos - aberto) * k / 2}px)`;
      });
    };
    const pedir = () => {
      if (!frame) frame = requestAnimationFrame(pintar);
    };
    atualizar.current = pedir;
    const ro = new ResizeObserver(pedir);
    ro.observe(rail);
    const mo = new MutationObserver(pedir);
    mo.observe(rail, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-k"] });
    const inicial = cards[Math.min(1, cards.length - 1)];
    if (inicial) rail.scrollLeft = inicial.offsetLeft + inicial.offsetWidth / 2 - rail.clientWidth / 2;
    rail.addEventListener("scroll", pedir, { passive: true });
    pedir();
    return () => {
      cancelAnimationFrame(frame);
      rail.removeEventListener("scroll", pedir);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  useLayoutEffect3(() => {
    atualizar.current();
  }, [ativo, centro]);
  const mover = (delta) => {
    const rail = ref.current, cards = rail.querySelectorAll("[data-item-trilho]");
    const alvo2 = cards[Math.max(0, Math.min(cards.length - 1, centro + delta))];
    if (!alvo2) return;
    rail.scrollTo({ left: alvo2.offsetLeft + alvo2.offsetWidth / 2 - rail.clientWidth / 2, behavior: prefersReducedMotion() ? "instant" : "smooth" });
  };
  if (!LANCHES.length) return null;
  return /* @__PURE__ */ jsxs10("section", { id: "sugestoes", "data-d-secao": "sugestoes", className: "secao-trilho", "aria-labelledby": "titulo-sugestoes", children: [
    /* @__PURE__ */ jsxs10("div", { className: "cabecalho-secao moldura", children: [
      /* @__PURE__ */ jsxs10("div", { children: [
        /* @__PURE__ */ jsx12("h2", { id: "titulo-sugestoes", children: "Na prensa" }),
        /* @__PURE__ */ jsx12("p", { children: "O centro fecha. As camadas aparecem ao deslizar." })
      ] }),
      /* @__PURE__ */ jsxs10("div", { className: "setas-trilho", children: [
        /* @__PURE__ */ jsx12("button", { "aria-label": "Lanche anterior", onClick: () => mover(-1), disabled: centro === 0, children: "\u2190" }),
        /* @__PURE__ */ jsx12("button", { "aria-label": "Pr\xF3ximo lanche", onClick: () => mover(1), disabled: centro === LANCHES.length - 1, children: "\u2192" })
      ] })
    ] }),
    /* @__PURE__ */ jsx12("div", { ref, "data-trilho": "lanches", className: "trilho-lanches", role: "region", "aria-label": "Prensados por dentro", onKeyDown: (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        mover(e.key === "ArrowLeft" ? -1 : 1);
      }
    }, children: LANCHES.map((f, i) => /* @__PURE__ */ jsxs10("article", { "data-item-trilho": f.slug, "data-central": i === centro ? "" : void 0, className: "trilho-lanche", children: [
      /* @__PURE__ */ jsx12("div", { "data-palco": true, className: "trilho-palco", children: ativo && Math.abs(i - centro) <= 1 ? /* @__PURE__ */ jsx12(Pilha, { fixo: f }) : /* @__PURE__ */ jsx12("img", { "data-icone": true, src: f.foto ?? `/fixos/${f.slug}.webp`, alt: "", width: 2e3, height: 2e3, loading: "lazy" }) }),
      /* @__PURE__ */ jsxs10("div", { className: "trilho-ficha", children: [
        /* @__PURE__ */ jsx12("h3", { children: f.nome }),
        /* @__PURE__ */ jsx12("p", { className: "ingredientes-linha", title: resumoCamadas2(f.camadas), children: resumoCamadas2(f.camadas) }),
        /* @__PURE__ */ jsxs10("div", { className: "trilho-acao", children: [
          /* @__PURE__ */ jsx12("span", { "data-preco": true, children: brl(precoDoFixo2(f)) }),
          /* @__PURE__ */ jsx12("button", { className: "botao-quente", "data-add": f.slug, onClick: (e) => onAdicionar(f, e.currentTarget.closest("article")), children: "Adicionar" })
        ] })
      ] })
    ] }, f.slug)) }),
    /* @__PURE__ */ jsxs10("p", { className: "trilho-posicao nota", "aria-live": "polite", children: [
      centro + 1,
      " de ",
      LANCHES.length
    ] })
  ] });
}

// components/cardapio/Extras.tsx
import { useEffect as useEffect5, useRef as useRef5, useState as useState5 } from "react";
import { jsx as jsx13, jsxs as jsxs11 } from "react/jsx-runtime";
function Extras({ grupo, onAdicionar }) {
  const { EXTRAS: EXTRAS2 } = useNegocio();
  const ref = useRef5(null);
  const [pos, setPos] = useState5(0);
  const [bordas, setBordas] = useState5({ inicio: true, fim: false });
  const itens = EXTRAS2.filter((e) => e.grupo === grupo);
  const bebida = grupo === "bebida", id = bebida ? "bebidas" : "acompanhamentos";
  const medir = () => {
    const rail = ref.current;
    setBordas({ inicio: rail.scrollLeft < 2, fim: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2 });
  };
  useEffect5(() => {
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const mover = (d) => {
    const rail = ref.current, cards = rail.querySelectorAll("article");
    const alvo2 = cards[Math.max(0, Math.min(cards.length - 1, pos + d))];
    rail.scrollTo({ left: alvo2.offsetLeft - cards[0].offsetLeft, behavior: prefersReducedMotion() ? "instant" : "smooth" });
  };
  return /* @__PURE__ */ jsxs11("section", { id, "data-d-secao": id, className: `extras secao-trilho ${id}`, children: [
    /* @__PURE__ */ jsxs11("div", { className: "cabecalho-secao moldura", children: [
      /* @__PURE__ */ jsxs11("div", { children: [
        /* @__PURE__ */ jsx13("h2", { children: bebida ? "Pra beber" : "Pra dividir" }),
        /* @__PURE__ */ jsx13("p", { children: bebida ? "Bebidas da geladeira." : "Acompanhamentos para a mesa." })
      ] }),
      /* @__PURE__ */ jsxs11("div", { className: "setas-trilho", children: [
        /* @__PURE__ */ jsx13("button", { "aria-label": `${bebida ? "Bebida" : "Acompanhamento"} anterior`, onClick: () => mover(-1), disabled: bordas.inicio, children: "\u2190" }),
        /* @__PURE__ */ jsx13("button", { "aria-label": `Pr\xF3ximo ${grupo}`, onClick: () => mover(1), disabled: bordas.fim, children: "\u2192" })
      ] })
    ] }),
    /* @__PURE__ */ jsx13("div", { ref, "data-trilho": grupo, className: "extras-trilho", onScroll: () => {
      medir();
      const rail = ref.current, cards = [...rail.querySelectorAll("article")];
      setPos(cards.reduce((melhor, c, i) => Math.abs(c.offsetLeft - cards[0].offsetLeft - rail.scrollLeft) < Math.abs(cards[melhor].offsetLeft - cards[0].offsetLeft - rail.scrollLeft) ? i : melhor, 0));
    }, children: itens.map((e, i) => /* @__PURE__ */ jsxs11("article", { className: "extra-card", "data-extra": e.slug, children: [
      /* @__PURE__ */ jsx13("img", { className: "extra-macro", src: `/macro/${bebida ? "macro-corte" : "macro-chapa"}.webp`, alt: "", "aria-hidden": "true", width: 2e3, height: 1333, loading: "lazy" }),
      /* @__PURE__ */ jsxs11("span", { "data-carimbo": true, children: [
        String(i + 1).padStart(2, "0"),
        " / ",
        bebida ? "GELADEIRA" : "FRITADEIRA"
      ] }),
      /* @__PURE__ */ jsx13("h3", { children: e.nome }),
      /* @__PURE__ */ jsxs11("div", { className: "extra-base", children: [
        /* @__PURE__ */ jsx13("span", { "data-preco": true, children: brl(e.precoCent) }),
        /* @__PURE__ */ jsx13("button", { className: "botao-quente", "data-add": e.slug, "aria-label": `Adicionar ${e.nome}`, onClick: () => onAdicionar(e), children: "Adicionar" })
      ] })
    ] }, e.slug)) })
  ] });
}

// lib/useHorario.ts
import { useMemo as useMemo2, useSyncExternalStore } from "react";
var atual = null;
var ouvintes2 = /* @__PURE__ */ new Set();
var timer;
var ler = () => {
  atual = Date.now();
  ouvintes2.forEach((fn) => fn());
};
var tick = () => {
  ler();
  timer = setTimeout(tick, 6e4 - Date.now() % 6e4);
};
var aoVoltar = () => {
  if (!document.hidden) ler();
};
function assinar(fn) {
  ouvintes2.add(fn);
  if (ouvintes2.size === 1) {
    tick();
    document.addEventListener("visibilitychange", aoVoltar);
  }
  return () => {
    ouvintes2.delete(fn);
    if (!ouvintes2.size) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    }
  };
}
var noServidor = () => null;
function useHorarioDaCasa() {
  const { CASA: CASA2 } = useNegocio();
  const instante = useSyncExternalStore(assinar, () => atual, noServidor);
  return useMemo2(() => instante === null ? null : horarioDaCasa(new Date(instante), CASA2), [instante, CASA2]);
}

// components/letreiro/Assinatura.tsx
import { jsx as jsx14, jsxs as jsxs12 } from "react/jsx-runtime";
function PlacaDePorta() {
  const horario = useHorarioDaCasa();
  return /* @__PURE__ */ jsxs12(
    "div",
    {
      className: "placa-porta",
      "data-placa-porta": true,
      "data-aberto": horario?.aberto,
      role: "img",
      "aria-label": horario ? horario.aberto === null ? "Hor\xE1rio n\xE3o informado" : horario.aberto ? "Aberto" : "Fechado" : "Consultando hor\xE1rio da casa",
      children: [
        /* @__PURE__ */ jsx14("div", { className: "placa-fio", "aria-hidden": "true" }),
        horario && /* @__PURE__ */ jsx14("div", { className: "placa-balanco", "aria-hidden": "true", children: /* @__PURE__ */ jsxs12("div", { className: "placa-giro", children: [
          /* @__PURE__ */ jsx14("span", { className: "placa-face placa-aberto", children: horario.aberto === null ? "CONSULTE" : "ABERTO" }),
          /* @__PURE__ */ jsx14("span", { className: "placa-face placa-fechado", children: horario.aberto === null ? "CONSULTE" : "FECHADO" })
        ] }) })
      ]
    }
  );
}
function Toldo() {
  return /* @__PURE__ */ jsx14("div", { className: "toldo", "data-toldo": true, "aria-hidden": "true", children: /* @__PURE__ */ jsx14("div", { className: "toldo-tecido" }) });
}

// components/letreiro/HeroMascote.tsx
import { useContext as useContext4, useEffect as useEffect6, useLayoutEffect as useLayoutEffect4, useRef as useRef6, useState as useState6 } from "react";
import { jsx as jsx15, jsxs as jsxs13 } from "react/jsx-runtime";
var relaxados = [-14, 14];
var sorte2 = (min, max) => min + Math.random() * (max - min);
var suave = (t) => t * t * (3 - 2 * t);
function HeroMascote() {
  const aberto = useContext4(RaioXAberto) || !useTema().mascote;
  return aberto ? null : /* @__PURE__ */ jsx15(Espiando, {});
}
function Espiando() {
  const ref = useRef6(null);
  const bracos = useRef6([]);
  const [emTela, setEmTela] = useState6(false);
  const [cabe, setCabe] = useState6(false);
  useLayoutEffect4(() => {
    const svg = ref.current;
    const hero = svg?.closest(".hero-faixa");
    const titulo = hero?.querySelector("h1");
    if (!svg || !hero || !titulo) return;
    let vivo = true;
    const posicionar = () => {
      if (!vivo) return;
      const h = hero.getBoundingClientRect();
      const faixa = document.createRange();
      faixa.selectNodeContents(titulo);
      const texto = faixa.getBoundingClientRect();
      const aoLado = Math.max(0, h.right - texto.right - 24);
      const acima = Math.max(0, texto.top - h.top - 10);
      const largura = Math.min(196, h.width * 0.39);
      const altura = largura * 2 / 3;
      const visivel2 = aoLado >= largura ? altura : Math.min(altura, acima);
      svg.style.width = `${largura}px`;
      svg.style.clipPath = `inset(0 0 ${Math.max(0, altura - visivel2)}px 0)`;
      svg.dataset.alturaVisivel = String(visivel2);
      setCabe(visivel2 >= largura * 0.27);
    };
    const ro = new ResizeObserver(posicionar);
    ro.observe(hero);
    ro.observe(titulo);
    posicionar();
    void document.fonts.ready.then(posicionar);
    return () => {
      vivo = false;
      ro.disconnect();
    };
  }, []);
  useEffect6(() => {
    const svg = ref.current;
    if (!svg) return;
    const io = new IntersectionObserver(([entrada]) => setEmTela(entrada.isIntersecting));
    io.observe(svg);
    return () => io.disconnect();
  }, []);
  useEffect6(() => {
    const svg = ref.current;
    if (!svg || !emTela || !cabe) return;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer2 = 0;
    let raf = 0;
    let ativo = false;
    let tentando = false;
    let liberadoEm = 0;
    let ultimo = null;
    const relaxar = () => bracos.current.forEach((b, i) => {
      if (b) b.style.transform = `rotate(${relaxados[i]}deg) scaleY(1)`;
    });
    const parar = () => {
      clearTimeout(timer2);
      cancelAnimationFrame(raf);
      timer2 = raf = 0;
      tentando = false;
      svg.dataset.bracosAtivos = "0";
    };
    const esperar = () => {
      clearTimeout(timer2);
      timer2 = window.setTimeout(() => tentar(false), sorte2(5500, 9500));
    };
    const tentar = (doPonteiro) => {
      if (!ativo || tentando || performance.now() < liberadoEm) return;
      clearTimeout(timer2);
      tentando = true;
      svg.dataset.bracosAtivos = "1";
      const caixa = svg.getBoundingClientRect();
      const k = caixa.width / 240;
      const repouso = {
        x: caixa.left + caixa.width * sorte2(0.15, 0.85),
        y: caixa.bottom + caixa.height * 0.7
      };
      const direcoes = () => [44, 196].map((x) => {
        const alvo2 = doPonteiro && ultimo ? ultimo : repouso;
        const dx = (alvo2.x - caixa.left) / k - x;
        const dy = (alvo2.y - caixa.top) / k - 5;
        return {
          angulo: Math.max(-55, Math.min(55, Math.atan2(-dx, dy) * 180 / Math.PI)),
          // Só percorre 55% da distância; a ponta nunca chega ao alvo.
          escala: Math.min(1.65, Math.max(0.12, Math.hypot(dx, dy) * 0.55 / 52))
        };
      });
      const inicio = performance.now();
      const quadro2 = (agora) => {
        if (!ativo) return;
        const t = agora - inicio;
        const peso = t < 300 ? suave(t / 300) : t < 460 ? 1 : 1 - suave(Math.min(1, (t - 460) / 440));
        const desejados = direcoes();
        bracos.current.forEach((b, i) => {
          if (!b) return;
          const d = desejados[i];
          b.style.transform = `rotate(${relaxados[i] + (d.angulo - relaxados[i]) * peso}deg) scaleY(${1 + (d.escala - 1) * peso})`;
        });
        if (t < 900) raf = requestAnimationFrame(quadro2);
        else {
          parar();
          relaxar();
          liberadoEm = agora + sorte2(2600, 4200);
          esperar();
        }
      };
      raf = requestAnimationFrame(quadro2);
    };
    const ponteiro = (e) => {
      ultimo = { x: e.clientX, y: e.clientY };
      tentar(true);
    };
    const sincronizar = () => {
      const proximo = !reduzido.matches && !document.hidden && !movimentoPausado();
      if (proximo === ativo) return;
      ativo = proximo;
      if (ativo) {
        relaxar();
        liberadoEm = performance.now() + 900;
        window.addEventListener("pointermove", ponteiro, { passive: true });
        window.addEventListener("pointerdown", ponteiro, { passive: true });
        esperar();
      } else {
        parar();
        window.removeEventListener("pointermove", ponteiro);
        window.removeEventListener("pointerdown", ponteiro);
        if (reduzido.matches) relaxar();
      }
    };
    const removerPausa = observarPausa(sincronizar);
    reduzido.addEventListener("change", sincronizar);
    document.addEventListener("visibilitychange", sincronizar);
    return () => {
      ativo = false;
      parar();
      window.removeEventListener("pointermove", ponteiro);
      window.removeEventListener("pointerdown", ponteiro);
      removerPausa();
      reduzido.removeEventListener("change", sincronizar);
      document.removeEventListener("visibilitychange", sincronizar);
    };
  }, [emTela, cabe]);
  return /* @__PURE__ */ jsxs13(
    "svg",
    {
      ref,
      className: "hero-espreita",
      "data-hero-mascote": true,
      "data-em-tela": emTela,
      "data-cabe": cabe,
      viewBox: "0 0 240 160",
      "aria-hidden": "true",
      focusable: "false",
      children: [
        /* @__PURE__ */ jsx15(DesenhoMascote, { transform: "translate(240 84) rotate(180)", olharAtivo: emTela && cabe }),
        [44, 196].map((x, i) => /* @__PURE__ */ jsx15("g", { transform: `translate(${x} 5)`, children: /* @__PURE__ */ jsx15(
          "g",
          {
            ref: (el) => {
              bracos.current[i] = el;
            },
            "data-braco": i,
            style: { transform: `rotate(${relaxados[i]}deg) scaleY(1)`, transformOrigin: "0 0" },
            children: /* @__PURE__ */ jsx15("path", { d: `M0 0 Q${i ? 6 : -6} 26 0 52`, fill: "none", stroke: "var(--osso)", strokeWidth: "5", strokeLinecap: "round" })
          }
        ) }, x))
      ]
    }
  );
}

// components/cardapio/Casa.tsx
import { Fragment as Fragment5, jsx as jsx16, jsxs as jsxs14 } from "react/jsx-runtime";
function Horario({ compacto = false }) {
  const { CASA: CASA2 } = useNegocio();
  const horario = useHorarioDaCasa();
  return /* @__PURE__ */ jsxs14("div", { className: compacto ? "horario-compacto" : "horario", "data-horario": true, "data-aberto": horario?.aberto, "data-ultimos": horario?.ultimos || void 0, children: [
    !compacto && /* @__PURE__ */ jsx16("h2", { children: "Est\xE1 aberto?" }),
    /* @__PURE__ */ jsx16("p", { "aria-live": "polite", children: horario?.texto ?? faixaHorario(CASA2) }),
    !compacto && /* @__PURE__ */ jsxs14("p", { className: "nota", children: [
      faixaHorario(CASA2),
      " Hor\xE1rio local da casa."
    ] })
  ] });
}
function Hero() {
  const tema = useTema();
  const { CASA: CASA2, dados: { textos } } = useNegocio();
  return /* @__PURE__ */ jsxs14("div", { "data-d-secao": "hero", children: [
    /* @__PURE__ */ jsxs14("header", { className: "cabecalho-casa moldura", children: [
      /* @__PURE__ */ jsxs14("span", { className: "marca-texto", children: [
        CASA2.marca,
        textos.registro && /* @__PURE__ */ jsx16("span", { className: "marca-registro", children: textos.registro })
      ] }),
      /* @__PURE__ */ jsxs14("span", { className: "nota", children: [
        textos.categoria,
        CASA2.cidade ? ` em ${CASA2.cidade.split(",")[0]}` : ""
      ] })
    ] }),
    tema.hero !== "nenhum" && /* @__PURE__ */ jsxs14("section", { className: "hero-faixa", "aria-labelledby": "titulo-casa", children: [
      tema.assinatura === "toldo" && /* @__PURE__ */ jsx16(Toldo, {}),
      tema.assinatura === "placa-de-porta" && /* @__PURE__ */ jsx16(PlacaDePorta, {}),
      tema.heroFoto && textos.heroFoto && /* @__PURE__ */ jsx16("img", { "data-demo-slot": "imagens.hero", src: textos.heroFoto, alt: textos.heroAlt, width: 2400, height: 1600, fetchPriority: "high" }),
      tema.mascote && /* @__PURE__ */ jsx16(HeroMascote, {}),
      /* @__PURE__ */ jsxs14("div", { className: "hero-texto moldura", children: [
        /* @__PURE__ */ jsx16("h1", { id: "titulo-casa", children: textos.heroTitulo.split("\n").map((s, i) => /* @__PURE__ */ jsxs14("span", { children: [
          i > 0 && /* @__PURE__ */ jsx16("br", {}),
          s
        ] }, i)) }),
        /* @__PURE__ */ jsx16("p", { children: textos.heroDescricao })
      ] })
    ] }),
    /* @__PURE__ */ jsx16("div", { className: "moldura", children: /* @__PURE__ */ jsx16(Horario, { compacto: true }) })
  ] });
}
function HistoriaERodape() {
  const tema = useTema();
  const { CASA: CASA2, dados: { textos } } = useNegocio();
  const [linha1, linha2] = linhasMarca(CASA2.marca);
  return /* @__PURE__ */ jsxs14(Fragment5, { children: [
    /* @__PURE__ */ jsxs14("section", { id: "a-chapa", "data-d-secao": "historia", className: "a-chapa", "aria-labelledby": "titulo-chapa", children: [
      textos.historiaFoto && /* @__PURE__ */ jsx16("img", { "data-demo-slot": "imagens.historia", src: textos.historiaFoto, alt: textos.historiaAlt, width: 2400, height: 1600, loading: "lazy" }),
      /* @__PURE__ */ jsx16("div", { className: "chapa-texto moldura", children: /* @__PURE__ */ jsxs14("div", { children: [
        /* @__PURE__ */ jsx16("h2", { id: "titulo-chapa", style: { whiteSpace: "pre-line" }, children: textos.historiaTitulo }),
        textos.historia.map((s, i) => /* @__PURE__ */ jsx16("p", { children: s }, i)),
        /* @__PURE__ */ jsx16("span", { "data-carimbo": true, children: textos.carimbo })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs14("section", { id: "horarios", "data-d-secao": "horarios", className: "horarios-secao moldura", children: [
      /* @__PURE__ */ jsx16(Horario, {}),
      /* @__PURE__ */ jsx16("a", { className: "botao-texto", href: "#cardapio", children: "Voltar ao card\xE1pio" })
    ] }),
    /* @__PURE__ */ jsxs14("footer", { id: "rodape", "data-d-secao": "contato", className: "rodape moldura", children: [
      /* @__PURE__ */ jsxs14("div", { className: "rodape-dados", children: [
        /* @__PURE__ */ jsx16("p", { children: CASA2.nome }),
        /* @__PURE__ */ jsxs14("address", { children: [
          CASA2.endereco,
          CASA2.endereco && /* @__PURE__ */ jsx16("br", {}),
          CASA2.cidade
        ] }),
        CASA2.telefone && /* @__PURE__ */ jsx16("a", { href: `tel:${CASA2.telefone.replace(/[^+\d]/g, "")}`, children: CASA2.telefone }),
        CASA2.whatsapp && /* @__PURE__ */ jsx16("a", { href: `https://wa.me/${CASA2.whatsapp}`, children: "WhatsApp" }),
        CASA2.instagram && /* @__PURE__ */ jsx16("a", { href: `https://instagram.com/${CASA2.instagram.replace(/^@/, "")}`, rel: "noreferrer", children: CASA2.instagram }),
        /* @__PURE__ */ jsx16("p", { className: "pagamentos", children: CASA2.pagamento.join(" / ") })
      ] }),
      tema.assinatura === "letreiro" ? /* @__PURE__ */ jsxs14("svg", { className: "letreiro-pequeno", viewBox: "0 0 470 200", role: "img", "aria-label": `${CASA2.marca}, letreiro aceso com o mascote pintado ao lado`, children: [
        /* @__PURE__ */ jsx16("rect", { x: "8", y: "8", width: "454", height: "184", rx: "3", fill: "var(--fumo)", stroke: "var(--traco)", strokeWidth: "2" }),
        /* @__PURE__ */ jsx16("rect", { x: "18", y: "18", width: "434", height: "164", rx: "2", fill: "var(--borra)", stroke: "var(--traco)" }),
        /* @__PURE__ */ jsxs14("g", { id: "lt-rod-tremor", fill: "var(--letreiro)", textAnchor: "middle", style: { fontFamily: "var(--fonte-display), serif", fontWeight: 800 }, children: [
          /* @__PURE__ */ jsx16("text", { x: "170", y: "93", fontSize: "72", textLength: "248", lengthAdjust: "spacingAndGlyphs", children: linha1.toUpperCase() }),
          /* @__PURE__ */ jsx16("text", { x: "170", y: "158", fontSize: "72", textLength: "248", lengthAdjust: "spacingAndGlyphs", children: linha2.toUpperCase() })
        ] }),
        /* @__PURE__ */ jsx16(DesenhoMascote, { transform: "translate(290 18) scale(.77)" })
      ] }) : /* @__PURE__ */ jsxs14("div", { className: "rodape-assinatura", children: [
        tema.mascote && /* @__PURE__ */ jsx16("svg", { viewBox: "0 0 240 200", width: "136", height: "114", "aria-hidden": "true", children: /* @__PURE__ */ jsx16(DesenhoMascote, {}) }),
        /* @__PURE__ */ jsx16("span", { className: "marca-texto", children: CASA2.marca }),
        textos.rodape && /* @__PURE__ */ jsx16("span", { children: textos.rodape })
      ] }),
      CASA2.horarioConfirmado !== false && /* @__PURE__ */ jsxs14("p", { className: "rodape-fim nota", children: [
        "Chapa acesa das ",
        horaLegivel(CASA2.abre),
        " \xE0s ",
        horaLegivel(CASA2.fecha),
        "."
      ] })
    ] })
  ] });
}

// components/pedido/BarraPedido.tsx
import { useCallback as useCallback2, useEffect as useEffect7, useImperativeHandle, useRef as useRef7 } from "react";
import { jsx as jsx17, jsxs as jsxs15 } from "react/jsx-runtime";
var CONTAGEM_MS = 320;
var ALTURA_BARRA = "var(--barra-altura)";
function BarraPedido({ itens, totalCent, ref, onAbrir, ultimo, onModificar }) {
  const tema = useTema();
  const totalRef = useRef7(null);
  const ficha = useRef7(0);
  const destinoAnimado = useRef7(null);
  const escrever = useCallback2((cent) => {
    if (totalRef.current) totalRef.current.textContent = brl(cent);
  }, []);
  useEffect7(() => {
    if (destinoAnimado.current === totalCent) return;
    ficha.current++;
    destinoAnimado.current = null;
    escrever(totalCent);
  }, [escrever, totalCent]);
  useEffect7(() => () => {
    ficha.current++;
  }, []);
  useImperativeHandle(ref, () => ({
    chegou(de, para) {
      const barra = document.getElementById("barra-pedido");
      const reduzido = prefersReducedMotion();
      if (barra?.animate && !reduzido) {
        barra.animate(
          [
            { transform: "translateY(0px)" },
            { transform: "translateY(7px)" },
            { transform: "translateY(-2px)" },
            { transform: "translateY(0px)" }
          ],
          { duration: 190, easing: "ease-out" }
        );
      }
      if (de === para || reduzido) {
        ficha.current++;
        destinoAnimado.current = null;
        escrever(para);
        return;
      }
      destinoAnimado.current = para;
      const minha = ++ficha.current;
      const t0 = performance.now();
      const passo = (t) => {
        if (minha !== ficha.current) return;
        const p = Math.min(1, (t - t0) / CONTAGEM_MS);
        escrever(Math.round(de + (para - de) * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(passo);
        else {
          destinoAnimado.current = null;
          escrever(para);
        }
      };
      requestAnimationFrame(passo);
    }
  }));
  const cheio = itens > 0;
  return /* @__PURE__ */ jsxs15(
    "div",
    {
      id: "barra-pedido",
      "data-barra-pedido": true,
      style: {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 38,
        minHeight: ALTURA_BARRA,
        background: "var(--fumo)",
        borderTop: "1px solid var(--traco)"
      },
      children: [
        ultimo && /* @__PURE__ */ jsxs15("div", { className: "barra-modificar", children: [
          /* @__PURE__ */ jsx17("span", { children: ultimo.nome }),
          /* @__PURE__ */ jsx17("button", { className: "botao-texto", onClick: (e) => onModificar(ultimo.id, e.currentTarget.closest(".barra-modificar")), children: tema.rotulos.modificar })
        ] }),
        /* @__PURE__ */ jsxs15(
          "div",
          {
            className: "barra-conteudo",
            style: {
              display: "flex",
              flexWrap: "wrap",
              gap: "10px 20px",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px clamp(16px, 4vw, 64px)"
            },
            children: [
              /* @__PURE__ */ jsxs15("div", { style: { display: "flex", gap: 14, alignItems: "baseline" }, children: [
                /* @__PURE__ */ jsx17(
                  "span",
                  {
                    "aria-live": "polite",
                    style: {
                      fontVariationSettings: "'wdth' 92, 'wght' 500",
                      fontSize: "0.9375rem",
                      color: "var(--osso)",
                      opacity: 0.72
                    },
                    children: itens === 0 ? "pedido vazio" : itens === 1 ? "1 item" : `${itens} itens`
                  }
                ),
                /* @__PURE__ */ jsx17(
                  "span",
                  {
                    id: "barra-total",
                    "data-preco": true,
                    ref: totalRef,
                    style: {
                      fontFamily: "var(--fonte-medida)",
                      fontWeight: 500,
                      fontSize: "1.5rem",
                      fontVariantNumeric: "var(--numerais)",
                      letterSpacing: "-0.01em",
                      color: "var(--latao)"
                    },
                    children: brl(totalCent)
                  }
                )
              ] }),
              /* @__PURE__ */ jsx17(
                "button",
                {
                  id: "barra-abrir",
                  type: "button",
                  "data-abrir-carrinho": true,
                  onClick: onAbrir,
                  style: {
                    minHeight: 46,
                    padding: "13px 14px",
                    background: cheio ? "var(--latao)" : "var(--fumo)",
                    color: cheio ? "var(--borra)" : "var(--osso)",
                    border: `1px solid ${cheio ? "var(--latao)" : "var(--traco)"}`,
                    borderRadius: 2,
                    fontFamily: "var(--fonte-corpo), sans-serif",
                    fontSize: "1rem",
                    fontVariationSettings: "'wght' 600",
                    cursor: "pointer",
                    opacity: 1
                  },
                  children: "Abrir pedido"
                }
              )
            ]
          }
        )
      ]
    }
  );
}

// components/pedido/Carrinho.tsx
import { useEffect as useEffect9, useRef as useRef10, useState as useState8 } from "react";

// components/pedido/Modal.tsx
import { useEffect as useEffect8, useRef as useRef8 } from "react";
import { jsx as jsx18 } from "react/jsx-runtime";
function Modal({ children, className, titulo, onSair }) {
  const ref = useRef8(null);
  const sair = useRef8(onSair);
  sair.current = onSair;
  useEffect8(() => {
    const anterior = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("button")?.focus();
    const teclado = (e) => {
      const painel = ref.current;
      if (!painel) return;
      if (e.key === "Escape") {
        if (painel.querySelector("#rx-trilho-cortina, #rx-composicao")) return;
        e.preventDefault();
        sair.current();
      }
      if (e.key !== "Tab") return;
      const escopo = painel.querySelector("#rx-trilho-folha, #rx-composicao") ?? painel;
      const focos = [...escopo.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter((e2) => e2.getClientRects().length);
      const primeiro = focos[0], ultimo = focos[focos.length - 1];
      if (e.shiftKey && (document.activeElement === primeiro || !escopo.contains(document.activeElement))) {
        e.preventDefault();
        ultimo?.focus();
      } else if (!e.shiftKey && (document.activeElement === ultimo || !escopo.contains(document.activeElement))) {
        e.preventDefault();
        primeiro?.focus();
      }
    };
    document.addEventListener("keydown", teclado, true);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", teclado, true);
      if (anterior?.isConnected && !anterior.closest("[inert]")) anterior.focus({ preventScroll: true });
      else document.querySelector("#barra-abrir")?.focus({ preventScroll: true });
    };
  }, []);
  return /* @__PURE__ */ jsx18("div", { className: `modal-cortina ${className}`, onClick: (e) => {
    if (e.target === e.currentTarget) onSair();
  }, children: /* @__PURE__ */ jsx18("div", { ref, role: "dialog", "aria-modal": "true", "aria-label": titulo, className: "modal-corpo", children }) });
}

// components/pedido/ConfirmacaoPedido.tsx
import { useRef as useRef9, useState as useState7 } from "react";
import { Fragment as Fragment6, jsx as jsx19, jsxs as jsxs16 } from "react/jsx-runtime";
function ConfirmacaoPedido({ pedido, dados, onDados }) {
  const { CASA: CASA2, validarConfirmacao: validarConfirmacao2, resumoPedido: resumoPedido2, urlWhatsApp: urlWhatsApp2 } = useNegocio();
  const [erros, setErros] = useState7({});
  const [enviado, setEnviado] = useState7(false);
  const form = useRef9(null);
  const mudar = (campo, valor) => {
    onDados({ ...dados, [campo]: valor });
    setErros((antes) => ({ ...antes, [campo]: void 0 }));
    setEnviado(false);
  };
  const atributos = (campo) => ({
    id: `pedido-${campo}`,
    "aria-invalid": !!erros[campo],
    "aria-describedby": erros[campo] ? `erro-${campo}` : void 0
  });
  const erro = (campo) => erros[campo] && /* @__PURE__ */ jsx19("span", { className: "campo-erro", id: `erro-${campo}`, children: erros[campo] });
  const confirmar = (e) => {
    e.preventDefault();
    const falhas = validarConfirmacao2(dados);
    setErros(falhas);
    const primeiro = Object.keys(falhas)[0];
    if (primeiro) {
      form.current?.querySelector(`#pedido-${primeiro}`)?.focus();
      return;
    }
    if (!pedido.length || !CASA2.whatsapp) return;
    window.open(urlWhatsApp2(pedido, dados), "_blank", "noopener,noreferrer");
    setEnviado(true);
  };
  return /* @__PURE__ */ jsxs16("form", { ref: form, id: "confirmacao-pedido", className: "confirmacao", onSubmit: confirmar, noValidate: true, children: [
    /* @__PURE__ */ jsxs16("details", { className: "conferir-itens", children: [
      /* @__PURE__ */ jsx19("summary", { children: "Conferir itens e altera\xE7\xF5es" }),
      /* @__PURE__ */ jsx19("pre", { children: resumoPedido2(pedido) })
    ] }),
    /* @__PURE__ */ jsxs16("label", { className: "campo", children: [
      /* @__PURE__ */ jsx19("span", { children: "Nome" }),
      /* @__PURE__ */ jsx19("input", { ...atributos("nome"), autoComplete: "name", required: true, value: dados.nome, onChange: (e) => mudar("nome", e.target.value) }),
      erro("nome")
    ] }),
    /* @__PURE__ */ jsxs16("fieldset", { className: "recebimento", children: [
      /* @__PURE__ */ jsx19("legend", { children: "Como vai receber?" }),
      /* @__PURE__ */ jsx19("div", { children: ["retirada", "entrega"].map((valor) => /* @__PURE__ */ jsxs16("label", { "data-escolhido": dados.recebimento === valor ? "" : void 0, children: [
        /* @__PURE__ */ jsx19("input", { type: "radio", name: "recebimento", value: valor, checked: dados.recebimento === valor, onChange: () => mudar("recebimento", valor) }),
        valor === "retirada" ? "Retirada" : "Entrega"
      ] }, valor)) })
    ] }),
    dados.recebimento === "entrega" && /* @__PURE__ */ jsxs16(Fragment6, { children: [
      /* @__PURE__ */ jsxs16("label", { className: "campo", children: [
        /* @__PURE__ */ jsx19("span", { children: "Endere\xE7o" }),
        /* @__PURE__ */ jsx19("input", { ...atributos("endereco"), autoComplete: "street-address", placeholder: "Rua, n\xFAmero e bairro", required: true, value: dados.endereco, onChange: (e) => mudar("endereco", e.target.value) }),
        erro("endereco")
      ] }),
      /* @__PURE__ */ jsxs16("label", { className: "campo", children: [
        /* @__PURE__ */ jsxs16("span", { children: [
          "Complemento ",
          /* @__PURE__ */ jsx19("small", { children: "se tiver" })
        ] }),
        /* @__PURE__ */ jsx19("input", { ...atributos("complemento"), autoComplete: "address-line2", value: dados.complemento, onChange: (e) => mudar("complemento", e.target.value) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs16("label", { className: "campo", children: [
      /* @__PURE__ */ jsx19("span", { children: "Pagamento" }),
      /* @__PURE__ */ jsxs16("select", { ...atributos("pagamento"), required: true, value: dados.pagamento, onChange: (e) => mudar("pagamento", e.target.value), children: [
        /* @__PURE__ */ jsx19("option", { value: "", children: "Escolha a forma" }),
        CASA2.pagamento.map((p) => /* @__PURE__ */ jsx19("option", { value: p, children: p }, p))
      ] }),
      erro("pagamento")
    ] }),
    dados.pagamento === "Dinheiro" && /* @__PURE__ */ jsxs16("label", { className: "campo", children: [
      /* @__PURE__ */ jsxs16("span", { children: [
        "Troco para quanto? ",
        /* @__PURE__ */ jsx19("small", { children: "se precisar" })
      ] }),
      /* @__PURE__ */ jsx19("input", { ...atributos("troco"), inputMode: "decimal", placeholder: "R$", value: dados.troco, onChange: (e) => mudar("troco", e.target.value) }),
      erro("troco")
    ] }),
    /* @__PURE__ */ jsxs16("label", { className: "campo", children: [
      /* @__PURE__ */ jsxs16("span", { children: [
        "Observa\xE7\xE3o do pedido ",
        /* @__PURE__ */ jsx19("small", { children: "se tiver" })
      ] }),
      /* @__PURE__ */ jsx19("textarea", { ...atributos("observacao"), rows: 3, value: dados.observacao, onChange: (e) => mudar("observacao", e.target.value) })
    ] }),
    /* @__PURE__ */ jsx19("p", { className: "confirmacao-recado", role: "status", children: !CASA2.whatsapp ? "WhatsApp da casa n\xE3o informado." : enviado ? "Pedido pronto no WhatsApp. Envie a mensagem para a casa." : "A casa confirma o pedido pelo WhatsApp." })
  ] });
}

// components/pedido/Carrinho.tsx
import { Fragment as Fragment7, jsx as jsx20, jsxs as jsxs17 } from "react/jsx-runtime";
function Carrinho({ dados, onDados, pedido, gancho, onSair, onQuantidade, onRemover, onModificar, onGancho, onDispensar }) {
  const { CASA: CASA2 } = useNegocio();
  const tema = useTema();
  const [resumo, setResumo] = useState8(false);
  const titulo = useRef10(null);
  useEffect9(() => {
    if (resumo) titulo.current?.focus({ preventScroll: true });
  }, [resumo]);
  return /* @__PURE__ */ jsx20(Modal, { className: "carrinho-modal", titulo: resumo ? "Confirmar pedido" : "Seu pedido", onSair, children: /* @__PURE__ */ jsxs17("div", { "data-carrinho": true, className: "carrinho-folha", children: [
    /* @__PURE__ */ jsxs17("header", { className: "carrinho-cabeca", children: [
      /* @__PURE__ */ jsx20("h2", { ref: titulo, tabIndex: -1, children: resumo ? "Confirmar pedido" : "Seu pedido" }),
      /* @__PURE__ */ jsx20("button", { id: "carrinho-fechar", className: "botao-texto", onClick: onSair, "aria-label": "Fechar pedido e voltar ao card\xE1pio", children: "Fechar" })
    ] }),
    /* @__PURE__ */ jsx20("div", { className: "carrinho-miolo", children: /* @__PURE__ */ jsx20("div", { "data-passo-pedido": resumo ? "confirmacao" : "itens", children: resumo ? /* @__PURE__ */ jsx20(ConfirmacaoPedido, { pedido, dados, onDados }) : /* @__PURE__ */ jsxs17(Fragment7, { children: [
      !pedido.length && /* @__PURE__ */ jsxs17("div", { className: "vazio carrinho-vazio", children: [
        /* @__PURE__ */ jsx20(Mascote, { largura: 150 }),
        /* @__PURE__ */ jsx20("p", { children: "Seu pedido est\xE1 vazio." }),
        /* @__PURE__ */ jsx20("button", { className: "botao-quente", onClick: onSair, children: "Escolher um lanche" })
      ] }),
      /* @__PURE__ */ jsx20("ul", { className: "pedido-linhas", children: pedido.map((p) => /* @__PURE__ */ jsxs17("li", { "data-linha-pedido": p.id, className: "pedido-linha", children: [
        p.foto ? /* @__PURE__ */ jsx20("img", { src: p.foto, alt: "", width: 64, height: 64 }) : /* @__PURE__ */ jsx20("span", { className: "extra-inicial", "aria-hidden": "true", children: p.nome[0] }),
        /* @__PURE__ */ jsxs17("div", { className: "pedido-descricao", children: [
          /* @__PURE__ */ jsx20("h3", { children: p.nome }),
          /* @__PURE__ */ jsx20("p", { children: p.resumo }),
          p.observacao && /* @__PURE__ */ jsxs17("p", { className: "item-observacao", children: [
            "obs: ",
            p.observacao
          ] })
        ] }),
        /* @__PURE__ */ jsxs17("div", { className: "quantidade", children: [
          /* @__PURE__ */ jsx20("button", { "data-qtd-menos": p.id, "aria-label": `Menos um ${p.nome}`, onClick: () => onQuantidade(p.id, -1), children: "\u2212" }),
          /* @__PURE__ */ jsx20("span", { "aria-label": `Quantidade: ${p.qtd}`, children: p.qtd }),
          /* @__PURE__ */ jsx20("button", { "data-qtd-mais": p.id, "aria-label": `Mais um ${p.nome}`, onClick: () => onQuantidade(p.id, 1), children: "+" })
        ] }),
        /* @__PURE__ */ jsx20("span", { className: "linha-preco", "data-preco": true, children: brl(p.cent * p.qtd) }),
        /* @__PURE__ */ jsxs17("div", { className: "linha-acoes", children: [
          p.grupo === "lanche" && /* @__PURE__ */ jsxs17("button", { className: "botao-texto", "data-modificar": p.id, onClick: (e) => onModificar(p.id, e.currentTarget.closest("[data-linha-pedido]")), children: [
            tema.rotulos.modificarCurto,
            p.qtd > 1 ? ` (${p.qtd})` : ""
          ] }),
          /* @__PURE__ */ jsx20("button", { className: "botao-texto", "data-remover": p.id, "aria-label": `Remover ${p.nome}`, onClick: () => onRemover(p.id), children: "Remover" })
        ] })
      ] }, p.id)) }),
      gancho && /* @__PURE__ */ jsxs17("aside", { "data-gancho": gancho.id, className: "gancho", children: [
        /* @__PURE__ */ jsx20("h3", { children: gancho.texto }),
        gancho.extra && /* @__PURE__ */ jsxs17("p", { children: [
          gancho.extra.nome,
          " ",
          /* @__PURE__ */ jsx20("span", { "data-preco": true, children: brl(gancho.extra.precoCent) })
        ] }),
        /* @__PURE__ */ jsxs17("div", { children: [
          /* @__PURE__ */ jsx20("button", { className: "botao-quente", "data-gancho-agir": true, onClick: (e) => onGancho(e.currentTarget.closest("[data-gancho]")), children: gancho.extra ? "Adicionar" : "P\xF4r bacon nesse" }),
          /* @__PURE__ */ jsx20("button", { className: "botao-texto", "data-gancho-dispensar": true, onClick: onDispensar, children: "Dispensar" })
        ] })
      ] })
    ] }) }) }),
    !!pedido.length && /* @__PURE__ */ jsxs17("div", { className: "carrinho-base", children: [
      /* @__PURE__ */ jsxs17("div", { className: "carrinho-total", children: [
        /* @__PURE__ */ jsx20("span", { children: "Total" }),
        /* @__PURE__ */ jsx20("span", { "data-preco": true, children: brl(totalPedido(pedido)) })
      ] }),
      /* @__PURE__ */ jsx20("p", { className: "pagamentos", children: CASA2.pagamento.join(" / ") }),
      resumo ? /* @__PURE__ */ jsxs17("div", { className: "resumo-acoes", children: [
        /* @__PURE__ */ jsx20("button", { id: "carrinho-enviar", form: "confirmacao-pedido", type: "submit", className: "botao-quente", children: "Confirmar e abrir WhatsApp" }),
        /* @__PURE__ */ jsx20("button", { className: "botao-texto", onClick: () => transicionar("confirma-sai", () => setResumo(false)), children: "Voltar aos itens" })
      ] }) : /* @__PURE__ */ jsx20("button", { id: "carrinho-resumo", className: "botao-quente", onClick: () => transicionar("confirma-entra", () => setResumo(true)), children: "Fechar pedido" })
    ] })
  ] }) });
}

// components/pedido/Balcao.tsx
import { jsx as jsx21, jsxs as jsxs18 } from "react/jsx-runtime";
var imagens = /* @__PURE__ */ new Map();
var preparar = (slugs) => Promise.all(slugs.map((s) => {
  if (!imagens.has(s)) imagens.set(s, new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      im.decode().catch(() => {
      }).finally(resolve);
    };
    im.onerror = () => resolve();
    im.src = urlCamada(MAPA_CAMADAS[s]);
  }));
  return imagens.get(s);
}));
function Balcao() {
  const { FIXOS: FIXOS2, comBacon: comBacon2, ganchoDoPedido: ganchoDoPedido2, itemFixo: itemFixo2, itemLanche: itemLanche2 } = useNegocio();
  const tema = useTema();
  const [pedido, setPedido] = useState9([]);
  const atual2 = useRef11([]);
  const [editor, setEditor] = useState9(null);
  const [confirmacao, setConfirmacao] = useState9(CONFIRMACAO_INICIAL);
  const [carrinho, setCarrinho] = useState9(false);
  const [intro, setIntro] = useState9(tema.intro);
  const [ultimo, setUltimo] = useState9(null);
  const [aviso, setAviso] = useState9("");
  const [ganchos, setGanchos] = useState9({ vistos: [], dispensados: [] });
  const [sessaoLida, setSessaoLida] = useState9(false);
  const barra = useRef11(null);
  const pid = useRef11(0);
  const canceladores = useRef11(/* @__PURE__ */ new Set());
  const vivo = useRef11(true);
  useEffect10(() => {
    vivo.current = true;
    const t = window.setTimeout(() => {
      void preparar([...new Set(FIXOS2.flatMap((f) => f.camadas))]);
    }, 1200);
    try {
      const salvo = JSON.parse(sessionStorage.getItem("lm:ganchos") ?? "null");
      if (Array.isArray(salvo?.vistos) && Array.isArray(salvo?.dispensados)) setGanchos(salvo);
    } catch {
    }
    setSessaoLida(true);
    return () => {
      vivo.current = false;
      clearTimeout(t);
      canceladores.current.forEach((c) => c());
    };
  }, []);
  useEffect10(() => {
    if (!intro) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [intro]);
  useEffect10(() => {
    if (sessaoLida) {
      try {
        sessionStorage.setItem("lm:ganchos", JSON.stringify(ganchos));
      } catch {
      }
    }
  }, [ganchos, sessaoLida]);
  const atualizar = useCallback3((novo) => {
    atual2.current = novo;
    setPedido(novo);
  }, []);
  const somar = useCallback3((item, substituir) => {
    const de = totalPedido(atual2.current);
    const lista = atual2.current.slice();
    let id = substituir;
    if (substituir) {
      const i = lista.findIndex((p) => p.id === substituir);
      if (i < 0) return;
      lista[i] = { ...item, id: substituir, qtd: lista[i].qtd };
    } else {
      const i = lista.findIndex((p) => p.chave === item.chave);
      if (i >= 0) {
        lista[i] = { ...lista[i], qtd: lista[i].qtd + 1 };
        id = lista[i].id;
      } else {
        id = `p${++pid.current}`;
        lista.push({ ...item, id, qtd: 1 });
      }
    }
    atualizar(lista);
    if (item.grupo === "lanche") setUltimo(id);
    setAviso(`${item.nome} ${substituir ? "atualizado" : "adicionado"}.`);
    barra.current?.chegou(de, totalPedido(lista));
  }, [atualizar]);
  const lancar = useCallback3((item, origem, substituir, voltarCarrinho = false) => {
    const cancelar = salto(item, origem, () => {
      somar(item, substituir);
      if (voltarCarrinho) setCarrinho(true);
    });
    canceladores.current.add(cancelar);
    window.setTimeout(() => canceladores.current.delete(cancelar), 1800);
  }, [somar]);
  const adicionarFixo = async (f, el) => {
    await preparar(f.camadas);
    if (!vivo.current || !el.isConnected) return;
    const palco = el.querySelector("[data-palco], .lanche-icone");
    const r = palco.getBoundingClientRect();
    let origem = { centroX: r.left + r.width / 2, baseY: r.top + r.height * 0.75, kk: Math.min(r.width * 0.9 / 2e3, 0.14) };
    const pilha = palco.querySelector("[data-camadas]");
    const base = pilha?.querySelector("[data-peca]");
    if (pilha && base) {
      const b = base.getBoundingClientRect(), k = Number(pilha.dataset.k);
      origem = { centroX: b.left + b.width / 2, baseY: b.top + (600 + Number(base.dataset.altura) / 2) * k, kk: k };
    }
    lancar(itemFixo2(f), origem);
  };
  const adicionarExtra = (e) => somar(itemExtra(e));
  const modificar = (id, origem, bacon = false) => {
    const p = atual2.current.find((p2) => p2.id === id);
    if (!p || p.grupo !== "lanche") return;
    lembrarOrigem(origem ?? null);
    transicionar("rx-entra", () => {
      setEditor({ nome: p.nome, forma: p.forma, fixoSlug: p.fixoSlug, observacao: p.observacao, camadas: bacon ? comBacon2(p.camadas) : p.camadas.slice(), id, voltarCarrinho: carrinho });
      setCarrinho(false);
    }, origemAtual());
  };
  const montar = (forma, origem) => {
    lembrarOrigem(origem);
    transicionar("rx-entra", () => {
      setEditor({ nome: forma === "prensado" ? "Seu prensado" : "Seu redondo", forma, camadas: [], voltarCarrinho: false });
    }, origemAtual());
  };
  const fecharEditor = () => transicionar("rx-sai", () => {
    if (editor?.voltarCarrinho) setCarrinho(true);
    setEditor(null);
  }, origemAtual());
  const abrirCarrinho = () => transicionar("carrinho-entra", () => setCarrinho(true));
  const fecharCarrinho = () => transicionar("carrinho-sai", () => setCarrinho(false));
  const aoFechar = (lanche, origem) => {
    setEditor(null);
    lancar(itemLanche2(lanche), origem, editor?.id, editor?.voltarCarrinho);
  };
  const gancho = carrinho && sessaoLida ? ganchoDoPedido2(pedido, ganchos.vistos, ganchos.dispensados) : null;
  const ganchoId = gancho?.id;
  useEffect10(() => {
    if (ganchoId) setGanchos((g) => g.vistos.includes(ganchoId) ? g : { ...g, vistos: [...g.vistos, ganchoId] });
  }, [ganchoId]);
  const ultimoItem = pedido.find((p) => p.id === ultimo);
  return /* @__PURE__ */ jsxs18(RaioXAberto.Provider, { value: !!editor, children: [
    tema.intro && /* @__PURE__ */ jsx21(Letreiro, { onConcluir: () => setIntro(false) }),
    /* @__PURE__ */ jsxs18("main", { id: "conteudo", inert: !!editor || carrinho || intro, className: ultimoItem ? "tem-modificar" : void 0, children: [
      /* @__PURE__ */ jsx21(Hero, {}),
      /* @__PURE__ */ jsx21(Cardapio, { pedido, onAdicionar: adicionarFixo, onModificar: modificar, onMontar: montar }),
      /* @__PURE__ */ jsx21(TrilhoLanches, { onAdicionar: adicionarFixo }),
      /* @__PURE__ */ jsx21(Extras, { grupo: "bebida", onAdicionar: adicionarExtra }),
      /* @__PURE__ */ jsx21(Extras, { grupo: "acompanhamento", onAdicionar: adicionarExtra }),
      /* @__PURE__ */ jsx21(HistoriaERodape, {})
    ] }),
    /* @__PURE__ */ jsx21("p", { className: "sr-only", role: "status", children: aviso }),
    !editor && /* @__PURE__ */ jsx21("div", { inert: carrinho || intro, children: /* @__PURE__ */ jsx21(BarraPedido, { ref: barra, itens: pedido.reduce((s, p) => s + p.qtd, 0), totalCent: totalPedido(pedido), onAbrir: abrirCarrinho, ultimo: carrinho ? void 0 : ultimoItem, onModificar: modificar }) }),
    carrinho && /* @__PURE__ */ jsx21(
      Carrinho,
      {
        dados: confirmacao,
        onDados: setConfirmacao,
        pedido,
        gancho,
        onSair: fecharCarrinho,
        onModificar: modificar,
        onQuantidade: (id, d) => atualizar(atual2.current.map((p) => p.id === id ? { ...p, qtd: p.qtd + d } : p).filter((p) => p.qtd > 0)),
        onRemover: (id) => atualizar(atual2.current.filter((p) => p.id !== id)),
        onGancho: (e) => {
          if (gancho?.extra) adicionarExtra(gancho.extra);
          else if (gancho?.pedidoId) modificar(gancho.pedidoId, e, true);
        },
        onDispensar: () => {
          if (gancho) setGanchos((g) => ({ ...g, dispensados: [...g.dispensados, gancho.id] }));
        }
      }
    ),
    editor && /* @__PURE__ */ jsx21(Modal, { className: "rx-modal", titulo: `Raio-x do ${editor.nome}`, onSair: fecharEditor, children: /* @__PURE__ */ jsx21(RaioX, { fixoSlug: editor.fixoSlug, observacaoInicial: editor.observacao, nome: editor.nome, forma: editor.forma, camadasIniciais: editor.camadas, onFechar: aoFechar, onSair: fecharEditor, editando: !!editor.id }) })
  ] });
}

// pacote/client.tsx
import { Fragment as Fragment8, jsx as jsx22, jsxs as jsxs19 } from "react/jsx-runtime";
function Lancheria({ tema, dados }) {
  const estilo = estiloTema(tema);
  const css = Object.entries(estilo).map(([k, v]) => `${k === "colorScheme" ? "color-scheme" : k}:${v}`).join(";");
  return /* @__PURE__ */ jsxs19(Fragment8, { children: [
    /* @__PURE__ */ jsx22("link", { rel: "stylesheet", href: "/lancheria-rx/estrutura.css", precedence: "lancheria" }),
    /* @__PURE__ */ jsx22("link", { rel: "stylesheet", href: tema.folhaFontes, precedence: "lancheria-fontes" }),
    /* @__PURE__ */ jsx22("style", { children: `html:has([data-lancheria-app]){${css}}` }),
    /* @__PURE__ */ jsx22(
      "div",
      {
        "data-lancheria-app": true,
        "data-tema": tema.slug,
        "data-layout": tema.cardapio,
        "data-fundo": tema.fundo,
        "data-densidade": tema.densidade,
        "data-assinatura": tema.assinatura,
        "data-transicao-ms": tema.movimento.transicaoMs ?? void 0,
        "data-captura": tema.movimento.captura,
        style: estilo,
        children: /* @__PURE__ */ jsx22(ProvedorTema, { tema, children: /* @__PURE__ */ jsx22(ProvedorNegocio, { dados, children: /* @__PURE__ */ jsx22(Balcao, {}) }, JSON.stringify(dados)) })
      }
    )
  ] });
}
export {
  Lancheria
};
