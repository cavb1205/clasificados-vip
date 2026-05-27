"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth } from "@/lib/client-api";

interface Me {
  email: string;
  username: string;
  role: "model" | "client" | "admin";
}

/**
 * Botones de cabecera que cambian según el estado de sesión:
 * - No logueado: Ingresar + Publicar (CTA).
 * - Logueado: link directo al panel correspondiente al rol.
 *
 * El estado de sesión se detecta llamando /auth/me/ al montar. La cookie JWT
 * es HttpOnly cross-domain → no podemos chequearla desde JS, por eso la
 * confirmación es contra el backend.
 */
export function AuthNav() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = cargando

  useEffect(() => {
    auth
      .me()
      .then((data) => setMe(data as Me))
      .catch(() => setMe(null));
  }, []);

  // Placeholder mientras carga: mantenemos el ancho con un par de chips
  // grises para evitar layout shift cuando se reemplaza al final.
  if (me === undefined) {
    return (
      <div className="flex gap-2 text-sm">
        <span className="h-7 w-16 animate-pulse rounded-full bg-neutral-900" />
        <span className="h-7 w-20 animate-pulse rounded-full bg-neutral-900" />
      </div>
    );
  }

  if (me) {
    const panel = me.role === "model" ? "/dashboard" : "/";
    return (
      <div className="flex gap-3 text-sm">
        <Link
          href={panel}
          className="rounded-full bg-pink-600 px-4 py-1.5 font-medium hover:bg-pink-500"
        >
          Mi panel
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-4 text-sm">
      <Link href="/login" className="hover:text-pink-400">
        Ingresar
      </Link>
      <Link
        href="/registro"
        className="rounded-full bg-pink-600 px-4 py-1.5 font-medium hover:bg-pink-500"
      >
        Publicar
      </Link>
    </div>
  );
}
