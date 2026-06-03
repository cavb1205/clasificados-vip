import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getProfileRating, getProfileReviews, getProfileStories } from "@/lib/api";
import { StoriesStrip } from "@/components/StoriesStrip";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ContactPanel } from "@/components/ContactPanel";
import { ProfileActions } from "@/components/ProfileActions";
import { ProfileTracker } from "@/components/ProfileTracker";
import { AvatarView } from "@/components/AvatarView";
import { ReviewForm } from "@/components/ReviewForm";
import { DEFAULT_GENDER_SLUG } from "@/lib/types";

const GENDER_LABEL: Record<string, string> = { female: "Mujer", trans: "Trans", male: "Hombre" };

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="text-amber-400" aria-label={`${value} de 5`}>
      {"★".repeat(full)}
      <span className="text-neutral-700">{"★".repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

function Dato({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className={`text-sm ${highlight ? "font-semibold text-pink-300" : "text-neutral-200"}`}>{value}</dd>
    </div>
  );
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) return { title: "Perfil no encontrado" };
  const place = profile.city ? `${profile.city.name}, ${profile.city.region.name}` : "Chile";
  return {
    title: `${profile.stage_name} — ${place}`,
    description: profile.description?.slice(0, 155) || `Perfil verificado en ${place}.`,
    alternates: { canonical: `/perfil/${slug}` },
    openGraph: {
      title: profile.stage_name,
      description: profile.description,
      images: profile.cover_photo ? [profile.cover_photo] : undefined,
    },
  };
}

