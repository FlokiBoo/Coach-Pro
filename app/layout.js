import { Cinzel, Merriweather, Work_Sans } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "@/app/components/ServiceWorkerRegistration";
import ChatWidget from "@/app/components/ChatWidget";
import CapacitorInit from "@/app/components/CapacitorInit";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "600", "700", "900"], variable: "--font-cinzel" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["300", "400", "700", "900"], style: ["normal", "italic"], variable: "--font-merriweather" });
const workSans = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-worksans" });

export const metadata = {
  title: "OSTRYK",
  description: "Gestion de programmes sportifs",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${cinzel.variable} ${merriweather.variable} ${workSans.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#6D1A22" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="OSTRYK" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
        <ChatWidget />
        <CapacitorInit />
      </body>
    </html>
  );
}
