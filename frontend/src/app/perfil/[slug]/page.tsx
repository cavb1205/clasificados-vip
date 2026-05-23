import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProfile, getProfileRating, getProfileReviews } from "@/lib/api";

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

  const [reviews, rating] = await Promise.all([
    getProfileReviews(slug),
    getProfileRating(slug),
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

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{profile.stage_name}</h1>
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

      {profile.description && (
        <p className="mt-5 whitespace-pre-line text-neutral-300">{profile.description}</p>
      )}

      {profile.services.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {profile.services.map((s) => (
            <span key={s.id} className="rounded-full bg-neutral-800 px-3 py-1 text-xs">
              {s.name}
            </span>
          ))}
        </div>
      )}

      {profile.photos?.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {profile.photos.map((url, i) => (
            <Image
              key={url}
              src={url}
              alt={`${profile.stage_name} foto ${i + 1}`}
              width={600}
              height={600}
              sizes="(max-width: 640px) 50vw, 33vw"
              priority={i === 0}
              className="aspect-square w-full rounded-xl object-cover"
            />
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Reseñas</h2>
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
    </article>
  );
}
