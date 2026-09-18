import type { AppConfig } from "@/lib/config";

/**
 * O contrato dos painéis que vivem DENTRO do formulário da /config.
 *
 * Eles não salvam sozinhos: editam o `AppConfig` em mãos e devolvem o
 * objeto novo, e quem grava é o único "Salvar" da página (um `PUT
 * /api/config` com o documento inteiro). É o que separa esse grupo dos
 * painéis autônomos — Usuários, Cotas, Metas, Fila de envio, Respostas
 * pendentes e Frases buscam e salvam cada um pela sua rota, e por isso não
 * recebem prop nenhuma.
 */
export interface PainelFormProps {
  form: AppConfig;
  onChange: (proximo: AppConfig) => void;
}
