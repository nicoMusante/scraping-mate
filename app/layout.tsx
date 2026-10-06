import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mate Finder | Mates tipo torpedo",
  description: "Buscador de mates tipo torpedo de todos los materiales en tiendas argentinas.",
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
