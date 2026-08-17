import type { LeadCapturas } from "@/lib/demos/capturas/estado";
import type { LeadDemo } from "@/lib/demos/types";
import type { VisitaDemo } from "@/lib/demos/visitas";

export const DEMOS_AVULSAS_COLLECTION = "demosAvulsas";

/**
 * Uma demo SEM lead associado — o mesmo produto da Forja, montado a partir
 * de identidade digitada à mão em vez de dado do Google.
 *
 * Mora em coleção PRÓPRIA, nunca em `/leads` com uma bandeirinha. A
 * diferença não é de gosto: uma avulsa não é prospect, não tem status, não
 * tem busca de origem e não pode entrar em contagem nenhuma do funil
 * (metas, penetração por nicho/cidade, fila de /hoje, listagem de leads).
 * Numa coleção separada isso vale por CONSTRUÇÃO — nenhuma query de lead
 * alcança uma avulsa, hoje ou depois de qualquer refatoração. Como flag
 * dentro de `/leads`, valeria só enquanto todo mundo lembrasse do filtro.
 *
 * O campo `demo` é o MESMO `LeadDemo` da demo de lead — é o que faz o
 * editor visual, a validação do PUT, os tokens de envio, as capturas e o
 * rastreio de visita servirem os dois casos sem contrato paralelo.
 */
export interface DemoAvulsa {
  /** UUID gerado na criação — também é o id do doc e o da rota pública. */
  id: string;
  /**
   * País do negócio, em pt-BR (MESMA chave dos mapas de `@/lib/idioma` e
   * `@/lib/moeda` — é o que o Places devolve no fim de `Lead.endereco`).
   * É daqui que saem o idioma e a moeda da demo, como o endereço do lead
   * faz na demo de lead. Ausente = default (pt-BR / BRL).
   */
  pais?: string;
  /** Configuração da demo — mesmo contrato do campo `demo` do lead. */
  demo: LeadDemo;
  /** Visitas à rota pública — mesmo formato e mesma regra de token do lead. */
  demoVisitas?: VisitaDemo[];
  /** Última geração de capturas — mesmo contrato do campo `capturas` do lead. */
  capturas?: LeadCapturas;
  criadoEm: string;
  /** Usuário do primeiro save (métricas de autoria na listagem de /demos). */
  criadoPor?: string;
  atualizadoEm: string;
}

/**
 * Campos de identidade que o operador digita na criação. Todos opcionais
 * menos `nome`: sem nome não há título hero nem rótulo na listagem, e uma
 * demo publicada com o nome do template seria o pior dos casos.
 *
 * Campo deixado vazio some da página — ver `identidadeEmBranco` em
 * ./identidade.ts.
 */
export interface IdentidadeAvulsa {
  nome: string;
  pais?: string;
  cidade?: string;
  endereco?: string;
  telefone?: string;
  whatsapp?: string;
  horarios?: string;
  instagram?: string;
}
