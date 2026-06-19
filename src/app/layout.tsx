import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "Neural Alpha — Smart Stock & F&O Recommendation System",
  description: "AI-driven equity and derivatives (F&O) advisory platform monitoring NSE/BSE stocks with real-time analytics, open interest, and multi-model sentiment intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
    >
      <body className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
