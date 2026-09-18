import type { ComponentType } from "react";

import { PAINEL_BUSCA, PainelBusca } from "./paineis/Busca";
import { PAINEL_COTAS, CotasUsuariosSection } from "./paineis/CotasUsuarios";
import { PAINEL_FILA, FilaEnvioSection } from "./paineis/FilaEnvio";
import { PAINEL_FRASES, FrasesSection } from "./paineis/Frases";
import { PAINEL_JANELAS, PainelJanelasContato } from "./paineis/JanelasContato";
import { PAINEL_MENSAGEM, PainelMensagemPadrao } from "./paineis/MensagemPadrao";
import { PAINEL_METAS, MetasUsuariosSection } from "./paineis/MetasUsuarios";
import { PAINEL_OPERACAO, PainelOperacaoDiaria } from "./paineis/OperacaoDiaria";
import { PAINEL_PAISES, PainelPaisesProspeccao } from "./paineis/PaisesProspeccao";
import { PAINEL_PRECIFICACAO, PainelPrecificacao } from "./paineis/Precificacao";
import { PAINEL_PRECOS, PainelPrecosCambio } from "./paineis/PrecosCambio";
import { PAINEL_RESPOSTAS, RespostasPendentesSection } from "./paineis/RespostasPendentes";
import { PAINEL_TETOS, PainelTetosSku } from "./paineis/TetosSku";
import { PAINEL_USUARIOS, UsuariosSection } from "./paineis/Usuarios";
import type { PainelFormProps } from "./tipos";

/**
 * O REGISTRO dos painéis da /config — a lista que a página percorre.
 *
 * A página não escreve JSX painel a painel: ela mapeia esta lista. É o que
 * faz a próxima alteração saber sozinha onde entrar — painel novo é uma
 * entrada aqui, e a ordem da tela é a ordem deste array. Ver "Painéis
 * colapsáveis da /config" no ARCHITECTURE.md.
 *
 * `posicao` existe porque a página tem TRÊS lugares, e a diferença entre
 * eles é de contrato, não de gosto:
 *
 * - `antes` e `depois` são os painéis AUTÔNOMOS: cada um busca e salva pela
 *   PRÓPRIA rota, então não recebem prop nenhuma.
 * - `formulario` são os que editam o `AppConfig` em mãos e são gravados
 *   pelo único "Salvar" da página (um `PUT /api/config` com o documento
 *   inteiro). Recebem `{ form, onChange }`.
 *
 * "Frases" fica em `depois` de propósito: a lista dele tem tamanho variável
 * (cresce com o registro de skins) e só chega depois do primeiro desenho —
 * no meio da página, empurraria o formulário inteiro para baixo a cada
 * carga. Sendo o último bloco, não há nada abaixo para deslocar (mesma
 * razão de efeito/LED serem `fixed` nas demos — ver "Deslocamento de
 * layout").
 */
interface PainelAutonomo {
  id: string;
  posicao: "antes" | "depois";
  Componente: ComponentType;
}

interface PainelDoFormulario {
  id: string;
  posicao: "formulario";
  Componente: ComponentType<PainelFormProps>;
}

export type PainelConfig = PainelAutonomo | PainelDoFormulario;

export const PAINEIS_CONFIG: PainelConfig[] = [
  { id: PAINEL_USUARIOS, posicao: "antes", Componente: UsuariosSection },
  { id: PAINEL_COTAS, posicao: "antes", Componente: CotasUsuariosSection },
  { id: PAINEL_METAS, posicao: "antes", Componente: MetasUsuariosSection },
  { id: PAINEL_FILA, posicao: "antes", Componente: FilaEnvioSection },
  { id: PAINEL_RESPOSTAS, posicao: "antes", Componente: RespostasPendentesSection },
  { id: PAINEL_BUSCA, posicao: "formulario", Componente: PainelBusca },
  { id: PAINEL_MENSAGEM, posicao: "formulario", Componente: PainelMensagemPadrao },
  { id: PAINEL_OPERACAO, posicao: "formulario", Componente: PainelOperacaoDiaria },
  { id: PAINEL_TETOS, posicao: "formulario", Componente: PainelTetosSku },
  { id: PAINEL_PRECOS, posicao: "formulario", Componente: PainelPrecosCambio },
  { id: PAINEL_PRECIFICACAO, posicao: "formulario", Componente: PainelPrecificacao },
  { id: PAINEL_JANELAS, posicao: "formulario", Componente: PainelJanelasContato },
  { id: PAINEL_PAISES, posicao: "formulario", Componente: PainelPaisesProspeccao },
  { id: PAINEL_FRASES, posicao: "depois", Componente: FrasesSection },
];

/**
 * As três listas que a página mapeia. Derivadas do registro acima (e não
 * escritas à mão) para que a ordem e a participação de cada painel tenham
 * UM dono só.
 */
export const PAINEIS_ANTES = PAINEIS_CONFIG.filter(
  (painel): painel is PainelAutonomo => painel.posicao === "antes",
);

export const PAINEIS_FORMULARIO = PAINEIS_CONFIG.filter(
  (painel): painel is PainelDoFormulario => painel.posicao === "formulario",
);

export const PAINEIS_DEPOIS = PAINEIS_CONFIG.filter(
  (painel): painel is PainelAutonomo => painel.posicao === "depois",
);
