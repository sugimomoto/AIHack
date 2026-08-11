import type { Metadata, Viewport } from "next";
import { Zen_Kaku_Gothic_New, Shippori_Mincho } from "next/font/google";
import "./globals.css";

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-zen-kaku",
});

const shippori = Shippori_Mincho({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shippori",
});

export const metadata: Metadata = {
  title: "Aida（あいだ）",
  description:
    "離婚しても、子どもが健やかに育つための基盤になる。父母のあいだにAIが立ち、二人を直接やりとりさせずに合意をつくります。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FDF8EF",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${zenKaku.variable} ${shippori.variable}`}>
        {children}
      </body>
    </html>
  );
}
