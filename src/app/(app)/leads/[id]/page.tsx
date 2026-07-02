import { LeadDetailClient } from "./LeadDetailClient";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // key={id} remonta o client component ao trocar de lead, reiniciando o
  // estado de loading/erro em vez de arrastar o estado do lead anterior.
  return <LeadDetailClient key={id} id={id} />;
}
