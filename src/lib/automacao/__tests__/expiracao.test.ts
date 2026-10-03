import { describe, expect, it } from "vitest";

import type { LeadDemo } from "@/lib/demos/types";
import type { Lead } from "@/lib/leads/types";
import {
  EXPIRACAO_PADRAO_HORAS,
  midiaDoOperador,
  motivoNaoExpira,
  origemAutomaticaComprovada,
  protecaoDaDemo,
  tokenConsumido,
  vencimentoDaDemo,
  type SinaisFila,
} from "../expiracao";

/** Relógio congelado: a varredura das 06:30 UTC. */
const AGORA = new Date("2026-10-03T06:30:00.000Z");
const HORA = 3_600_000;

function horasAtras(h: number): string {
  return new Date(AGORA.getTime() - h * HORA).toISOString();
}

const SEM_FILA: SinaisFila = { temDocFila: false, temCiclo: false };
const PRAZO = { now: AGORA, prazoHoras: EXPIRACAO_PADRAO_HORAS };

/** A demo como a unidade "demo" da automação a grava no primeiro save. */
function demoAuto(overrides: Partial<LeadDemo> = {}): LeadDemo {
  return {
    skinId: "barbearia-editorial",
    themeId: "creme",
    dados: {},
    criadoEm: horasAtras(80),
    criadoPor: "automacao",
    atualizadoEm: horasAtras(80),
    origem: "automacao",
    aprovacao: "pendente",
    execucaoAutomacao: "exec-1",
    envios: [
      { token: "t-link", geradoEm: horasAtras(80), canal: "link" },
      { token: "t-wa", geradoEm: horasAtras(80), canal: "whatsapp" },
    ],
    ...overrides,
  };
}

/** Lead novo, sem rastro nenhum, com demo automática de 80h. */
function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: "ChIJ-auto",
    nome: "Barbearia Norte",
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    demo: demoAuto(),
    criadoEm: horasAtras(100),
    atualizadoEm: horasAtras(80),
    ...overrides,
  } as Lead;
}

describe("motivoNaoExpira — o prazo", () => {
  it("demo automática não enviada, passado o prazo, pode ser apagada", () => {
    expect(motivoNaoExpira(lead(), SEM_FILA, PRAZO)).toBeUndefined();
  });

  it("antes do prazo, não", () => {
    const novo = lead({ demo: demoAuto({ criadoEm: horasAtras(71) }) });
    expect(motivoNaoExpira(novo, SEM_FILA, PRAZO)).toBe("dentroDoPrazo");
  });

  it("vence EXATAMENTE em criadoEm + prazo (a primeira varredura depois do prazo)", () => {
    const justo = lead({ demo: demoAuto({ criadoEm: horasAtras(72) }) });
    expect(motivoNaoExpira(justo, SEM_FILA, PRAZO)).toBeUndefined();
    const umMinutoAntes = lead({
      demo: demoAuto({ criadoEm: new Date(AGORA.getTime() - 72 * HORA + 60_000).toISOString() }),
    });
    expect(motivoNaoExpira(umMinutoAntes, SEM_FILA, PRAZO)).toBe("dentroDoPrazo");
  });

  it("o prazo é o configurado, não o padrão", () => {
    expect(motivoNaoExpira(lead(), SEM_FILA, { now: AGORA, prazoHoras: 96 })).toBe("dentroDoPrazo");
    expect(motivoNaoExpira(lead(), SEM_FILA, { now: AGORA, prazoHoras: 24 })).toBeUndefined();
  });

  it("vencimentoDaDemo é criadoEm + prazo; data inválida nunca vence", () => {
    expect(vencimentoDaDemo(demoAuto({ criadoEm: "2026-10-01T00:00:00.000Z" }), 72)).toBe(
      Date.parse("2026-10-04T00:00:00.000Z"),
    );
    expect(vencimentoDaDemo(demoAuto({ criadoEm: "x" }), 72)).toBeUndefined();
    expect(vencimentoDaDemo(undefined, 72)).toBeUndefined();
  });

  it("criadoEm inválido protege: sem data não há como provar a idade", () => {
    expect(motivoNaoExpira(lead({ demo: demoAuto({ criadoEm: "x" }) }), SEM_FILA, PRAZO)).toBe(
      "criadoEmInvalido",
    );
  });
});

