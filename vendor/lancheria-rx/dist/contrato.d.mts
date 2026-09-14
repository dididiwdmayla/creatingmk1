import { CSSProperties } from 'react';

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
    /**
     * A faixa hero desta identidade usa FOTO? Meia-Noite e Diner sim;
     * Prático e Cantina abrem só com tipografia. É knob, e não CSS
     * `display:none`, porque a imagem não pode nem ser BAIXADA numa
     * identidade que não a mostra — é hero, está acima da dobra, e o
     * Prático existe justamente para ser o caminho mais curto.
     */
    heroFoto: boolean;
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
declare const TEMAS: readonly Tema[];
declare const TEMA: Tema;
/** Registro de identidades. A rota pública recebe o objeto pela definição da skin. */
declare function selecionarTema(slug?: string | null): Tema;
/** Os nomes históricos são aliases semânticos, não paletas dentro dos componentes. */
declare function estiloTema(tema: Tema): CSSProperties;

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
declare const TEXTOS_CASA: Record<'chapa' | 'balcao' | 'menu' | 'nenhum', TextosCasa>;
declare const DADOS_EXEMPLO: DadosLancheria;
declare function exemploLancheria(hero: keyof typeof TEXTOS_CASA): DadosLancheria;
/** Só conteúdo comercial atravessa a fronteira. Geometria e calibração não são slots. */
declare function validarDadosLancheria(valor: unknown): string[];

declare function criarPrecos(dados: DadosLancheria): {
    precoDaComposicao: (slugs: string[]) => number;
    precoDoFixo: (f: Fixo) => number;
    precoDoLanche: (camadas: string[], fixoSlug?: string) => number;
    camadaFixa: (slug: string, fixoSlug?: string) => boolean;
};

type Forma = 'prensado' | 'redondo';

type LancheFechado = {
    chave: string;
    nome: string;
    forma: Forma;
    camadas: string[];
    resumo: string;
    cent: number;
    fixoSlug?: string;
    observacao?: string;
};

type Item = LancheFechado & {
    grupo: 'lanche' | Extra['grupo'];
    foto: string;
};
type ItemPedido = Item & {
    id: string;
    qtd: number;
};
type Gancho = {
    id: 'bebida' | 'batata' | 'bacon';
    texto: string;
    extra?: Extra;
    pedidoId?: string;
};
type Confirmacao = {
    nome: string;
    recebimento: 'retirada' | 'entrega';
    endereco: string;
    complemento: string;
    pagamento: string;
    troco: string;
    observacao: string;
};
declare function criarPedido(dadosCasa: DadosLancheria): {
    resumoCamadas: (camadas: string[]) => string;
    itemLanche: (lanche: LancheFechado) => Item;
    itemFixo: (f: Fixo) => Item;
    itemExtra: (e: Extra) => Item;
    ganchoDoPedido: (pedido: ItemPedido[], vistos: string[], dispensados: string[]) => Gancho | null;
    comBacon: (camadas: string[]) => string[];
    validarConfirmacao: (dados: Confirmacao) => Partial<Record<keyof Confirmacao, string>>;
    resumoPedido: (pedido: ItemPedido[], dados?: Confirmacao) => string;
    urlWhatsApp: (pedido: ItemPedido[], dados: Confirmacao) => string;
};

declare const horaLegivel: (hora: string) => string;
declare const faixaHorario: (casa: Casa) => string;
declare function horarioDaCasa(agora?: Date, casa?: Casa): {
    aberto: null;
    ultimos: boolean;
    texto: string;
} | {
    aberto: boolean;
    ultimos: boolean;
    texto: string;
};

export { type Casa, DADOS_EXEMPLO, type DadosLancheria, type IngredienteComercial, type LancheComercial, TEMA, TEMAS, type Tema, type TextosCasa, criarPedido, criarPrecos, estiloTema, exemploLancheria, faixaHorario, horaLegivel, horarioDaCasa, selecionarTema, validarDadosLancheria };
