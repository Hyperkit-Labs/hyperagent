import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThirdwebProviderWrapper } from "@/components/providers/ThirdwebProviderWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HyperAgent - AI Agent Platform for Smart Contracts",
  description: "Generate, audit, test, and deploy smart contracts using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-gradient-to-br from-white via-blue-50/20 to-indigo-50/10`}
      >
        <ThirdwebProviderWrapper>
          <Header />
          <main className="flex-1 max-w-[1920px] mx-auto w-full px-6 sm:px-8 lg:px-12 py-10">
            {children}
          </main>
          <Footer />
        </ThirdwebProviderWrapper>
      </body>
    </html>
  );
}
