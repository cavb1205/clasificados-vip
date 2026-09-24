"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard, privacyRequests, type MyReview, type PrivacyRequestRecord } from "@/lib/client-api";

interface Me {
  email?: string;
  username?: string;
  role?: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente de moderación", cls: "bg-amber-600/20 text-amber-300" },
  approved: { label: "Publicada", cls: "bg-emerald-600/20 text-emerald-300" },
  rejected: { label: "Rechazada", cls: "bg-red-600/20 text-red-300" },
};

const ROLE_LABEL: Record<string, string> = {
  client: "Cliente",
  model: "Modelo",
  host: "Anfitrión",
  moderator: "Moderador",
  admin: "Administrador",
};

export default function AccountPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [reviews, setReviews] = useState<MyReview[]>([]);

  useEffect(() => {
    auth
      .me()
      .then((m) => {
        setMe(m as Me);
        return dashboard.myReviews().catch(() => [] as MyReview[]);
      })
      .then((r) => {
        setReviews(r as MyReview[]);
        setReady(true);
      })
      .catch(() => router.replace("/login?next=/cuenta"));
  }, [router]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Mi cuenta</h1>
      </header>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-neutral-500">Correo</dt>
          <dd>{me?.email}</dd>
          <dt className="text-neutral-500">Usuario</dt>
          <dd>{me?.username}</dd>
          <dt className="text-neutral-500">Tipo de cuenta</dt>
          <dd>{ROLE_LABEL[me?.role ?? ""] ?? me?.role}</dd>
        </dl>
      </section>

      <LegalDocumentsAcceptance />
      <PrivacyRequestsPanel />

      <ChangePasswordForm />

      {me?.role === "client" && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Mis reseñas</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-neutral-500">Aún no dejaste reseñas.</p>
          ) : (
            <ul className="space-y-2">
              {reviews.map((r) => {
                const st = STATUS[r.status] ?? STATUS.pending;
                return (
                  <li key={r.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        <Link href={`/perfil/${r.profile_slug}`} className="hover:text-pink-300">
                          {r.stage_name}
                        </Link>{" "}
                        <span className="text-amber-400">{"★".repeat(r.rating)}</span>
                      </p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-neutral-400">{r.comment}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function LegalDocumentsAcceptance() {
  const [current, setCurrent] = useState<boolean | null>(null);
  const [enforcementActive, setEnforcementActive] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    auth.legalAcceptance()
      .then((result) => {
        setCurrent(result.current);
        setEnforcementActive(result.enforcement_active);
      })
      .catch(() => setError("No se pudo consultar la versión de los documentos."));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!terms || !privacy) {
      setError("Debes aceptar los Términos y confirmar por separado que leíste la Política de privacidad.");
      return;
    }
    setBusy(true);
    try {
      await auth.acceptCurrentLegalDocuments();
      setCurrent(true);
      setMessage("La aceptación de la versión vigente quedó registrada en tu cuenta.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la aceptación.");
    } finally {
      setBusy(false);
    }
  }

  if (current === true) {
    return (
      <section className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-4 text-sm">
        <h2 className="font-semibold">Documentos vigentes</h2>
        <p className="mt-1 text-neutral-400">La última aceptación registrada coincide con las versiones vigentes.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-amber-700/60 bg-amber-950/20 p-4">
      <h2 className="font-semibold">Revisar documentos legales</h2>
      <p className="mt-1 text-sm text-neutral-400">
        {enforcementActive
          ? "Esta cuenta aún no tiene registradas las versiones vigentes, o los documentos cambiaron. Las funciones protegidas requieren una aceptación vigente de los Términos y confirmación de lectura de Privacidad."
          : "Esta cuenta aún no tiene registradas las versiones vigentes, o los documentos cambiaron. El control obligatorio aún no está activado; puedes revisar los Términos y confirmar la lectura de Privacidad ahora."}
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
        <label htmlFor="account-accept-terms" className="flex items-start gap-2">
          <input id="account-accept-terms" type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 accent-pink-500" />
          <span>Acepto los <Link href="/terminos" target="_blank" className="text-pink-300 underline">Términos y condiciones</Link>.</span>
        </label>
        <label htmlFor="account-accept-privacy" className="flex items-start gap-2">
          <input id="account-accept-privacy" type="checkbox" required checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-1 accent-pink-500" />
          <span>Confirmo que leí la <Link href="/privacidad" target="_blank" className="text-pink-300 underline">Política de privacidad</Link>. Las autorizaciones específicas se solicitan por separado.</span>
        </label>
        {error && <p role="alert" className="text-red-400">{error}</p>}
        {message && <p role="status" className="text-emerald-400">{message}</p>}
        <button type="submit" disabled={busy} className="rounded-full bg-pink-600 px-4 py-2 font-medium disabled:opacity-50">
          {busy ? "Guardando…" : enforcementActive ? "Aceptar versión vigente" : "Registrar aceptación"}
        </button>
      </form>
    </section>
  );
}

const PRIVACY_REQUEST_LABELS: Record<PrivacyRequestRecord["request_type"], string> = {
  access: "Acceso o copia de mis datos",
  rectification: "Rectificar mis datos",
  erasure: "Eliminar/cancelar mis datos",
  opposition: "Oposición o retiro de consentimiento",
  other: "Otra solicitud de privacidad",
};

const PRIVACY_REQUEST_STATUS: Record<PrivacyRequestRecord["status"], string> = {
  open: "Recibida",
  in_review: "En revisión",
  completed: "Resuelta",
  denied: "No procede",
};

function PrivacyRequestsPanel() {
  const [items, setItems] = useState<PrivacyRequestRecord[]>([]);
  const [type, setType] = useState<PrivacyRequestRecord["request_type"]>("access");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    privacyRequests.list().then(setItems).catch(() => setError("No se pudieron cargar tus solicitudes."));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const item = await privacyRequests.submit({ request_type: type, details });
      setItems((existing) => [item, ...existing]);
      setDetails("");
      setMessage("Solicitud recibida. El equipo la revisará; puedes consultar su estado aquí.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-2 text-lg font-semibold">Privacidad y datos de tu cuenta</h2>
      <p className="mb-4 text-sm text-neutral-400">Envía una solicitud autenticada de acceso, rectificación o eliminación. No incluyas contraseñas ni adjuntes documentos de identidad.</p>
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="privacy-request-type" className="sr-only">Tipo de solicitud</label>
        <select id="privacy-request-type" value={type} onChange={(e) => setType(e.target.value as PrivacyRequestRecord["request_type"])} className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm">
          {Object.entries(PRIVACY_REQUEST_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label htmlFor="privacy-request-details" className="sr-only">Detalles opcionales</label>
        <textarea id="privacy-request-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={3000} rows={3} placeholder="Detalles necesarios para tramitarla (opcional)" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
        <button type="submit" disabled={busy} className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium disabled:opacity-50">
          {busy ? "Enviando…" : "Enviar solicitud"}
        </button>
      </form>
      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-neutral-800 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span>{PRIVACY_REQUEST_LABELS[item.request_type]}</span>
                <span className="text-neutral-400">{PRIVACY_REQUEST_STATUS[item.status]}</span>
              </div>
              <time className="mt-1 block text-xs text-neutral-500" dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString("es-CL")}</time>
              {item.resolution_notes && (
                <p className="mt-2 border-t border-neutral-800 pt-2 text-neutral-300">
                  Respuesta del equipo: {item.resolution_notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChangePasswordForm() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (next.length < 8) {
      setErr("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setErr("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await dashboard.changePassword({ current_password: cur, new_password: next });
      setMsg("Contraseña actualizada.");
      setCur("");
      setNext("");
      setConfirm("");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm";

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-lg font-semibold">Cambiar contraseña</h2>
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="current-password" className="sr-only">Contraseña actual</label>
        <input id="current-password" name="current_password" type="password" placeholder="Contraseña actual" autoComplete="current-password"
          className={inputCls} value={cur} onChange={(e) => setCur(e.target.value)} required />
        <label htmlFor="account-new-password" className="sr-only">Nueva contraseña</label>
        <input id="account-new-password" name="new_password" type="password" placeholder="Nueva contraseña" autoComplete="new-password"
          className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} required />
        <label htmlFor="account-confirm-password" className="sr-only">Repetir nueva contraseña</label>
        <input id="account-confirm-password" name="new_password_confirmation" type="password" placeholder="Repetir nueva contraseña" autoComplete="new-password"
          className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {err && <p className="text-sm text-red-400" role="alert">{err}</p>}
        {msg && <p className="text-sm text-emerald-400" role="status">{msg}</p>}
        <button type="submit" disabled={busy}
          className="rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500 disabled:opacity-50">
          {busy ? "Guardando…" : "Actualizar contraseña"}
        </button>
      </form>
    </section>
  );
}
