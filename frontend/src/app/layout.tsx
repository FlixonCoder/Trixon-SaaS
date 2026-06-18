import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Trixon — Continuous Technical Intelligence for Founders",
  description:
    "Connect your repo once and every commit gets analyzed, scored, and turned into a clear next step. AI-powered codebase intelligence in plain English — built for non-technical founders.",
  keywords: [
    "technical intelligence",
    "codebase analysis",
    "non-technical founders",
    "continuous tracking",
    "code health",
    "AI",
    "software analysis",
    "tech debt",
    "security scan",
  ],
  openGraph: {
    title: "Trixon — Continuous Technical Intelligence for Founders",
    description:
      "Know what changed. Know what's next. AI-powered codebase intelligence in plain English.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
