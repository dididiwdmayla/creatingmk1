import { Oswald } from "next/font/google";

// Só alcançável via escolha explícita do editor (lib/demos/fontes.ts) —
// preload desligado: sem custo até o usuário selecionar.
const oswald = Oswald({
  variable: "--font-demo-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

export default oswald;
