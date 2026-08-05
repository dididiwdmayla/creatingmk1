/**
 * Placeholder de carregamento que RESERVA espaço — nunca "Carregando…" de
 * uma linha só. Todo bloco que troca de conteúdo depois do primeiro
 * desenho (uma lista que chega do cliente, uma seção que busca os próprios
 * dados) usa um destes no lugar do texto solto, para o tamanho final não
 * pegar o resto da tela de surpresa (ver ARCHITECTURE.md, "Deslocamento de
 * layout").
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-2 ${className}`} aria-hidden="true" />;
}

/** N blocos empilhados — uma lista/tabela ainda não chegou, mas a altura dela já ocupa o lugar. */
export function SkeletonRows({
  count = 3,
  className = "h-16",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}
