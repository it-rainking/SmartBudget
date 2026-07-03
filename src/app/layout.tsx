import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { themeScript } from "@/lib/themeScript";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartBudget - Gestione Finanze Personali",
  description: "Piattaforma completa per la gestione di budget, entrate, spese, risparmi e fatture.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SmartBudget",
  },
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
