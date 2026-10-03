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
    const snap = new FakeSnapshot(this.db.readDoc(this.path));
    // Depois de LER, antes de devolver: é aqui que um teste de corrida
    // intercala a escrita concorrente (ver `aoLer`).
    await this.db.notificarLeitura(this.path);
    return snap;
  }

  set(data: Record<string, unknown>, options?: { merge?: boolean }): void {
    this.db.applyWrite(this.path, data, options?.merge ?? false);
  }

  delete(): void {
    this.db.deleteDoc(this.path);
  }
}

/**
 * Conflito detectado no commit: um doc LIDO nesta transação foi escrito por
 * outra pessoa antes de ela terminar. `runTransaction` roda a função de novo,
 * como o Firestore real faz.
 */
class ConflitoTransacao extends Error {}

/** Mesmo teto de tentativas do SDK real (`maxAttempts` padrão = 5). */
export const FAKE_TENTATIVAS_TRANSACAO = 5;

class FakeTransaction implements UsageTransaction {
  private readonly writes: Array<{
    path: string;
    data: Record<string, unknown>;
    merge: boolean;
  }> = [];
  /** Versão de cada doc no instante em que esta transação o LEU. */
  private readonly lidas = new Map<string, number>();

  constructor(private readonly db: FakeFirestore) {}

  async get(ref: { get(): Promise<UsageDocSnapshot> }): Promise<UsageDocSnapshot> {
    const path = (ref as FakeDocRef).path;
    if (!this.lidas.has(path)) this.lidas.set(path, this.db.versao(path));
    const snap = new FakeSnapshot(this.db.readDoc(path));
    await this.db.notificarLeitura(path);
    return snap;
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
    // A garantia que o Firestore real dá e que o fake não dava: se um doc
    // que esta transação LEU mudou antes do commit, nada é escrito e a
    // função roda de novo sobre o estado novo. Sem isto, um teste de
    // "isto agora é transacional" passaria sem provar nada.
    for (const [path, versao] of this.lidas) {
      if (this.db.versao(path) !== versao) throw new ConflitoTransacao(path);
    }
    for (const write of this.writes) {
      this.db.applyWrite(write.path, write.data, write.merge);
    }
  }
}

export class FakeFirestore implements AppDb {
  private readonly docs = new Map<string, Record<string, unknown>>();
  /** Sobe a cada escrita de um doc — o que a detecção de conflito compara. */
  private readonly versoes = new Map<string, number>();
  /** Ganchos de corrida, um por path, disparados UMA vez depois de uma leitura. */
  private readonly ganchosLeitura = new Map<string, () => Promise<unknown>>();

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
    for (let tentativa = 1; ; tentativa += 1) {
      const tx = new FakeTransaction(this);
      const result = await fn(tx);
      try {
        tx.commit();
        return result;
      } catch (error) {
        if (!(error instanceof ConflitoTransacao) || tentativa >= FAKE_TENTATIVAS_TRANSACAO) {
          throw error instanceof ConflitoTransacao
            ? new Error(`ABORTED: contenção em ${error.message} (${tentativa} tentativas)`)
            : error;
        }
      }
    }
  }

  /**
   * GANCHO DE CORRIDA para testes: `fn` roda UMA vez, logo depois da próxima
   * leitura de `path` (por `doc.get()` ou `tx.get()`), antes de o leitor
   * receber o snapshot. É como se escreve "outra requisição gravou este doc
   * entre a leitura e a escrita desta" sem depender de relógio.
   */
  aoLer(path: string, fn: () => Promise<unknown>): void {
    this.ganchosLeitura.set(path, fn);
  }

  async notificarLeitura(path: string): Promise<void> {
    const fn = this.ganchosLeitura.get(path);
    if (!fn) return;
    this.ganchosLeitura.delete(path);
    await fn();
  }

  versao(path: string): number {
    return this.versoes.get(path) ?? 0;
  }

  private tocar(path: string): void {
    this.versoes.set(path, this.versao(path) + 1);
  }

  /** Pré-carrega um doc para o teste ("dado sujo", mês anterior etc.). */
  seed(path: string, data: Record<string, unknown>): void {
    this.docs.set(path, structuredClone(data));
    this.tocar(path);
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
    this.tocar(path);
  }

  deleteDoc(path: string): void {
    this.docs.delete(path);
    this.tocar(path);
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
