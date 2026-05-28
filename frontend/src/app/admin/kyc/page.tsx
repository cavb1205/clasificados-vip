"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface QueueItem {
  id: number;
  user_email: string;
  user_username: string;
  stage_name: string | null;
  challenge_code: string;
  has_id_document: boolean;
  has_selfie: boolean;
  has_consent_video: boolean;
  status: string;
  created_at: string;
}

interface AuthMe {
  email: string;
  username: string;
  role: string;
  is_staff?: boolean;
}

export default function AdminKYCPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const reload = useCallback(async () => {
    setItems((await dashboard.kycQueue()) as QueueItem[]);
  }, []);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        // Endpoint /auth/me/ no expone is_staff todavía; el chequeo final
        // ocurre en el backend (IsAdminUser). Si no es staff, kycQueue() lanza 403
        // y mostramos un error claro.
        if (!me) throw new Error();
        return reload();
      })
      .then(() => setReady(true))
      .catch((e) => {
        if (e instanceof Error && /403/.test(e.message)) {
          setErr("Solo administradores pueden ver esta página.");
          setReady(true);
        } else {
          router.replace("/login");
        }
      });
  }, [router, reload]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;
  if (err) return <p className="rounded-lg bg-red-950/40 px-4 py-3 text-red-300">{err}</p>;

  async function act(id: number, decision: "approve" | "reject", reason?: string) {
    setBusyId(id);
    setErr("");
    try {
      await dashboard.kycAction(id, decision, reason);
      setItems((curr) => curr.filter((i) => i.id !== id));
      setOpenId(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Cola de KYC</h1>
        <p className="text-sm text-neutral-500">{items.length} pendiente(s)</p>
      </header>

      {items.length === 0 ? (
        <p className="text-neutral-400">No hay verificaciones pendientes.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((vr) => {
            const open = openId === vr.id;
            return (
              <li
                key={vr.id}
                className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : vr.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-neutral-800/50"
                >
                  <div>
                    <p className="font-medium">{vr.stage_name ?? vr.user_username}</p>
                    <p className="text-xs text-neutral-500">{vr.user_email}</p>
                  </div>
                  <div className="text-right text-xs text-neutral-500">
                    <p>{new Date(vr.created_at).toLocaleString("es-CL")}</p>
                    <p className="mt-1 font-mono text-sky-300">{vr.challenge_code}</p>
                  </div>
                </button>

                {open && (
                  <ReviewDetail
                    vr={vr}
                    busy={busyId === vr.id}
                    onAct={(decision, reason) => act(vr.id, decision, reason)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {err && <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{err}</p>}
    </div>
  );
}

function ReviewDetail({
  vr,
  busy,
  onAct,
}: {
  vr: QueueItem;
  busy: boolean;
  onAct: (decision: "approve" | "reject", reason?: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const docUrl = (field: string) =>
    `${API}/verification/${vr.id}/document/${field}/`;

  return (
    <div className="space-y-4 border-t border-neutral-800 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Block label="Cédula">
          {vr.has_id_document ? (
            // crossOrigin="use-credentials" envía la cookie JWT cross-origin.
            <img
              crossOrigin="use-credentials"
              src={docUrl("id_document")}
              alt="cédula"
              className="w-full rounded-lg border border-neutral-800"
            />
          ) : (
            <Missing label="cédula" />
          )}
        </Block>
        <Block label="Selfie con cédula">
          {vr.has_selfie ? (
            <img
              crossOrigin="use-credentials"
              src={docUrl("selfie")}
              alt="selfie"
              className="w-full rounded-lg border border-neutral-800"
            />
          ) : (
            <Missing label="selfie" />
          )}
        </Block>
        <Block label="Video de consentimiento" wide>
          {vr.has_consent_video ? (
            <video
              crossOrigin="use-credentials"
              src={docUrl("consent_video")}
              controls
              className="w-full rounded-lg border border-neutral-800"
            />
          ) : (
            <Missing label="video" />
          )}
        </Block>
      </div>
      <p className="rounded-lg bg-sky-950/30 px-3 py-2 text-xs text-sky-200">
        Verifica que en el audio se mencione el código{" "}
        <strong className="font-mono">{vr.challenge_code}</strong> y la fecha del
        envío:{" "}
        <strong>
          {new Date(vr.created_at).toLocaleDateString("es-CL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </strong>
        .
      </p>

      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy || !vr.has_consent_video}
            onClick={() => onAct("approve")}
            className="flex-1 rounded-full bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            ✓ Aprobar
          </button>
          <button
            disabled={busy}
            onClick={() => setRejecting(true)}
            className="flex-1 rounded-full border border-red-700/60 px-5 py-2.5 font-medium text-red-200 hover:bg-red-950/30 disabled:opacity-40"
          >
            ✕ Rechazar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (se envía al usuario)"
            rows={3}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => onAct("reject", reason.trim())}
              className="flex-1 rounded-full bg-red-600 px-5 py-2.5 font-medium hover:bg-red-500 disabled:opacity-40"
            >
              Confirmar rechazo
            </button>
            <button
              disabled={busy}
              onClick={() => setRejecting(false)}
              className="rounded-full border border-neutral-700 px-5 py-2.5 text-neutral-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!vr.has_consent_video && (
        <p className="text-xs text-amber-300">
          Sin video de consentimiento no se puede aprobar. Pide al usuario que vuelva
          a enviar la verificación.
        </p>
      )}
    </div>
  );
}

function Block({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function Missing({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-neutral-700 px-3 py-4 text-center text-sm text-neutral-500">
      Sin {label} ✗
    </p>
  );
}
