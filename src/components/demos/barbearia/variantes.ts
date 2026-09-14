import type { BarbeariaComposicao, DemoData, SkinVariante } from "@/lib/demos/types";
import { criarVariante } from "@/lib/demos/variantes";
import { BARBEARIA_EXEMPLO } from "./exemplo";
import { BARBEARIA_SECOES } from "./secoes";
import { BARBEARIA_THEME_PRESETS } from "./themes";

interface Declaracao {
  id: string; nome: string; descricao: string; fundo: "claro" | "escuro";
  composicao: BarbeariaComposicao; ordem: string[]; slogan: string;
  textos: Record<string, Partial<DemoData["secoes"][string]>>;
}
const DECLARACOES: Declaracao[] = [
  {
    id: "norte", nome: "Norte — Casa de Ofício", fundo: "escuro",
    descricao: "Tradição de bairro: princípios antes da oferta, madeira fosca e retratos verticais.",
    composicao: { abertura: "oficio", textura: "fibra", servicos: "lateral", equipe: "cartoes", filosofia: "colunas", moldura: "simples", sombra: 24, saturacao: .8 },
    ordem: ["hero","agendamentoRapido","filosofia","servicos","equipe","ritual","depoimentos","agendamento","contato"],
    slogan: "Ofício, tesoura e navalha.",
    textos: {
      hero: { texto: "Cortes clássicos, barbas artesanais e um horário reservado para cuidar de você." },
      agendamentoRapido: { titulo: "SUA CADEIRA, SEU HORÁRIO.", texto: "Já conhece a casa? Vá direto ao agendamento." },
      filosofia: { titulo: "O OFÍCIO VEM PRIMEIRO." },
      equipe: { titulo: "QUEM CUIDA DO SEU CORTE." },
      contato: { titulo: "A NOSSA PORTA ESTÁ AQUI." },
    },
  },
  {
    id: "meia-noite", nome: "Meia-noite — Precisão Urbana", fundo: "escuro",
    descricao: "Para a rotina da cidade: serviço, preço e agendamento primeiro. Registro fino e leitura compacta.",
    composicao: { abertura: "urbana", textura: "registro", servicos: "tabela", equipe: "perfis", filosofia: "linhas", moldura: "simples", sombra: 8, saturacao: .35 },
    ordem: ["hero","servicos","agendamentoRapido","agendamento","equipe","depoimentos","filosofia","ritual","contato"],
    slogan: "Seu corte. No seu tempo.",
    textos: {
      hero: { texto: "Corte preciso, acabamento limpo. Escolha o serviço e reserve o próximo horário.", cta: "RESERVAR HORÁRIO" },
      agendamentoRapido: { titulo: "ESCOLHEU? VAMOS AGENDAR.", texto: "Combine seu serviço e horário em uma conversa.", cta: "RESERVAR PELO WHATSAPP" },
      servicos: { titulo: "SERVIÇO. PREÇO. SEM RODEIOS." },
      equipe: { titulo: "PRECISÃO EM CADA MÃO." },
      filosofia: { titulo: "O ESSENCIAL, BEM FEITO." },
      ritual: { texto: "Um intervalo na agenda. Um corte em dia." },
      depoimentos: { titulo: "QUEM PASSOU POR AQUI." },
      agendamento: { titulo: "ESCOLHA. CONFIRME. CHEGUE." },
      contato: { titulo: "ENCONTRE SEU PRÓXIMO CORTE." },
    },
  },
  {
    id: "creme", nome: "Creme — Almanaque do Barbeiro", fundo: "claro",
    descricao: "Uma casa para gerações: papel, margens abertas e perfis dos profissionais. Atalho de reserva na segunda seção.",
    composicao: { abertura: "almanaque", textura: "papel", servicos: "lateral", equipe: "perfis", filosofia: "colunas", moldura: "dupla", sombra: 5, saturacao: .7 },
    ordem: ["hero","agendamentoRapido","equipe","filosofia","servicos","ritual","depoimentos","agendamento","contato"],
    slogan: "Bons cortes atravessam o tempo.",
    textos: {
      hero: { texto: "Uma casa de conversa boa e cuidado atento. Conheça as mãos por trás de cada corte.", cta: "MARCAR UMA VISITA" },
      agendamentoRapido: { titulo: "VAMOS MARCAR SUA VISITA?", texto: "O caminho de quem já é de casa começa aqui.", cta: "COMBINAR UM HORÁRIO" },
      equipe: { titulo: "PESSOAS, HISTÓRIAS E OFÍCIO." },
      filosofia: { titulo: "O QUE A GENTE FAZ QUESTÃO." },
      servicos: { titulo: "UM CLÁSSICO PARA CHAMAR DE SEU." },
      ritual: { texto: "O corte muda. O cuidado permanece." },
      depoimentos: { titulo: "HISTÓRIAS DE QUEM VOLTA." },
      agendamento: { titulo: "SUA PRÓXIMA VISITA." },
      contato: { titulo: "VENHA CONHECER A CASA." },
    },
  },
  {
    id: "vinho", nome: "Vinho — Salão de Ritual", fundo: "escuro",
    descricao: "Atendimento reservado: pausa, ritual e profissionais antes do preço. Molduras duplas e superfícies bordô foscas.",
    composicao: { abertura: "salao", textura: "fosco", servicos: "tabela", equipe: "cartoes", filosofia: "linhas", moldura: "dupla", sombra: 18, saturacao: .65 },
    ordem: ["hero","agendamentoRapido","ritual","equipe","filosofia","servicos","depoimentos","agendamento","contato"],
    slogan: "Reserve tempo para você.",
    textos: {
      hero: { texto: "Um atendimento de cada vez. Corte, barba e uma pausa para sair renovado.", cta: "RESERVAR MEU MOMENTO" },
      agendamentoRapido: { titulo: "O SEU TEMPO COMEÇA AQUI.", texto: "Reserve agora. Conheça o ritual logo abaixo.", cta: "RESERVAR ATENDIMENTO" },
      ritual: { texto: "Entre um compromisso e outro, um momento que é só seu." },
      equipe: { titulo: "CUIDADO QUE TEM ASSINATURA." },
      filosofia: { titulo: "OS DETALHES FAZEM O RITUAL." },
      servicos: { titulo: "ESCOLHA O SEU RITUAL." },
      depoimentos: { titulo: "A EXPERIÊNCIA, EM PALAVRAS." },
      agendamento: { titulo: "UM HORÁRIO SÓ PARA VOCÊ." },
      contato: { titulo: "SEU PRÓXIMO MOMENTO." },
    },
  },
];

/** Mesma forma de conteúdo e mesmos placeholders. A variante só muda defaults. */
export const BARBEARIA_VARIANTES: readonly SkinVariante[] = DECLARACOES.map(d => {
  const preset = BARBEARIA_THEME_PRESETS.find(t => t.id === d.id)!;
  const exemplo: DemoData = { ...BARBEARIA_EXEMPLO, slogan: d.slogan,
    secoes: Object.fromEntries(Object.entries(BARBEARIA_EXEMPLO.secoes).map(([id,s]) => [id,{...s,...d.textos[id]}])),
  };
  return criarVariante({ id:d.id, nome:d.nome, descricao:d.descricao, fundo:d.fundo,
    theme: { ...preset, nome:d.nome, barbearia:d.composicao,
      ...(d.id === "meia-noite" && { intro:false }),
      ...(d.id === "vinho" && { densidade:"arejada" as const, heroTitulo:{...preset.heroTitulo,alinhamento:"centro" as const} }),
    },
    exemplo, arranjo:{ordem:d.ordem}, thumbnail:`/demos/barbearia/${d.id}.jpg`,
  },BARBEARIA_SECOES);
});
