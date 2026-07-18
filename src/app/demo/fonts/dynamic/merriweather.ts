import { Merriweather } from "next/font/google";

const merriweather = Merriweather({
  variable: "--font-demo-merriweather",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  preload: false,
});

export default merriweather;
