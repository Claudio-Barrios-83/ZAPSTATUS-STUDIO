import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZapStatus Studio",
  description: "Clips verticales 9:16 para estados de WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
