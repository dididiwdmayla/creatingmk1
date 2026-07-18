import { Lora } from "next/font/google";

const lora = Lora({
  variable: "--font-demo-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  preload: false,
});

export default lora;
