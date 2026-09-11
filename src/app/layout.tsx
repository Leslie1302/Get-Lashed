import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import { BUSINESS } from "@/lib/constants";
import { siteUrl } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StructuredData from "@/components/StructuredData";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito-sans",
  display: "swap",
});

const SERVICES_TEASER =
  "BIAB, acrylics and French tips, classic to custom lash sets, and pedicures in Accra, Ghana.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_GH",
    siteName: BUSINESS.name,
    url: "/",
    description: SERVICES_TEASER,
  },
  title: {
    default: `${BUSINESS.name} — ${BUSINESS.tagline}`,
    template: `%s · ${BUSINESS.name}`,
  },
  description: `${BUSINESS.name}. ${BUSINESS.tagline}. ${SERVICES_TEASER}`,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-scroll-behavior tells Next the smooth scrolling in globals.css is
    // deliberate, so it suppresses it during route changes — without it, a
    // click through to a new page animates the scroll instead of landing at
    // the top.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${fraunces.variable} ${nunitoSans.variable}`}
    >
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-4 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-terracotta"
        >
          Skip to content
        </a>
        <StructuredData />
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}