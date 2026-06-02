import Link from "next/link";
import Image from "next/image";
import type { PublicProfile } from "@/lib/types";
import { FavoriteHeart } from "@/components/FavoriteHeart";

/** Estrellas para rating 0-5, soporta media estrella. */
function Stars({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span aria-label={`${value.toFixed(1)} de 5`} className="text-amber-400">
      {"★".repeat(full)}
      {half && "⯨"}
      <span className="text-neutral-700">{"★".repeat(empty)}</span>
    </span>
  );
}

export function ProfileCard({ profile }: { profile: PublicProfile }) {
  const ring = profile.is_featured
    ? "border-amber-400/70 shadow-[0_0_0_1px_rgba(251,191,36,0.4)]"
    : "border-neutral-800 hover:border-pink-600";

  return (
    <div className="relative">
    <FavoriteHeart slug={profile.slug} className="absolute right-2 top-2 z-10" />
    <Link
      href={`/perfil/${profile.slug}`}
      className={`group relative block overflow-hidden rounded-2xl border bg-neutral-900 transition ${ring}`}
    >
      <div className="relative">
        {profile.cover_photo ? (
          <Image
            src={profile.cover_photo}
            alt={profile.stage_name}
            width={600}
            height={800}
            sizes="(max-width: 640px) 50vw, 33vw"
            className="aspect-[3/4] w-full object-cover object-top"
          />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center bg-neutral-800 text-neutral-600">
            Sin foto
          </div>
        )}

        {/* Badges flotantes sobre la foto */}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <span
            title="Identidad verificada"
            className="flex items-center gap-1 rounded-full bg-sky-600/95 px-2 py-0.5 text-[11px] font-medium text-white"
          >
            ✓ Verificada
          </span>
          {profile.is_featured && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
              Destacada
            </span>
          )}
          {profile.is_available_now && (
            <span
              title="Disponible para contactar ahora"
              className="flex items-center gap-1 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[11px] font-semibold text-white"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Disponible ahora
            </span>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="truncate font-display text-base font-semibold leading-tight tracking-tight sm:text-lg">
            {profile.stage_name}
          </h2>
          {profile.rating_count > 0 && profile.rating_average !== null && (
            <span className="shrink-0 text-xs">
              <Stars value={profile.rating_average} />{" "}
              <span className="text-neutral-500">({profile.rating_count})</span>
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-neutral-400">
          {profile.age} años
          {profile.city && ` · ${profile.city.name}`}
          {profile.base_rate && ` · desde $${profile.base_rate.toLocaleString("es-CL")}`}
        </p>
        {profile.description && (
          <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{profile.description}</p>
        )}
      </div>
    </Link>
    </div>
  );
}