describe("demo manual ou sem origem comprovada — NUNCA é apagada", () => {
  const casos: Array<[string, Partial<LeadDemo>]> = [
    ["sem origem (demo de antes da automação)", { origem: undefined }],
    ["origem manual", { origem: "manual" }],
    ["automática sem criadoPor", { criadoPor: undefined }],
    ["automática com criadoPor humano", { criadoPor: "admin" }],
    ["automática sem execucaoAutomacao", { execucaoAutomacao: undefined }],
    ["automática com execucaoAutomacao vazia", { execucaoAutomacao: "" }],
  ];
  for (const [nome, overrides] of casos) {
    it(nome, () => {
      const l = lead({ demo: demoAuto({ ...overrides, criadoEm: horasAtras(24 * 365) }) });
      expect(origemAutomaticaComprovada(l.demo!)).toBe(false);
      expect(motivoNaoExpira(l, SEM_FILA, PRAZO)).toBe("origemNaoComprovada");
    });
  }

  it("as três marcas juntas são a prova", () => {
    expect(origemAutomaticaComprovada(demoAuto())).toBe(true);
  });
});

describe("demo enviada — cada critério protege SOZINHO", () => {
  const casos: Array<[string, Partial<Lead>, SinaisFila, string]> = [
    ["status contactado", { status: "contactado" }, SEM_FILA, "status"],
    ["status respondeu", { status: "respondeu" }, SEM_FILA, "status"],
    ["status fechado", { status: "fechado" }, SEM_FILA, "status"],
    ["selo de contato", { seloContato: { userId: "admin", em: horasAtras(10) } }, SEM_FILA, "contato"],
    [
      "registro de envio",
      { registrosEnvio: [{ em: horasAtras(10), horaLocalLead: "10:00", diaSemanaLocalLead: 3 }] },
      SEM_FILA,
      "contato",
    ],
    ["primeiroContatoEm", { contato: { primeiroContatoEm: horasAtras(10) } }, SEM_FILA, "contato"],
    [
      "visita externa",
      { demoVisitas: [{ id: "v1", em: horasAtras(10), interna: false, canal: "link" }] },
      SEM_FILA,
      "visita",
    ],
    [
      "visita INTERNA também",
      { demoVisitas: [{ id: "v1", em: horasAtras(10), interna: true }] },
      SEM_FILA,
      "visita",
    ],
    [
      "token consumido (o canal link rotacionou)",
      {
        demo: demoAuto({
          envios: [
            { token: "t-link-2", geradoEm: horasAtras(10), canal: "link" },
            { token: "t-link", geradoEm: horasAtras(80), canal: "link" },
            { token: "t-wa", geradoEm: horasAtras(80), canal: "whatsapp" },
          ],
        }),
      },
      SEM_FILA,
      "tokenConsumido",
    ],
    ["doc em filaEnvios (qualquer reserva)", {}, { temDocFila: true, temCiclo: false }, "filaEnvios"],
    ["ciclo em filaEnvios/{id}/ciclos", {}, { temDocFila: false, temCiclo: true }, "ciclo"],
  ];
  for (const [nome, overrides, sinais, motivo] of casos) {
    it(nome, () => {
      expect(motivoNaoExpira(lead(overrides), sinais, PRAZO)).toBe(motivo);
    });
  }

  it("uma demo com um ano de idade continua protegida pelo rastro", () => {
    const velha = lead({ status: "contactado", demo: demoAuto({ criadoEm: horasAtras(24 * 365) }) });
    expect(motivoNaoExpira(velha, SEM_FILA, PRAZO)).toBe("status");
  });
});

describe("tokenConsumido — ter token não é sinal de nada", () => {
  it("um token por canal (como toda demo nasce) não é consumo", () => {
    expect(tokenConsumido(demoAuto())).toBe(false);
  });

  it("sem envios nenhum também não", () => {
    expect(tokenConsumido(demoAuto({ envios: undefined }))).toBe(false);
  });

  it("entrada antiga sem canal conta como whatsapp — duas delas são consumo", () => {
    const envios = [
      { token: "a", geradoEm: horasAtras(5) },
      { token: "b", geradoEm: horasAtras(80) },
      { token: "c", geradoEm: horasAtras(80), canal: "link" },
    ] as LeadDemo["envios"];
    expect(tokenConsumido(demoAuto({ envios }))).toBe(true);
  });
});

