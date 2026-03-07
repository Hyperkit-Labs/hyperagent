import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ApiAuthProvider } from "@/components/providers/ApiAuthProvider";
import { ConfigLoader } from "@/components/providers/ConfigLoader";
import { ThirdwebProviderWrapper } from "@/components/providers/ThirdwebProviderWrapper";
import { Toaster } from "sonner";
import { LayoutSwitcher } from "@/components/layout/LayoutSwitcher";

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
  description: "Production-ready smart contract development in under 2 minutes. x402 Native | Mantle SDK | Thirdweb | EigenDA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased min-h-screen flex flex-col bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] font-sans">
        <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full">
          <ConfigLoader />
          <ThirdwebProviderWrapper>
            <ApiAuthProvider>
              <LayoutSwitcher>{children}</LayoutSwitcher>
              <Toaster position="top-right" richColors />
            </ApiAuthProvider>
          </ThirdwebProviderWrapper>
        </div>
      </body>
    </html>
  );
}