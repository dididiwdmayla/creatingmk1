import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { estruturalVazio, lerPoolBruto, type DiagnosticoEstrutural } from "@/lib/fila/candidatos";
import { loadFilaConfig } from "@/lib/fila/config";
import { lerContadorFila } from "@/lib/fila/contadores";
import type { LinhaFilaPainel } from "@/lib/fila/estado";
import { PAINEL_LINHAS, contadorDoPainel, linhasDoPainel } from "@/lib/fila/painel";
import {
  motivoDeRitmo,
  niveisAceitos,
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
 * Devolve também o que a TELA mostra além das contagens: o contador do dia
 * (com o instante em que o dia operacional vira) e as duas listas curtas —
 * os próximos elegíveis e os bloqueados por janela, com nome. As listas
 * saem da MESMA chamada de `ordenarCandidatos` que produz as contagens:
 * duas rotas recomputando a mesma seleção no mesmo segundo seriam duas
 * verdades sobre quem é o próximo, e elas divergiriam em silêncio.
 *
 * As linhas custam uma leitura de lead POR ID, e só das poucas que a tela
 * mostra (`PAINEL_LINHAS`) — nunca uma varredura de `/leads`, que é o custo
 * que o pool existe para evitar. Cada linha é reconferida contra o doc
 * fresco e sai da lista se não passa mais (o pool é cache; pode OFERECER
 * quem não serve, nunca ENTREGAR).
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
    let proximos: LinhaFilaPainel[] = [];
    let bloqueados: LinhaFilaPainel[] = [];
    if (pool) {
      const app = await loadConfig(db);
      const aceitos = niveisAceitos(config);
      const resultado = ordenarCandidatos(pool.candidatos, config, app.janelasContato, now, {
        coletarBloqueados: true,
      });
      nichoBarrado = resultado.diagnostico.nichoBarrado;
      janela = resultado.diagnostico.janela;
      elegiveis = resultado.escolhido.length;

      const linhas = {
        janelas: app.janelasContato,
        niveisAceitos: aceitos,
        now,
      };
      [proximos, bloqueados] = await Promise.all([
        linhasDoPainel(db, pool.candidatos, resultado.escolhido.slice(0, PAINEL_LINHAS), {
          ...linhas,
          // Elegível está em janela AGORA; "quando entra" é uma pergunta
          // que só o bloqueado faz.
          comProximaFaixa: false,
        }),
        linhasDoPainel(db, pool.candidatos, resultado.diagnostico.bloqueados.slice(0, PAINEL_LINHAS), {
          ...linhas,
          comProximaFaixa: true,
        }),
      ]);
    }

    const estrutural: DiagnosticoEstrutural = pool?.estrutural ?? estruturalVazio();

    return NextResponse.json({
      ritmo,
      contador: contadorDoPainel(config, contador, now),
      pool: {
        geradoEm: pool?.geradoEm ?? null,
        lidos: pool?.lidos ?? 0,
        truncado: pool?.truncado ?? false,
        estrutural,
      },
      nichoBarrado,
      janela,
      elegiveis,
      proximos,
      bloqueados,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
