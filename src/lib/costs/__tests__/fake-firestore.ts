import type {
  UsageDb,
  UsageDocRef,
  UsageDocSnapshot,
  UsageTransaction,
} from "../firestore-like";

/**
 * Fake em memória do subconjunto de Firestore usado pelo módulo de custos,
 * reproduzindo a semântica de transação: leituras veem o estado
 * pré-transação, escritas ficam em buffer e só aplicam no commit;
 * se a função da transação lançar, nada é aplicado.
 */

class FakeSnapshot implements UsageDocSnapshot {
  constructor(private readonly stored: Record<string, unknown> | undefined) {}

  get exists(): boolean {
    return this.stored !== undefined;
  }

  data(): Record<string, unknown> | undefined {
    return this.stored ? { ...this.stored } : undefined;
  }
}

class FakeDocRef implements UsageDocRef {
  constructor(
    private readonly db: FakeFirestore,
    readonly path: string,
  ) {}

  async get(): Promise<UsageDocSnapshot> {
    return new FakeSnapshot(this.db.readDoc(this.path));
  }
}

class FakeTransaction implements UsageTransaction {
  private readonly writes: Array<{
    path: string;
    data: Record<string, unknown>;
    merge: boolean;
  }> = [];

  constructor(private readonly db: FakeFirestore) {}

  async get(ref: UsageDocRef): Promise<UsageDocSnapshot> {
    return new FakeSnapshot(this.db.readDoc((ref as FakeDocRef).path));
  }

  set(
    ref: UsageDocRef,
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): void {
    this.writes.push({
      path: (ref as FakeDocRef).path,
      data: { ...data },
      merge: options?.merge ?? false,
    });
  }

  commit(): void {
    for (const write of this.writes) {
      this.db.applyWrite(write.path, write.data, write.merge);
    }
  }
}

export class FakeFirestore implements UsageDb {
  private readonly docs = new Map<string, Record<string, unknown>>();

  collection(name: string): { doc(id: string): UsageDocRef } {
    return {
      doc: (id: string) => new FakeDocRef(this, `${name}/${id}`),
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
    this.docs.set(path, { ...data });
  }

  /** Estado persistido do doc, para asserções. */
  getDoc(path: string): Record<string, unknown> | undefined {
    const stored = this.docs.get(path);
    return stored ? { ...stored } : undefined;
  }

  readDoc(path: string): Record<string, unknown> | undefined {
    return this.docs.get(path);
  }

  applyWrite(path: string, data: Record<string, unknown>, merge: boolean): void {
    const current = merge ? (this.docs.get(path) ?? {}) : {};
    this.docs.set(path, { ...current, ...data });
  }
}
