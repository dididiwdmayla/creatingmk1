import { listBuscas } from "@/lib/buscas/repo";
import { penetracaoParaLead } from "@/lib/buscas/penetracao";
import { loadConfig } from "@/lib/config";
import { demoUrlComToken, envioVigente } from "@/lib/demos/envio";
import type { AppDb } from "@/lib/firestore-like";
import { listConjuntos } from "@/lib/frases/repo";
import { resolverMensagem } from "@/lib/frases/resolver";
import { argumentoPenetracao } from "@/lib/leads/penetracao";
import type { Lead } from "@/lib/leads/types";
import { aplicarMarcadores, digitosTelefone } from "@/lib/wa";

/**
 * `montarMensagemParaLead`: a MESMA precedência/marcadores que já rodam na
 * ficha (`LeadDetailClient.tsx`) e na fila do dia (`hoje/page.tsx`), só que
 * de um route handler — para as rotas da fila de envio (celular), que não
 * têm sessão de navegador nem `window.location` para montar o link da
 * demo. Nenhuma regra nova: `resolverMensagem`/`aplicarMarcadores` são os
 * MESMOS de lib/frases e lib/wa; esta função só busca as mesmas fontes
 * (frases/buscas/config) direto do Firestore em vez de receber por prop.
 */

export interface MensagemParaLeadResultado {
  /** Marcadores já resolvidos — pronto para o link do WhatsApp. */
  texto: string;
  /** Dígitos puros (DDI + número), ou `undefined` sem telefone nenhum. */
  telefone: string | undefined;
  /**
   * Skin cujo conjunto de frases forneceu o texto — o contador que a
   * confirmação do envio faz girar. `null` quando venceu a mensagem do grupo
   * ou a global, que não têm rotação.
   */
  rotacaoSkinId: string | null;
}

/**
 * `APP_PUBLIC_URL` (ver .env.example) — mesma env do motor de capturas,
 * aqui reaproveitada porque o servidor não tem `window.location.origin`
 * como o cliente tem. Ausente = `{demo}` fica sem link (mesmo espírito da
 * "pastilha vazia" das capturas: nunca inventar domínio).
 */
function origemPublica(): string | undefined {
  const bruto = process.env.APP_PUBLIC_URL?.trim().replace(/\/+$/, "");
  return bruto || undefined;
}

/**
 * As três fontes que a precedência da mensagem consulta (skin → grupo →
 * global). Existem como parâmetro OPCIONAL por causa de quem monta a
 * mensagem de VÁRIOS leads de uma vez — hoje, a lista de respostas
 * pendentes do painel (`respostasPainel.ts`): `listBuscas`/`listConjuntos`
 * são varreduras de coleção, e pagá-las uma vez por linha multiplicaria a
 * leitura pelo tamanho da lista. Ausentes, a função carrega sozinha — é o
 * caminho de todo chamador de UM lead só, que não muda em nada.
 */
export interface FontesDaMensagem {
  config: Awaited<ReturnType<typeof loadConfig>>;
  buscas: Awaited<ReturnType<typeof listBuscas>>;
  conjuntos: Awaited<ReturnType<typeof listConjuntos>>;
}

/** Carrega as três fontes UMA vez, para reusar em vários leads. */
export async function carregarFontesDaMensagem(db: AppDb): Promise<FontesDaMensagem> {
  const [config, buscas, conjuntos] = await Promise.all([
    loadConfig(db),
    listBuscas(db),
    listConjuntos(db),
  ]);
  return { config, buscas, conjuntos };
}

export async function montarMensagemParaLead(
  db: AppDb,
  lead: Lead,
  fontes?: FontesDaMensagem,
): Promise<MensagemParaLeadResultado> {
  const { config, buscas, conjuntos } = fontes ?? (await carregarFontesDaMensagem(db));

  const resolvida = resolverMensagem({
    lead,
    buscas,
    conjuntos,
    global: config.mensagemPadrao,
  });

  const origem = origemPublica();
  const tokenVigente = envioVigente(lead.demo, "whatsapp")?.token;
  const demoUrl = lead.demo && origem ? demoUrlComToken(origem, lead.placeId, tokenVigente) : undefined;

  const penetracaoInfo = penetracaoParaLead(lead, buscas);
  const penetracao =
    penetracaoInfo && lead.siteProprio === false
      ? argumentoPenetracao(
          penetracaoInfo.nicho,
          penetracaoInfo.regiao,
          penetracaoInfo.penetracao,
          lead.nome,
        )
      : undefined;

  const texto = aplicarMarcadores(resolvida.texto, lead.nome, { demoUrl, penetracao });

  const telefoneCru = lead.detalhes?.telefoneIntl ?? lead.telefoneIntl;
  const telefone = telefoneCru ? digitosTelefone(telefoneCru) : undefined;

  return { texto, telefone, rotacaoSkinId: resolvida.rotacao?.skinId ?? null };
}
