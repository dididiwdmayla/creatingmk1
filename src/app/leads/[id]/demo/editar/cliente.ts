import type { SugestaoDemo } from "@/lib/ai/sugestao";
import type { ConteudoTraduzivel } from "@/lib/ai/traducaoDemo";
import type { NivelIA } from "@/lib/ai/nivel";
import { api } from "@/lib/api-client";
import {
  baseDemoDataAvulsa,
  montarDemoDataAvulsa,
  nomeDaAvulsa,
} from "@/lib/demos/avulsas/identidade";
import { idiomaPadraoDaAvulsa, moedaDaAvulsa } from "@/lib/demos/avulsas/idioma";
import type { DemoAvulsa } from "@/lib/demos/avulsas/types";
import { caminhoDemo, envioVigente } from "@/lib/demos/envio";
import { idiomaPadraoDoLead } from "@/lib/demos/idioma";
import { moedaDaDemo } from "@/lib/demos/moeda";
import { montarDemoData } from "@/lib/demos/montar";
import type {
  DemoData,
  DemoDataPatch,
  LeadDemo,
  SkinDefinition,
  TemaPatch,
} from "@/lib/demos/types";
import type { Lead } from "@/lib/leads/types";

/**
 * O editor visual serve DUAS famílias de demo — a de um lead e a avulsa
 * (sem lead associado). O painel, o preview, o diff mínimo e o fluxo de
 * salvar são os mesmos; o que muda é de onde o registro vem, pra onde o
 * PUT vai e se existe a camada `dadosDoLead` na montagem.
 *
 * Este módulo é essa diferença, inteira e num lugar só. `EditorClient`
 * recebe um `ClienteDemo` e não menciona lead nem avulsa em lugar nenhum:
 * é o que permite reaproveitar o editor sem uma segunda cópia dele.
 */

export type TipoDemo = "lead" | "avulsa";

/** O registro que hospeda a demo, do ponto de vista do editor. */
export interface RegistroDemo {
  id: string;
  /** Nome exibido no cabeçalho do editor. */
  nome: string;
  /** Configuração salva — ausente enquanto a demo do lead não foi criada. */
  demo?: LeadDemo;
  /** Idioma default (o seletor da aba Tema mostra como "do endereço"/"do país"). */
  idiomaPadrao: string;
  /** Moeda dos preços — deriva do país, sem sobrescrita manual. */
  moeda: string;
  /** País digitado — só a avulsa tem; `undefined` na demo de lead. */
  pais?: string;
}

export interface CorpoSalvar {
  skinId: string;
  themeId: string;
  dados: DemoDataPatch;
  tema?: TemaPatch;
  idioma?: string;
}

export interface ClienteDemo {
  tipo: TipoDemo;
  /** Rótulo do registro no texto da tela ("lead" / "demo avulsa"). */
  rotulo: string;
  /** Pra onde "← Voltar" e o pós-exclusão levam. */
  voltarPara(id: string): string;
  /** Rótulo do botão de voltar. */
  voltarRotulo: string;
  /** Caminho da rota pública desta demo. */
  caminhoPublico(id: string): string;

  carregar(id: string): Promise<RegistroDemo>;
  salvar(id: string, corpo: CorpoSalvar): Promise<RegistroDemo>;
  excluir(id: string): Promise<void>;

  uploadImagem(id: string, slot: string, arquivo: File, skinId: string): Promise<{ url: string }>;
  removerImagem(id: string, slot: string): Promise<RegistroDemo>;
  uploadVideo(id: string, slot: string, arquivo: File, skinId: string): Promise<{ url: string }>;
  removerVideo(id: string, slot: string, skinId: string): Promise<RegistroDemo>;

  /**
   * BASE do diff mínimo: o que `montarPatch` compara pra decidir o que
   * vira patch. Na demo de lead é `exemplo ← dadosDoLead`; na avulsa é
   * `exemplo ← identidade em branco`.
   */
  base(registro: RegistroDemo, skin: SkinDefinition): DemoData;
  /** Montagem EFETIVA (a mesma da rota pública) sobre um patch salvo. */
  montar(registro: RegistroDemo, skin: SkinDefinition, patch?: DemoDataPatch): DemoData;

  /**
   * Sugestão de texto/tema por IA. Ausente na avulsa: `gerarSugestaoDemo`
   * monta o prompt a partir do LEAD (nicho da busca, endereço, avaliações)
   * e sem lead não há contexto — o botão de IA mostra só "Traduzir".
   */
  gerarSugestao?(
    id: string,
    skinId: string,
    nivel: NivelIA,
    idioma?: string,
  ): Promise<{ sugestao: SugestaoDemo }>;
  traduzir(
    id: string,
    skinId: string,
    idioma: string,
    dados: DemoData,
  ): Promise<{ traducao: ConteudoTraduzivel }>;

