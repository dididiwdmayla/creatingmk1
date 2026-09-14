import {describe,it,expect} from 'vitest';
import {SKINS} from '@/lib/demos/registry';
import {PRESETS_SEM_VARIANTES,TEMAS_POR_SKIN,ALVOS_QA} from '../temas.mjs';
import {VARIANTES_POR_SKIN} from '../variantes.mjs';

describe('cobertura real dos laços: skin × preset/variante',()=>{
 it('cobre o registro inteiro, com o preset explícito e sem duplicações',()=>{
  expect(TEMAS_POR_SKIN).toEqual(Object.fromEntries(SKINS.map(s=>[s.id,s.themePresets.map(t=>t.id)])));
  expect(Object.keys(PRESETS_SEM_VARIANTES).filter(id=>id in VARIANTES_POR_SKIN)).toEqual([]);
  expect(ALVOS_QA).toHaveLength(SKINS.reduce((n,s)=>n+s.themePresets.length,0));
  expect(new Set(ALVOS_QA.map(a=>a.id)).size).toBe(ALVOS_QA.length);
  expect(ALVOS_QA.filter(a=>a.skinId==='barbearia-editorial').map(a=>a.preset)).toEqual(['norte','meia-noite','creme','vinho']);
 });
});
