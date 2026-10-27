import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drops Hub — Twitch Drops в одном месте",
  description:
    "Каталог кампаний Twitch Drops: избранное, уведомления о новых наградах, прогресс и сбор уже заработанных дропсов.",
  applicationName: "Drops Hub",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-ink text-[#efeff1]">{children}</body>
    </html>
  );
}
