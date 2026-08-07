import { describe, expect, it } from "vitest";

import {
  calcularToposFatias,
  enderecoExibido,
  FATIAS_MAX,
  fundoClaro,
  htmlMoldura,
  LIMITE_FATIA_UNICA,
  luminancia,
  medidasMoldura,
  nomeComposto,
  PROPORCAO_APARELHO,
  vazioNaFatia,
} from "../moldura.mjs";

/**
 * O compositor é HTML, então o que dá pra cobrar dele em teste é o
 * CONTRATO: o que aparece e o que NÃO pode aparecer em cada moldura, as
 * medidas (que o motor usa pra dimensionar a página antes do screenshot) e
 * o tratamento de texto que vem de fora. O acabamento visual em si é
 * verificado por captura, que é o único jeito honesto de olhar desenho.
 */

const UMA_TELA = 844 * 2; // a viewport de celular do motor, em pixel
const CELULAR = {
  tela: "celular" as const,
  src: "./x.png",
  largura: 780,
  altura: 2600,
  alturaTela: UMA_TELA,
};
const DESKTOP = { tela: "desktop" as const, src: "./x.png", largura: 1440, altura: 1100 };

// As medidas voltam discriminadas por tela (as duas molduras não têm as
// mesmas partes). Estes dois estreitam a união para o teste conseguir
// olhar as peças de cada uma.
function medidasCelular(captura: typeof CELULAR) {
  const m = medidasMoldura(captura);
  if (m.tela !== "celular") throw new Error("esperava medidas de celular");
  return m;
}
function medidasDesktop(captura: typeof DESKTOP) {
  const m = medidasMoldura(captura);
  if (m.tela !== "desktop") throw new Error("esperava medidas de desktop");
  return m;
}

/**
 * Só a MOLDURA, sem o `<head>`: o fundo da composição usa gradiente de
 * propósito (é a paleta da demo), e uma asserção sobre a página inteira
 * confundiria o fundo com brilho no aparelho.
 */
function soAMoldura(html: string): string {
  return html.slice(html.indexOf("<body>"));
}

describe("nomeComposto", () => {
  it("põe o sufixo antes da extensão", () => {
    expect(nomeComposto("lead-01-hero-celular.png")).toBe("lead-01-hero-celular-moldura.png");
  });

  it("não mexe em nome sem extensão .png", () => {
    expect(nomeComposto("sem-extensao")).toBe("sem-extensao");
  });
});

