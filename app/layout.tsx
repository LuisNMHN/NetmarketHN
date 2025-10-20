import type React from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import SupabaseAuthListener from "@/app/providers/SupabaseAuthListener"
import { NotificationProvider } from "@/components/notifications/NotificationProvider"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </ThemeProvider>
        <SupabaseAuthListener />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.app'
    };
