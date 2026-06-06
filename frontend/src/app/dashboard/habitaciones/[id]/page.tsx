"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { auth, rooms, type PublicRoom } from "@/lib/client-api";
import { RoomDetail } from "@/components/RoomDetail";

export default function RoomDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "gated" | "notfound">("loading");

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        if ((me as { role?: string } | null)?.role !== "model") {
          router.replace("/");
          return Promise.reject(new Error("redirect"));
        }
        return rooms.detail(params.id);
      })
      .then((r) => {
        setRoom(r);
        setState("ok");
      })
      .catch((e) => {
        if (e instanceof Error && e.message === "redirect") return;
        if (e instanceof Error && /activo|forbidden/i.test(e.message)) setState("gated");
        else setState("notfound");
      });
  }, [router, params.id]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/dashboard/habitaciones" className="text-sm text-neutral-400 hover:text-pink-400">
        ← Volver a habitaciones
      </Link>

      {state === "loading" && <p className="text-neutral-400">Cargando…</p>}
      {state === "gated" && (
        <p className="rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Tu perfil debe estar activo para ver las habitaciones.
        </p>
      )}
      {state === "notfound" && (
        <p className="text-sm text-neutral-500">Esta habitación ya no está disponible.</p>
      )}
      {state === "ok" && room && <RoomDetail room={room} />}
    </div>
  );
}
