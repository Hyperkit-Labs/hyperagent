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
    <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-background text-foreground`}
        >
          <ThirdwebProviderWrapper>
            <Header />
            <main className="flex-1 w-full">
              {children}
            </main>
            <Footer />
          </ThirdwebProviderWrapper>
        </body>
    </html>
  );
}
