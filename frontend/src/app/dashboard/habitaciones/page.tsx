"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard, rooms, type PublicRoom } from "@/lib/client-api";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const PERIOD_LABEL: Record<string, string> = {
  daily: "/ día",
  weekly: "/ semana",
  monthly: "/ mes",
};

interface Region {
  id: number;
  name: string;
  slug: string;
}
interface City {
  id: number;
  name: string;
  slug: string;
}

export default function RoomsBrowsePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [gated, setGated] = useState(false);
  const [items, setItems] = useState<PublicRoom[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (region) params.region = region;
    if (city) params.city = city;
    try {
      setItems(await rooms.browse(params));
      setGated(false);
    } catch (e) {
      // 403 = perfil no activo. El backend protege con IsActiveModel.
      if (e instanceof Error && /activo|forbidden/i.test(e.message)) {
        setGated(true);
      } else {
        throw e;
      }
    }
  }, [region, city]);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        const u = me as { role?: string };
        if (u.role !== "model") {
          router.replace("/");
          return Promise.reject(new Error("redirect"));
        }
        return dashboard.regions();
      })
      .then((r) => {
        setRegions(r as Region[]);
        return load();
      })
      .then(() => setReady(true))
      .catch((e) => {
        if (e instanceof Error && e.message === "redirect") return;
        router.replace("/login?next=/dashboard/habitaciones");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (region) {
      dashboard.cities(region).then((c) => setCities(c as City[]));
    } else {
      setCities([]);
    }
    setCity("");
  }, [region]);

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, city]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-neutral-500">
          <Link href="/dashboard" className="hover:text-pink-400">
            Mi panel
          </Link>{" "}
          / Habitaciones
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Habitaciones disponibles
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Piezas publicadas por anfitriones en todo el país. Contacta directo por WhatsApp.
        </p>
      </header>

      {gated ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-600/10 p-6 text-center">
          <p className="font-medium text-amber-200">
            Tu perfil debe estar activo para ver las habitaciones.
          </p>
          <p className="mt-1 text-sm text-neutral-300">
            Completa tu verificación o activa una publicación y vuelve aquí.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-full bg-pink-600 px-5 py-2 text-sm font-medium hover:bg-pink-500"
          >
            Ir a mi panel
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <select
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">Toda región</option>
              {regions.map((r) => (
                <option key={r.id} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm disabled:opacity-50"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!region}
            >
              <option value="">Toda comuna</option>
              {cities.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No hay habitaciones disponibles con estos filtros.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {items.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function waLink(number: string, title: string) {
  const digits = number.replace(/[^\d]/g, "");
  const text = encodeURIComponent(`Hola, vi tu publicación "${title}" en Clasificados VIP.`);
  return `https://wa.me/${digits}?text=${text}`;
}

function RoomCard({ room }: { room: PublicRoom }) {
  const cover = room.photos[0];
  return (
    <li className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      {cover ? (
        <Image
          src={cover.image_url}
          alt={room.title}
          width={640}
          height={400}
          unoptimized
          className="h-44 w-full object-cover"
        />
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-neutral-800 text-neutral-600">
          Sin foto
        </div>
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">
            {room.is_featured && <span className="mr-1 text-amber-300">⭐</span>}
            {room.title}
          </p>
          <p className="whitespace-nowrap text-sm font-medium text-pink-300">
            {CLP.format(room.price)}{" "}
            <span className="text-xs text-neutral-400">{PERIOD_LABEL[room.price_period]}</span>
          </p>
        </div>
        <p className="text-xs text-neutral-400">
          {room.city ?? "—"}
          {room.region && `, ${room.region}`}
          {room.sector && ` · ${room.sector}`}
        </p>
        {room.description && (
          <p className="line-clamp-3 text-sm text-neutral-300">{room.description}</p>
        )}
        <div className="flex gap-2 pt-1">
          {room.whatsapp && (
            <a
              href={waLink(room.whatsapp, room.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-full bg-emerald-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-emerald-500"
            >
              WhatsApp
            </a>
          )}
          {room.phone && (
            <a
              href={`tel:${room.phone}`}
              className="flex-1 rounded-full border border-neutral-700 px-3 py-2 text-center text-sm hover:border-pink-500"
            >
              Llamar
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