describe("medidasMoldura", () => {
  it("a composta é maior que a captura nas duas dimensões", () => {
    const m = medidasCelular({ ...CELULAR, altura: 1200 });
    expect(m.largura).toBeGreaterThan(CELULAR.largura);
    expect(m.altura).toBeGreaterThan(1200);
  });

  it("captura de até uma tela vira APARELHO, em proporção de aparelho real, sem encolher", () => {
    const m = medidasCelular({ ...CELULAR, altura: UMA_TELA });
    if (m.modo !== "aparelho") throw new Error("esperava aparelho");
    expect(m.cortada).toBe(false);
    expect(m.escala).toBe(1);
    // A proporção da TELA é a da viewport do motor, que é a de um aparelho
    // de verdade — não um número inventado aqui.
    expect(m.alturaVisivel / CELULAR.largura).toBeCloseTo(UMA_TELA / CELULAR.largura, 5);
  });

  it("seção CURTA não vira celular atarracado: a tela continua com uma tela", () => {
    const m = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * 0.6) });
    if (m.modo !== "aparelho") throw new Error("esperava aparelho");
    expect(m.escala).toBe(1);
    expect(m.alturaVisivel).toBe(UMA_TELA);
    // A sobra é preenchida com o fundo da demo — a página continuando, não
    // uma tarja preta.
    expect(m.folga).toBe(UMA_TELA - Math.round(UMA_TELA * 0.6));
    expect(m.cortada).toBe(false);
  });

  it("captura mais alta que uma tela vira FATIADA, não aparelho esticado", () => {
    const m = medidasCelular({ ...CELULAR, altura: UMA_TELA * 2 });
    if (m.modo !== "fatiado") throw new Error("esperava fatiado");
    // O defeito que isto impede: um corpo de aparelho com proporção de 1:4.
    expect(m.numFatias).toBe(2);
    expect(m.cortada).toBe(false);
  });

  it(`até ${LIMITE_FATIA_UNICA}× uma tela, continua APARELHO — encolhido, não fatiado em duas quase iguais`, () => {
    const noLimite = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * LIMITE_FATIA_UNICA) });
    const abaixoDoLimite = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * 1.1) });
    expect(noLimite.modo).toBe("aparelho");
    expect(abaixoDoLimite.modo).toBe("aparelho");

    const acimaDoLimite = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * 1.2) });
    expect(acimaDoLimite.modo).toBe("fatiado");
  });

  it("o aparelho e cada quadro do fatiado têm o MESMO raio — a mesma moldura de aparelho", () => {
    const aparelho = medidasCelular({ ...CELULAR, altura: UMA_TELA });
    const fatiado = medidasCelular({ ...CELULAR, altura: UMA_TELA * 2 });
    if (aparelho.modo !== "aparelho" || fatiado.modo !== "fatiado") throw new Error("modo inesperado");
    expect(fatiado.raio).toBe(aparelho.raio);
    expect(fatiado.borda).toBe(aparelho.borda);
  });

  it("sem a altura da tela, cai na proporção de aparelho de reserva", () => {
    const m = medidasCelular({
      tela: "celular",
      src: "./x.png",
      largura: 780,
      altura: Math.round(780 * PROPORCAO_APARELHO),
      alturaTela: undefined as unknown as number,
    });
    expect(m.modo).toBe("aparelho");
  });

  it("a barra do navegador entra na altura da composta de desktop", () => {
    const m = medidasDesktop(DESKTOP);
    expect(m.altura).toBe(DESKTOP.altura + m.barra + 2 * m.margem);
    expect(m.largura).toBe(DESKTOP.largura + 2 * m.margem);
  });

  it("borda e raio do fatiado saem da LARGURA, nunca da altura da seção", () => {
    const duasTelas = medidasCelular({ ...CELULAR, altura: UMA_TELA * 2 });
    const quatroTelas = medidasCelular({ ...CELULAR, altura: UMA_TELA * 4 });
    if (duasTelas.modo !== "fatiado" || quatroTelas.modo !== "fatiado") throw new Error("modo inesperado");
    expect(quatroTelas.borda).toBe(duasTelas.borda);
    expect(quatroTelas.raio).toBe(duasTelas.raio);
  });
});

/**
 * Uma seção só um pouco mais alta que uma tela (até `LIMITE_FATIA_UNICA`)
 * não vira duas fatias quase idênticas — encolhe pra caber num quadro só.
 */
describe("medidasMoldura — quadro único encolhido (seção um pouco mais alta que uma tela)", () => {
  it("escala menor que 1, e SEM cortar: a tela mostra a seção inteira, só menor", () => {
    const m = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * 1.1) });
    if (m.modo !== "aparelho") throw new Error("esperava aparelho");
    expect(m.escala).toBeLessThan(1);
    expect(m.escala).toBeCloseTo(UMA_TELA / Math.round(UMA_TELA * 1.1), 3);
  });

  it("sem folga: a imagem encolhida bate exatamente com a altura da tela, nem sobra nem falta", () => {
    const m = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * 1.1) });
    if (m.modo !== "aparelho") throw new Error("esperava aparelho");
    expect(m.folga).toBe(0);
  });

  it("quanto mais alta a seção (dentro do limite), menor a escala", () => {
    const poucoMaisAlta = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * 1.02) });
    const maisAlta = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * 1.14) });
    if (poucoMaisAlta.modo !== "aparelho" || maisAlta.modo !== "aparelho") throw new Error("modo inesperado");
    expect(maisAlta.escala).toBeLessThan(poucoMaisAlta.escala);
  });

  it("a tela do quadro continua do tamanho de UMA tela, como o aparelho normal", () => {
    const exato = medidasCelular({ ...CELULAR, altura: UMA_TELA });
    const encolhido = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * 1.1) });
    if (exato.modo !== "aparelho" || encolhido.modo !== "aparelho") throw new Error("modo inesperado");
    expect(encolhido.alturaVisivel).toBe(exato.alturaVisivel);
    expect(encolhido.largura).toBe(exato.largura);
    expect(encolhido.altura).toBe(exato.altura);
  });
});

