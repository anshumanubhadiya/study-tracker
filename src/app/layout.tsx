import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "GTU Study Tracker",
  description:
    "Syllabus-aware study companion for GTU students — scan your syllabus, run guided Pomodoro sessions, and track exam readiness with spaced repetition.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "GTU Study" },
  icons: { icon: "/icon.png", apple: "/icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
  ],
};

const bootTheme = `(function(){try{var t=localStorage.getItem('gtu-theme')||'dark';var a=localStorage.getItem('gtu-accent')||'lime';var r=document.documentElement;r.dataset.theme=t;r.dataset.accent=a;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-accent="lime" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootTheme }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
