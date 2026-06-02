import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Reglas *advisory* del React Compiler (eslint-plugin-react-hooks v6, que
    // Next 16 activa por defecto): son sugerencias de optimización, no bugs.
    // Las dejamos como advertencias —visibles pero sin bloquear el CI— para
    // poder gatear los errores REALES (imports/variables sin usar, a11y, etc.).
    // Se pueden ir corrigiendo gradualmente; el patrón marcado es intencional
    // (leer localStorage al montar, animaciones, countdowns de tiempo, etc.).
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);

export default eslintConfig;
