"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";
import { ProfileCard } from "@/components/ProfileCard";
import type { PublicProfile } from "@/lib/types";

export default function FavoritesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<PublicProfile[]>([]);

  useEffect(() => {
    auth
      .me()
      .then(() => dashboard.myFavorites())
      .then((list) => {
        setItems(list as PublicProfile[]);
        setReady(true);
      })
      .catch(() => router.replace("/login?next=/favoritos"));
  }, [router]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Mis favoritos</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Perfiles que guardaste. Toca el ♥ en un perfil para agregarlo o quitarlo.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
          <p className="text-neutral-300">Todavía no tienes favoritos.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500"
          >
            Explorar perfiles
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {items.map((p) => (
            <ProfileCard key={p.slug} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}
