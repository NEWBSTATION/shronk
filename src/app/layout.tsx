import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
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
  title: "Shronk - Milestone Tracker",
  description: "Track your project milestones with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var c=JSON.parse(localStorage.getItem("shronk-theme-cache"));if(c&&c.vars){if(c.mode==="dark")document.documentElement.classList.add("dark");var r=document.documentElement;var v=c.vars;for(var k in v)r.style.setProperty(k,v[k])}}catch(e){try{var d=JSON.parse(localStorage.getItem("shronk-theme-storage"));var m=d&&d.state&&d.state.mode;if(m==="system")m=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";if(m==="dark")document.documentElement.classList.add("dark")}catch(e){}}})()`,
            }}
          />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          suppressHydrationWarning
        >
          <QueryProvider>
            <ThemeProvider>{children}</ThemeProvider>
            <Toaster />
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
