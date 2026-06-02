import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeSync } from "@/components/ThemeSync";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Orkestra AI — Le copilote multi-IA pour optimiser les boutiques Shopify",
  description:
    "Connectez votre boutique Shopify et vos IA. Orkestra AI analyse votre boutique, comprend votre niche et génère du SEO premium, des sections Shopify codées et des audits Merchant Center.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
