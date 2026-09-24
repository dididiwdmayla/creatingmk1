import type { DemoData } from "@/lib/demos/types";

import { TATUAGEM2_EXEMPLO } from "./exemplo";

type ConteudoDaVariante = Pick<DemoData, "slogan" | "servicos" | "depoimentos" | "secoes">;

/**
 * Aplica somente CONTEÚDO editorial ao exemplo comum. Nome, endereço,
 * telefones, Instagram, horários e imagens continuam vindo da identidade e
 * dos slots compartilhados — trocar de variante nunca inventa um negócio.
 */
function comConteudo(conteudo: ConteudoDaVariante): DemoData {
  return { ...TATUAGEM2_EXEMPLO, ...conteudo };
}

const AQUARELA = comConteudo({
  slogan: "Cor feita para uma pele só.",
  servicos: [
    { nome: "PROJETO PEQUENO", preco: "", precoValor: 220, descricao: "Símbolos e composições coloridas de até 10 cm." },
    { nome: "PEÇA AUTORAL", preco: "", precoValor: 520, descricao: "Desenho exclusivo com estudo de forma e paleta." },
    { nome: "PROJETO AMPLO", preco: "", precoPrefixo: "A partir de", precoValor: 1100, descricao: "Composição colorida para braço, perna ou costas." },
    { nome: "SESSÃO DE COR", preco: "", precoValor: 360, descricao: "Etapa adicional para projetos construídos em mais de uma sessão." },
    { nome: "RETOQUE", preco: "", precoPrefixo: "Sob consulta", descricao: "Revisão pontual de cor depois da cicatrização." },
  ],
  depoimentos: [
    { autor: "Lia M.", texto: "Eu trouxe uma sensação, não um desenho. A paleta virou exatamente a memória que eu queria carregar.", nota: 5 },
    { autor: "Ravi C.", texto: "A mistura de azul e laranja deixou a peça viva sem perder o traço delicado.", nota: 5 },
    { autor: "Nina A.", texto: "Ver as opções de cor antes da sessão me ajudou a escolher com calma.", nota: 5 },
  ],
  secoes: {
    hero: { rotulo: "Ateliê de tatuagem em cor", texto: "Aquarela, contraste e desenho autoral para uma composição que não se repete.", cta: "Propor uma ideia" },
    manifesto: { texto: "Cor não preenche o desenho. Cor conduz o olhar, guarda temperatura e transforma pele em matéria de pintura." },
    estilos: {
      rotulo: "Linguagens de cor", titulo: "Cinco maneiras de pintar na pele.", itens: [
        { titulo: "Aquarela", texto: "Transparência aparente, bordas livres e encontros inesperados de pigmento." },
        { titulo: "Neo-trad colorido", texto: "Contorno firme, volume gráfico e paleta de alto contraste." },
        { titulo: "Botânico cromático", texto: "Folhas, flores e frutos construídos por temperatura e ritmo." },
        { titulo: "Abstrato", texto: "Gestos, manchas e vazios organizados para acompanhar o corpo." },
        { titulo: "Ilustrativo", texto: "Narrativa visual com desenho preciso e cor como protagonista." },
      ],
    },
    investimento: { rotulo: "Faixas de projeto", titulo: "Escala, tempo e quantidade de cor." },
    portfolio: {
      rotulo: "Caderno cromático", titulo: "Cada peça começa pela paleta.", itens: [
        { titulo: "Jardim líquido", subtitulo: "Aquarela", detalhe: "rosa · azul" },
        { titulo: "Ave solar", subtitulo: "Neo-trad colorido", detalhe: "laranja · cobalto" },
        { titulo: "Folhas em fluxo", subtitulo: "Botânico", detalhe: "verde · violeta" },
        { titulo: "Maré abstrata", subtitulo: "Abstrato", detalhe: "azul · coral" },
        { titulo: "Raposa em flor", subtitulo: "Ilustrativo", detalhe: "ocre · magenta" },
        { titulo: "Órbita", subtitulo: "Aquarela abstrata", detalhe: "três pigmentos" },
        { titulo: "Peônia elétrica", subtitulo: "Neo-trad colorido", detalhe: "rosa · azul" },
        { titulo: "Semente", subtitulo: "Botânico cromático", detalhe: "verde · laranja" },
      ],
    },
    artistas: {
      rotulo: "Mãos e paletas", titulo: "Três leituras de cor.", itens: [
        { titulo: "Cora Vidal", subtitulo: "Aquarela · Abstrato", texto: "Composição guiada por gesto, transparência aparente e movimento." },
        { titulo: "Bento Aoki", subtitulo: "Neo-trad · Ilustrativo", texto: "Contornos gráficos, personagens e cores densas em diálogo." },
        { titulo: "Íris Weiss", subtitulo: "Botânico · Cromático", texto: "Flores e folhagens construídas com variações de temperatura." },
      ],
    },
    depoimentos: { rotulo: "Cores escolhidas", titulo: "Quando a paleta encontra a história." },
    processo: {
      rotulo: "Do gesto à pele", titulo: "Uma cor puxa a próxima.", itens: [
        { titulo: "Intenção", subtitulo: "01", texto: "A ideia chega em palavras, referências ou apenas numa sensação." },
        { titulo: "Paleta", subtitulo: "02", texto: "Combinações de cor testam contraste, temperatura e passagem." },
        { titulo: "Composição", subtitulo: "03", texto: "O desenho se ajusta à área e ao movimento do corpo." },
        { titulo: "Pigmento", subtitulo: "04", texto: "A aplicação constrói camadas, bordas e pontos de respiro." },
      ],
    },
    faq: {
      rotulo: "Antes da cor", titulo: "O que ajuda a decidir.", itens: [
        { titulo: "Preciso chegar com a paleta pronta?", texto: "Não. Referências de clima, objetos e cores favoritas já ajudam a iniciar o estudo." },
        { titulo: "Toda cor aparece igual em qualquer pele?", texto: "Não. O estudo considera o tom da pele e o contraste necessário para cada pigmento." },
        { titulo: "Como escolher o tamanho?", texto: "Detalhe, área do corpo e distância de leitura definem a escala mais adequada." },
        { titulo: "A peça pode ser construída em etapas?", texto: "Sim. Projetos amplos podem ser divididos por composição e por camada de cor." },
      ],
    },
    agendar: { titulo: "Qual cor abre a sua ideia?", cta: "Enviar proposta", ctaSecundaria: "Conversar" },
    contato: {},
  },
});

