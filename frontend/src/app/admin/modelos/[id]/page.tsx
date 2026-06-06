"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";
import { NotifyButton } from "@/components/NotifyButton";

type Detail = Awaited<ReturnType<typeof dashboard.adminProfileDetail>>;

interface ProfileLite {
  id: number;
  user_id: number;
  stage_name: string;
  slug: string;
  email: string;
  verification_status: string;
  is_suspended: boolean;
  suspension_reason: string;
  photo_authenticity: "pending" | "none" | "light" | "heavy";
}

const AUTH_OPTIONS: { value: "none" | "light" | "heavy" | "pending"; label: string }[] = [
  { value: "none", label: "🟢 Sin retoque" },
  { value: "light", label: "🟡 Retoque leve" },
  { value: "heavy", label: "🟠 Con retoque" },
  { value: "pending", label: "Por revisar" },
];

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fdate = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-CL") : "—");

export default function AdminModeloFichaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [data, setData] = useState<Detail | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    setData(await dashboard.adminProfileDetail(id));
  }, [id]);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        const u = me as { is_staff?: boolean; role?: string } | null;
        setIsStaff(!!u?.is_staff);
        setCanModerate(!!u?.is_staff || u?.role === "moderator");
        return reload();
      })
      .then(() => setReady(true))
      .catch(() => router.replace(`/login?next=/admin/modelos/${id}`));
  }, [router, reload, id]);

  const p = (data?.profile ?? null) as ProfileLite | null;

  async function suspend() {
    if (!p) return;
    const action = p.is_suspended ? "unsuspend" : "suspend";
    let reason = "";
    if (action === "suspend") {
      const v = window.prompt(`Motivo para suspender a ${p.stage_name}:`);
      if (v === null) return;
      reason = v;
    } else if (!confirm(`¿Reactivar a ${p.stage_name}?`)) return;
    setBusy(true);
    try {
      await dashboard.adminProfileAction(p.id, action, reason);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function setAuthenticity(value: "none" | "light" | "heavy" | "pending") {
    setBusy(true);
    try {
      await dashboard.adminSetAuthenticity(id, value);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function grant(pubId: number, title: string) {
    const raw = window.prompt(`¿Cuántos días de cortesía para «${title}»? (1-365)`);
    if (raw === null) return;
    const days = parseInt(raw, 10);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setErr("Días inválidos (1-365).");
      return;
    }
    const note = window.prompt("Nota (opcional, queda en la bitácora):") ?? "";
    setBusy(true);
    try {
      await dashboard.adminGrantDays(pubId, days, note);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleMedia(mediaId: number, hidden: boolean) {
    const action = hidden ? "unhide" : "hide";
    if (action === "hide" && !confirm("¿Ocultar esta pieza del perfil público?")) return;
    setBusy(true);
    try {
      await dashboard.adminMediaHide(mediaId, action);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function expire(pubId: number, title: string) {
    if (!confirm(`¿Expirar «${title}» ahora? Dejará de mostrarse.`)) return;
    setBusy(true);
    try {
      await dashboard.adminExpirePublication(pubId);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;
  if (!data || !p) return <p className="text-red-400">No se pudo cargar la ficha.</p>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-neutral-500">
          <Link href="/admin" className="hover:text-pink-400">Admin</Link> /{" "}
          <Link href="/admin/modelos" className="hover:text-pink-400">Modelos</Link> / {p.stage_name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{p.stage_name}</h1>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs">KYC: {p.verification_status}</span>
          {p.is_suspended && <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-300">Suspendida</span>}
          <Link href={`/perfil/${p.slug}`} className="text-xs text-sky-400 hover:underline">ver perfil público →</Link>
        </div>
        <p className="mt-1 text-sm text-neutral-500">{p.email}</p>
        {p.is_suspended && p.suspension_reason && (
          <p className="mt-1 text-sm text-red-300">Motivo: {p.suspension_reason}</p>
        )}
      </header>

      {err && <p className="text-sm text-red-400">{err}</p>}

      {canModerate && (
        <div className="flex flex-wrap gap-2">
          <NotifyButton userId={p.user_id} name={p.stage_name} onError={setErr} />
          <button
            disabled={busy}
            onClick={suspend}
            className={`rounded-full px-3 py-1.5 text-xs disabled:opacity-50 ${
              p.is_suspended
                ? "bg-emerald-600 font-medium text-white hover:bg-emerald-500"
                : "border border-red-500 text-red-300 hover:bg-red-600/20"
            }`}
          >
            {p.is_suspended ? "Reactivar" : "Suspender"}
          </button>
        </div>
      )}

      <Section title="Muro de fotos y videos">
        {canModerate && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
            <span className="text-neutral-400">Autenticidad (retoque):</span>
            {AUTH_OPTIONS.map((o) => (
              <button
                key={o.value}
                disabled={busy}
                onClick={() => setAuthenticity(o.value)}
                className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${
                  p.photo_authenticity === o.value
                    ? "border-pink-500 bg-pink-600/20 text-pink-200"
                    : "border-neutral-700 text-neutral-300 hover:border-pink-500"
                }`}
              >
                {o.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-neutral-600">
              Compara con su KYC. Vuelve a “Por revisar” si cambia sus fotos.
            </span>
          </div>
        )}
        {data.media.length === 0 ? (
          <Empty>Sin multimedia.</Empty>
        ) : (
          <div className="flex flex-wrap gap-3">
            {data.media.map((m) => (
              <div key={m.id} className="w-28">
                <div className={`relative aspect-square overflow-hidden rounded-lg border ${m.is_hidden ? "border-red-500/50 opacity-50" : "border-neutral-800"}`}>
                  {m.media_type === "photo" && m.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">🎬</div>
                  )}
                  {m.is_hidden && (
                    <span className="absolute left-1 top-1 rounded-full bg-red-600/80 px-1.5 py-0.5 text-[10px] text-white">oculta</span>
                  )}
                </div>
                {canModerate && (
                  <button
                    disabled={busy}
                    onClick={() => toggleMedia(m.id, m.is_hidden)}
                    className={`mt-1 w-full rounded-full border px-2 py-1 text-[11px] disabled:opacity-50 ${
                      m.is_hidden
                        ? "border-emerald-600 text-emerald-300 hover:bg-emerald-950/30"
                        : "border-red-500 text-red-300 hover:bg-red-600/20"
                    }`}
                  >
                    {m.is_hidden ? "Mostrar" : "Ocultar"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Publicaciones">
        {data.publications.length === 0 ? (
          <Empty>Sin publicaciones.</Empty>
        ) : (
          <ul className="space-y-2">
            {data.publications.map((pub) => (
              <li key={pub.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {pub.title}{" "}
                    {pub.is_featured && <span className="rounded-full bg-amber-600/20 px-2 py-0.5 text-xs text-amber-200">Destacada</span>}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {pub.is_live ? "🟢 activa" : `⚪ ${pub.status}`} · vence {fdate(pub.expires_at)}
                    {pub.plan_name && ` · plan: ${pub.plan_name}`}
                  </p>
                </div>
                {isStaff && (
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => grant(pub.id, pub.title)}
                      className="rounded-full border border-emerald-600 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950/30 disabled:opacity-50">
                      Dar días
                    </button>
                    {pub.is_live && (
                      <button disabled={busy} onClick={() => expire(pub.id, pub.title)}
                        className="rounded-full border border-neutral-600 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">
                        Expirar
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Pagos">
        {data.receipts.length === 0 ? (
          <Empty>Sin pagos registrados.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {data.receipts.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
                <span>{CLP.format(r.amount)} · {r.publication_title}</span>
                <span className="text-xs text-neutral-500">{r.status} · {fdate(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Reportes recibidos">
        {data.reports.length === 0 ? (
          <Empty>Sin reportes.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {data.reports.map((r) => (
              <li key={r.id} className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
                <span className="text-neutral-200">{r.reason || "(sin motivo)"}</span>
                <span className="ml-2 text-xs text-neutral-500">por {r.reporter_email ?? "anónimo"} · {fdate(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Acciones recientes (bitácora)">
        {data.recent_actions.length === 0 ? (
          <Empty>Sin acciones registradas.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {data.recent_actions.map((a, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
                <span><span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs">{a.action}</span> {a.note}</span>
                <span className="text-xs text-neutral-500">{a.actor_email} · {fdate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-600">{children}</p>;
}
