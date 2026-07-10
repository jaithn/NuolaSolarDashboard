import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nuola Energy Dashboard",
  description: "Stromverbrauchs- und Abrechnungsportal der Nuola Solar GbR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
