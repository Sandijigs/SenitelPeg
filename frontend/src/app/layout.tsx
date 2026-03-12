import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SentinelPeg — Depeg Defense Dashboard",
  description:
    "Real-time depeg defense for stablecoin liquidity pools powered by Uniswap v4 and Reactive Network",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className="font-sans min-h-screen antialiased text-white overflow-x-hidden"
        style={{ background: "var(--bg-primary)" }}
      >
        {children}
      </body>
    </html>
  );
}
