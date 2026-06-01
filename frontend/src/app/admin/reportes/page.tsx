"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard, rooms } from "@/lib/client-api";

interface Report {
  id: number;
  story_id: number;
  kind: "photo" | "video";
  file_url: string | null;
  stage_name: string;
  profile_slug: string;
  reason: string;
  created_at: string;
  story_expires_at: string;
}

interface ProfileReportRow {
  id: number;
  profile_slug: string;
  stage_name: string;
  is_suspended: boolean;
  reporter_email: string | null;
  reason: string;
  created_at: string;
}

interface RoomReportRow {
  id: number;
  listing_id: number;
  listing_title: string;
  is_suspended: boolean;
  reporter_email: string | null;
  reason: string;
  created_at: string;
}

export default function AdminReportesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Report[]>([]);
  const [profileReports, setProfileReports] = useState<ProfileReportRow[]>([]);
  const [roomReports, setRoomReports] = useState<RoomReportRow[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const [stories, profiles, roomsR] = await Promise.all([
      dashboard.adminStoryReports(),
      dashboard.adminProfileReports(),
      rooms.adminRoomReports(),
    ]);
    setItems(stories as Report[]);
    setProfileReports(profiles as ProfileReportRow[]);
    setRoomReports(roomsR as RoomReportRow[]);
  }, []);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        setIsStaff(!!(me as { is_staff?: boolean })?.is_staff);
        return reload();
      })
      .then(() => setReady(true))
      .catch(() => router.replace("/login?next=/admin/reportes"));
  }, [router, reload]);

  async function actProfile(id: number, action: "suspend" | "dismiss") {
    if (!confirm(action === "suspend" ? "¿Suspender este perfil?" : "¿Descartar el reporte?")) return;
    setBusyId(id);
    try {
      await dashboard.adminProfileReportAction(id, action);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function actRoom(id: number, action: "suspend" | "dismiss") {
    if (!confirm(action === "suspend" ? "¿Suspender esta habitación?" : "¿Descartar el reporte?")) return;
    setBusyId(id);
    try {
      await rooms.adminRoomReportAction(id, action);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function act(id: number, action: "delete_story" | "dismiss") {
    const msg =
      action === "delete_story"
        ? "¿Eliminar la story (visible para el público)? Esto borra el archivo."
        : "¿Descartar este reporte? La story queda visible.";
    if (!confirm(msg)) return;
    setBusyId(id);
    try {
      await dashboard.adminStoryReportAction(id, action);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  // Agrupamos por story para que múltiples reportes de la misma story se vean
  // juntos (eliminar 1 vez sirve para todos).
  const grouped = new Map<number, { story: Report; reports: Report[] }>();
  for (const r of items) {
    const entry = grouped.get(r.story_id) ?? { story: r, reports: [] };
    entry.reports.push(r);
    grouped.set(r.story_id, entry);
  }

  return (
    <div>
      <header className="mb-4">
        <p className="text-sm text-neutral-500">
          <Link href="/admin" className="hover:text-pink-400">
            Admin
          </Link>{" "}
          / Reportes de stories
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Stories reportadas
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Stories que recibieron al menos un reporte de la comunidad.
        </p>
      </header>

      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      {grouped.size === 0 ? (
        <p className="text-sm text-neutral-500">No hay reportes pendientes. 👌</p>
      ) : (
        <ul className="space-y-4">
          {Array.from(grouped.values()).map(({ story, reports }) => {
            const expired =
              new Date(story.story_expires_at).getTime() < Date.now();
            return (
              <li
                key={story.story_id}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="w-40 shrink-0 overflow-hidden rounded-lg border border-neutral-800 bg-black">
                    {!story.file_url ? (
                      <div className="flex aspect-[3/4] items-center justify-center text-xs text-neutral-500">
                        (sin archivo)
                      </div>
                    ) : story.kind === "photo" ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={story.file_url}
                        alt=""
                        className="aspect-[3/4] w-full object-cover"
                      />
                    ) : (
                      <video
                        src={story.file_url}
                        controls
                        className="aspect-[3/4] w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      <Link
                        href={`/perfil/${story.profile_slug}`}
                        className="hover:text-pink-300"
                      >
                        {story.stage_name}
                      </Link>{" "}
                      <span className="text-xs text-neutral-500">
                        · {reports.length} reporte{reports.length === 1 ? "" : "s"}
                      </span>
                      {expired && (
                        <span className="ml-2 rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                          ya expiró
                        </span>
                      )}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-neutral-400">
                      {reports.map((r) => (
                        <li key={r.id}>
                          <span className="text-neutral-600">
                            {new Date(r.created_at).toLocaleString("es-CL")} ·{" "}
                          </span>
                          {r.reason || <em className="text-neutral-600">sin motivo</em>}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        disabled={busyId !== null}
                        onClick={() => act(story.id, "delete_story")}
                        className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        Eliminar story
                      </button>
                      {reports.map((r) => (
                        <button
                          key={r.id}
                          disabled={busyId !== null}
                          onClick={() => act(r.id, "dismiss")}
                          className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-emerald-500 disabled:opacity-50"
                          title={`Descartar reporte #${r.id}`}
                        >
                          Descartar #{r.id}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Perfiles reportados ───────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Perfiles reportados</h2>
        {profileReports.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Sin reportes de perfiles. 👌</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {profileReports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    <Link href={`/perfil/${r.profile_slug}`} className="hover:text-pink-300">{r.stage_name}</Link>
                    {r.is_suspended && <span className="ml-2 rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-300">Suspendido</span>}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {new Date(r.created_at).toLocaleString("es-CL")} · {r.reason || "sin motivo"}
                    {r.reporter_email && ` · por ${r.reporter_email}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isStaff && !r.is_suspended && (
                    <button disabled={busyId !== null} onClick={() => actProfile(r.id, "suspend")}
                      className="rounded-full border border-red-500 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/20 disabled:opacity-50">Suspender</button>
                  )}
                  <button disabled={busyId !== null} onClick={() => actProfile(r.id, "dismiss")}
                    className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-emerald-500 disabled:opacity-50">Descartar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Habitaciones reportadas ───────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Habitaciones reportadas</h2>
        {roomReports.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Sin reportes de habitaciones. 👌</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {roomReports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.listing_title}
                    {r.is_suspended && <span className="ml-2 rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-300">Suspendida</span>}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {new Date(r.created_at).toLocaleString("es-CL")} · {r.reason || "sin motivo"}
                    {r.reporter_email && ` · por ${r.reporter_email}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isStaff && !r.is_suspended && (
                    <button disabled={busyId !== null} onClick={() => actRoom(r.id, "suspend")}
                      className="rounded-full border border-red-500 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/20 disabled:opacity-50">Suspender</button>
                  )}
                  <button disabled={busyId !== null} onClick={() => actRoom(r.id, "dismiss")}
                    className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-emerald-500 disabled:opacity-50">Descartar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