export default async function ProfilePage({ params }: { params: Params }) {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) notFound();

  const [reviews, rating, stories] = await Promise.all([
    getProfileReviews(slug),
    getProfileRating(slug),
    getProfileStories(slug).catch(() => []),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.stage_name,
    address: profile.city
      ? { "@type": "PostalAddress", addressLocality: profile.city.name, addressRegion: profile.city.region.name }
      : undefined,
    ...(rating.count > 0 && rating.average
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.average,
            reviewCount: rating.count,
          },
        }
      : {}),
  };

  // Back / breadcrumb: si la modelo tiene comuna, ofrecemos volver al listado
  // de esa comuna (tab Todos) para que el usuario siga explorando ahí mismo.
  const cityHref = profile.city
    ? `/chile/${profile.city.region.slug}/${profile.city.slug}/${DEFAULT_GENDER_SLUG}`
    : null;

  return (
    <article className="pb-28 lg:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Back + breadcrumb. En móvil predomina el "Volver", en desktop el rastro. */}
      <nav className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {cityHref ? (
          <Link
            href={cityHref}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-800 px-3 py-1 text-neutral-300 hover:border-pink-500 hover:text-pink-300"
          >
            <span aria-hidden>←</span>
            Volver a {profile.city!.name}
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-800 px-3 py-1 text-neutral-300 hover:border-pink-500 hover:text-pink-300"
          >
            <span aria-hidden>←</span>
            Volver al inicio
          </Link>
        )}
        {profile.city && (
          <p className="text-neutral-500">
            <Link href="/" className="hover:text-pink-400">
              Chile
            </Link>{" "}
            /{" "}
            <Link
              href={`/chile/${profile.city.region.slug}`}
              className="hover:text-pink-400"
            >
              {profile.city.region.name}
            </Link>{" "}
            /{" "}
            <Link href={cityHref!} className="hover:text-pink-400">
              {profile.city.name}
            </Link>{" "}
            / <span className="text-neutral-300">{profile.stage_name}</span>
          </p>
        )}
      </nav>

      {stories.length > 0 && (
        <div className="mb-4">
          <StoriesStrip
            stories={stories}
            stageName={profile.stage_name}
            coverPhoto={profile.cover_photo}
          />
        </div>
      )}

      <div className="lg:grid lg:grid-cols-5 lg:gap-8">
        {/* Columna de info + contacto (sticky en desktop) */}
        <div className="lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
          <header className="flex items-center gap-4">
            {profile.avatar && <AvatarView src={profile.avatar} alt={profile.stage_name} />}
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {profile.stage_name}
              </h1>
              {rating.count > 0 && rating.average !== null ? (
                <p className="mt-1 text-sm">
                  <Stars value={rating.average} />{" "}
                  <span className="text-neutral-400">{rating.average}</span>{" "}
                  <span className="text-neutral-600">({rating.count})</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-neutral-500">Sin reseñas aún</p>
              )}
            </div>
          </header>

          {/* Señales de confianza / disponibilidad */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1 rounded-full bg-sky-600/20 px-2.5 py-1 font-medium text-sky-200">
              ✓ Identidad verificada
            </span>
            {profile.is_available_now && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 font-medium text-emerald-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Disponible ahora
              </span>
            )}
          </div>

          {/* Ficha de datos clave */}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <Dato label="Categoría" value={GENDER_LABEL[profile.gender] ?? profile.gender} />
            <Dato label="Edad" value={`${profile.age} años`} />
            {profile.city && (
              <Dato label="Ciudad" value={`${profile.city.name}, ${profile.city.region.name}`} />
            )}
            {profile.base_rate && (
              <Dato label="Tarifa desde" value={`$${profile.base_rate.toLocaleString("es-CL")}`} highlight />
            )}
          </dl>

          <div className="mt-4">
            <ProfileActions slug={slug} />
          </div>

          {profile.description && (
            <p className="mt-4 whitespace-pre-line text-sm text-neutral-300">{profile.description}</p>
          )}

          {/* Servicios / extras / características, etiquetados */}
          {profile.services.length > 0 && (
            <div className="mt-5 space-y-3">
              {(
                [
                  ["service", "Servicios", "bg-pink-600/20 text-pink-200"],
                  ["extra", "Extras", "bg-amber-600/20 text-amber-200"],
                  ["feature", "Características", "bg-sky-600/20 text-sky-200"],
                ] as const
              ).map(([cat, label, tone]) => {
                const tags = profile.services.filter((s) => s.category === cat);
                if (tags.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="mb-1.5 text-xs uppercase tracking-wide text-neutral-500">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((s) => (
                        <span key={s.id} className={`rounded-full px-2.5 py-0.5 text-xs ${tone}`}>
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/*
            Contacto: sticky al fondo en móvil/tablet (zona del pulgar, safe-area
            para el notch); inline dentro de esta columna en desktop (lg+).
          */}
          <div
            className="
              fixed inset-x-0 bottom-0 z-30 border-t border-neutral-800 bg-neutral-950/95
              px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur
              lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none
            "
          >
            <div className="mx-auto max-w-5xl lg:max-w-none">
              <ContactPanel
                slug={slug}
                stageName={profile.stage_name}
                whatsapp={profile.whatsapp}
                telegram={profile.telegram}
              />
            </div>
          </div>
        </div>

        {/* Columna de galería (muro de fotos) */}
        <div className="mt-2 lg:col-span-3 lg:mt-0">
          {profile.photos?.length > 0 ? (
            <PhotoGallery photos={profile.photos} alt={profile.stage_name} />
          ) : (
            <p className="mt-6 text-sm text-neutral-500">Esta modelo aún no subió fotos a su muro.</p>
          )}
        </div>
      </div>
      <ProfileTracker slug={slug} />

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Reseñas</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Aún no hay reseñas aprobadas.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-neutral-800 p-4">
                <p className="text-sm font-medium">
                  {r.client_username} · ★ {r.rating}
                </p>
                {r.comment && <p className="mt-1 text-sm text-neutral-400">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
        <ReviewForm slug={slug} />
      </section>

      {cityHref && (
        <div className="mt-10 flex justify-center">
          <Link
            href={cityHref}
            className="rounded-full border border-neutral-700 px-5 py-2.5 text-sm text-neutral-300 hover:border-pink-500 hover:text-pink-300"
          >
            Ver más perfiles en {profile.city!.name} →
          </Link>
        </div>
      )}
    </article>
  );
}
