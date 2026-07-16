import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import type { AppDb } from "@/lib/firestore-like";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não configurada (ver .env.example).`);
  }
  return value;
}

/** Init lazy do app admin: só toca nas credenciais quando alguém precisa. */
export function ensureApp(): void {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: requireEnv("FIREBASE_PROJECT_ID"),
        clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
        // A Vercel armazena a chave com \n literais.
        privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });
  }
}

export function getDb(): Firestore {
  ensureApp();
  return getFirestore();
}

// Static assert: o Firestore real satisfaz a interface mínima do app.
// Se o firebase-admin mudar a API, isto quebra o build, não a produção.
type Satisfies<T extends U, U> = T;
export type FirestoreSatisfiesAppDb = Satisfies<Firestore, AppDb>;
