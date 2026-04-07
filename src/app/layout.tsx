import type { Metadata } from "next";
import { Zen_Maru_Gothic, Inter } from "next/font/google";
import "./globals.css";

// 日本語用：丸ゴシック（優しい印象）
const zenMaru = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-zen-maru",
  display: "swap",
});

// 英数字用：Inter（高い視認性・可読性）
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "大会成績システム",
  description: "大会の成績管理および表示システムです",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 両方のフォント変数をHTMLタグに適用します
    <html lang="ja" className={`${zenMaru.variable} ${inter.variable}`}>
      <body className="font-sans antialiased bg-theme-bg text-theme-secondary">
        {children}
      </body>
    </html>
  );
}