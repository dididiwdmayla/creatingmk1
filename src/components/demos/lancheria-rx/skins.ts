import { LANCHERIA_RX_SECOES } from './secoes';
import { TEMAS, type Tema } from '@radar/lancheria-rx/contrato';
import { exemploRadar } from '@/lib/demos/lancheria/adapter';
import { inkPara } from '@/lib/demos/tema';
import type { SkinDefinition, Theme } from '@/lib/demos/types';
import { LancheriaRaioX } from './Skin';

export function themeRadar(tema: Tema): Theme {
  const c = tema.cores;
  return {
    id: `lancheria-${tema.slug}`, nome: tema.nome, lancheria: tema,
    paleta: { fundo: c.base, fundoAlt: c.superficie, fundoElevado: c.superficie, borda: c.traco,
      texto: c.texto, textoSuave: c.frio, quente: c.quente, frio: c.frio,
      // Compatibilidade com o chrome antigo. A skin lê EXCLUSIVAMENTE quente/frio.
      destaque: c.quente, destaqueInk: inkPara(c.quente), acentoSecundario: c.frio, acentoTerciario: c.traco },
    fontes: { display: tema.fontes.display, corpo: tema.fontes.corpo, mono: tema.fontes.medida,
      serif: tema.fontes.corpo, decorativa: tema.fontes.display, citacao: tema.fontes.corpo, destaque: tema.fontes.display },
    raio: `${tema.raio}px`, densidade: ({ solta: 'arejada', media: 'confortavel', apertada: 'compacta' } as const)[tema.densidade],
    animacao: 'sutil', intro: tema.intro, hover: 'lift', clique: 'nenhum', fundoEfeito: 'nenhum',
    heroTitulo: { fonte: tema.fontes.display, escala: 1, espacamento: 0, alinhamento: 'esquerda' },
    led: 'desligado', ledEstilo: 'barra', barraCor: { modo: 'fundo' },
  };
}
const descricoes: Record<Tema['cardapio'], string> = {
  editorial: 'Noite, letreiro e cartões editoriais compactos. Raio-x para montar o pedido.',
  painel: 'Fórmica azul, placa de porta e painel de fotos em três colunas.',
  lista: 'Lista direta, foto à esquerda e adicionar em primeiro plano. Sem intro.',
  folha: 'Folha de menu em papel, nomes ligados ao preço por pontilhado e toldo terracota.',
};
/** Quatro escolhas do operador ao gerar a demo. Cada uma tem um único preset. */
export const LANCHERIA_RX_SKINS: SkinDefinition[] = Object.values(TEMAS).map(tema => {
  const theme = themeRadar(tema);
  return { id: theme.id, nicho: 'lancheria', nome: `Lancheria ${tema.nome}`, descricao: descricoes[tema.cardapio],
    componente: LancheriaRaioX, themeDefault: theme, themePresets: [theme], demoDataExemplo: exemploRadar(tema),
    secoes: LANCHERIA_RX_SECOES, localeFixo:{idioma:'pt-BR',moeda:'BRL'}, heroEscalaLimites: {min:1,max:1},
    thumbnail: `/demos/lancheria-rx/${tema.slug}.jpg`,
  };
});
