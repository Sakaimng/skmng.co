import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import { DeferredGlobalSiteHeader } from "@/components/DeferredGlobalSiteHeader";
import { LocaleProvider } from "@/components/LocaleProvider";
import { PageTransitionProvider } from "@/components/PageTransitionProvider";
import { SeoJsonLd } from "@/components/SeoJsonLd";
import { defaultOgImagePath, siteUrl } from "@/lib/site";
import { themeInitScript } from "@/lib/theme";
import { localeInitScript } from "@/lib/locale";
import faviconDark from "./skmng.coFaviconDarkMode.png";
import faviconLight from "./skmng.coFaviconLightMode.png";
import "./globals.css";

/* Geist Sans is not preloaded: the UI uses Helvetica Neue from globals.css.
   Loading it via next/font caused an unused <link rel="preload"> warning. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTitle = "SKMNG | TOKYO BASED VISUAL STORYTELLER";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | SKMNG",
  },
  description:
    "SKMNG — Tokyo based visual storyteller. Cinematic photography and image-led work: gallery, archive, and contact.",
  applicationName: "SKMNG",
  authors: [{ name: "SKMNG", url: siteUrl }],
  creator: "SKMNG",
  publisher: "SKMNG",
  keywords: [
    "SKMNG",
    "photography",
    "Tokyo photographer",
    "visual storyteller",
    "cinematic photography",
    "photography portfolio",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      {
        url: faviconLight.src,
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: faviconDark.src,
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      { url: faviconDark.src, type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "SKMNG",
    title: siteTitle,
    description:
      "Tokyo based visual storyteller — minimal portfolio with gallery, archive, and info.",
    images: [
      {
        url: defaultOgImagePath,
        alt: "SKMNG — photography",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description:
      "Tokyo based visual storyteller — gallery, archive, and visual portfolio.",
    images: [defaultOgImagePath],
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
      className={`${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-background font-sans text-foreground"
        suppressHydrationWarning
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <Script id="locale-init" strategy="beforeInteractive">
          {localeInitScript}
        </Script>
        <SeoJsonLd />
        <PageTransitionProvider>
          <LocaleProvider>
            <DeferredGlobalSiteHeader />
            {children}
          </LocaleProvider>
        </PageTransitionProvider>
      </body>
    </html>
  );
}
