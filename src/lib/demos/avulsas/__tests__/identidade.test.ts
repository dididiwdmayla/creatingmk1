import { describe, expect, it } from "vitest";

import { montarPatch } from "@/lib/demos/patch";
import { SKINS, getSkin } from "@/lib/demos/registry";
import type { DemoDataPatch } from "@/lib/demos/types";

import {
  CAMPOS_IDENTIDADE_AVULSA,
  baseDemoDataAvulsa,
  identidadeEmBranco,
  montarDemoDataAvulsa,
  nomeDaAvulsa,
  patchIdentidadeAvulsa,
} from "../identidade";
import type { IdentidadeAvulsa } from "../types";

const skin = getSkin("barbearia-editorial")!;

function montar(identidade: IdentidadeAvulsa, extra?: DemoDataPatch) {
  return montarDemoDataAvulsa(
    skin.demoDataExemplo,
    { ...extra, ...patchIdentidadeAvulsa(identidade) },
    skin.id,
  );
}

describe("identidade da demo avulsa", () => {
  it("usa o nome digitado e quebra o título hero em duas linhas", () => {
    const dados = montar({ nome: "Barbearia Norte do Vale" });
    expect(dados.nome).toBe("Barbearia Norte do Vale");
    expect(dados.secoes.hero.titulo).toBe("Barbearia Norte\ndo Vale");
  });

  it("mostra cada campo de identidade que foi digitado", () => {
    const dados = montar({
      nome: "Zé Barbearia",
      cidade: "Maringá - PR",
      endereco: "Av. Brasil, 2785",
      telefone: "(44) 3222-1111",
      whatsapp: "+55 44 99999-0000",
      horarios: "Seg a sáb, 9h às 19h",
      instagram: "@zebarbearia",
    });
    expect(dados.cidade).toBe("Maringá - PR");
    expect(dados.endereco).toBe("Av. Brasil, 2785");
    expect(dados.telefone).toBe("(44) 3222-1111");
    expect(dados.whatsapp).toBe("+55 44 99999-0000");
    expect(dados.horarios).toBe("Seg a sáb, 9h às 19h");
    expect(dados.instagram).toBe("@zebarbearia");
  });

  it("campo de identidade deixado vazio some da página — nunca cai no texto do template", () => {
    const dados = montar({ nome: "Só o nome" });
    for (const campo of CAMPOS_IDENTIDADE_AVULSA) {
      expect(dados[campo], `${campo} deveria sumir`).toBe("");
    }
  });

  it("espaço em branco conta como vazio", () => {
    const dados = montar({ nome: "Só o nome", telefone: "   ", instagram: "\t" });
    expect(dados.telefone).toBe("");
    expect(dados.instagram).toBe("");
  });

  it("nenhuma skin do registro vaza identidade de exemplo numa avulsa em branco", () => {
    // O endereço é o caso real: TODO exemplo.ts tem um ("Av. Principal,
    // 100 — Centro"), e sem a camada em branco ele iria publicado.
    for (const s of SKINS) {
      const dados = montarDemoDataAvulsa(
        s.demoDataExemplo,
        patchIdentidadeAvulsa({ nome: "Negócio X" }),
        s.id,
      );
      for (const campo of CAMPOS_IDENTIDADE_AVULSA) {
        expect(dados[campo], `${s.id}.${campo}`).toBe("");
      }
    }
  });

  it("mantém o conteúdo de marketing do template (slogan, seções, serviços)", () => {
    const dados = montar({ nome: "Negócio X" });
    expect(dados.slogan).toBe(skin.demoDataExemplo.slogan);
    expect(dados.servicos).toEqual(skin.demoDataExemplo.servicos);
  });

  it("preserva overrides do diálogo (modo de imagem) junto da identidade", () => {
    const dados = montar({ nome: "Negócio X" }, { imagensModo: "grafico" });
    expect(dados.imagensModo).toBe("grafico");
  });
});

describe("ida e volta pelo editor", () => {
  // O editor edita o DemoData EFETIVO e salva o diff contra a base. Se a
  // base não for a mesma montagem da leitura, um campo vazio volta a cair
  // no template no save seguinte.
  it("salvar sem mexer em nada preserva os campos vazios", () => {
    const identidade: IdentidadeAvulsa = { nome: "Zé", telefone: "(44) 3222-1111" };
    const base = baseDemoDataAvulsa(skin.demoDataExemplo, skin.id);
    const efetivo = montar(identidade);

    const patch = montarPatch(base, efetivo, skin);
    const relido = montarDemoDataAvulsa(skin.demoDataExemplo, patch, skin.id);

    expect(relido.telefone).toBe("(44) 3222-1111");
    expect(relido.endereco).toBe("");
    expect(relido.instagram).toBe("");
    expect(relido.nome).toBe("Zé");
  });

  it("limpar um campo no editor mantém ele fora da página", () => {
    const base = baseDemoDataAvulsa(skin.demoDataExemplo, skin.id);
    const efetivo = { ...montar({ nome: "Zé", instagram: "@errado" }), instagram: "" };

    const patch = montarPatch(base, efetivo, skin);
    expect(montarDemoDataAvulsa(skin.demoDataExemplo, patch, skin.id).instagram).toBe("");
  });

  it("não grava patch pra dizer o que a base já diz", () => {
    const base = baseDemoDataAvulsa(skin.demoDataExemplo, skin.id);
    const patch = montarPatch(base, montar({ nome: "Zé" }), skin);
    for (const campo of CAMPOS_IDENTIDADE_AVULSA) {
      expect(patch[campo]).toBeUndefined();
    }
  });
});

describe("identidadeEmBranco", () => {
  it("zera exatamente os campos de identidade, e nenhum outro", () => {
    expect(Object.keys(identidadeEmBranco()).sort()).toEqual([...CAMPOS_IDENTIDADE_AVULSA].sort());
    expect(Object.values(identidadeEmBranco()).every((v) => v === "")).toBe(true);
  });
});

describe("nomeDaAvulsa", () => {
  it("lê o nome digitado", () => {
    expect(nomeDaAvulsa({ demo: { dados: { nome: "Zé" } } as never })).toBe("Zé");
  });

  it("cai num rótulo neutro quando não há nome", () => {
    expect(nomeDaAvulsa({ demo: { dados: {} } as never })).toBe("Demo sem nome");
  });
});
