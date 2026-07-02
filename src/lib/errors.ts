/**
 * Erros de domínio do app. Cada um mapeia para um HTTP status fixo em
 * src/lib/http.ts (o contrato de rotas do ARCHITECTURE.md).
 */

export class ValidationError extends Error {
  readonly code = "validation_error";

  constructor(readonly problemas: string[]) {
    super(`Configuração ou entrada inválida: ${problemas.join("; ")}`);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  readonly code = "not_found";

  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InvalidTransitionError extends Error {
  readonly code = "invalid_transition";

  constructor(
    readonly de: string,
    readonly para: string,
  ) {
    super(`Transição de status inválida: "${de}" → "${para}".`);
    this.name = "InvalidTransitionError";
  }
}