describe("medidasMoldura — fatiado (seção mais alta que uma tela)", () => {
  it(`no máximo ${FATIAS_MAX} fatias, mesmo com a seção MUITO mais alta`, () => {
    const m = medidasCelular({ ...CELULAR, altura: UMA_TELA * 10 });
    if (m.modo !== "fatiado") throw new Error("esperava fatiado");
    expect(m.numFatias).toBe(FATIAS_MAX);
    // Passou do teto: só as primeiras telas saem, e o contrato precisa
    // dizer isso — é o que "mostra as 3 primeiras" significa.
    expect(m.cortada).toBe(true);
  });

  it("seção com 2,4 telas vira 3 fatias (arredonda pra cima) e não fica cortada", () => {
    const m = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * 2.4) });
    if (m.modo !== "fatiado") throw new Error("esperava fatiado");
    expect(m.numFatias).toBe(3);
    expect(m.cortada).toBe(false);
  });

  it("a composição final é DEITADA: mais larga que alta", () => {
    const m = medidasCelular({ ...CELULAR, altura: UMA_TELA * 3 });
    expect(m.largura).toBeGreaterThan(m.altura);
  });

  it("a largura cresce com o número de fatias — cada quadro é uma tela inteira lado a lado", () => {
    const duas = medidasCelular({ ...CELULAR, altura: UMA_TELA * 2 });
    const tres = medidasCelular({ ...CELULAR, altura: UMA_TELA * 3 });
    if (duas.modo !== "fatiado" || tres.modo !== "fatiado") throw new Error("modo inesperado");
    expect(tres.numFatias).toBe(3);
    expect(duas.numFatias).toBe(2);
    expect(tres.largura).toBeGreaterThan(duas.largura);
  });

  it("a altura do fatiado é sempre UMA tela — nunca cresce com a seção (é isso que faz caber lado a lado)", () => {
    const duas = medidasCelular({ ...CELULAR, altura: UMA_TELA * 2 });
    const dez = medidasCelular({ ...CELULAR, altura: UMA_TELA * 10 });
    expect(dez.altura).toBe(duas.altura);
  });
});

/**
 * O BUG: com as fatias posicionadas de `umaTela` em `umaTela` a partir do
 * topo, a ÚLTIMA só bate certinho com o fim do conteúdo quando a altura da
 * seção é múltiplo exato da tela — 2,4 telas ou 1,3 telas (que arredondam
 * pra 2 e 3 fatias) sobravam com uma faixa vazia no final da última janela.
 * `calcularToposFatias` (e o portão de `vazioNaFatia` dentro de
 * `medidasMoldura`, que teria lançado se a conta abaixo estivesse errada)
 * são o que garante que isso não acontece mais — para os dois casos citados
 * no relato do bug, 2 e 3 fatias.
 */
