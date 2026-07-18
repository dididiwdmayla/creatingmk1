import { Josefin_Sans } from "next/font/google";

const josefin = Josefin_Sans({
  variable: "--font-demo-josefin",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  preload: false,
});

export default josefin;
