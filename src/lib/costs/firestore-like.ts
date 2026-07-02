/**
 * Interface estrutural mínima do Firestore usada pelo módulo de custos.
 *
 * O Firestore do firebase-admin satisfaz UsageDb por tipagem estrutural
 * (static assert em src/lib/firebase/admin.ts); os testes usam um fake em
 * memória. Assim o módulo fica puro e testável sem emulador nem credenciais.
 */

export interface UsageDocSnapshot {
  readonly exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface UsageDocRef {
  get(): Promise<UsageDocSnapshot>;
}

export interface UsageTransaction {
  get(ref: UsageDocRef): Promise<UsageDocSnapshot>;
  set(
    ref: UsageDocRef,
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): unknown;
}

export interface UsageDb {
  collection(name: string): { doc(id: string): UsageDocRef };
  runTransaction<T>(fn: (tx: UsageTransaction) => Promise<T>): Promise<T>;
}
