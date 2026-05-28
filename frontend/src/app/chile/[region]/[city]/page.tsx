import { redirect } from "next/navigation";
import { DEFAULT_GENDER_SLUG } from "@/lib/types";

type Params = Promise<{ region: string; city: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

/**
 * Redirige al gender por defecto (mujeres) preservando los query params.
 * La página real con tabs vive en /chile/[region]/[city]/[gender].
 */
export default async function CityRedirect({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { region, city } = await params;
  const sp = await searchParams;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((item) => usp.append(k, item));
    else if (v !== undefined) usp.set(k, v);
  }
  const qs = usp.toString();
  redirect(`/chile/${region}/${city}/${DEFAULT_GENDER_SLUG}${qs ? `?${qs}` : ""}`);
}