  /** Token vigente do canal "link" — usado pelo botão "Copiar link". */
  tokenLink(registro: RegistroDemo): string | undefined;
  /** Salva o país (só a avulsa; ausente na demo de lead, onde vem do endereço). */
  salvarPais?(id: string, pais: string): Promise<RegistroDemo>;
}

function doLead(lead: Lead): RegistroDemo & { lead: Lead } {
  return {
    id: lead.placeId,
    nome: lead.nome,
    demo: lead.demo,
    idiomaPadrao: idiomaPadraoDoLead(lead),
    moeda: moedaDaDemo(lead),
    lead,
  };
}

function daAvulsa(avulsa: DemoAvulsa): RegistroDemo & { avulsa: DemoAvulsa } {
  return {
    id: avulsa.id,
    nome: nomeDaAvulsa(avulsa),
    demo: avulsa.demo,
    idiomaPadrao: idiomaPadraoDaAvulsa(avulsa),
    moeda: moedaDaAvulsa(avulsa),
    pais: avulsa.pais,
    avulsa,
  };
}

/** O lead por trás do registro — só existe na família "lead". */
function leadDe(registro: RegistroDemo): Lead | undefined {
  return (registro as { lead?: Lead }).lead;
}

const CLIENTE_LEAD: ClienteDemo = {
  tipo: "lead",
  rotulo: "lead",
  voltarPara: (id) => `/leads/${id}`,
  voltarRotulo: "← Ficha",
  caminhoPublico: (id) => caminhoDemo(id),

  carregar: async (id) => doLead((await api.getLead(id)).lead),
  salvar: async (id, corpo) => doLead((await api.putLeadDemo(id, corpo)).lead),
  excluir: async (id) => {
    await api.deleteLeadDemo(id);
  },

  uploadImagem: (id, slot, arquivo, skinId) => api.uploadDemoImagem(id, slot, arquivo, skinId),
  removerImagem: async (id, slot) => doLead((await api.deleteDemoImagem(id, slot)).lead),
  uploadVideo: (id, slot, arquivo, skinId) => api.uploadDemoVideo(id, slot, arquivo, skinId),
  removerVideo: async (id, slot, skinId) => doLead((await api.deleteDemoVideo(id, slot, skinId)).lead),

  base: (registro, skin) => {
    const lead = leadDe(registro);
    return lead ? montarDemoData(skin.demoDataExemplo, lead) : skin.demoDataExemplo;
  },
  montar: (registro, skin, patch) =>
    montarDemoData(skin.demoDataExemplo, leadDe(registro), patch, skin.id),

  gerarSugestao: (id, skinId, nivel, idioma) => api.gerarSugestaoDemo(id, skinId, nivel, idioma),
  traduzir: (id, skinId, idioma, dados) => api.traduzirDemo(id, skinId, idioma, dados),

  tokenLink: (registro) => envioVigente(registro.demo, "link")?.token,
};

const CLIENTE_AVULSA: ClienteDemo = {
  tipo: "avulsa",
  rotulo: "demo avulsa",
  voltarPara: () => "/demos",
  voltarRotulo: "← Demos",
  caminhoPublico: (id) => caminhoDemo(id, true),

  carregar: async (id) => daAvulsa((await api.getDemoAvulsa(id)).avulsa),
  salvar: async (id, corpo) => daAvulsa((await api.putDemoAvulsa(id, corpo)).avulsa),
  excluir: async (id) => {
    await api.deleteDemoAvulsa(id);
  },

  uploadImagem: (id, slot, arquivo, skinId) => api.uploadImagemAvulsa(id, slot, arquivo, skinId),
  removerImagem: async (id, slot) => daAvulsa((await api.deleteImagemAvulsa(id, slot)).avulsa),
  uploadVideo: (id, slot, arquivo, skinId) => api.uploadVideoAvulsa(id, slot, arquivo, skinId),
  removerVideo: async (id, slot, skinId) =>
    daAvulsa((await api.deleteVideoAvulsa(id, slot, skinId)).avulsa),

  base: (_registro, skin) => baseDemoDataAvulsa(skin.demoDataExemplo, skin.id),
  montar: (_registro, skin, patch) => montarDemoDataAvulsa(skin.demoDataExemplo, patch, skin.id),

  traduzir: (id, skinId, idioma, dados) => api.traduzirDemoAvulsa(id, skinId, idioma, dados),

  tokenLink: (registro) => envioVigente(registro.demo, "link")?.token,
  salvarPais: async (id, pais) => daAvulsa((await api.patchDemoAvulsa(id, { pais })).avulsa),
};

export function clienteDaDemo(tipo: TipoDemo): ClienteDemo {
  return tipo === "avulsa" ? CLIENTE_AVULSA : CLIENTE_LEAD;
}
