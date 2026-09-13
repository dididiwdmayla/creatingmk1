import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Lancheria } from "@radar/lancheria-rx/client";
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { criarPrecos, criarPedido, horarioDaCasa, validarDadosLancheria } from '@radar/lancheria-rx/contrato';
import { LANCHERIA_RX_SKINS } from '@/components/demos/lancheria-rx/skins';
import { dadosDaLancheria, temaDaLancheria } from '../lancheria/adapter';
import { dadosQaLancheria } from '../lancheria/qa';
import { montarPatch } from '../patch';
import { montarDemoDataAvulsa } from '../avulsas/identidade';
import { aplicarTema } from '../tema';
import { validateLeadDemoInput } from '../validate';

const skin=LANCHERIA_RX_SKINS[0];
const input=(dados:unknown={},tema:unknown={})=>({skinId:skin.id,themeId:skin.themeDefault.id,dados,tema});
describe('lancheria: fronteira do Radar e motor fixo',()=>{
  it.each(LANCHERIA_RX_SKINS)('$id é uma skin independente com um único preset',s=>{
    expect(s.themePresets).toHaveLength(1);
    expect(s.nicho).toBe('lancheria');expect(s.localeFixo).toEqual({idioma:'pt-BR',moeda:'BRL'});
    const d=dadosDaLancheria(s.demoDataExemplo);
    expect(validarDadosLancheria(d)).toEqual([]);
    expect(d.lanches).toHaveLength(6);
    const tema=temaDaLancheria(s.themeDefault);
    expect(tema.cores.quente).toBe(s.themeDefault.paleta.quente);
    expect(tema.cores.frio).toBe(s.themeDefault.paleta.frio);
    expect(tema.cores.quente).not.toBe(tema.cores.frio);
  });
  it('mudar slug não altera os knobs e pelo-rotulo funciona fora do Diner',()=>{
    const d=dadosDaLancheria(dadosQaLancheria(skin));
    const tema={...temaDaLancheria(skin.themeDefault),slug:'identidade-futura',filtroInicial:'todos' as const,abrirComposicao:'pelo-rotulo' as const};
    const html=renderToStaticMarkup(createElement(Lancheria,{tema,dados:d}));
    expect(html).toContain('data-filtro-forma="todos"');expect(html.match(/class="composicao-rotulo"/g)).toHaveLength(6);
  });
  it('cores têm overrides independentes e a identidade não segue accent genérico',()=>{
    const t=temaDaLancheria(aplicarTema(skin.themeDefault,{quente:'#cc4411',frio:'#224466',destaque:'#ff00ff'}));
    expect(t.cores.quente).toBe('#cc4411');expect(t.cores.frio).toBe('#224466');
    expect(()=>validateLeadDemoInput(input({}, {destaque:'#ff00ff'}))).toThrow();
    expect(()=>validateLeadDemoInput(input({}, {quente:'#cc4411',frio:'#224466'}))).not.toThrow();
  });
  it('o diff do editor persiste os seis lanches, funcionamento e ingredientes sem perda',()=>{
    const d=dadosQaLancheria(skin,'cliente');const patch=montarPatch(skin.demoDataExemplo,d,skin);
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
    const a=dadosDaLancheria(dadosQaLancheria(skin,'cliente')),b=dadosDaLancheria(skin.demoDataExemplo);
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
    const c=dadosDaLancheria(dadosQaLancheria(skin,'cliente')).casa;
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
