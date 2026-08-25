import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favoritos",
  robots: { index: false, follow: false },
};

export default function FavoritosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
