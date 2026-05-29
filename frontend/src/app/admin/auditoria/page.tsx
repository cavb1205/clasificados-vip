"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";

interface LogEntry {
  id: number;
  request_id: number;
  target_email: string;
  accessed_by_email: string | null;
  field_name: string;
  accessed_at: string;
  ip_address: string | null;
}

const FIELD_LABEL: Record<string, string> = {
  id_document: "Documento de identidad",
  selfie: "Selfie",
  consent_video: "Video de consentimiento",
};

export default function AdminAuditoriaPage() {
  const router = useRouter();
  const [items, setItems] = useState<LogEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    auth
      .me()
      .then(() => dashboard.adminKycAudit() as Promise<LogEntry[]>)
      .then((rows) => {
        setItems(rows);
        setReady(true);
      })
      .catch(() => router.replace("/login?next=/admin/auditoria"));
  }, [router]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <div>
      <header className="mb-4">
        <p className="text-sm text-neutral-500">
          <Link href="/admin" className="hover:text-pink-400">
            Admin
          </Link>{" "}
          / Auditoría KYC
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Accesos a documentos KYC
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Registro inmutable de cada vez que un staff descifró un documento.
          Últimos 200 accesos. Exigido por Ley 19.628.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin accesos registrados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-neutral-900 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Staff</th>
                <th className="px-3 py-2 text-left">Modelo</th>
                <th className="px-3 py-2 text-left">Documento</th>
                <th className="px-3 py-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-neutral-800">
                  <td className="px-3 py-2 text-neutral-400">
                    {new Date(r.accessed_at).toLocaleString("es-CL")}
                  </td>
                  <td className="px-3 py-2">
                    {r.accessed_by_email ?? <em className="text-neutral-500">(borrado)</em>}
                  </td>
                  <td className="px-3 py-2 text-neutral-300">{r.target_email}</td>
                  <td className="px-3 py-2">
                    {FIELD_LABEL[r.field_name] ?? r.field_name}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">
                    {r.ip_address ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
