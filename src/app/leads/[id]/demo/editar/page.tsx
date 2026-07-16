import { DemoEditorClient } from "./EditorClient";

/**
 * Editor visual da demo do lead — tela cheia, fora do route group (app)
 * (sem header/bottom-nav do painel: o espaço é do preview). Protegida por
 * senha como tudo (ver src/proxy.ts). Wrapper server fino no mesmo padrão
 * da ficha: extrai params.id e remonta o client component por lead.
 */
export default async function DemoEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DemoEditorClient key={id} id={id} />;
}
