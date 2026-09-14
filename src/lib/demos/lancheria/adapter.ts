import { exemploLancheria, validarDadosLancheria, type Tema, type DadosLancheria } from '@radar/lancheria-rx/contrato';
import type { DemoData, Theme, DemoLancheria } from '../types';

/** Identidade vem SEMPRE dos slots resolvidos pelo Radar, inclusive os vazios. */
export function dadosDaLancheria(data: DemoData): DadosLancheria {
  if (!data.lancheria) throw new Error('Catálogo da lancheria ausente');
  const { funcionamento, ...catalogo } = data.lancheria;
  // As duas fotos da página são SLOTS do Radar (`DemoData.imagens`), não
  // campos do catálogo: é o que dá a elas upload por lead, placeholder
  // gráfico e o modo foto/gráfico, como em qualquer outra skin. O texto
  // alternativo continua no catálogo — é conteúdo, editável em Conteúdo.
  const textos = { ...catalogo.textos,
    heroFoto: data.imagens.hero ?? catalogo.textos.heroFoto,
    historiaFoto: data.imagens.historia ?? catalogo.textos.historiaFoto };
  return { ...catalogo, textos, casa: {
    nome: data.nome, marca: data.nome.replace(/^Lancheria\s+/iu, ''),
    cidade: data.cidade ?? '', endereco: data.endereco ?? '', telefone: data.telefone ?? '',
    horarioTexto: funcionamento.confirmado ? undefined : data.horarios, instagram: data.instagram,
    horarioConfirmado: funcionamento.confirmado,
    whatsapp: (data.whatsapp ?? '').replace(/\D/g, ''), abre:funcionamento.abre,fecha:funcionamento.fecha,fuso:funcionamento.fuso,pagamento:funcionamento.pagamento,
  }};
}

export function temaDaLancheria(theme: Theme): Tema {
  if (!theme.lancheria || !theme.paleta.quente || !theme.paleta.frio)
    throw new Error('A skin precisa de knobs e das cores quente/frio independentes');
  return { ...theme.lancheria, intro: theme.intro, cores: {
    base: theme.paleta.fundo, superficie: theme.paleta.fundoElevado, traco: theme.paleta.borda,
    texto: theme.paleta.texto, quente: theme.paleta.quente, frio: theme.paleta.frio,
  }};
}

export function exemploRadar(tema: Tema): DemoData {
  const { casa, ...catalogo } = exemploLancheria(tema.hero);
  const lancheria: DemoLancheria = { ...catalogo,
    funcionamento: { abre: casa.abre, fecha: casa.fecha, fuso: casa.fuso, pagamento: casa.pagamento, confirmado: false },
  };
  return { nome: casa.nome, lancheria,
    servicos: [], depoimentos: [], secoes: {cardapio:{},historia:{},contato:{}}, imagens: {},
  };
}

/** Schema comercial fechado: dados extras nunca entram no motor físico. */
export function problemasLancheria(value: unknown, base: DemoData): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['lancheria deve ser objeto'];
  const v = value as Record<string, unknown>;
  const { funcionamento, ...catalogo } = v;
  const extra = 'casa' in v ? ['lancheria.casa: use os slots de identidade do Radar'] : [];
  if (!funcionamento || typeof funcionamento !== 'object' || Array.isArray(funcionamento))
    return [...extra, 'lancheria.funcionamento deve ser objeto'];
  for (const chave of Object.keys(funcionamento)) if (!['abre','fecha','fuso','pagamento','confirmado'].includes(chave))
    extra.push(`lancheria.funcionamento.${chave}: chave desconhecida`);
  const {confirmado,...horas}=funcionamento as Record<string,unknown>;
  if(typeof confirmado!=='boolean')extra.push('lancheria.funcionamento.confirmado: booleano obrigatório');
  const dados = { ...catalogo, casa: { nome: base.nome, marca: base.nome, cidade: base.cidade ?? '',
    endereco: base.endereco ?? '', telefone: base.telefone ?? '', whatsapp: (base.whatsapp ?? '').replace(/\D/g,''),
    ...horas,
  }};
  return [...extra, ...validarDadosLancheria(dados)];
}
