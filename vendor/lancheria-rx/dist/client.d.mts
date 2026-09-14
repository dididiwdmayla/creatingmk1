import * as react from 'react';

type Tema = {
    slug: string;
    nome: string;
    fundo: 'escuro' | 'claro';
    cores: {
        base: string;
        superficie: string;
        traco: string;
        texto: string;
        quente: string;
        frio: string;
    };
    fontes: {
        display: string;
        corpo: string;
        medida: string;
    };
    raio: number;
    densidade: 'solta' | 'media' | 'apertada';
    assinatura: string;
    mascote: boolean;
    filtroInicial: 'todos' | 'primeira-forma';
    abrirComposicao: 'nenhuma' | 'pela-foto' | 'pelo-rotulo';
    cardapio: 'editorial' | 'painel' | 'lista' | 'folha';
    intro: boolean;
    hero: 'chapa' | 'balcao' | 'menu' | 'nenhum';
    adicionarIcone: boolean;
    rotulos: {
        modificar: string;
        modificarCurto: string;
    };
    movimento: {
        grade: boolean;
        transicaoMs: number | null;
        captura: boolean;
    };
    medida: {
        fallback: 'monospace' | 'sans-serif' | 'serif';
        numerais: string;
    };
    folhaFontes: string;
};

type Fixo = {
    slug: string;
    nome: string;
    forma: 'prensado' | 'redondo';
    camadas: string[];
    essenciais: string[];
    precoCent?: number;
    foto?: string;
};
type Extra = {
    slug: string;
    nome: string;
    grupo: 'bebida' | 'acompanhamento';
    precoCent: number;
    icone: string;
};

type Casa = {
    nome: string;
    marca: string;
    cidade: string;
    endereco: string;
    telefone: string;
    whatsapp: string;
    fuso: string;
    abre: string;
    fecha: string;
    pagamento: string[];
    horarioConfirmado?: boolean;
    horarioTexto?: string;
    instagram?: string;
};
type IngredienteComercial = {
    slug: string;
    nome: string;
    precoCent: number;
};
type LancheComercial = Fixo & {
    precoCent: number;
    foto: string;
};
type TextosCasa = {
    registro: string;
    categoria: string;
    heroTitulo: string;
    heroDescricao: string;
    heroFoto: string;
    heroAlt: string;
    historiaTitulo: string;
    historia: string[];
    historiaFoto: string;
    historiaAlt: string;
    carimbo: string;
    rodape: string;
};
type DadosLancheria = {
    casa: Casa;
    precoBaseCent: number;
    ingredientes: IngredienteComercial[];
    lanches: LancheComercial[];
    extras: Extra[];
    textos: TextosCasa;
};

/** A skin recebe o objeto escolhido pelo servidor. Não existe seletor de identidade. */
declare function Lancheria({ tema, dados }: {
    tema: Tema;
    dados: DadosLancheria;
}): react.JSX.Element;

export { Lancheria };
