import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <AdminNav />
      {children}
    </div>
  );
}
