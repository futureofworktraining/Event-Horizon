import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { SidebarProvider } from "@/components/SidebarContext";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConvexClientProvider>
          <SidebarProvider>
            <div className="min-h-screen flex">
              {/* Sidebar */}
              <Sidebar />

              {/* Main content area */}
              <div className="flex-1 flex flex-col min-h-screen border-l border-border/50">
                <Header />
                <main className="flex-1 bg-muted/30 overflow-auto">{children}</main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
