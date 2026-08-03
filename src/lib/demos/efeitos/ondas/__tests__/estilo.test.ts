import { describe, expect, it } from "vitest";

import {
  ATAQUE,
  CAMADAS,
  OPACIDADE_MAXIMA,
  PONTOS_DO_ANEL,
  alfaRelativo,
  aneisOndas,
  espessuraRelativa,
  fatorEspessura,
  fatorRaio,
  opacidadeOndas,
  progressoAnel,
} from "../estilo";

const INTENSIDADES = [1, 2, 3] as const;

describe("ondas — opacidade", () => {
  it("respeita o teto de 6% em toda intensidade", () => {
    for (const i of INTENSIDADES) {
      expect(opacidadeOndas(i)).toBeLessThanOrEqual(OPACIDADE_MAXIMA);
      expect(opacidadeOndas(i)).toBeGreaterThan(0);
    }
    expect(opacidadeOndas(3)).toBe(OPACIDADE_MAXIMA);
  });

  it("cresce com a intensidade", () => {
    expect(opacidadeOndas(1)).toBeLessThan(opacidadeOndas(2));
    expect(opacidadeOndas(2)).toBeLessThan(opacidadeOndas(3));
  });

  it("a soma das camadas da seção nunca estoura o teto real", () => {
    // Composição source-over das 4 camadas no ponto mais aceso do anel.
    const composto = CAMADAS.reduce((acc, c) => acc + (1 - acc) * c.alfa, 0);
    const pico = Math.max(...amostras(400).map(alfaRelativo));
    expect(composto * pico * opacidadeOndas(3)).toBeLessThanOrEqual(OPACIDADE_MAXIMA);
  });

  it("a camada mais externa é fraca demais pra ler como contorno", () => {
    const externa = CAMADAS[0];
    expect(externa.largura).toBe(Math.max(...CAMADAS.map((c) => c.largura)));
    // 0,13 × 6% = 0,78% de opacidade real na aresta da banda.
    expect(externa.alfa * opacidadeOndas(3)).toBeLessThan(0.01);
  });

  it("nenhuma camada acrescenta um degrau que leia como borda dura", () => {
    // Composição source-over, camada a camada: o INCREMENTO de cada uma é
    // o degrau de alfa que aparece na aresta dela. Uma tabela desbalanceada
    // (0,1 / 0,2 / 0,3 / 0,8) concentra 42% de salto na camada de dentro —
    // borda dura no meio da fita. Todos os degraus têm que ser pequenos e
    // parecidos entre si.
    let composto = 0;
    const degraus: number[] = [];
    for (const camada of CAMADAS) {
      const antes = composto;
      composto += (1 - composto) * camada.alfa;
      degraus.push(composto - antes);
    }
    const maior = Math.max(...degraus);
    // Na tela: degrau × teto de 6% ≈ 0,8% de opacidade, ~1 nível de 255.
    expect(maior * opacidadeOndas(3)).toBeLessThan(0.01);
    // E parecidos entre si: nenhum degrau é o dobro do menor.
    expect(maior / Math.min(...degraus)).toBeLessThan(1.5);
  });

  it("as larguras caem em sino, não em rampa reta", () => {
    // Espaçamento LINEAR entre as larguras = perfil triangular, que tem
    // quina nas duas pontas — e o olho lê quina como contorno. O sino
    // `(1−u²)²` tem inclinação zero nos dois extremos, então as camadas
    // ficam ESPAÇADAS nas pontas e apertadas no meio: os intervalos formam
    // um vale. É o que distingue "sino" de "rampa reta" sem depender dos
    // números exatos.
    const intervalos = CAMADAS.slice(1).map((c, i) => CAMADAS[i].largura - c.largura);
    const menor = Math.min(...intervalos);
    const meio = intervalos.indexOf(menor);
    expect(meio).toBeGreaterThan(0);
    expect(meio).toBeLessThan(intervalos.length - 1);
    expect(intervalos[0]).toBeGreaterThan(menor);
    expect(intervalos[intervalos.length - 1]).toBeGreaterThan(menor);
  });
});

describe("ondas — as duas rampas do percurso", () => {
  it("a opacidade nasce em zero, sobe pela rampa de ataque e some na borda", () => {
    expect(alfaRelativo(0)).toBe(0);
    expect(alfaRelativo(ATAQUE / 2)).toBeGreaterThan(0);
    expect(alfaRelativo(ATAQUE / 2)).toBeLessThan(alfaRelativo(ATAQUE));
    expect(alfaRelativo(1)).toBe(0);
  });

  it("a opacidade decai monotonicamente depois do ataque", () => {
    let anterior = alfaRelativo(ATAQUE);
    for (const p of amostras(200).filter((p) => p > ATAQUE)) {
      const atual = alfaRelativo(p);
      expect(atual).toBeLessThanOrEqual(anterior + 1e-9);
      anterior = atual;
    }
  });

  it("a espessura decai monotonicamente do centro até a borda", () => {
    let anterior = espessuraRelativa(0);
    for (const p of amostras(200).slice(1)) {
      const atual = espessuraRelativa(p);
      expect(atual).toBeLessThan(anterior);
      anterior = atual;
    }
    // O anel chega na borda BEM mais fino do que nasceu, mas nunca em zero
    // (espessura zero seria um anel que some antes de terminar o percurso).
    expect(espessuraRelativa(1)).toBeGreaterThan(0);
    expect(espessuraRelativa(1)).toBeLessThan(espessuraRelativa(0) / 5);
  });
});

