import { Cinzel, Merriweather } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "@/app/components/ServiceWorkerRegistration";
import ChatWidget from "@/app/components/ChatWidget";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "600", "700", "900"], variable: "--font-cinzel" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["300", "400", "700", "900"], style: ["normal", "italic"], variable: "--font-merriweather" });

export const metadata = {
  title: "CoachPro",
  description: "Gestion de programmes sportifs",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${cinzel.variable} ${merriweather.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#6D1A22" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CoachPro" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
        <ChatWidget />
      </body>
    </html>
  );
}
