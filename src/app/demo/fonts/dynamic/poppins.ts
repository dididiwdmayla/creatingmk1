import { Poppins } from "next/font/google";

const poppins = Poppins({
  variable: "--font-demo-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export default poppins;
