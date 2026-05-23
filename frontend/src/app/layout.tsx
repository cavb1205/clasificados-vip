import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import "./globals.css";
import { AgeGate } from "@/components/AgeGate";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://clasificados.vip"),
  title: {
    default: "Clasificados VIP — Anuncios verificados en Chile",
    template: "%s · Clasificados VIP",
  },
  description:
    "Directorio de anuncios verificados por región y comuna en Chile. Perfiles con verificación de identidad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <AgeGate />
        <header className="border-b border-neutral-800">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Clasificados<span className="text-pink-500">VIP</span>
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/login" className="hover:text-pink-400">
                Ingresar
              </Link>
              <Link
                href="/registro"
                className="rounded-full bg-pink-600 px-4 py-1.5 font-medium hover:bg-pink-500"
              >
                Publicar
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-neutral-800 px-4 py-6 text-center text-xs text-neutral-500">
          Solo mayores de 18 años · No intermediamos transacciones · © Clasificados VIP
        </footer>
      </body>
    </html>
  );
}