describe("mão humana — protege", () => {
  it("lead marcado para a fila pelo operador", () => {
    expect(motivoNaoExpira(lead({ filaManual: true }), SEM_FILA, PRAZO)).toBe("filaManual");
  });

  it("foto subida pelo operador (URL do Storage no prefixo do lead)", () => {
    const l = lead({
      demo: demoAuto({
        dados: { imagens: { hero: "https://storage.googleapis.com/b/demos/ChIJ-auto/hero-1.webp" } },
      }),
    });
    expect(midiaDoOperador(l)).toBe(true);
    expect(motivoNaoExpira(l, SEM_FILA, PRAZO)).toBe("midiaDoOperador");
  });

  it("vídeo subido pelo operador", () => {
    const l = lead({
      demo: demoAuto({ dados: { videos: { titulo: "https://storage.googleapis.com/b/demos/ChIJ-auto/video-1.mp4" } } }),
    });
    expect(motivoNaoExpira(l, SEM_FILA, PRAZO)).toBe("midiaDoOperador");
  });

  it("qualquer URL absoluta conta — a automação nunca produz uma", () => {
    const l = lead({ demo: demoAuto({ dados: { imagens: { hero: "https://exemplo.com/foto.jpg" } } }) });
    expect(motivoNaoExpira(l, SEM_FILA, PRAZO)).toBe("midiaDoOperador");
  });

  it("a foto de variante que o texto por IA grava (caminho relativo) NÃO é mídia do operador", () => {
    const l = lead({
      demo: demoAuto({ dados: { imagens: { hero: "/demos/barbearia/foto/hero-noir.webp" } } }),
    });
    expect(midiaDoOperador(l)).toBe(false);
    expect(motivoNaoExpira(l, SEM_FILA, PRAZO)).toBeUndefined();
  });
});

describe("captura em andamento", () => {
  it("viva protege — o workflow subiria arquivo depois da exclusão", () => {
    const l = lead({ capturas: { estado: "rodando", execucaoId: "c1", pedidoEm: horasAtras(0.2), iniciadoEm: horasAtras(0.1) } });
    expect(motivoNaoExpira(l, SEM_FILA, PRAZO)).toBe("capturaEmAndamento");
    const fila = lead({ capturas: { estado: "enfileirado", execucaoId: "c1", pedidoEm: horasAtras(0.05) } });
    expect(motivoNaoExpira(fila, SEM_FILA, PRAZO)).toBe("capturaEmAndamento");
  });

  it("parada há dias (passou do limite de silêncio) não protege: ninguém vai subir mais nada", () => {
    const l = lead({ capturas: { estado: "rodando", execucaoId: "c1", pedidoEm: horasAtras(79), iniciadoEm: horasAtras(79) } });
    expect(motivoNaoExpira(l, SEM_FILA, PRAZO)).toBeUndefined();
  });

  it("pronta ou falhou não protege", () => {
    const pronta = lead({ capturas: { estado: "pronto", execucaoId: "c1", pedidoEm: horasAtras(79), imagens: [] } });
    expect(motivoNaoExpira(pronta, SEM_FILA, PRAZO)).toBeUndefined();
    const falhou = lead({ capturas: { estado: "falhou", execucaoId: "c1", pedidoEm: horasAtras(79), erro: "x" } });
    expect(motivoNaoExpira(falhou, SEM_FILA, PRAZO)).toBeUndefined();
  });
});

describe("o resto", () => {
  it("lead sem demo", () => {
    expect(protecaoDaDemo(lead({ demo: undefined }), SEM_FILA, AGORA)).toBe("semDemo");
  });

  it("o lead fixo de teste nunca perde a demo", () => {
    expect(motivoNaoExpira(lead({ leadDeTeste: true }), SEM_FILA, PRAZO)).toBe("leadDeTeste");
  });

  it("aprovação não protege: aprovada e não enviada vence igual", () => {
    const aprovada = lead({ demo: demoAuto({ aprovacao: "aprovada", aprovacaoEm: horasAtras(2) }) });
    expect(motivoNaoExpira(aprovada, SEM_FILA, PRAZO)).toBeUndefined();
  });

  it("reprovada e não enviada vence igual — já está fora da automação", () => {
    const reprovada = lead({
      demo: demoAuto({ aprovacao: "reprovada" }),
      automacaoReprovada: { em: horasAtras(70), por: "admin" },
    });
    expect(motivoNaoExpira(reprovada, SEM_FILA, PRAZO)).toBeUndefined();
  });

  it("descartado ou com número sem WhatsApp marcado à mão não protege", () => {
    expect(motivoNaoExpira(lead({ descartado: true }), SEM_FILA, PRAZO)).toBeUndefined();
    expect(motivoNaoExpira(lead({ telefoneInvalido: true }), SEM_FILA, PRAZO)).toBeUndefined();
  });

  it("ciclo não lido (pool) não protege nem desprotege — vale o doc principal", () => {
    expect(motivoNaoExpira(lead(), { temDocFila: false }, PRAZO)).toBeUndefined();
    expect(motivoNaoExpira(lead(), { temDocFila: true }, PRAZO)).toBe("filaEnvios");
  });
});
