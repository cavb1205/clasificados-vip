import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { AgeGate } from "@/components/AgeGate";
import { AuthNav } from "@/components/AuthNav";
import { Toaster } from "@/components/Toaster";
import { SupportButton } from "@/components/SupportButton";
import { Analytics } from "@vercel/analytics/next";

// Tipografía UI: Plus Jakarta Sans (geométrica, moderna, alta legibilidad).
const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});
// Tipografía de display: Fraunces (serif con optical sizing, da el toque
// elegante a títulos y al logo).
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://portalvip.cl"),
  title: {
    default: "PortalVip Chile — Anuncios verificados",
    template: "%s · PortalVip Chile",
  },
  description:
    "Directorio de anuncios verificados por región y comuna en Chile. Perfiles con verificación de identidad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-CL"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <AgeGate />
        <Toaster />
        <SupportButton />
        <header className="gold-rule border-b border-neutral-900">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/brand/symbol.png"
                alt="PortalVip Chile"
                width={40}
                height={32}
                priority
                className="h-8 w-auto"
              />
              <span className="flex flex-col leading-none">
                <span className="text-gold font-display text-xl font-bold tracking-wide [text-shadow:0_1px_8px_rgba(233,193,92,0.25)]">
                  PortalVip
                </span>
                <span className="mt-0.5 text-[10px] uppercase tracking-[0.3em] text-neutral-400">
                  Chile
                </span>
              </span>
            </Link>
            <form
              action="/buscar"
              method="get"
              className="order-3 w-full sm:order-2 sm:flex-1 sm:max-w-md"
            >
              <input
                name="q"
                placeholder="Buscar perfiles…"
                className="w-full rounded-full border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-sm focus:border-pink-600 focus:outline-none"
              />
            </form>
            <div className="order-2 ml-auto sm:order-3 sm:ml-0">
              <AuthNav />
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-neutral-800 px-4 py-6 text-center text-xs text-neutral-500">
          <p>Solo mayores de 18 años · No intermediamos transacciones · © PortalVip Chile</p>
          <p className="mt-2 flex justify-center gap-4">
            <Link href="/terminos" className="hover:text-pink-400">
              Términos
            </Link>
            <Link href="/privacidad" className="hover:text-pink-400">
              Privacidad
            </Link>
          </p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
