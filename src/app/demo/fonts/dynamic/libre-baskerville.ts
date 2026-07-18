import { Libre_Baskerville } from "next/font/google";

const libreBaskerville = Libre_Baskerville({
  variable: "--font-demo-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  preload: false,
});

export default libreBaskerville;
