import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PatientProvider } from "@/lib/context/PatientContext";
import { PWAProvider } from "@/components/PWAProvider";
import { AppShell } from "@/components/AppShell";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Parthia Health", template: "%s · Parthia Health" },
  description:
    "Patient-owned, holistic medication safety for people living with several chronic conditions.",
  manifest: "/manifest.json",
  applicationName: "Parthia Health",
  appleWebApp: {
    capable: true,
    title: "Parthia",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0E5C56",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`} data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        <PatientProvider>
          <PWAProvider>
            <AppShell>{children}</AppShell>
          </PWAProvider>
        </PatientProvider>
      </body>
    </html>
  );
}
