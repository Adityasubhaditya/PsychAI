import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PsychAI — Explainable mental-health screening",
  description:
    "A privacy-conscious mental-health screening and professional decision-support workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
