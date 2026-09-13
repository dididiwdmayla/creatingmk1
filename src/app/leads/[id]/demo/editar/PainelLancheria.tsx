'use client';
import { exemploLancheria } from '@radar/lancheria-rx/contrato';
import { problemasLancheria } from '@/lib/demos/lancheria/adapter';
import type { DemoData, DemoLancheria, SkinDefinition, TemaPatch } from '@/lib/demos/types';
import { SKINS } from '@/lib/demos/registry';

type Atualizar = (fn: (dados: DemoData) => DemoData) => void;
const campo = 'min-h-11 w-full rounded border border-line bg-surface p-2 text-sm text-foreground';
const botao = 'min-h-11 rounded border border-line px-3 text-sm';
const exemplo = exemploLancheria('chapa');
function Campo({nome,valor,mudar,tipo='text'}:{nome:string;valor:string|number;mudar:(s:string)=>void;tipo?:string}) {
  return <label className="grid gap-1 text-xs">{nome}<input className={campo} type={tipo} step={tipo==='number'?'0.01':undefined} min={tipo==='number'?0:undefined} value={valor} onChange={e=>mudar(e.target.value)}/></label>;
}
function Preco({nome,valor,mudar}:{nome:string;valor:number;mudar:(n:number)=>void}) {
  return <Campo nome={`${nome} (R$)`} tipo="number" valor={valor/100} mudar={s=>mudar(Math.round((Number(s)||0)*100))}/>;
}
export function PainelLancheria({dados,atualizar}:{dados:DemoData;atualizar:Atualizar}) {
  const c=dados.lancheria!;
  const mudar=(fn:(c:DemoLancheria)=>DemoLancheria)=>atualizar(d=>({...d,lancheria:fn(d.lancheria!)}));
  const problemas=problemasLancheria(c,dados);
  return <div className="grid gap-5">
    <p className="text-sm">Dados deste estabelecimento. Preços em reais; composições usam o acervo de ingredientes disponível.</p>
    {problemas.length>0 && <p role="status" className="text-sm text-critical">{problemas.join('; ')}</p>}
    <details open><summary className={botao}>Estabelecimento e funcionamento</summary><div className="grid gap-3 pt-3">
      {(['nome','cidade','endereco','telefone','whatsapp'] as const).map(k=><Campo key={k} nome={({nome:'Nome',cidade:'Cidade',endereco:'Endereço',telefone:'Telefone',whatsapp:'WhatsApp com DDI'})[k]} valor={dados[k]??''} mudar={s=>atualizar(d=>({...d,[k]:s}))}/>)}
      <p className="text-xs text-ink-secondary">Horário diário. Confirme os horários do cliente; o relógio e a placa usam os campos abaixo.</p>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={c.funcionamento.confirmado} onChange={e=>mudar(c=>({...c,funcionamento:{...c.funcionamento,confirmado:e.target.checked}}))}/>Usar este horário diário na placa</label>
      {(['abre','fecha','fuso'] as const).map(k=><Campo key={k} nome={({abre:'Abre',fecha:'Fecha',fuso:'Fuso (ex.: America/Sao_Paulo)'})[k]} tipo={k==='fuso'?'text':'time'} valor={c.funcionamento[k]} mudar={s=>mudar(c=>({...c,funcionamento:{...c.funcionamento,[k]:s}}))}/>)}
      <label className="grid gap-1 text-xs">Pagamento — uma forma por linha<textarea className={campo} value={c.funcionamento.pagamento.join('\n')} onChange={e=>mudar(c=>({...c,funcionamento:{...c.funcionamento,pagamento:e.target.value.split('\n')}}))}/></label>
      <Preco nome="Base do monte o seu" valor={c.precoBaseCent} mudar={n=>mudar(c=>({...c,precoBaseCent:n}))}/>
    </div></details>
    <section className="grid gap-3"><h3 className="text-sm font-bold">Lanches ({c.lanches.length})</h3>
    {c.lanches.map((l,i)=>{
      const alterar=(patch:Partial<typeof l>)=>mudar(c=>({...c,lanches:c.lanches.map((x,j)=>j===i?{...x,...patch}:x)}));
      return <details key={l.slug} className="rounded border border-line p-2"><summary className={botao}>{l.nome}</summary><div className="grid gap-3 pt-3">
        <Campo nome="Nome completo" valor={l.nome} mudar={nome=>alterar({nome})}/>
        <Preco nome="Preço do lanche" valor={l.precoCent} mudar={precoCent=>alterar({precoCent})}/>
        <label className="grid gap-1 text-xs">Formato<select className={campo} value={l.forma} onChange={e=>{
          const forma=e.target.value as 'prensado'|'redondo', paes=forma==='prensado'?['pao-prensado-base','pao-prensado-topo']:['pao-base','pao-topo'];
          alterar({forma,camadas:[paes[0],...l.camadas.slice(1,-1),paes[1]],essenciais:l.essenciais.filter(s=>!s.startsWith('pao-'))});
        }}><option value="prensado">Prensado</option><option value="redondo">Redondo</option></select></label>
        <label className="grid gap-1 text-xs">Foto de demonstração<select className={campo} value={l.foto} onChange={e=>alterar({foto:e.target.value})}>{exemplo.lanches.map(f=><option key={f.foto} value={f.foto}>{f.nome}</option>)}</select></label>
        <p className="text-xs text-ink-secondary">Composição de baixo para cima. Essenciais ficam fixas para quem pede. Os pães permanecem nas extremidades.</p>
        {l.camadas.map((s,k)=>{
          const pao=s.startsWith('pao-');
          return <div key={k} className="grid gap-1 border-b border-line pb-2">
            <span className="text-sm">{k+1}. {c.ingredientes.find(x=>x.slug===s)?.nome??s}</span>
            {!pao && <div className="flex flex-wrap gap-1">
              <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={l.essenciais.includes(s)} onChange={e=>alterar({essenciais:e.target.checked?[...new Set([...l.essenciais,s])]:l.essenciais.filter(x=>x!==s)})}/>Essencial</label>
              <button className={botao} disabled={k<=1} onClick={()=>{const camadas=[...l.camadas];[camadas[k-1],camadas[k]]=[camadas[k],camadas[k-1]];alterar({camadas})}}>Subir</button>
              <button className={botao} disabled={k>=l.camadas.length-2} onClick={()=>{const camadas=[...l.camadas];[camadas[k+1],camadas[k]]=[camadas[k],camadas[k+1]];alterar({camadas})}}>Descer</button>
              <button className={botao} onClick={()=>{const camadas=l.camadas.filter((_,n)=>n!==k);alterar({camadas,essenciais:l.essenciais.filter(x=>camadas.includes(x))})}}>Retirar</button>
            </div>}
          </div>;
        })}
        <label className="grid gap-1 text-xs">Acrescentar ingrediente<select className={campo} value="" onChange={e=>{if(e.target.value)alterar({camadas:[...l.camadas.slice(0,-1),e.target.value,l.camadas.at(-1)!]})}}><option value="">Escolha…</option>{c.ingredientes.filter(x=>!x.slug.startsWith('pao-')).map(x=><option key={x.slug} value={x.slug}>{x.nome}</option>)}</select></label>
        <button className={botao} disabled={c.lanches.length<=1} onClick={()=>mudar(c=>({...c,lanches:c.lanches.filter((_,j)=>j!==i)}))}>Excluir este lanche</button>
      </div></details>;
    })}
    <button className={botao} onClick={()=>mudar(c=>({...c,lanches:[...c.lanches,{...structuredClone(c.lanches[0]),slug:`lanche-${crypto.randomUUID()}`,nome:'Novo lanche'}]}))}>Adicionar lanche</button>
    </section>
    <details><summary className={botao}>Ingredientes e preços adicionais</summary><div className="grid gap-3 pt-3">
      {exemplo.ingredientes.map(orig=>{const atual=c.ingredientes.find(x=>x.slug===orig.slug);const usado=c.lanches.some(l=>l.camadas.includes(orig.slug))||orig.slug.startsWith('pao-');return <div key={orig.slug} className="grid gap-2 border-b border-line pb-2">
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!!atual} disabled={usado} onChange={e=>mudar(c=>({...c,ingredientes:e.target.checked?[...c.ingredientes,orig]:c.ingredientes.filter(x=>x.slug!==orig.slug)}))}/>{orig.nome}</label>
        {atual && <><Campo nome="Nome no cardápio" valor={atual.nome} mudar={nome=>mudar(c=>({...c,ingredientes:c.ingredientes.map(x=>x.slug===orig.slug?{...x,nome}:x)}))}/><Preco nome="Adicional" valor={atual.precoCent} mudar={precoCent=>mudar(c=>({...c,ingredientes:c.ingredientes.map(x=>x.slug===orig.slug?{...x,precoCent}:x)}))}/></>}
      </div>})}
    </div></details>
    <details><summary className={botao}>Bebidas e acompanhamentos</summary><div className="grid gap-3 pt-3">{c.extras.map((x,i)=><div key={x.slug} className="grid gap-2 border-b border-line pb-2"><Campo nome="Nome" valor={x.nome} mudar={nome=>mudar(c=>({...c,extras:c.extras.map((e,j)=>j===i?{...e,nome}:e)}))}/><Preco nome="Preço" valor={x.precoCent} mudar={precoCent=>mudar(c=>({...c,extras:c.extras.map((e,j)=>j===i?{...e,precoCent}:e)}))}/><button className={botao} onClick={()=>mudar(c=>({...c,extras:c.extras.filter((_,j)=>j!==i)}))}>Excluir</button></div>)}
      {(['bebida','acompanhamento'] as const).map(grupo=><button key={grupo} className={botao} onClick={()=>mudar(c=>({...c,extras:[...c.extras,{slug:`extra-${crypto.randomUUID()}`,nome:'Novo item',grupo,precoCent:0,icone:''}]}))}>Adicionar {grupo}</button>)}
    </div></details>
    <details><summary className={botao}>Textos da página</summary><div className="grid gap-3 pt-3">{Object.entries(c.textos).filter(([k])=>!['heroFoto','heroAlt'].includes(k)).map(([k,v])=><label key={k} className="grid gap-1 text-xs">{({registro:'Registro',categoria:'Categoria',heroTitulo:'Título de abertura',heroDescricao:'Descrição de abertura',historiaTitulo:'Título da história',historia:'História — um parágrafo por linha',carimbo:'Carimbo',rodape:'Rodapé'} as Record<string,string>)[k]}<textarea id={`campo-lancheria.textos.${k}`} className={campo} value={Array.isArray(v)?v.join('\n'):v} onChange={e=>mudar(c=>({...c,textos:{...c.textos,[k]:k==='historia'?e.target.value.split('\n'):e.target.value}}))}/></label>)}</div></details>
  </div>;
}

export function TemaLancheria({skin,onSkinChange,tema,setTema}:{skin:SkinDefinition;onSkinChange:(id:string)=>void;tema:TemaPatch;setTema:(p:TemaPatch)=>void}) {
  return <div className="grid gap-4"><label className="grid gap-1 text-xs">Skin da demonstração<select className={campo} value={skin.id} onChange={e=>onSkinChange(e.target.value)}>{SKINS.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
    <p className="text-sm">A escolha é do operador. O cliente recebe esta identidade pronta.</p>
    {(['quente','frio'] as const).map(k=><label key={k} className="grid gap-2 text-sm">{k==='quente'?'Comida — preço e pedido':'Sistema — medição e estados'}<input className="h-11 w-full" type="color" value={tema[k]??skin.themeDefault.paleta[k]} onChange={e=>setTema({...tema,[k]:e.target.value})}/></label>)}
    {skin.themeDefault.lancheria?.intro && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={tema.intro??true} onChange={e=>setTema({...tema,intro:e.target.checked})}/>Intro ligada</label>}
    <button className={botao} onClick={()=>setTema({})}>Restaurar cores da skin</button>
  </div>;
}
