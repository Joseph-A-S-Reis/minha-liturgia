import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "./components/sidebar";
import { EventsPanel } from "./components/events-panel";
import { MobileTabbar } from "./components/mobile-tabbar";
import { auth } from "@/auth";
import { PwaBootstrap } from "./components/pwa-bootstrap";
import { PwaInstallCta } from "./components/pwa-install-cta";

export const metadata: Metadata = {
  title: "Minha Liturgia",
  description: "Aplicação web para vida litúrgica, diário espiritual e leitura bíblica.",
  applicationName: "Minha Liturgia",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/brand/logo-oficial.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Minha Liturgia",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#003366",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen bg-[#f0f9ff] text-[#003366]">
        <PwaBootstrap />
        <PwaInstallCta />

        <a
          href="#conteudo-principal"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-60 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#003366] focus:shadow"
        >
          Pular para conteúdo principal
        </a>

        {/* Navigation Sidebar (Fixed Left) */}
        <Sidebar isAuthenticated={Boolean(session?.user)} />

        {/* Main Content Area */}
        {/* On mobile, no left margin and extra bottom space for tab navigation */}
        {/* On md+, reserve left space for sidebar and right space on xl for events panel */}
        <div
          id="conteudo-principal"
          className="min-h-screen p-4 pb-28 pt-6 transition-all duration-300 sm:p-6 sm:pb-28 md:ml-64 md:min-h-screen md:p-8 md:pb-8 xl:mr-72"
        >
          {children}
        </div>

        <MobileTabbar />

        {/* Right Panel - Calendar (Fixed Right) */}
        <EventsPanel userId={session?.user?.id ?? null} />
      </body>
    </html>
  );
}
