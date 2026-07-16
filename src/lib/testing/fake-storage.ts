import type { DemoStorage } from "@/lib/demos/imagens";

/**
 * Fake em memória da interface DemoStorage (src/lib/demos/imagens.ts) —
 * mesmo papel do FakeFirestore: testar rotas e módulos sem bucket real.
 */
export class FakeDemoStorage implements DemoStorage {
  readonly files = new Map<string, { data: Uint8Array; contentType: string }>();

  async save(path: string, data: Uint8Array, contentType: string): Promise<void> {
    this.files.set(path, { data, contentType });
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const path of [...this.files.keys()]) {
      if (path.startsWith(prefix)) this.files.delete(path);
    }
  }

  publicUrl(path: string): string {
    return `https://storage.googleapis.com/bucket-teste/${path}`;
  }

  paths(): string[] {
    return [...this.files.keys()].sort();
  }
}
