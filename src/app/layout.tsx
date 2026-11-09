import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hablemos con Carla",
  description: "Parler espagnol avec Carla, 15 minutes par jour",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Carla", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c8553d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <main className="app">{children}</main>
      </body>
    </html>
  );
}