describe("calcularToposFatias / vazioNaFatia — nenhuma fatia termina em vazio", () => {
  it("2 fatias, seção NÃO múltipla da tela (o caso relatado): a última termina exatamente no fim", () => {
    const altura = UMA_TELA * 1.3; // ceil(1.3) = 2 fatias
    const topos = calcularToposFatias(2, altura, UMA_TELA, false);
    expect(topos[0]).toBe(0);
    // A fórmula antiga (`i * umaTela`) puria a 2ª fatia em `umaTela`, que
    // sobra 0,3 tela de vazio no final. A nova termina EXATAMENTE em `altura`.
    expect(topos[1] + UMA_TELA).toBeCloseTo(altura, 5);
    for (const topo of topos) expect(vazioNaFatia(topo, UMA_TELA, altura)).toBe(0);
  });

  it("3 fatias, seção NÃO múltipla da tela (o caso relatado): a última termina exatamente no fim", () => {
    const altura = UMA_TELA * 2.4; // ceil(2.4) = 3 fatias
    const topos = calcularToposFatias(3, altura, UMA_TELA, false);
    expect(topos[0]).toBe(0);
    expect(topos[topos.length - 1] + UMA_TELA).toBeCloseTo(altura, 5);
    for (const topo of topos) expect(vazioNaFatia(topo, UMA_TELA, altura)).toBe(0);
  });

  it("a sobreposição entre fatias fica distribuída por igual, não só na última", () => {
    const altura = UMA_TELA * 2.4;
    const topos = calcularToposFatias(3, altura, UMA_TELA, false);
    const passo1 = topos[1] - topos[0];
    const passo2 = topos[2] - topos[1];
    expect(passo1).toBeCloseTo(passo2, 5);
  });

  it("a fórmula antiga (i × umaTela) É o defeito: comparação direta prova a diferença", () => {
    const altura = UMA_TELA * 2.4;
    const topoAntigoDaUltima = 2 * UMA_TELA; // como o código calculava antes
    const topoNovoDaUltima = calcularToposFatias(3, altura, UMA_TELA, false)[2];
    expect(vazioNaFatia(topoAntigoDaUltima, UMA_TELA, altura)).toBeGreaterThan(0);
    expect(vazioNaFatia(topoNovoDaUltima, UMA_TELA, altura)).toBe(0);
  });

  it("seção EXATAMENTE múltipla da tela: as duas fórmulas coincidem (não havia bug aqui)", () => {
    const altura = UMA_TELA * 2;
    const topos = calcularToposFatias(2, altura, UMA_TELA, false);
    expect(topos).toEqual([0, UMA_TELA]);
  });

  it("truncada (mais telas do que o teto mostra): tiles cheios de umaTela em umaTela, sem sobreposição — não tem 'fim' a alcançar", () => {
    const altura = UMA_TELA * 10;
    const topos = calcularToposFatias(FATIAS_MAX, altura, UMA_TELA, true);
    expect(topos).toEqual([0, UMA_TELA, 2 * UMA_TELA]);
  });

  it("uma fatia só: começa no topo", () => {
    expect(calcularToposFatias(1, UMA_TELA * 1.1, UMA_TELA, false)).toEqual([0]);
  });

  it(
    "PORTÃO amplo: para toda combinação de altura (1,16 a 6 telas) e uma tolerância mínima, " +
      "medidasMoldura nunca produz fatia com área vazia (e nunca lança) — é a rede que pega regressão futura",
    () => {
      for (let razao = 1.16; razao <= 6; razao += 0.07) {
        const altura = Math.round(UMA_TELA * razao);
        const m = medidasCelular({ ...CELULAR, altura });
        if (m.modo !== "fatiado") throw new Error(`esperava fatiado em ${razao}× (altura=${altura})`);
        if (!m.cortada) {
          for (const topo of m.topos) {
            expect(vazioNaFatia(topo, m.umaTela, altura)).toBeLessThanOrEqual(1);
          }
        }
      }
    },
  );
});

