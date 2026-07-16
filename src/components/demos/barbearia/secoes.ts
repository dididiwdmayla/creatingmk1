import type { SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin de barbearia, na ordem default de render.
 * O editor usa esta lista para reordenar/ocultar e oferecer alinhamento;
 * a skin renderiza pela ordem efetiva (ver lib/demos/estrutura.ts).
 *
 * `hero` é fixa (é a tela de abertura, com o header por cima). As demais
 * são reordenáveis e ocultáveis. `alignOptions` só onde o layout aguenta
 * trocar o alinhamento sem quebrar (grades de itens e blocos de texto) —
 * nada de posicionamento livre: o template continua responsivo.
 */
export const BARBEARIA_SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Abertura (hero)", fixa: true },
  { id: "agendamentoRapido", nome: "Agendamento rápido" },
  { id: "filosofia", nome: "Filosofia", alignOptions: ["esquerda", "centro"] },
  { id: "servicos", nome: "Serviços" },
  { id: "equipe", nome: "Equipe", alignOptions: ["esquerda", "centro"] },
  { id: "ritual", nome: "Ritual (citação)" },
  { id: "depoimentos", nome: "Depoimentos", alignOptions: ["esquerda", "centro"] },
  { id: "agendamento", nome: "Como funciona", alignOptions: ["esquerda", "centro"] },
  { id: "contato", nome: "Contato" },
];
