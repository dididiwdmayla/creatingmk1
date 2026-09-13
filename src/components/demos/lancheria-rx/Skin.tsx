import { Lancheria } from '@radar/lancheria-rx/client';
import { dadosDaLancheria, temaDaLancheria } from '@/lib/demos/lancheria/adapter';
import type { SkinProps } from '@/lib/demos/types';

/** A mesma entrada serve SSR público e preview. Não lê URL nem resolve identidade. */
export function LancheriaRaioX({ data, theme }: SkinProps) {
  return <Lancheria tema={temaDaLancheria(theme)} dados={dadosDaLancheria(data)} />;
}
