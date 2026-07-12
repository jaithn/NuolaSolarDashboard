import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
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

// Explizites Viewport-Meta für die optimale Darstellung auf mobilen Endgeräten
// (Next.js setzt den Standard zwar automatisch, hier bewusst dokumentiert).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme-Cookie serverseitig lesen und als data-theme setzen, damit die Wahl
  // ohne Flackern (kein Client-Umweg) gilt. Ohne Cookie ("system") entscheidet
  // die CSS-Media-Query prefers-color-scheme.
  const theme = (await cookies()).get("theme")?.value;
  const dataTheme = theme === "dark" || theme === "light" ? theme : undefined;
  return (
    <html lang="de" data-theme={dataTheme} className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
