import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "JobSwipe — trouve ton prochain poste en swipant",
    template: "%s · JobSwipe",
  },
  description:
    "Dépose ton CV, définis tes critères, et parcours les offres qui te " +
    "correspondent. Swipe à droite pour garder, à gauche pour passer.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0a0e13] text-slate-100">
        {children}
      </body>
    </html>
  );
}
