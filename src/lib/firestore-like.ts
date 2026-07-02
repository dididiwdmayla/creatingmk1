/**
 * Interface estrutural mínima do Firestore usada pelo app.
 *
 * O Firestore do firebase-admin satisfaz AppDb por tipagem estrutural
 * (static assert em src/lib/firebase/admin.ts); os testes usam um fake em
 * memória (src/lib/testing/fake-firestore.ts). Assim os módulos ficam puros
 * e testáveis sem emulador nem credenciais.
 *
 * UsageDb é o subconjunto que o módulo de custos precisa; AppDb amplia com
 * escrita fora de transação e leitura de coleção inteira (o app é
 * single-user com centenas de docs — filtros são aplicados em memória).
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

export interface AppDocRef extends UsageDocRef {
  set(data: Record<string, unknown>, options?: { merge?: boolean }): unknown;
}

export interface AppQueryDocSnapshot {
  readonly id: string;
  data(): Record<string, unknown>;
}

export interface AppCollectionRef {
  doc(id: string): AppDocRef;
  get(): Promise<{ docs: AppQueryDocSnapshot[] }>;
}

export interface AppDb extends UsageDb {
  collection(name: string): AppCollectionRef;
}
