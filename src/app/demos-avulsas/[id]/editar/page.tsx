import { DemoEditorClient } from "@/app/leads/[id]/demo/editar/EditorClient";

/**
 * Editor visual da demo AVULSA — o MESMO componente do editor da demo de
 * lead, só com o outro `ClienteDemo` (ver
 * app/leads/[id]/demo/editar/cliente.ts). Nenhuma cópia do painel, do
 * preview ou do diff mínimo: a diferença entre as duas famílias cabe
 * inteira naquele adaptador.
 *
 * Fora do route group (app), como o editor de lead: sem header/bottom-nav
 * do painel — o espaço é do preview. Protegida por senha como tudo (ver
 * src/proxy.ts).
 */
export default async function DemoAvulsaEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DemoEditorClient key={id} id={id} tipo="avulsa" />;
}
