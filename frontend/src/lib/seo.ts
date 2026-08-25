/**
 * Serializa datos para un bloque JSON-LD inline sin permitir que valores
 * controlados por usuarios cierren el elemento <script>.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
