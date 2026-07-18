import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({
  variable: "--font-demo-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

export default dmSans;
