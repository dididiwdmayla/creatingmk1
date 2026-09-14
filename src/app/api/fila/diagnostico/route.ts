import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { estruturalVazio, lerPoolBruto, type DiagnosticoEstrutural } from "@/lib/fila/candidatos";
import { loadFilaConfig } from "@/lib/fila/config";
import { lerContadorFila } from "@/lib/fila/contadores";
import {
  motivoDeRitmo,
  ordenarCandidatos,
  type DiagnosticoJanela,
  type MotivoSemTarefa,
} from "@/lib/fila/selecao";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `GET /api/fila/diagnostico` — quantos leads pararam em cada filtro da
 * seleção, na ordem real de avaliação. Existe para o caso que motivou esta
 * rota: operador desmarca `exigirJanelaBoa` e `/proximo` continua devolvendo
 * `fora_de_janela` — comportamento correto (pode não haver ninguém em
 * "razoavel" agora mesmo), mas sem contagem por etapa não dá para distinguir
 * isso de "a flag não pegou". Este endpoint é a diferença.
 *
 * Autenticação de SESSÃO de admin — mesmo mecanismo de `/api/config/fila`
 * (`requireAdmin`), NUNCA a `RADAR_DEVICE_KEY`: aquele segredo é do aparelho
 * e não abre nada além das rotas de execução da fila (`/proximo`,
 * `/confirmar`). Por isso esta rota, mesmo vivendo sob o prefixo `/api/fila/*`
 * que o proxy isenta da sessão comum (ver `src/proxy.ts`), faz sua própria
 * checagem completa de sessão+papel — igual a `/api/config/fila` PUT.
 *
 * Etapas, na ordem em que a seleção de fato avalia:
 * 1. **Ritmo** — `motivoDeRitmo` de novo, aqui só para dizer se ele está
 *    ativo agora (não é contagem por lead, é um portão único).
 * 2. **Estrutural** — `pool.estrutural`, apurado no rebuild (`construirPool`)
 *    e lido tal como está (`lerPoolBruto`, sem TTL, SEM disparar varredura
 *    nova). `pool.geradoEm` é o retrato: até `POOL_TTL_MS` velho, ou mais se
 *    `/proximo` não estiver sendo chamado.
 * 3. **Nicho** e 4. **Janela** (quebrada por nível) — frescos, calculados
 *    agora sobre esse mesmo pool.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);

    const now = new Date();
    const config = await loadFilaConfig(db);
    const contador = await lerContadorFila(db, now, config.inicioDiaOperacionalHora);
    const ritmo: MotivoSemTarefa | null = motivoDeRitmo(config, contador) ?? null;

    const pool = await lerPoolBruto(db);

    let nichoBarrado = 0;
    let janela: DiagnosticoJanela = { razoavel: 0, ruim: 0, semNivel: 0 };
    let elegiveis = 0;
    if (pool) {
      const app = await loadConfig(db);
      const resultado = ordenarCandidatos(pool.candidatos, config, app.janelasContato, now);
      nichoBarrado = resultado.diagnostico.nichoBarrado;
      janela = resultado.diagnostico.janela;
      elegiveis = resultado.escolhido.length;
    }

    const estrutural: DiagnosticoEstrutural = pool?.estrutural ?? estruturalVazio();

    return NextResponse.json({
      ritmo,
      pool: {
        geradoEm: pool?.geradoEm ?? null,
        lidos: pool?.lidos ?? 0,
        truncado: pool?.truncado ?? false,
        estrutural,
      },
      nichoBarrado,
      janela,
      elegiveis,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
