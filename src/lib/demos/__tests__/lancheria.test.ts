import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Lancheria } from "@radar/lancheria-rx/client";
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { criarPrecos, criarPedido, horarioDaCasa, validarDadosLancheria } from '@radar/lancheria-rx/contrato';
import { LANCHERIA_2 } from '@/components/demos/lancheria2';
import { dadosDaLancheria, temaDaLancheria } from '../lancheria/adapter';
import { dadosQaLancheria } from '../lancheria/qa';
import { montarPatch } from '../patch';
import { montarDemoDataAvulsa } from '../avulsas/identidade';
import { aplicarTema } from '../tema';
import { validateLeadDemoInput } from '../validate';
import { getSkin, getTheme } from '../registry';
import { exemploDaSkin, getVariante } from '../variantes';
import { secoesVisiveis } from '../estrutura';
import { montarDemoData } from '../montar';
import type { DemoData } from '../types';

const skin=LANCHERIA_2;
const variantes=skin.variantes!;
const input=(dados:unknown={},tema:unknown={})=>({skinId:skin.id,themeId:skin.themeDefault.id,dados,tema});
describe('lancheria: fronteira do Radar e motor fixo',()=>{
  it('é UMA skin do nicho lancheria, com as quatro identidades como variantes',()=>{
    expect(skin.id).toBe('lancheria-2');
    expect(skin.nicho).toBe('lancheria');
    expect(skin.localeFixo).toEqual({idioma:'pt-BR',moeda:'BRL'});
    expect(variantes.map(v=>v.id)).toEqual([
      'lancheria-meia-noite','lancheria-diner','lancheria-pratico','lancheria-cantina',
    ]);
    // A variante OCUPA o lugar do preset: mesma lista, mesma ordem.
    expect(skin.themePresets).toEqual(variantes.map(v=>v.theme));
    expect(skin.themeDefault).toBe(variantes[0].theme);
  });
  it.each(variantes.map(v=>[v.id,v] as const))('variante %s entrega o catálogo e as cores próprias',(_id,v)=>{
    const d=dadosDaLancheria(v.exemplo);
    expect(validarDadosLancheria(d)).toEqual([]);
    expect(d.lanches).toHaveLength(6);
    const tema=temaDaLancheria(v.theme);
    expect(tema.cores.quente).toBe(v.theme.paleta.quente);
    expect(tema.cores.frio).toBe(v.theme.paleta.frio);
    expect(tema.cores.quente).not.toBe(tema.cores.frio);
    expect(tema.slug).toBe(v.id.replace(/^lancheria-/,''));
  });
  it('os quatro skinId antigos continuam resolvendo, na variante certa',()=>{
    for(const v of variantes) {
      expect(getSkin(v.id)).toBe(skin);            // o skinId antigo é o id da variante
      expect(getTheme(skin,v.id)).toBe(v.theme);   // e o themeId salvo acha a variante
      expect(exemploDaSkin(skin,v.id)).toBe(v.exemplo);
    }
  });
  it('a aba Estrutura chega no HTML do servidor: ordem e ocultação viram CSS',async ()=>{
    const theme=aplicarTema(getTheme(skin,skin.themeDefault.id),undefined,skin.heroEscalaLimites);
    const Componente=await skin.componente();
    const render=(patch:Partial<DemoData>)=>renderToStaticMarkup(createElement(Componente,{
      data:montarDemoData({...exemploDaSkin(skin,skin.themeDefault.id),...patch},undefined,undefined,skin.id),
      theme,
    }));
    const ordemDe=(html:string)=>[...html.matchAll(/\[data-d-secao="([^"]+)"\]\{order:(\d+)\}/g)]
      .sort((a,b)=>Number(a[2])-Number(b[2])).map(m=>m[1]);
    const ocultasDe=(html:string)=>[...html.matchAll(/\[data-d-secao="([^"]+)"\]\{display:none\}/g)].map(m=>m[1]);

    // Sem patch: a ordem default do contrato, nada oculto.
    const padrao=render({ordemSecoes:undefined,secoes:Object.fromEntries(skin.secoes.map(s=>[s.id,{}]))});
    expect(ordemDe(padrao)).toEqual(skin.secoes.map(s=>s.id));
    expect(ocultasDe(padrao)).toEqual([]);

    // Reordenar as não-fixas: as fixas ficam no lugar, as outras seguem o pedido.
    const reordenado=render({
      ordemSecoes:['horarios','historia','acompanhamentos','bebidas','sugestoes'],
      secoes:Object.fromEntries(skin.secoes.map(s=>[s.id,{}])),
    });
    expect(ordemDe(reordenado)).toEqual([
      'hero','cardapio','horarios','historia','acompanhamentos','bebidas','sugestoes','contato',
    ]);

    // Ocultar sai do fluxo E some da numeração — nunca deixa buraco na ordem.
    const comOculta=render({
      ordemSecoes:undefined,
      secoes:{...Object.fromEntries(skin.secoes.map(s=>[s.id,{}])),bebidas:{oculta:true}},
    });
    expect(ocultasDe(comOculta)).toEqual(['bebidas']);
    expect(ordemDe(comOculta)).toEqual([
      'hero','cardapio','sugestoes','acompanhamentos','historia','horarios','contato',
    ]);

    // Seção FIXA não pode ser ocultada, nem por dado salvo à mão.
    const tentandoOcultarFixa=render({
      ordemSecoes:undefined,
      secoes:{...Object.fromEntries(skin.secoes.map(s=>[s.id,{}])),hero:{oculta:true}},
    });
    expect(ocultasDe(tentandoOcultarFixa)).toEqual([]);
  });
  it('cada variante entra com o SEU arranjo, e o Prático nasce sem a trilha',()=>{
    const arranjo=(v:typeof variantes[number])=>secoesVisiveis(skin.secoes,
      montarDemoData(v.exemplo,undefined,undefined,skin.id));
    expect(arranjo(getVariante(skin,'lancheria-meia-noite')!)).toEqual(
      ['hero','cardapio','sugestoes','historia','bebidas','acompanhamentos','horarios','contato']);
    expect(arranjo(getVariante(skin,'lancheria-cantina')!)).toEqual(
      ['hero','cardapio','historia','sugestoes','bebidas','acompanhamentos','horarios','contato']);
    expect(arranjo(getVariante(skin,'lancheria-pratico')!)).toEqual(
      ['hero','cardapio','bebidas','acompanhamentos','horarios','historia','contato']);
  });
  it('mudar slug não altera os knobs e pelo-rotulo funciona fora do Diner',()=>{
    const d=dadosDaLancheria(dadosQaLancheria(skin));
    const tema={...temaDaLancheria(skin.themeDefault),slug:'identidade-futura',filtroInicial:'todos' as const,abrirComposicao:'pelo-rotulo' as const};
    const html=renderToStaticMarkup(createElement(Lancheria,{tema,dados:d}));
    expect(html).toContain('data-filtro-forma="todos"');expect(html.match(/class="composicao-rotulo"/g)).toHaveLength(6);
  });
  it('a camada decorativa da Forja vale sobre a variante; o que é calibrado é recusado',async ()=>{
    const patch={fundoEfeito:'grao',fundoEfeitoIntensidade:2 as const,led:'marcante' as const,
      ledEstilo:'moldura',efeitoCores:{modo:'arco-iris' as const},ledCores:{modo:'fixa' as const,cores:['#00c2ff']},
      barraCor:{modo:'destaque' as const}};
    // Passa pela validação do PUT…
    expect(()=>validateLeadDemoInput(input({},patch))).not.toThrow();
    // …e chega no Theme resolvido, em QUALQUER variante.
    for(const v of variantes) {
      const t=aplicarTema(getTheme(skin,v.id),patch,skin.heroEscalaLimites);
      expect(t.fundoEfeito).toBe('grao');
      expect(t.led).toBe('marcante');
      expect(t.ledEstilo).toBe('moldura');
      expect(t.efeitoCores).toEqual({modo:'arco-iris',cores:undefined});
      expect(t.barraCor).toEqual({modo:'destaque',cor:undefined});
      // …sem mexer no que é da skin.
      expect(t.fontes).toEqual(v.theme.fontes);
      expect(t.raio).toBe(v.theme.raio);
      expect(t.densidade).toBe(v.theme.densidade);
    }
    // O LED sai no HTML do servidor, como nas outras oito skins.
    const theme=aplicarTema(getTheme(skin,skin.themeDefault.id),patch,skin.heroEscalaLimites);
    const Componente=await skin.componente();
    const html=renderToStaticMarkup(createElement(Componente,{
      data:montarDemoData(exemploDaSkin(skin,skin.themeDefault.id),undefined,undefined,skin.id),theme}));
    expect(html).toContain('data-d-led-estilo="moldura"');
  });
  it('o que a variante traz calibrado o PUT recusa',()=>{
    for(const chave of ['destaque','fonteDisplay','fonteCorpo','raio','densidade','animacao','hover','clique'])
      expect(()=>validateLeadDemoInput(input({},{[chave]:chave==='raio'?'12px':'x'})),chave).toThrow();
    expect(()=>validateLeadDemoInput(input({},{heroTitulo:{escala:2}}))).toThrow();
  });
  it('cores têm overrides independentes e a identidade não segue accent genérico',()=>{
    const t=temaDaLancheria(aplicarTema(skin.themeDefault,{quente:'#cc4411',frio:'#224466',destaque:'#ff00ff'}));
    expect(t.cores.quente).toBe('#cc4411');expect(t.cores.frio).toBe('#224466');
    expect(()=>validateLeadDemoInput(input({}, {destaque:'#ff00ff'}))).toThrow();
    expect(()=>validateLeadDemoInput(input({}, {quente:'#cc4411',frio:'#224466'}))).not.toThrow();
  });
  it('o diff do editor persiste os seis lanches, funcionamento e ingredientes sem perda',()=>{
    const d=dadosQaLancheria(skin,undefined,'cliente');const patch=montarPatch(skin.demoDataExemplo,d,skin);
    expect(()=>validateLeadDemoInput(input(patch))).not.toThrow();
    const montado=montarDemoDataAvulsa(skin.demoDataExemplo,patch,skin.id);
    expect(montado.lancheria).toEqual(d.lancheria);
    expect(dadosDaLancheria(montado).casa).toMatchObject({nome:'Sanduicheria da Praça',cidade:'Londrina, PR',abre:'11:30',fecha:'22:15',whatsapp:'5543999992600'});
  });
  it('identidade em branco não recupera o telefone/endereço da casa de exemplo',()=>{
    const d=dadosDaLancheria(montarDemoDataAvulsa(skin.demoDataExemplo,{nome:'Outra casa'},skin.id));
    expect(d.casa).toMatchObject({nome:'Outra casa',marca:'Outra casa',telefone:'',whatsapp:'',cidade:'',endereco:''});
  });
  it('catálogos simultâneos não compartilham preço nem nome de ingrediente',()=>{
    const a=dadosDaLancheria(dadosQaLancheria(skin,undefined,'cliente')),b=dadosDaLancheria(skin.demoDataExemplo);
    const pa=criarPedido(a),pb=criarPedido(b),precos=criarPrecos(a);
    expect(pa.itemFixo(a.lanches[0]).cent).toBe(4100);
    expect(pb.itemFixo(b.lanches[0]).cent).toBe(b.lanches[0].precoCent);
    expect(precos.precoDoLanche(a.lanches[0].camadas.slice(0,-2).concat(a.lanches[0].camadas.at(-1)!),a.lanches[0].slug)).toBe(4100);
    const linha={...pa.itemFixo(a.lanches[0]),id:'pedido-a',qtd:2};
    const resumo=pa.resumoPedido([linha]);
    expect(resumo).toContain('Sanduicheria da Praça');expect(resumo).toContain('R$ 82,00');
    expect(pa.urlWhatsApp([linha],{nome:'Cliente',recebimento:'retirada',endereco:'',complemento:'',pagamento:'Pix',troco:'',observacao:''})).toMatch(/^https:\/\/wa.me\/5543999992600\?text=/);
    expect(pa.itemFixo(a.lanches[0]).nome).toContain('Praça');
    expect(pb.itemFixo(b.lanches[0]).nome).not.toContain('Praça');
  });
  it('não adivinha o estado quando o horário diário não foi configurado',()=>{
    const c=dadosDaLancheria(skin.demoDataExemplo).casa;
    expect(horarioDaCasa(new Date(),c).aberto).toBeNull();
    expect(()=>validateLeadDemoInput({...input(),idioma:'de-CH'})).toThrow();
  });
  it('o relógio respeita minutos, intervalo diurno e horário de madrugada',()=>{
    const c=dadosDaLancheria(dadosQaLancheria(skin,undefined,'cliente')).casa;
    expect(horarioDaCasa(new Date('2026-09-13T14:29:00Z'),c).aberto).toBe(false);
    expect(horarioDaCasa(new Date('2026-09-13T14:30:00Z'),c).aberto).toBe(true);
    expect(horarioDaCasa(new Date('2026-09-14T01:16:00Z'),c).aberto).toBe(false);
  });
  it.each(['prensa','baselines','afundamento','salto'])('rejeita tentativa de configurar %s',chave=>{
    const d=dadosQaLancheria(skin);Object.assign(d.lancheria!,{[chave]:42});
    expect(()=>validateLeadDemoInput(input(d))).toThrow();
  });
  it('rejeita ingrediente sem camada calibrada e campo físico dentro de ingrediente',()=>{
    const d=dadosQaLancheria(skin);d.lancheria!.ingredientes.push({slug:'costela',nome:'Costela',precoCent:600});
    expect(()=>validateLeadDemoInput(input(d))).toThrow();
    const outro=dadosQaLancheria(skin);Object.assign(outro.lancheria!.ingredientes[4],{altura:999});
    expect(()=>validateLeadDemoInput(input(outro))).toThrow();
  });
  it('motor e acervo publicados correspondem aos hashes de origem, byte a byte',()=>{
    const origem=JSON.parse(readFileSync('vendor/lancheria-rx/origem.json','utf8'));
    for(const [path,hash] of Object.entries(origem.sha256)) {
      const file=path.startsWith('public/')?path:`vendor/lancheria-rx/fonte-calibrada/${path}`;
      expect(createHash('sha256').update(readFileSync(file)).digest('hex'),file).toBe(hash);
    }
  });
});
