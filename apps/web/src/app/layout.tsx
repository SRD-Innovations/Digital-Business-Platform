import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Business Platform",
  description:
    "Web-based business management platform (EPOS + ERP) for Sri Lankan businesses — offline-first POS, inventory, and modular Trade and Manufacturing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
