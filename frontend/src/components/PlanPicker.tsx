"use client";

import type { Plan } from "@/lib/types";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const BASE_PERKS = [
  "Tu perfil visible en tu comuna",
  "Fotos y video en tu muro",
  "Botón “Disponible ahora”",
  "Reseñas de clientes",
  "Contacto por WhatsApp / Telegram",
];

// Beneficios exclusivos de los planes con destacado (includes_featured).
const FEATURED_PERKS = [
  "Apareces de primera en los listados",
  "Sello VIP dorado en tu perfil",
  "Historias (stories) de 24 h",
];

/**
 * Selector de planes en tarjetas, mostrando precio y beneficios para que la
 * modelo entienda qué incluye cada uno (y por qué conviene el destacado).
 */
export function PlanPicker({
  plans,
  onChoose,
  busy,
}: {
  plans: Plan[];
  onChoose: (planId: number) => void;
  busy?: boolean;
}) {
  // Destacados primero para resaltar el de mayor valor.
  const ordered = [...plans].sort(
    (a, b) => Number(b.includes_featured) - Number(a.includes_featured) || a.price - b.price,
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ordered.map((p) => {
        const feat = p.includes_featured;
        return (
          <div
            key={p.id}
            className={`relative flex flex-col rounded-2xl border p-4 ${
              feat ? "border-[#caa24a]/60 bg-[#e9c15c]/[0.04]" : "border-neutral-800 bg-neutral-900"
            }`}
          >
            {feat && (
              <span className="badge-vip absolute -top-2 right-4 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                ★ Recomendado
              </span>
            )}
            <p className={`font-display text-lg font-semibold ${feat ? "text-gold" : ""}`}>
              {p.name}
            </p>
            <p className="mt-0.5 text-2xl font-bold">
              {CLP.format(p.price)}
              <span className="text-sm font-normal text-neutral-500"> / {p.duration_days} días</span>
            </p>

            <ul className="mt-3 space-y-1.5 text-sm">
              {BASE_PERKS.map((perk) => (
                <li key={perk} className="flex gap-2 text-neutral-300">
                  <span className="text-emerald-400" aria-hidden>✓</span> {perk}
                </li>
              ))}
              {feat &&
                FEATURED_PERKS.map((perk) => (
                  <li key={perk} className="flex gap-2 font-medium text-[#e9c15c]">
                    <span aria-hidden>★</span> {perk}
                  </li>
                ))}
              {!feat && (
                <li className="flex gap-2 text-neutral-600">
                  <span aria-hidden>—</span> Sin destacado, sello VIP ni historias
                </li>
              )}
            </ul>

            <button
              type="button"
              disabled={busy}
              onClick={() => onChoose(p.id)}
              className={`mt-4 w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-50 ${
                feat
                  ? "btn-gold"
                  : "border border-neutral-700 text-neutral-200 hover:border-pink-500"
              }`}
            >
              Elegir {p.name}
            </button>
          </div>
        );
      })}
    </div>
  );
}
