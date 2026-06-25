import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PageTransitionProvider } from "@/components/PageTransitionProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SKMNG",
  description:
    "SKMNG visual portfolio with a cinematic scrolling image sequence.",
  openGraph: {
    title: "SKMNG",
    description:
      "Minimal portfolio with looping gallery, archive, and info page.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-black font-sans text-white"
        suppressHydrationWarning
      >
        <PageTransitionProvider>{children}</PageTransitionProvider>
      </body>
    </html>
  );
}
