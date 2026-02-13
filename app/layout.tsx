import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "./components/sidebar";
import { EventsPanel } from "./components/events-panel";

export const metadata: Metadata = {
  title: "Minha Liturgia",
  description: "Aplicação web para vida litúrgica, diário espiritual e leitura bíblica.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen bg-[#f0f9ff] text-[#003366]">
        {/* Navigation Sidebar (Fixed Left) */}
        <Sidebar />

        {/* Main Content Area */}
        {/* Adds margin left to accommodate sidebar */}
        {/* Adds margin right on large screens to accommodate events panel */}
        <main className="ml-64 xl:mr-72 min-h-screen p-8 transition-all duration-300">
          {children}
        </main>

        {/* Right Panel - Calendar (Fixed Right) */}
        <EventsPanel />
      </body>
    </html>
  );
}
