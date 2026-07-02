import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import type { UsageDb } from "@/lib/costs";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não configurada (ver .env.example).`);
  }
  return value;
}

/** Init lazy: só toca nas credenciais quando uma rota realmente precisa do banco. */
export function getDb(): Firestore {
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
  return getFirestore();
}

// Static assert: o Firestore real satisfaz a interface mínima do módulo de
// custos. Se o firebase-admin mudar a API, isto quebra o build, não a produção.
type Satisfies<T extends U, U> = T;
export type FirestoreSatisfiesUsageDb = Satisfies<Firestore, UsageDb>;
