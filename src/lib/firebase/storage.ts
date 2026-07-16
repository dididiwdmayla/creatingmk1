import { getStorage } from "firebase-admin/storage";

import type { DemoStorage } from "@/lib/demos/imagens";
import { ensureApp, requireEnv } from "./admin";

/**
 * Adaptador real do Firebase Storage para a interface mínima DemoStorage
 * (src/lib/demos/imagens.ts). Init lazy, mesma credencial do Firestore;
 * o bucket vem de FIREBASE_STORAGE_BUCKET (ver .env.example).
 *
 * Os objetos são gravados públicos (a demo é uma página pública) com URL
 * estável storage.googleapis.com. Cache imutável é seguro: cada upload
 * gera um caminho novo com timestamp — trocar a imagem troca a URL.
 */
export function getDemoStorage(): DemoStorage {
  ensureApp();
  const bucketName = requireEnv("FIREBASE_STORAGE_BUCKET");
  const bucket = getStorage().bucket(bucketName);

  return {
    async save(path, data, contentType) {
      await bucket.file(path).save(Buffer.from(data), {
        contentType,
        resumable: false,
        public: true,
        metadata: { cacheControl: "public, max-age=31536000, immutable" },
      });
    },
    async deleteByPrefix(prefix) {
      await bucket.deleteFiles({ prefix });
    },
    publicUrl(path) {
      return `https://storage.googleapis.com/${bucketName}/${path}`;
    },
  };
}
