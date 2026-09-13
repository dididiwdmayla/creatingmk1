import { notFound } from 'next/navigation';
import { PaginaDemo, resolverDemo, viewportDaDemo } from '@/app/demo/comum';
import { getSkin } from '@/lib/demos/registry';
import { dadosQaLancheria } from '@/lib/demos/lancheria/qa';

/** Protegido pelo proxy, sem banco: usa o MESMO resolvedor/árvore das rotas públicas.
 * Não é um link de cliente nem aceita ?tema=. A configuração vem da skin no servidor. */
export const dynamic='force-dynamic';
type Props={params:Promise<{skinId:string;cenario?:string[]}>};
async function resolver({params}:Props) {
  const {skinId,cenario=[]}=await params;
  const skin=getSkin(skinId);
  if(!skin?.themeDefault.lancheria||cenario.length>1||cenario.some(c=>c!=='cliente'))notFound();
  const dados=dadosQaLancheria(skin,cenario[0]);
  const resolvida=await resolverDemo({id:`qa-${skin.id}`,avulsa:true,nome:dados.nome,idioma:'pt-BR',moeda:'BRL',
    demo:{skinId:skin.id,themeId:skin.themeDefault.id,dados,criadoEm:'2026-09-13T00:00:00Z',atualizadoEm:'2026-09-13T00:00:00Z'}});
  if(!resolvida)notFound();
  return resolvida;
}
export async function generateViewport(props:Props){return viewportDaDemo(await resolver(props))}
export default async function Page(props:Props){return <PaginaDemo resolvida={await resolver(props)} visitante={{interna:false}}/>}
