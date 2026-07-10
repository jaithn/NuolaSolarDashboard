import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Markenschriften laut Nuola Style Guide. next/font laedt die Dateien zur
// Build-Zeit herunter und hostet sie same-origin (kein externer Request zur
// Laufzeit) - dadurch CSP-konform (font-src 'self').
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nuola Energy Dashboard",
  description: "Stromverbrauchs- und Abrechnungsportal der Nuola Solar GbR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
