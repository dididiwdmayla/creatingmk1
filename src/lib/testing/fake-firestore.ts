import type {
  AppCollectionRef,
  AppDb,
  AppDocRef,
  AppQueryDocSnapshot,
  UsageDocSnapshot,
  UsageTransaction,
} from "../firestore-like";

/**
 * Fake em memória do subconjunto de Firestore usado pelo app, reproduzindo
 * a semântica de transação: leituras veem o estado pré-transação, escritas
 * ficam em buffer e só aplicam no commit; se a função da transação lançar,
 * nada é aplicado. Escritas fora de transação aplicam na hora.
 */

class FakeSnapshot implements UsageDocSnapshot {
  constructor(private readonly stored: Record<string, unknown> | undefined) {}

  get exists(): boolean {
    return this.stored !== undefined;
  }

  data(): Record<string, unknown> | undefined {
    return this.stored ? structuredClone(this.stored) : undefined;
  }
}

class FakeDocRef implements AppDocRef {
  constructor(
    private readonly db: FakeFirestore,
    readonly path: string,
  ) {}

  async get(): Promise<UsageDocSnapshot> {
    return new FakeSnapshot(this.db.readDoc(this.path));
  }

  set(data: Record<string, unknown>, options?: { merge?: boolean }): void {
    this.db.applyWrite(this.path, data, options?.merge ?? false);
  }
}

class FakeTransaction implements UsageTransaction {
  private readonly writes: Array<{
    path: string;
    data: Record<string, unknown>;
    merge: boolean;
  }> = [];

  constructor(private readonly db: FakeFirestore) {}

  async get(ref: { get(): Promise<UsageDocSnapshot> }): Promise<UsageDocSnapshot> {
    return new FakeSnapshot(this.db.readDoc((ref as FakeDocRef).path));
  }

  set(
    ref: { get(): Promise<UsageDocSnapshot> },
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): void {
    this.writes.push({
      path: (ref as FakeDocRef).path,
      data: structuredClone(data),
      merge: options?.merge ?? false,
    });
  }

  commit(): void {
    for (const write of this.writes) {
      this.db.applyWrite(write.path, write.data, write.merge);
    }
  }
}

export class FakeFirestore implements AppDb {
  private readonly docs = new Map<string, Record<string, unknown>>();

  /**
   * Toda coleção do Firestore real tem um número ÍMPAR de segmentos no
   * path (collection, collection/doc/collection, ...) — o SDK real
   * (`@google-cloud/firestore`) recusa `.collection()` com número par de
   * segmentos: "must point to a collection... does not contain an odd
   * number of components". Validar isso aqui pega em teste (fake) o mesmo
   * bug que só apareceria em produção (real) — foi exatamente por faltar
   * essa validação que `usage_users/{userId}` (2 segmentos) passou pelos
   * testes e quebrou em produção antes de virar `usage_users/{userId}/dias`.
   */
  collection(name: string): AppCollectionRef {
    if (name.split("/").length % 2 !== 1) {
      throw new Error(
        `Value for argument "collectionPath" must point to a collection, but was "${name}". Your path does not contain an odd number of components.`,
      );
    }
    return {
      doc: (id: string) => new FakeDocRef(this, `${name}/${id}`),
      get: async () => ({ docs: this.listDocs(name) }),
    };
  }

  async runTransaction<T>(fn: (tx: UsageTransaction) => Promise<T>): Promise<T> {
    const tx = new FakeTransaction(this);
    const result = await fn(tx);
    tx.commit();
    return result;
  }

  /** Pré-carrega um doc para o teste ("dado sujo", mês anterior etc.). */
  seed(path: string, data: Record<string, unknown>): void {
    this.docs.set(path, structuredClone(data));
  }

  /** Estado persistido do doc, para asserções. */
  getDoc(path: string): Record<string, unknown> | undefined {
    const stored = this.docs.get(path);
    return stored ? structuredClone(stored) : undefined;
  }

  readDoc(path: string): Record<string, unknown> | undefined {
    return this.docs.get(path);
  }

  applyWrite(path: string, data: Record<string, unknown>, merge: boolean): void {
    const current = merge ? (this.docs.get(path) ?? {}) : {};
    this.docs.set(path, { ...current, ...structuredClone(data) });
  }

  private listDocs(collection: string): AppQueryDocSnapshot[] {
    const prefix = `${collection}/`;
    const result: AppQueryDocSnapshot[] = [];
    for (const [path, stored] of this.docs) {
      if (!path.startsWith(prefix) || path.slice(prefix.length).includes("/")) {
        continue;
      }
      result.push({
        id: path.slice(prefix.length),
        data: () => structuredClone(stored),
      });
    }
    return result;
  }
}
