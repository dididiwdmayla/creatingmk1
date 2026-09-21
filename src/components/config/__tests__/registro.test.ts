import { describe, expect, it } from "vitest";

import { PAINEIS_CONFIG as PAINEIS_MJS } from "../../../../scripts/paineis-config.mjs";
import { PAINEIS_ANTES, PAINEIS_CONFIG, PAINEIS_DEPOIS, PAINEIS_FORMULARIO } from "../registro";
import { PAINEL_DISPARO_TESTE } from "../paineis/DisparoTeste";
import { PAINEL_PRINT_PENDENTE } from "../paineis/PrintPendente";
import { PAINEL_RESPOSTA_AUTOMATICA } from "../paineis/RespostaAutomatica";
import { PAINEL_SIMULAR } from "../paineis/RespostasPendentes";
import { PAINEL_VISAO_FILA } from "../paineis/VisaoFila";

/** Os quatro blocos que vivem DENTRO do painel "Fila de envio". */
const SUBORDINADOS_DA_FILA = [
  PAINEL_RESPOSTA_AUTOMATICA,
  PAINEL_VISAO_FILA,
  PAINEL_DISPARO_TESTE,
  PAINEL_PRINT_PENDENTE,
];

/**
 * E o que vive dentro de "Respostas pendentes". Subordinado pela mesma
 * razão dos de cima: "Simular mensagem" testa exatamente o que aquele
 * painel mostra, e como painel irmão ficaria longe do resultado que
 * explica.
 */
const SUBORDINADOS_DAS_RESPOSTAS = [PAINEL_SIMULAR];

/** Todo bloco de nível 3 da página, seja de qual painel for. */
const SUBORDINADOS = [...SUBORDINADOS_DA_FILA, ...SUBORDINADOS_DAS_RESPOSTAS];

describe("registro de painéis da /config", () => {
  /**
   * O id é a CHAVE DA PERSISTÊNCIA (`/usuarios/{id}.paineisConfigAbertos`):
   * dois painéis com o mesmo id abririam e fechariam juntos.
   */
  it("todo painel tem id não-vazio e único", () => {
    const ids = PAINEIS_CONFIG.map((painel) => painel.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("as três listas derivadas cobrem o registro inteiro, sem sobreposição", () => {
    const derivados = [...PAINEIS_ANTES, ...PAINEIS_FORMULARIO, ...PAINEIS_DEPOIS];
    expect(derivados).toHaveLength(PAINEIS_CONFIG.length);
    expect(derivados.map((p) => p.id).sort()).toEqual(PAINEIS_CONFIG.map((p) => p.id).sort());
  });

  it("a ordem das listas derivadas é a ordem do registro", () => {
    const posicao = (id: string) => PAINEIS_CONFIG.findIndex((p) => p.id === id);
    for (const lista of [PAINEIS_ANTES, PAINEIS_FORMULARIO, PAINEIS_DEPOIS]) {
      const indices = lista.map((p) => posicao(p.id));
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
    }
  });

  /**
   * A cópia em `.mjs` que os laços de captura leem não compila TypeScript,
   * então nada além deste teste impede que painel novo entre na página e
   * fique fora do `--so=paineis` — um portão que não visita o painel passa
   * sempre (foi assim que quatro skins ficaram fora de três laços por uma
   * rodada inteira, ver "Padrão para adicionar uma nova skin").
   */
  it("a cópia `.mjs` que o laço de captura lê tem os MESMOS painéis", () => {
    const noRegistro = [...PAINEIS_CONFIG.map((p) => p.id), ...SUBORDINADOS].sort();
    const noLaco = PAINEIS_MJS.map((p: { id: string }) => p.id).sort();
    expect(noLaco).toEqual(noRegistro);
  });

  it("a cópia `.mjs` marca como nível 3 exatamente os blocos subordinados", () => {
    const nivel3 = PAINEIS_MJS.filter((p: { nivel: number }) => p.nivel === 3)
      .map((p: { id: string }) => p.id)
      .sort();
    expect(nivel3).toEqual([...SUBORDINADOS].sort());
  });
});
