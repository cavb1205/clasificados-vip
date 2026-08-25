import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel de anfitrión",
  robots: { index: false, follow: false },
};

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
