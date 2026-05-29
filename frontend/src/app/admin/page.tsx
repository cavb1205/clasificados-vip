"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";

interface Stats {
  pending_kyc: number;
  pending_payments: number;
  pending_reviews: number;
  open_reports: number;
  verified_models: number;
  active_publications: number;
  expiring_soon: number;
  revenue_month_clp: number;
}

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function AdminHomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    auth
      .me()
      .then(() => dashboard.adminStats() as unknown as Promise<Stats>)
      .then((s) => {
        setStats(s);
        setReady(true);
      })
      .catch((e) => {
        if (e instanceof Error && e.message.toLowerCase().includes("forbid")) {
          setErr("Necesitas permisos de staff para entrar aquí.");
          setReady(true);
        } else {
          router.replace("/login?next=/admin");
        }
      });
  }, [router]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;
  if (err) return <p className="text-red-400">{err}</p>;
  if (!stats) return null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Panel de moderación</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Resumen rápido del estado del sitio y colas que requieren tu atención.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
          Pendientes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PendingCard
            label="Verificaciones (KYC)"
            count={stats.pending_kyc}
            href="/admin/kyc"
          />
          <PendingCard
            label="Pagos por revisar"
            count={stats.pending_payments}
            href="/admin/pagos"
          />
          <PendingCard
            label="Reseñas por moderar"
            count={stats.pending_reviews}
            href="/admin#"
            disabled
          />
          <PendingCard
            label="Stories reportadas"
            count={stats.open_reports}
            href="/admin/reportes"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
          Estado del catálogo
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Modelos verificadas" value={stats.verified_models} />
          <Stat label="Publicaciones activas" value={stats.active_publications} />
          <Stat label="Expiran en ≤3 días" value={stats.expiring_soon} tone="warn" />
          <Stat
            label="Ingresos del mes"
            value={CLP.format(stats.revenue_month_clp)}
          />
        </div>
      </section>
    </div>
  );
}

function PendingCard({
  label,
  count,
  href,
  disabled,
}: {
  label: string;
  count: number;
  href: string;
  disabled?: boolean;
}) {
  const tone =
    count === 0
      ? "border-neutral-800 text-neutral-500"
      : "border-pink-500/50 bg-pink-600/10 text-pink-200";
  const body = (
    <div
      className={`flex h-full flex-col justify-between rounded-xl border p-4 transition ${tone} ${
        disabled ? "opacity-50" : "hover:border-pink-400"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-2 text-3xl font-bold">{count}</p>
      {!disabled && count > 0 && (
        <p className="mt-1 text-xs text-pink-300">Revisar →</p>
      )}
    </div>
  );
  return disabled ? body : <Link href={href}>{body}</Link>;
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "warn" }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === "warn" && Number(value) > 0
          ? "border-amber-500/40 bg-amber-600/10"
          : "border-neutral-800"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
