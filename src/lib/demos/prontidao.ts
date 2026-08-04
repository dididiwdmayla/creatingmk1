import { IDIOMA_PADRAO } from "@/lib/idioma";
import type { Lead } from "@/lib/leads/types";
import { idiomaEfetivoDemo } from "./idioma";
import { montarDemoData } from "./montar";
import type { DemoData, SkinDefinition } from "./types";

/**
 * Selo de prontidão: o que numa demo salva ainda está em estado PADRÃO —
 * sem Instagram, sem horário, sem telefone, imagens ainda no conjunto
 * genérico, textos ainda no idioma do template. Visível na ficha do lead e
 * em /demos, pra não mandar link com campo obviamente vazio. Função pura
 * sobre o `DemoData` EFETIVO (`montarDemoData` — exemplo ← lead ←
 * edições): o que importa é o que a demo publicada de fato mostra, não a
 * origem do dado.
 */

export type ChavePendencia = "instagram" | "horario" | "telefone" | "imagens" | "idioma";

export interface PendenciaProntidao {
  chave: ChavePendencia;
  rotulo: string;
}

/** Slots de `imagens` que a skin declara no exemplo (o universo possível de upload). */
function slotsDaSkin(skin: SkinDefinition): string[] {
  return Object.keys(skin.demoDataExemplo.imagens);
}

/**
 * Quantos slots de imagem da skin NÃO têm override do lead (`lead.demo.dados.imagens`)
 * — ainda mostram o placeholder/foto genérica do template, não algo enviado
 * pelo lead. `total` é o universo de slots da skin.
 */
export function imagensPendentes(
  lead: Lead,
  skin: SkinDefinition,
): { pendentes: number; total: number } {
  const slots = slotsDaSkin(skin);
  const enviados = new Set(Object.keys(lead.demo?.dados.imagens ?? {}));
  const pendentes = slots.filter((slot) => !enviados.has(slot)).length;
  return { pendentes, total: slots.length };
}

/**
 * O texto da demo (slogan/seções) ainda é o do TEMPLATE (em português) para
 * um lead cujo idioma-alvo é outro? Só faz sentido quando o idioma-alvo
 * diverge do idioma em que o template foi escrito — nenhum texto próprio
 * (slogan ou alguma seção com título/texto) foi editado/gerado ainda.
 */
function textoAindaNoIdiomaDoTemplate(lead: Lead): boolean {
  if (idiomaEfetivoDemo(lead) === IDIOMA_PADRAO) return false;
  const dados = lead.demo?.dados;
  if (dados?.slogan) return false;
  return !Object.values(dados?.secoes ?? {}).some(
    (secao) => secao.titulo || secao.texto || secao.rotulo,
  );
}

/** Lista as pendências de prontidão de UMA demo já salva (`lead.demo` presente). */
export function pendenciasProntidao(lead: Lead, skin: SkinDefinition): PendenciaProntidao[] {
  if (!lead.demo) return [];

  const efetivo: DemoData = montarDemoData(
    skin.demoDataExemplo,
    lead,
    lead.demo.dados,
    skin.id,
  );
  const pendencias: PendenciaProntidao[] = [];

  if (!efetivo.instagram) {
    pendencias.push({ chave: "instagram", rotulo: "Sem Instagram" });
  }
  if (!efetivo.horarios) {
    pendencias.push({ chave: "horario", rotulo: "Sem horário de funcionamento" });
  }
  if (!efetivo.telefone) {
    pendencias.push({ chave: "telefone", rotulo: "Sem telefone" });
  }

  const { pendentes, total } = imagensPendentes(lead, skin);
  if (pendentes > 0) {
    pendencias.push({
      chave: "imagens",
      rotulo: `${pendentes} de ${total} imagem${total === 1 ? "" : "s"} ainda genérica${pendentes === 1 ? "" : "s"}`,
    });
  }

  if (textoAindaNoIdiomaDoTemplate(lead)) {
    pendencias.push({
      chave: "idioma",
      rotulo: "Textos ainda no idioma do template (lead é de outro idioma)",
    });
  }

  return pendencias;
}
