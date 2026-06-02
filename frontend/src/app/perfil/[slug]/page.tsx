import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getProfileRating, getProfileReviews, getProfileStories } from "@/lib/api";
import { StoriesStrip } from "@/components/StoriesStrip";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ContactPanel } from "@/components/ContactPanel";
import { ProfileActions } from "@/components/ProfileActions";
import { ProfileTracker } from "@/components/ProfileTracker";
import { DEFAULT_GENDER_SLUG } from "@/lib/types";

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
    <article className="pb-28 md:pb-0">
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

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {profile.stage_name}
          </h1>
          <p className="mt-1 text-neutral-400">
            {profile.age} años
            {profile.city && ` · ${profile.city.name}, ${profile.city.region.name}`}
          </p>
        </div>
        {rating.average !== null && (
          <p className="text-sm text-neutral-300">
            ★ {rating.average} <span className="text-neutral-500">({rating.count})</span>
          </p>
        )}
      </header>

      <div className="mt-3">
        <ProfileActions slug={slug} />
      </div>

      {profile.description && (
        <p className="mt-5 whitespace-pre-line text-neutral-300">{profile.description}</p>
      )}

      {/*
        Mobile: sticky al fondo del viewport (zona del pulgar) con safe-area
        para el notch. Desktop: inline después de la descripción, sin sticky.
      */}
      <div
        className="
          fixed inset-x-0 bottom-0 z-30 border-t border-neutral-800 bg-neutral-950/95
          px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur
          md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none
        "
      >
        <div className="mx-auto max-w-5xl">
          <ContactPanel
            slug={slug}
            stageName={profile.stage_name}
            whatsapp={profile.whatsapp}
            telegram={profile.telegram}
          />
        </div>
      </div>
      <ProfileTracker slug={slug} />

      {profile.services.length > 0 && (
        <div className="mt-5 space-y-2">
          {(["service", "extra", "feature"] as const).map((cat) => {
            const tags = profile.services.filter((s) => s.category === cat);
            if (tags.length === 0) return null;
            const tone =
              cat === "service" ? "bg-pink-600/20 text-pink-200"
              : cat === "extra" ? "bg-amber-600/20 text-amber-200"
              : "bg-sky-600/20 text-sky-200";
            return (
              <div key={cat} className="flex flex-wrap gap-1.5">
                {tags.map((s) => (
                  <span key={s.id} className={`rounded-full px-2.5 py-0.5 text-xs ${tone}`}>
                    {s.name}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {profile.photos?.length > 0 && (
        <PhotoGallery photos={profile.photos} alt={profile.stage_name} />
      )}

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
