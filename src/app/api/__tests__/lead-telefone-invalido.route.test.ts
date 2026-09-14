import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TENTATIVAS_MAX } from "@/lib/fila/estado";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import type { Lead } from "@/lib/leads/types";
import { GET, PATCH } from "../leads/[id]/route";

/**
 * `telefoneInvalido` é escrito por dois caminhos que não se falam: a fila
 * (ao receber `invalido` do celular) e a ficha, à mão. O que estes testes
 * protegem é a REVERSIBILIDADE — marcar errado não pode condenar o lead — e
 * o estado da fila chegar à ficha, que é o único lugar onde um lead parado
 * consegue aparecer.
 */

let db: FakeFirestore;
let cookie: string;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const params = { params: Promise.resolve({ id: "ChIJa" }) };

function patch(body: unknown, comCookie = cookie) {
  return PATCH(
    new Request("http://localhost/api/leads/ChIJa", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: comCookie },
      body: JSON.stringify(body),
    }),
    params,
  );
}

beforeEach(async () => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
  db.seed("leads/ChIJa", {
    placeId: "ChIJa",
    nome: "Ink House",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PATCH /api/leads/[id] — telefoneInvalido", () => {
  it("marca o número como sem WhatsApp", async () => {
    const res = await patch({ telefoneInvalido: true });

    expect(res.status).toBe(200);
    expect((await res.json()).lead.telefoneInvalido).toBe(true);
  });

  it("DESMARCA — quem marcou errado precisa poder voltar atrás", async () => {
    await patch({ telefoneInvalido: true });

    const res = await patch({ telefoneInvalido: false });

    expect((await res.json()).lead.telefoneInvalido).toBe(false);
  });

  it("não é booleano → 400", async () => {
    const res = await patch({ telefoneInvalido: "sim" });

    expect(res.status).toBe(400);
    expect((await res.json()).error.problemas).toContain("telefoneInvalido deve ser booleano");
  });

  it("sozinho no corpo já é um patch válido", async () => {
    expect((await patch({ telefoneInvalido: true })).status).toBe(200);
  });

  // Sem teste de sessão aqui de propósito: quem barra anônimo nos extras é o
  // PROXY (Edge, ver "Proteção por sessão multiusuário"), não a rota — que só
  // chama `usuarioDaRequest` quando a ação precisa de autor (status,
  // vendidoPor). `telefoneInvalido` segue exatamente o mesmo caminho de
  // `descartado`/`favorito`, e inventar uma checagem própria aqui é que
  // divergiria.

  it("não atrapalha os outros extras do mesmo patch", async () => {
    const res = await patch({ telefoneInvalido: true, notas: "ligar depois", favorito: true });
    const { lead } = (await res.json()) as { lead: Lead };

    expect(lead).toMatchObject({ telefoneInvalido: true, notas: "ligar depois", favorito: true });
  });
});

describe("GET /api/leads/[id] — o estado na fila de envio", () => {
  it("lead que nunca passou pela fila não traz filaEnvio", async () => {
    const corpo = await (await GET(new Request("http://localhost"), params)).json();

    expect(corpo.filaEnvio).toBeUndefined();
    expect(corpo.lead.placeId).toBe("ChIJa");
  });

  it("lead PARADO chega à ficha com tentativas e último erro", async () => {
    db.seed("filaEnvios/ChIJa", {
      leadId: "ChIJa",
      estado: "falhou",
      claimId: "c1",
      reservadoEm: "2026-03-10T10:00:00.000Z",
      expiraEm: "2026-03-10T10:05:00.000Z",
      dispositivo: "android",
      tentativas: TENTATIVAS_MAX,
      ultimoErro: "whatsapp travou",
      enviadoEm: null,
    });

    const corpo = await (await GET(new Request("http://localhost"), params)).json();

    expect(corpo.filaEnvio).toMatchObject({
      estado: "falhou",
      tentativas: TENTATIVAS_MAX,
      ultimoErro: "whatsapp travou",
    });
  });
});
