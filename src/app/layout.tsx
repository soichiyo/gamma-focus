import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Gamma Focus",
  description: "40Hz Binaural Beat Generator for Focus",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="dark">
      <body className={`${geist.variable} ${geistMono.variable} antialiased bg-[#0A0A0A] text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
