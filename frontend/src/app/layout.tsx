import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="bg-[#0a0e17] text-gray-200 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
