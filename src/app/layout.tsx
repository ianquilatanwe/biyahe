import type { Metadata, Viewport } from "next";
import { Fredoka, Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({ variable: "--font-rubik", subsets: ["latin"] });
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });

// Absolute base for the social preview image: the Vercel production URL when
// deployed, localhost otherwise.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const title = "Biyahe – Ian Joseph Quilatan, Frontend Developer";
const description =
  "Drive a jeepney around a little town by the bay to visit Ian Joseph Quilatan's projects: Next.js sites, a motion demo, a WebGL typhoon and a Flutter app. Or skip straight to the list.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#f6c9a1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${rubik.variable} ${fredoka.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
