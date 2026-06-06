import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

const themeScript = `(function(){var t=localStorage.getItem('theme');var d=document.documentElement;if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('dark')}else{d.classList.remove('dark')}})()`

export const metadata: Metadata = {
  title: "SmartBudget - Gestione Finanze Personali",
  description: "Piattaforma completa per la gestione di budget, entrate, spese, risparmi e fatture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
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