describe("ondas — disparo escalonado e irregular", () => {
  it("nenhum par de anéis compartilha período ou fase", () => {
    const aneis = aneisOndas(3);
    for (let i = 0; i < aneis.length; i++) {
      for (let j = i + 1; j < aneis.length; j++) {
        expect(Math.abs(aneis[i].periodoSegundos - aneis[j].periodoSegundos)).toBeGreaterThan(0.1);
        expect(Math.abs(aneis[i].fase - aneis[j].fase)).toBeGreaterThan(0.01);
      }
    }
  });

  it("os intervalos entre disparos são irregulares, não uma cadência fixa", () => {
    // Instantes de nascimento (progresso passando por 0) dos 7 anéis nos
    // primeiros 30s: os intervalos entre eles não podem ser todos iguais.
    const aneis = aneisOndas(3);
    const nascimentos: number[] = [];
    for (const anel of aneis) {
      for (let n = 0; n < 4; n++) {
        const t = (n + 1 - anel.fase) * anel.periodoSegundos;
        if (t > 0 && t < 30) nascimentos.push(t);
      }
    }
    nascimentos.sort((a, b) => a - b);
    const intervalos = nascimentos.slice(1).map((t, i) => t - nascimentos[i]);
    expect(intervalos.length).toBeGreaterThan(4);
    const menor = Math.min(...intervalos);
    const maior = Math.max(...intervalos);
    expect(maior / Math.max(menor, 1e-3)).toBeGreaterThan(2);
  });

  it("o progresso é determinístico e cíclico", () => {
    const anel = aneisOndas(2)[0];
    expect(progressoAnel(anel, 0)).toBeCloseTo(anel.fase, 10);
    expect(progressoAnel(anel, anel.periodoSegundos)).toBeCloseTo(anel.fase, 10);
    for (const t of [0, 1.7, 9.3, 40]) {
      const p = progressoAnel(anel, t);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });

  it("os anéis são estáveis entre chamadas (mesmo campo a cada montagem)", () => {
    expect(aneisOndas(3)).toEqual(aneisOndas(3));
    // Subir a intensidade acrescenta anéis sem embaralhar os que já existiam.
    expect(aneisOndas(3).slice(0, 3)).toEqual(aneisOndas(1));
  });
});

describe("ondas — nenhum anel lê como círculo perfeito", () => {
  it("na intensidade 3, todo anel tem raio ondulado ao longo da volta", () => {
    for (const anel of aneisOndas(3)) {
      for (const t of [0, 3.5, 11.2]) {
        const fatores = anguloAmostras().map((ang) => fatorRaio(anel, ang, t));
        const maior = Math.max(...fatores);
        const menor = Math.min(...fatores);
        // Pelo menos 5% de variação de raio na volta — bem acima do que o
        // olho precisa pra parar de ler "circunferência".
        expect(maior - menor).toBeGreaterThan(0.05);
      }
    }
  });

  it("a espessura também varia ao longo da volta, em todo anel", () => {
    for (const anel of aneisOndas(3)) {
      const fatores = anguloAmostras().map((ang) => fatorEspessura(anel, ang));
      expect(Math.min(...fatores)).toBeLessThan(0.6);
      expect(Math.max(...fatores)).toBeGreaterThan(0.9);
    }
  });

  it("as ondulações giram com o tempo (dois instantes nunca dão a mesma forma)", () => {
    for (const anel of aneisOndas(3)) {
      const agora = anguloAmostras().map((ang) => fatorRaio(anel, ang, 0));
      const depois = anguloAmostras().map((ang) => fatorRaio(anel, ang, 6));
      const maiorDiferenca = Math.max(...agora.map((f, i) => Math.abs(f - depois[i])));
      expect(maiorDiferenca).toBeGreaterThan(0.002);
    }
  });

  it("dois anéis quaisquer têm ondulações diferentes", () => {
    const aneis = aneisOndas(3);
    for (let i = 0; i < aneis.length; i++) {
      for (let j = i + 1; j < aneis.length; j++) {
        const a = anguloAmostras().map((ang) => fatorRaio(aneis[i], ang, 2));
        const b = anguloAmostras().map((ang) => fatorRaio(aneis[j], ang, 2));
        expect(Math.max(...a.map((f, k) => Math.abs(f - b[k])))).toBeGreaterThan(0.01);
      }
    }
  });
});

function amostras(n: number): number[] {
  return Array.from({ length: n + 1 }, (_, i) => i / n);
}

function anguloAmostras(): number[] {
  return Array.from({ length: PONTOS_DO_ANEL }, (_, k) => (k / PONTOS_DO_ANEL) * Math.PI * 2);
}
