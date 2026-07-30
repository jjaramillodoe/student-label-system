import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from '@/components/Providers';
import AppHeaderWrapper from '@/components/AppHeaderWrapper';
import ContentWrapper from '@/components/ContentWrapper';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';
import { Analytics } from '@vercel/analytics/react';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className={`${geistSans.className} min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col`} suppressHydrationWarning>
        <Providers>
          <Analytics />
          <AppHeaderWrapper />
          <ContentWrapper>
            {children}
          </ContentWrapper>
          <ScrollToTop />
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
