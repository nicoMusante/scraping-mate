import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mate Finder | Mates en un solo lugar",
  description: "Buscá, compará y guardá mates de tiendas argentinas.",
  applicationName: "Mate Finder",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Mate Finder", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#173b2e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
