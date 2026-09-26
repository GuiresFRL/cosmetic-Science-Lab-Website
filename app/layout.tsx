import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SiteScripts from "@/components/SiteScripts";

export const metadata: Metadata = {
  title: "Cosmetic Science Lab",
  description:
    "End-to-end cosmetic product development for brands worldwide.",
};

export const viewport: Viewport = {
  themeColor: "#1B1130",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/images/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/images/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap"
        />
      </head>
      <body>
        <Nav />
        {children}
        <Footer />
        {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
          <Script src="https://www.google.com/recaptcha/api.js?render=explicit" strategy="afterInteractive" />
        )}
        <SiteScripts />
      </body>
    </html>
  );
}
