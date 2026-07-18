import { Cinzel } from "next/font/google";

const cinzel = Cinzel({
  variable: "--font-demo-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  preload: false,
});

export default cinzel;