const BOREAL = comConteudo({
  slogan: "Uma nova leitura para a tatuagem que já existe.",
  servicos: [
    { nome: "COBERTURA P", preco: "", precoValor: 380, descricao: "Estudo para áreas de até 8 cm, conforme densidade da peça anterior." },
    { nome: "COBERTURA M", preco: "", precoValor: 720, descricao: "Projeto para áreas de 8 a 18 cm, com composição construída sobre o desenho existente." },
    { nome: "COBERTURA G", preco: "", precoPrefixo: "A partir de", precoValor: 1250, descricao: "Planejamento por etapas para áreas maiores ou muito saturadas." },
    { nome: "REFORMA DE COR", preco: "", precoValor: 460, descricao: "Reorganização de contraste e cor em tatuagens já cicatrizadas." },
    { nome: "LEITURA DA PEÇA", preco: "", precoPrefixo: "Sob consulta", descricao: "Análise visual de tamanho, pigmento, relevo e possibilidades de composição." },
  ],
  depoimentos: [
    { autor: "Tainá R.", texto: "Eu queria parar de esconder a tatuagem. O novo desenho incorporou o que existia sem parecer um remendo.", nota: 5 },
    { autor: "Caio F.", texto: "Entender o que podia ser coberto e o que precisava entrar na composição tirou minha ansiedade.", nota: 5 },
    { autor: "Lu M.", texto: "A cor antiga virou sombra e profundidade na peça nova. Foi uma mudança de leitura completa.", nota: 5 },
  ],
  secoes: {
    hero: { rotulo: "Cobertura e reforma de cor", texto: "A peça antiga vira ponto de partida para contraste, forma e uma narrativa nova.", cta: "Avaliar minha tatuagem" },
    manifesto: { texto: "Cobrir não é apagar. É observar o que existe, escolher o que permanece e desenhar uma saída possível por cima." },
    estilos: {
      rotulo: "Rotas de transformação", titulo: "Cinco caminhos para recomeçar.", itens: [
        { titulo: "Cover-up botânico", texto: "Folhas, flores e massas orgânicas redistribuem áreas escuras." },
        { titulo: "Reforma de cor", texto: "Contraste e temperatura reorganizam uma peça que perdeu presença." },
        { titulo: "Clareamento estratégico", texto: "Etapa prévia possível quando a peça precisa abrir espaço para outra composição." },
        { titulo: "Incorporação", texto: "Parte do desenho anterior permanece como textura, sombra ou memória." },
        { titulo: "Reenquadramento", texto: "Uma moldura visual maior muda o foco sem esconder cada linha antiga." },
      ],
    },
    investimento: { rotulo: "Orçamento por escala", titulo: "Tamanho é só o primeiro dado." },
    portfolio: {
      rotulo: "Transformações", titulo: "O antes informa. O depois responde.", itens: [
        { titulo: "Traço antigo → folhagem", subtitulo: "Cover-up botânico", detalhe: "área P" },
        { titulo: "Cor fria → ave", subtitulo: "Reforma cromática", detalhe: "área M" },
        { titulo: "Nome → paisagem", subtitulo: "Incorporação", detalhe: "área M" },
        { titulo: "Símbolo → peônia", subtitulo: "Cover-up floral", detalhe: "área P" },
        { titulo: "Bloco escuro → máscara", subtitulo: "Reenquadramento", detalhe: "área G" },
        { titulo: "Linha falhada → ramo", subtitulo: "Reforma de traço", detalhe: "área P" },
        { titulo: "Figura antiga → serpente", subtitulo: "Incorporação", detalhe: "área M" },
        { titulo: "Mancha → mariposa", subtitulo: "Cover-up ilustrativo", detalhe: "área M" },
      ],
    },
    artistas: {
      rotulo: "Leituras técnicas", titulo: "Olhares para o que já está na pele.", itens: [
        { titulo: "Cora Vidal", subtitulo: "Cobertura orgânica", texto: "Massas de cor, folhagem e desenho fluido para áreas irregulares." },
        { titulo: "Bento Aoki", subtitulo: "Reforma gráfica", texto: "Contorno, contraste e composição densa para peças de leitura forte." },
        { titulo: "Íris Weiss", subtitulo: "Reenquadramento delicado", texto: "Detalhe botânico e espaço negativo para integrar traços anteriores." },
      ],
    },
    depoimentos: { rotulo: "Depois da mudança", titulo: "Voltar a olhar sem desviar." },
    processo: {
      rotulo: "Plano de cobertura", titulo: "Primeiro ler. Depois redesenhar.", itens: [
        { titulo: "Leitura", subtitulo: "01", texto: "Foto, tamanho, relevo e saturação mostram os limites da peça atual." },
        { titulo: "Rota", subtitulo: "02", texto: "Cobertura direta, incorporação ou etapa prévia entram como possibilidades." },
        { titulo: "Encaixe", subtitulo: "03", texto: "Forma e contraste são testados sobre a área real antes da aplicação." },
        { titulo: "Cobertura", subtitulo: "04", texto: "Camadas novas conduzem o olhar para a composição escolhida." },
      ],
    },
    faq: {
      rotulo: "Dúvidas de cobertura", titulo: "Nem toda peça pede a mesma solução.", itens: [
        { titulo: "Qualquer tatuagem pode ser coberta?", texto: "Tamanho, pigmento, cicatriz e desenho anterior determinam as possibilidades." },
        { titulo: "A nova peça precisa ser maior?", texto: "Em geral, uma margem maior dá espaço para mudar foco, contraste e silhueta." },
        { titulo: "É preciso clarear antes?", texto: "Alguns projetos ganham opções com uma etapa prévia; outros permitem incorporação direta." },
        { titulo: "Dá para manter parte da antiga?", texto: "Sim. Elementos existentes podem entrar como textura, sombra ou estrutura da nova arte." },
      ],
    },
    agendar: { titulo: "Envie a peça como ela está hoje.", cta: "Pedir uma leitura", ctaSecundaria: "Enviar foto" },
    contato: {},
  },
});