describe("moldura de celular — aparelho (cabe numa tela)", () => {
  it("não exibe endereço nenhum — é aparelho, não navegador", () => {
    const html = htmlMoldura({ ...CELULAR, altura: UMA_TELA, endereco: "https://radar.exemplo.com/demo/abc" });
    expect(html).not.toContain("radar.exemplo.com");
    expect(html).not.toContain("/demo/abc");
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("não estampa relógio, ilha nem botão — a moldura é borda e canto, nada mais", () => {
    const moldura = soAMoldura(htmlMoldura({ ...CELULAR, altura: UMA_TELA }));
    expect(moldura).not.toMatch(/\d{1,2}:\d{2}/);
    // Sem gradiente no corpo: gradiente ali é brilho de fotografia de
    // produto, e o objetivo é ler como site num celular, não como retrato
    // de um aparelho.
    expect(moldura).not.toContain("gradient");
  });

  it("aponta para a captura crua pelo caminho relativo recebido", () => {
    const html = htmlMoldura({ ...CELULAR, altura: UMA_TELA, src: "./lead-01-hero-celular.png" });
    expect(html).toContain('src="./lead-01-hero-celular.png"');
  });

  it("um quadro só — nenhuma segunda tela aparece pra uma seção que cabe numa só", () => {
    const html = soAMoldura(htmlMoldura({ ...CELULAR, altura: UMA_TELA }));
    expect(html.match(/class="captura"/g)).toHaveLength(1);
  });
});

/**
 * FATIADO — seção mais alta que uma tela. O que a moldura de celular tinha
 * antes ("cartão", um corpo alongado sem chrome) não existe mais: agora é
 * uma fileira de quadros de aparelho, cada um mostrando uma tela da MESMA
 * captura (técnica de sprite-sheet — várias `<img class="captura">` com o
 * mesmo `src`, cada uma deslocada por `top`).
 */
describe("moldura de celular — fatiado (seção mais alta que uma tela)", () => {
  const ALTA = { ...CELULAR, altura: UMA_TELA * 2 };

  it("nunca vira um corpo de aparelho esticado ('cartão') — não existe mais", () => {
    const html = htmlMoldura(ALTA);
    // O cartão antigo não tinha chrome de aparelho nenhum; o fatiado usa a
    // MESMA sombra/moldura do aparelho em cada quadro.
    expect(html).toContain("box-shadow");
  });

  it("uma <img class=\"captura\"> por fatia — o mesmo src repetido, não a imagem cortada em arquivos", () => {
    const duasTelas = soAMoldura(htmlMoldura(ALTA));
    const imgs = [...duasTelas.matchAll(/<img class="captura" src="([^"]+)"/g)];
    expect(imgs).toHaveLength(2);
    expect(imgs.every(([, src]) => src === CELULAR.src)).toBe(true);
  });

  it(`seção com ${FATIAS_MAX + 2} telas mostra só ${FATIAS_MAX} quadros`, () => {
    const html = soAMoldura(htmlMoldura({ ...CELULAR, altura: UMA_TELA * (FATIAS_MAX + 2) }));
    expect(html.match(/class="captura"/g)).toHaveLength(FATIAS_MAX);
  });

  it("cada quadro desloca a imagem por uma tela a mais (seção múltipla exata da tela)", () => {
    const html = soAMoldura(htmlMoldura(ALTA));
    expect(html).toContain("top: 0px");
    expect(html).toContain(`top: -${UMA_TELA}px`);
  });

  it("2 fatias, seção NÃO múltipla da tela: a última janela termina no fim real do conteúdo, não em -1×umaTela", () => {
    const altura = Math.round(UMA_TELA * 1.3);
    const html = soAMoldura(htmlMoldura({ ...CELULAR, altura }));
    const tops = [...html.matchAll(/top: (-?\d+)px/g)].map(([, v]) => Number(v));
    expect(tops).toHaveLength(2);
    expect(tops[0]).toBe(0);
    // A fórmula antiga poria a 2ª fatia em -umaTela (sobrando 0,3 tela de
    // vazio); a nova termina exatamente no fim: topo + umaTela === altura.
    expect(-tops[1] + UMA_TELA).toBe(altura);
  });

  it("3 fatias, seção NÃO múltipla da tela: a última janela termina no fim real do conteúdo, não em -2×umaTela", () => {
    const altura = Math.round(UMA_TELA * 2.4);
    const html = soAMoldura(htmlMoldura({ ...CELULAR, altura }));
    const tops = [...html.matchAll(/top: (-?\d+)px/g)].map(([, v]) => Number(v));
    expect(tops).toHaveLength(3);
    expect(tops[0]).toBe(0);
    expect(-tops[2] + UMA_TELA).toBe(altura);
    // A fórmula antiga (2 × umaTela) deixaria 40% da última janela vazia.
    expect(-tops[2]).not.toBe(2 * UMA_TELA);
  });

  it("não exibe endereço nenhum, igual ao aparelho — continua sem chrome de navegador", () => {
    const html = htmlMoldura({ ...ALTA, endereco: "https://radar.exemplo.com/demo/abc" });
    expect(html).not.toContain("radar.exemplo.com");
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("os quadros ficam lado a lado (flex row), não empilhados", () => {
    const html = soAMoldura(htmlMoldura(ALTA));
    expect(html).toMatch(/display:\s*flex[^"]*gap/);
  });
});

describe("moldura de navegador", () => {
  it("exibe o endereço real da demo", () => {
    const html = htmlMoldura({ ...DESKTOP, endereco: "https://radar.exemplo.com/demo/ChIJ-abc" });
    expect(html).toContain("radar.exemplo.com");
    expect(html).toContain("/demo/ChIJ-abc");
  });

  it("sem endereço configurado, a pastilha sai vazia — nunca um domínio inventado", () => {
    const html = htmlMoldura(DESKTOP);
    expect(html).not.toMatch(/https?:\/\/[a-z]/i);
    // A pastilha continua desenhada: é a janela que fica sem endereço, não
    // o navegador que vira outra coisa.
    expect(html).toContain("border-radius");
  });

  it("endereço ilegível é tratado como ausente, não impresso cru", () => {
    const html = htmlMoldura({ ...DESKTOP, endereco: "isto não é uma url" });
    expect(html).not.toContain("isto não é uma url");
  });

  it("não deixa o endereço injetar marcação (ele carrega o id do lead)", () => {
    const html = htmlMoldura({
      ...DESKTOP,
      endereco: 'https://radar.exemplo.com/demo/a"><script>alert(1)</script>',
    });
    // Duas defesas em série: a `URL` normaliza o caminho para
    // percent-encoding e o `escapar` cuida do resto. Aqui a primeira já
    // resolve — o teste cobra o resultado, não o caminho.
    expect(html).not.toContain("<script>");
    expect(html).toContain("%3Cscript%3E");
  });

  it("escapa o caminho relativo da captura antes de virar atributo", () => {
    const html = htmlMoldura({ ...DESKTOP, src: './x.png" onerror="alert(1)' });
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain("&quot;");
  });
});

describe("enderecoExibido", () => {
  it("separa esquema, host e caminho como um navegador mostra", () => {
    expect(enderecoExibido("https://radar.exemplo.com/demo/abc?x=1")).toEqual({
      antes: "",
      host: "radar.exemplo.com",
      depois: "/demo/abc?x=1",
    });
  });

  it("mantém http:// visível — esconder o esquema inseguro seria mentir sobre ele", () => {
    expect(enderecoExibido("http://exemplo.com/demo/a")?.antes).toBe("http://");
  });

  it("vazio, indefinido e lixo devolvem null", () => {
    expect(enderecoExibido("")).toBeNull();
    expect(enderecoExibido(undefined)).toBeNull();
    expect(enderecoExibido("nada disso")).toBeNull();
  });
});

describe("luminancia / fundoClaro", () => {
  it("lê hex curto, hex longo e rgb() — que é como o computed style devolve", () => {
    expect(luminancia("#fff")).toBeCloseTo(1, 3);
    expect(luminancia("#000000")).toBeCloseTo(0, 3);
    expect(luminancia("rgb(255, 255, 255)")).toBeCloseTo(1, 3);
    expect(luminancia("rgba(0, 0, 0, 0.5)")).toBeCloseTo(0, 3);
  });

  it("cor que não dá pra ler devolve null, em vez de um preto silencioso", () => {
    expect(luminancia("var(--d-bg)")).toBeNull();
    expect(luminancia(undefined as unknown as string)).toBeNull();
  });

  it("decide o cromo pela paleta da demo, e cai no escuro quando não sabe", () => {
    expect(fundoClaro({ fundo: "#faf7f2", fundoAlt: "#ffffff" })).toBe(true);
    expect(fundoClaro({ fundo: "#0b0b0c", fundoAlt: "#121214" })).toBe(false);
    expect(fundoClaro(undefined)).toBe(false);
  });
});
