import { ANCORAS_PADRAO } from "@/lib/demos/capturas/ancoras";
import { SKINS } from "@/lib/demos/registry";

import { CapturasClient, type SkinCatalogo } from "./CapturasClient";

/**
 * TELA INTERNA DE MARCAÇÃO das âncoras de captura.
 *
 * Lista as skins do registro e, em cada uma, as seções que ela declara em
 * `SkinDefinition.secoes` — o operador escolhe até três e vê a PRÉVIA DO
 * ENQUADRAMENTO resultante. Nenhum cálculo de pixel, nenhuma rolagem: a
 * marcação é por SEÇÃO e o enquadramento sai sozinho da caixa do elemento
 * `[data-d-secao]` (ver lib/demos/capturas/ancoras.ts).
 *
 * Fica em /interno (fora do route group (app), sem Nav/header — é tela de
 * operação, não de painel) e é protegida pela sessão como o resto do app,
 * pelo default do proxy.ts. A marcação persiste em `/config/app` via
 * `PUT /api/config`, que é restrito ao admin: membro com sessão abre e vê
 * a marcação vigente, sem os controles de edição.
 *
 * Server Component fino: resolve o catálogo de skins (o registro tem
 * componentes React, que não atravessam a fronteira server→client) para
 * dados serializáveis e entrega ao cliente.
 */

export const dynamic = "force-dynamic";

export default function CapturasPage() {
  const catalogo: SkinCatalogo[] = SKINS.map((skin) => ({
    id: skin.id,
    nome: skin.nome,
    nicho: skin.nicho,
    secoes: skin.secoes.map((secao) => ({
      id: secao.id,
      nome: secao.nome,
      fixa: secao.fixa === true,
    })),
    padrao: ANCORAS_PADRAO[skin.id] ?? [],
  }));

  return <CapturasClient catalogo={catalogo} />;
}
