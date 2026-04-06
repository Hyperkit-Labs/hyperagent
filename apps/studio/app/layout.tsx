import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/providers/ClientProviders";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hyperkit - AI-Powered Smart Contract Platform",
  description:
    "AI-assisted smart contract workflows for SKALE Base. x402-backed payments | Thirdweb | Tenderly",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      nonce={nonce}
      suppressHydrationWarning
    >
      <body className="antialiased min-h-screen flex flex-col bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] font-sans">
        <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full">
          <ClientProviders>{children}</ClientProviders>
        </div>
      </body>
    </html>
  );
}
