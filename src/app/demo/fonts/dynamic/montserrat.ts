import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  variable: "--font-demo-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export default montserrat;
