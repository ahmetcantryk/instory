import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "InStory - İnteraktif Hikaye Platformu",
  description: "Panel panel ilerleyen, seçimlerinize göre dallanan hikayeler",
  applicationName: "InStory",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "InStory",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="antialiased">
      <head>
        {/* Google Fonts preconnect - tüm cihazlarda font yüklemeyi hızlandırır */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* En sık kullanılan fontları preload et */}
        <link 
          rel="preload" 
          href="https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&family=Permanent+Marker&family=Poppins:wght@400;600;700&family=Noto+Sans+JP:wght@400;700&display=swap" 
          as="style"
        />
        <link 
          rel="stylesheet" 
          href="https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&family=Permanent+Marker&family=Poppins:wght@400;600;700&family=Noto+Sans+JP:wght@400;700&display=swap"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} text-base`}
      >
        {children}
      </body>
    </html>
  );
}
