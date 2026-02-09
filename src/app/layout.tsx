import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { SidebarProvider } from "@/components/SidebarContext";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import { ExportProvider } from "@/contexts/ExportContext";
import { ExportProgressToast } from "@/components/pdd/ExportProgressToast";
import { FloatingNavigation } from "@/components/FloatingNavigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Event Horizon AI - Process Documentation Studio",
  description: "Transform screen recordings into detailed Process Design Documents using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ConvexClientProvider>
          <ExportProvider>
            <SidebarProvider>
              <div className="min-h-screen flex items-stretch">
                {/* Sidebar */}
                <Sidebar />

                {/* Main content area */}
                <div className="flex-1 flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-1 bg-dot-pattern overflow-auto">{children}</main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster />
            {/* Global export progress toast - persists across navigation */}
            <ExportProgressToast />
            <FloatingNavigation />
          </ExportProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
