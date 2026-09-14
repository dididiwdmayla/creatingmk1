import { notFound } from 'next/navigation';
import { PaginaDemo, resolverDemo, viewportDaDemo } from '@/app/demo/comum';
import { getSkin } from '@/lib/demos/registry';
import { varianteEfetiva } from '@/lib/demos/variantes';
import { dadosQaLancheria } from '@/lib/demos/lancheria/qa';

/** Protegido pelo proxy, sem banco: usa o MESMO resolvedor/árvore das rotas públicas.
 * Não é um link de cliente nem aceita ?tema=. A configuração vem da skin no servidor.
 *
 * O parâmetro é o id de uma VARIANTE (`lancheria-diner`) — que é também o
 * skinId aposentado de antes da fusão, resolvido por SKINS_MIGRADAS — ou o
 * id da skin (`lancheria-2`), que cai na variante default. */
export const dynamic='force-dynamic';
type Props={params:Promise<{skinId:string;cenario?:string[]}>};
async function resolver({params}:Props) {
  const {skinId,cenario=[]}=await params;
  const skin=getSkin(skinId);
  if(!skin?.themeDefault.lancheria||cenario.length>1||cenario.some(c=>c!=='cliente'))notFound();
  const variante=varianteEfetiva(skin,skinId);
  if(!variante)notFound();
  const dados=dadosQaLancheria(skin,variante.id,cenario[0]);
  const resolvida=await resolverDemo({id:`qa-${variante.id}`,avulsa:true,nome:dados.nome,idioma:'pt-BR',moeda:'BRL',
    demo:{skinId:skin.id,themeId:variante.id,dados,criadoEm:'2026-09-13T00:00:00Z',atualizadoEm:'2026-09-13T00:00:00Z'}});
  if(!resolvida)notFound();
  return resolvida;
}
export async function generateViewport(props:Props){return viewportDaDemo(await resolver(props))}
export default async function Page(props:Props){return <PaginaDemo resolvida={await resolver(props)} visitante={{interna:false}}/>}
