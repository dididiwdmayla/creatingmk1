import type { AppDb } from "@/lib/firestore-like";

import { cidadeDoEndereco } from "./cidade";
import { listLeads } from "./repo";
import type { Lead } from "./types";

/**
 * A LINHA DE UM LEAD NO SELETOR — o mínimo que serve para ESCOLHER um, e
 * nada além disso.
 *
 * Existe porque vários campos da /config precisam de um `leadId` e o
 * operador não tem como saber um: o id é o placeId do Google ("ChIJ…",
 * quase 30 caracteres) e ele não aparece — de propósito — em lugar nenhum
 * da interface. A resposta não é expor id na tela (isso desfaria a
 * arrumação que o colapso da /config fez); é o campo parar de pedir id
 * cru. O VALOR GRAVADO continua sendo o `leadId`: nenhum modelo de dados
 * muda por causa desta tela.
 *
 * Os quatro campos são o que distingue um lead de outro na hora de
 * escolher — e `cidade` é o que resolve o caso que motiva a lista existir:
 * dois leads de mesmo NOME em cidades diferentes ("Barbearia do Zé", em
 * Maringá e em Porto Alegre) são indistinguíveis sem ela.
 *
 * O que NÃO vem aqui é o ponto: o doc de um lead carrega demo inteira,
 * capturas, horários, detalhes do Places. Mandar a coleção inteira para a
 * tela por causa de um campo de escolha seria megabytes para desenhar uma
 * lista de nomes.
 */
export interface OpcaoLead {
  leadId: string;
  nome: string;
  /** Nicho CRU da busca que trouxe o lead. `""` quando não há busca. */
  nicho: string;
  /** Cidade do lead. `""` quando o endereço não diz e não há região. */
  cidade: string;
  /** Tem demo salva — o que decide se ele serve de alvo de disparo. */
  temDemo: boolean;
}

/**
 * De um lead completo para a linha do seletor.
 *
 * A cidade sai do ENDEREÇO do lead (`cidadeDoEndereco`, o mesmo caminho da
 * /mundo, da ficha e da montagem da demo) e não da região da busca: o
 * endereço é onde o negócio FICA, e a região é só o que alguém digitou ao
 * procurar — uma busca por "Porto Alegre RS" devolve lead de Canoas. A
 * região entra como reserva, para o lead sem endereço não ficar sem nada
 * ao lado do nome.
 */
export function opcaoDoLead(lead: Lead): OpcaoLead {
  const cidade = lead.endereco ? cidadeDoEndereco(lead.endereco).cidade : undefined;
  return {
    leadId: lead.placeId,
    nome: lead.nome,
    nicho: lead.busca?.nicho ?? "",
    cidade: cidade ?? lead.busca?.regiao ?? "",
    temDemo: Boolean(lead.demo),
  };
}

/**
 * A lista inteira, ordenada por NOME — a ordem em que o operador procura.
 *
 * Varredura de `/leads`, e é POR ISSO que o seletor a busca **uma vez, ao
 * abrir**, e filtra no cliente: o `AppDb` não tem query, então "buscar por
 * nome" no servidor seria a MESMA varredura a cada tecla digitada.
 *
 * O LEAD FIXO DE TESTE continua fora: quem exclui é `listLeads`, na
 * origem, e afrouxar aquilo para servir a um campo de escolha vazaria o
 * lead de teste para /leads, /demos, /hoje, /mundo e para a penetração de
 * site por nicho (ver "O INVENTÁRIO" no ARCHITECTURE.md). Quem precisa
 * oferecê-lo — o seletor do disparo de teste — o passa como opção EXTRA,
 * que é onde esse caso pertence.
 */
export async function listarOpcoesDeLead(db: AppDb): Promise<OpcaoLead[]> {
  const leads = await listLeads(db);
  return leads
    .map(opcaoDoLead)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}
