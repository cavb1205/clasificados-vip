"use client";

import { useEffect } from "react";

/** Si la URL trae ?ref=CODE (link de referido), lo guarda para usarlo al crear
 *  el perfil. Se incluye en /registro y /publica. */
export function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("pv_ref", ref.trim());
  }, []);
  return null;
}
