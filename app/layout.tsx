import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mate Finder | Torpedos de calabaza",
  description: "Buscador de mates torpedo de calabaza en tiendas argentinas.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
