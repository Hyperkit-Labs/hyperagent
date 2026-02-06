import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ThirdwebProviderWrapper } from "@/components/providers/ThirdwebProviderWrapper";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HyperAgent - AI-Powered Smart Contract Platform",
  description: "Production-ready smart contract development in under 2 minutes. x402 Native | Mantle SDK | Thirdweb | EigenDA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThirdwebProviderWrapper>
          <DashboardLayout>{children}</DashboardLayout>
          <Toaster position="top-right" richColors />
        </ThirdwebProviderWrapper>
      </body>
    </html>
  );
}