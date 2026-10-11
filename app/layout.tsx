import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A Mustafa Traders | Chat Dashboard",
  description: "Customer conversation history and website visitor insights for A Mustafa Traders"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