const MEIA_NOITE = comConteudo({
  slogan: "Cor pop em volume máximo.",
  servicos: [
    { nome: "FLASH POP", preco: "", precoValor: 190, descricao: "Desenhos fechados em escala pequena, com paleta definida." },
    { nome: "PERSONAGEM", preco: "", precoValor: 560, descricao: "Retrato estilizado de anime, game ou universo autoral." },
    { nome: "PEÇA NEO-TRAD", preco: "", precoValor: 690, descricao: "Composição de médio porte com contorno e cor saturada." },
    { nome: "PAINEL GEEK", preco: "", precoPrefixo: "A partir de", precoValor: 1350, descricao: "Narrativa ampla com múltiplos elementos e sessões planejadas." },
    { nome: "LETTERING COLORIDO", preco: "", precoPrefixo: "Sob consulta", descricao: "Palavra ou frase tratada como forma gráfica em cor." },
  ],
  depoimentos: [
    { autor: "Bia K.", texto: "Meu personagem favorito ficou reconhecível sem virar cópia da referência. A cor deu outra energia.", nota: 5 },
    { autor: "Davi N.", texto: "Escolhi a paleta como quem escolhe skin de jogo — e ela funcionou muito melhor na pele do que na tela.", nota: 5 },
    { autor: "Mika S.", texto: "O contorno segura tudo de longe; de perto, aparecem os detalhes que eu queria esconder na cena.", nota: 5 },
  ],
  secoes: {
    hero: { rotulo: "Tatuagem pop colorida", texto: "Anime, games, cartoon e neo-trad em pigmentos que não pedem licença.", cta: "Escolher meu universo" },
    manifesto: { texto: "Referência não é fantasia de outra pessoa. É matéria-prima para exagerar a cor, editar a cena e tornar o fandom seu." },
    estilos: {
      rotulo: "Seleção de personagem", titulo: "Escolha o seu modo.", itens: [
        { titulo: "Anime", texto: "Expressão, movimento e leitura imediata de personagem." },
        { titulo: "Neo-trad pop", texto: "Contorno encorpado, volume e paleta de tela acesa." },
        { titulo: "Geek", texto: "Games, ficção científica e símbolos de universos favoritos." },
        { titulo: "Cartoon", texto: "Forma elástica, humor visual e cor direta." },
        { titulo: "Lettering colorido", texto: "Letras tratadas como logotipo, efeito e ritmo." },
      ],
    },
    investimento: { rotulo: "Créditos", titulo: "Da fase rápida ao projeto épico." },
    portfolio: {
      rotulo: "Galeria desbloqueada", titulo: "Cor, personagem e cena.", itens: [
        { titulo: "Guardião celeste", subtitulo: "Anime", detalhe: "ciano · magenta" },
        { titulo: "Boss final", subtitulo: "Geek", detalhe: "laranja · violeta" },
        { titulo: "Gato cósmico", subtitulo: "Cartoon", detalhe: "três cores" },
        { titulo: "Heroína em neon", subtitulo: "Neo-trad pop", detalhe: "área M" },
        { titulo: "Continue?", subtitulo: "Lettering colorido", detalhe: "pixel" },
        { titulo: "Criatura de bolso", subtitulo: "Anime", detalhe: "área P" },
        { titulo: "Nave em fuga", subtitulo: "Geek", detalhe: "área M" },
        { titulo: "Sapo turbo", subtitulo: "Cartoon", detalhe: "flash" },
      ],
    },
    artistas: {
      rotulo: "Player select", titulo: "Escolha seu estilo de jogo.", itens: [
        { titulo: "Cora Vidal", subtitulo: "Anime · Cor luminosa", texto: "Cenas de movimento e personagens construídos por planos de cor." },
        { titulo: "Bento Aoki", subtitulo: "Neo-trad · Geek", texto: "Silhueta forte, contorno espesso e composição de impacto." },
        { titulo: "Íris Weiss", subtitulo: "Cartoon · Lettering", texto: "Humor, forma gráfica e detalhes escondidos na leitura de perto." },
      ],
    },
    depoimentos: { rotulo: "Tela de resultados", titulo: "Fandom que saiu do feed." },
    processo: {
      rotulo: "Próxima fase", titulo: "Da referência ao render final.", itens: [
        { titulo: "Universo", subtitulo: "01", texto: "Personagem, cena, símbolo e energia desejada entram no briefing." },
        { titulo: "Painel", subtitulo: "02", texto: "Referências se combinam sem copiar uma imagem pronta." },
        { titulo: "Line", subtitulo: "03", texto: "Silhueta e contorno são ajustados para leitura no corpo." },
        { titulo: "Render", subtitulo: "04", texto: "Cor, luz e pequenos efeitos fecham a narrativa." },
      ],
    },
    faq: {
      rotulo: "Antes de apertar start", titulo: "Referência boa evita tela de erro.", itens: [
        { titulo: "Posso misturar universos?", texto: "Sim. Um elemento em comum — pose, paleta ou cenário — ajuda a unir referências diferentes." },
        { titulo: "Precisa ser uma cena original?", texto: "A composição pode partir de uma referência e ganhar enquadramento, cor e detalhes próprios." },
        { titulo: "Como a cor muda na pele?", texto: "Brilho de tela vira contraste entre pigmento, contorno, sombra e áreas de respiro." },
        { titulo: "Dá para ampliar depois?", texto: "Sim. Fundos, molduras e personagens secundários podem ser previstos desde o primeiro desenho." },
      ],
    },
    agendar: { titulo: "Qual universo vai sair da tela?", cta: "Enviar referência", ctaSecundaria: "Abrir conversa" },
    contato: {},
  },
});

