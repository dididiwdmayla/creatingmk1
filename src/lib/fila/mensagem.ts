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

export async function montarMensagemParaLead(
  db: AppDb,
  lead: Lead,
): Promise<MensagemParaLeadResultado> {
  const [config, buscas, conjuntos] = await Promise.all([
    loadConfig(db),
    listBuscas(db),
    listConjuntos(db),
  ]);

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

  return { texto, telefone };
}
