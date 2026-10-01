/**
 * SAÚDE DA FILA — as variáveis de ambiente de que o ciclo de envio depende,
 * e a regra que transforma a ausência delas em "não entrega".
 *
 * **O incidente que criou isto.** Em produção existia `RADAR_DEVICE_KEY`
 * mas não `RADAR_DEVICE_USER_ID`. `/api/fila/proximo` entregava lead
 * normalmente, o aparelho mandava a mensagem, e `POST /api/fila/confirmar`
 * respondia 503 sem gravar nada (é ele que exige o userId do registro de
 * autor). Nenhum lead virou "contactado", o contador do dia nunca andou —
 * então meta, teto por hora e intervalo nunca seguraram nada —, e cada claim
 * silenciosa devolvia o lead à fila: a mesma mensagem saía de novo. A tarefa
 * de TESTE passava (o confirmar dela desvia antes da checagem), e o ensaio
 * dizia que estava tudo certo.
 *
 * **A regra**: o servidor nunca depende de o aparelho reportar. Faltando
 * qualquer variável que o confirmar exige, `/proximo` (e `/resumo`, que
 * precisa dizer a mesma coisa) respondem `pausado` — o motivo que já existe
 * e que a macro já sabe esperar — sem reservar nada. Bloquear um lead que
 * não recebeu custa um envio; entregar um envio que não vai ser registrado
 * é mandar duas vezes.
 *
 * Só lê `process.env` e devolve NOME + presente/ausente, nunca o valor: o
 * painel mostra isto, e a chave do aparelho não pode aparecer numa tela.
 */

export interface VariavelFila {
  nome: string;
  /** Sem ela a fila NÃO entrega lead (ver `motivoDeSaude`). */
  exigida: boolean;
  /** Para que serve — a linha que o painel mostra ao lado do nome. */
  papel: string;
}

export const VARIAVEIS_FILA: readonly VariavelFila[] = [
  {
    nome: "RADAR_DEVICE_KEY",
    exigida: true,
    papel: "autentica o aparelho em /api/fila/* — sem ela, nenhuma rota do celular responde",
  },
  {
    nome: "RADAR_DEVICE_USER_ID",
    exigida: true,
    papel:
      "autor do contato que o confirmar grava (id de /usuarios) — sem ela o envio sai e não é registrado",
  },
  {
    nome: "APP_PUBLIC_URL",
    exigida: false,
    papel:
      "origem do link {demo} — sem ela, lead cuja frase usa {demo} não é entregue (o marcador sairia literal)",
  },
];

export interface VariavelSaude extends VariavelFila {
  presente: boolean;
}

export interface SaudeFila {
  variaveis: VariavelSaude[];
  /** Nomes das EXIGIDAS ausentes, na ordem de `VARIAVEIS_FILA`. */
  faltando: string[];
  /** `faltando` vazio — a fila pode entregar lead. */
  entregaLiberada: boolean;
}

type Ambiente = Record<string, string | undefined>;

/** Presente = não vazia depois de aparar espaços (valor só de espaço é engano de cadastro). */
function presente(env: Ambiente, nome: string): boolean {
  return (env[nome] ?? "").trim() !== "";
}

export function saudeDaFila(env: Ambiente = process.env): SaudeFila {
  const variaveis = VARIAVEIS_FILA.map((variavel) => ({
    ...variavel,
    presente: presente(env, variavel.nome),
  }));
  const faltando = variaveis.filter((v) => v.exigida && !v.presente).map((v) => v.nome);
  return { variaveis, faltando, entregaLiberada: faltando.length === 0 };
}

/**
 * O portão de SAÚDE: `"pausado"` quando falta config exigida, senão
 * `undefined`. Fica ANTES do ritmo em `/proximo` e sobrepõe o motivo em
 * `/resumo` e no diagnóstico do painel — três lugares, uma regra.
 */
export function motivoDeSaude(env: Ambiente = process.env): "pausado" | undefined {
  return saudeDaFila(env).entregaLiberada ? undefined : "pausado";
}

/**
 * O texto final ainda carrega `{demo}` — o link não foi resolvido (hoje, só
 * acontece sem `APP_PUBLIC_URL`). É a REDE DE SEGURANÇA da entrega: um
 * marcador literal numa mensagem para negócio real é pior do que não
 * mandar, e o lead fica para a próxima volta em vez de queimado.
 */
export function demoSemResolver(texto: string): boolean {
  return texto.includes("{demo}");
}