const TERRA = comConteudo({
  slogan: "Memória desenhada para permanecer perto.",
  servicos: [
    { nome: "RETRATO PEQUENO", preco: "", precoValor: 480, descricao: "Rosto ou detalhe afetivo em composição compacta." },
    { nome: "RETRATO COLORIDO", preco: "", precoValor: 780, descricao: "Estudo de expressão, luz e paleta para pessoa ou pet." },
    { nome: "HOMENAGEM BOTÂNICA", preco: "", precoValor: 520, descricao: "Flor de nascimento, data ou símbolo reunidos numa peça autoral." },
    { nome: "COMPOSIÇÃO DE MEMÓRIA", preco: "", precoPrefixo: "A partir de", precoValor: 980, descricao: "Retrato, objeto e caligrafia organizados em uma narrativa maior." },
    { nome: "ESTUDO DE REFERÊNCIA", preco: "", precoPrefixo: "Sob consulta", descricao: "Leitura de fotos, enquadramento e possibilidades de composição." },
  ],
  depoimentos: [
    { autor: "Ana P.", texto: "O olhar do retrato era a parte que mais me preocupava. Foi também a parte que me fez reconhecer a memória.", nota: 5 },
    { autor: "Leo G.", texto: "A flor da minha mãe e a letra dela cabiam em lembranças diferentes; no desenho, viraram uma só.", nota: 5 },
    { autor: "Mara V.", texto: "Levei muitas fotos do meu cachorro. A pose escolhida trouxe o jeito dele, não apenas a aparência.", nota: 5 },
  ],
  secoes: {
    hero: { rotulo: "Homenagem e retrato colorido", texto: "Pessoas, pets, flores e caligrafias reunidos com cuidado de expressão e memória.", cta: "Contar uma história" },
    manifesto: { texto: "Retrato não é copiar uma fotografia. É escolher o gesto que ficou, a cor da lembrança e o detalhe que faz alguém reconhecer." },
    estilos: {
      rotulo: "Formas de lembrar", titulo: "Cinco vestígios, uma história.", itens: [
        { titulo: "Retrato", texto: "Expressão, luz e enquadramento concentrados no que torna o rosto singular." },
        { titulo: "Pet", texto: "Postura, olhar e pequenos hábitos transformados em desenho." },
        { titulo: "Flor de nascimento", texto: "Botânica ligada a uma data, pessoa ou passagem." },
        { titulo: "Caligrafia de quem se foi", texto: "Uma escrita real preservada sem perder suas imperfeições." },
        { titulo: "Objeto de memória", texto: "Brinquedo, joia, ferramenta ou lembrança cotidiana como centro da composição." },
      ],
    },
    investimento: { rotulo: "Escala da lembrança", titulo: "Referência, detalhe e composição." },
    portfolio: {
      rotulo: "Álbum aberto", titulo: "Histórias que ganharam contorno.", itens: [
        { titulo: "Retrato em luz quente", subtitulo: "Pessoa", detalhe: "cor suave" },
        { titulo: "Companheiro de quatro patas", subtitulo: "Pet", detalhe: "área M" },
        { titulo: "Flor de setembro", subtitulo: "Botânico", detalhe: "ocre · verde" },
        { titulo: "Bilhete guardado", subtitulo: "Caligrafia", detalhe: "traço original" },
        { titulo: "Relógio de bolso", subtitulo: "Objeto de memória", detalhe: "terracota" },
        { titulo: "Duas gerações", subtitulo: "Retrato duplo", detalhe: "área G" },
        { titulo: "Coleira e ramo", subtitulo: "Pet · Botânico", detalhe: "área P" },
        { titulo: "Receita de família", subtitulo: "Caligrafia", detalhe: "papel · tinta" },
      ],
    },
    artistas: {
      rotulo: "Olhares de retrato", titulo: "Três maneiras de guardar presença.", itens: [
        { titulo: "Cora Vidal", subtitulo: "Retrato em cor", texto: "Expressão e atmosfera construídas por temperatura e luz." },
        { titulo: "Bento Aoki", subtitulo: "Objetos · Composição", texto: "Narrativas com símbolos, molduras e contraste gráfico." },
        { titulo: "Íris Weiss", subtitulo: "Pets · Botânico", texto: "Gestos delicados, pelagem e flores tratados como lembrança viva." },
      ],
    },
    depoimentos: { rotulo: "Histórias confiadas", titulo: "Reconhecer antes de eternizar." },
    processo: {
      rotulo: "Construção do retrato", titulo: "Da lembrança ao desenho.", itens: [
        { titulo: "História", subtitulo: "01", texto: "Quem ou o que será lembrado define o centro emocional da peça." },
        { titulo: "Referências", subtitulo: "02", texto: "Fotos, escritos e objetos revelam expressão, gesto e detalhes importantes." },
        { titulo: "Estudo", subtitulo: "03", texto: "Enquadramento, luz e símbolos formam uma composição reconhecível." },
        { titulo: "Sessão", subtitulo: "04", texto: "A aplicação preserva leitura de longe e nuances de perto." },
      ],
    },
    faq: {
      rotulo: "Antes do retrato", titulo: "Escolher referência também é cuidar.", itens: [
        { titulo: "Qual foto funciona melhor?", texto: "Imagens nítidas, com luz lateral e expressão natural oferecem mais informação para o estudo." },
        { titulo: "E se eu tiver poucas fotos?", texto: "Diferentes imagens podem contribuir com pose, roupa, expressão e pequenos detalhes." },
        { titulo: "Dá para unir retrato e escrita?", texto: "Sim. Caligrafia, datas, flores e objetos podem organizar a narrativa ao redor do rosto." },
        { titulo: "Como conferir a semelhança?", texto: "O estudo compara proporções e pontos marcantes antes de definir o desenho final." },
      ],
    },
    agendar: { titulo: "O que fica com você?", cta: "Enviar referências", ctaSecundaria: "Contar a história" },
    contato: {},
  },
});

export const TATUAGEM2_EXEMPLOS_POR_VARIANTE: Readonly<Record<string, DemoData>> = {
  aquarela: AQUARELA,
  boreal: BOREAL,
  "meia-noite": MEIA_NOITE,
  terra: TERRA,
};
