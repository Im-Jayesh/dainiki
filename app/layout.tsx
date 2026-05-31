import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Playfair_Display, Dancing_Script } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { SecurityGate } from "@/components/security-gate";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { OneSignalInit } from "@/components/onesignal-init";
import { SettingsProvider } from "@/contexts/settings-context";
import Init from "./init";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

const dancing = Dancing_Script({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dainiki | Aesthetic Personal Journal",
  description: "A clean, private, and aesthetic space for your thoughts.",
  icons: {
    icon: "/dainiki-logo.jpg",
  },
  openGraph: {
    images: ["/link-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${playfair.variable} ${dancing.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-zinc-200 dark:selection:bg-zinc-800">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SettingsProvider>
            <Init>
              <AuthProvider>
                <OneSignalInit />
                <SecurityGate>{children}</SecurityGate>
              </AuthProvider>
            </Init>
            <Toaster position="top-center" />
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
