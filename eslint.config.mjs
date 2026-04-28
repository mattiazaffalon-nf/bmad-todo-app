import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const NO_MODALS_PATHS = [
  "@radix-ui/react-dialog",
  "@radix-ui/react-alert-dialog",
  "@base-ui/react/dialog",
  "@base-ui/react/alert-dialog",
];

const noModalsPaths = NO_MODALS_PATHS.map((name) => ({
  name,
  message:
    "Modals are forbidden by UX policy. Use inline affordances (UndoToast, ErrorIndicator) instead. See AGENTS.md.",
}));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // No-modals rule (UX policy — see AGENTS.md). Applies globally.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: noModalsPaths },
      ],
    },
  },

  // Architectural import-graph: components/** must not reach into db/** or app/api/**.
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/db/*", "@/db", "**/db/*"],
              message: "components/ must not import from db/ — go through hooks/.",
            },
            {
              group: ["@/app/api/*", "**/app/api/*"],
              message: "components/ must not import from app/api/ — go through hooks/ + lib/api-client.",
            },
          ],
          paths: noModalsPaths,
        },
      ],
    },
  },

  // Architectural import-graph: hooks/** must not reach into db/** or components/**.
  {
    files: ["hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/db/*", "@/db", "**/db/*"],
              message: "hooks/ must not import from db/ — call lib/api-client instead.",
            },
            {
              group: ["@/components/*", "**/components/*"],
              message: "hooks/ must not import from components/ — hooks are consumed by components, not the reverse.",
            },
          ],
          paths: noModalsPaths,
        },
      ],
    },
  },

  // Architectural import-graph: app/api/** must not reach into components/** or hooks/**.
  {
    files: ["app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*", "**/components/*"],
              message: "app/api/ must not import from components/ — handlers stay server-side.",
            },
            {
              group: ["@/hooks/*", "**/hooks/*"],
              message: "app/api/ must not import from hooks/ — hooks are client-only.",
            },
          ],
          paths: noModalsPaths,
        },
      ],
    },
  },

  // Architectural import-graph: db/** is the data boundary — must not reach into components/**, hooks/**, or app/api/**.
  // Direction is one-way: app/api/ -> db/queries -> db/client. Never reversed.
  {
    files: ["db/**/*.{ts,tsx}"],
    ignores: ["db/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*", "**/components/*"],
              message: "db/ must not import from components/ — data layer stays UI-agnostic.",
            },
            {
              group: ["@/hooks/*", "**/hooks/*"],
              message: "db/ must not import from hooks/ — hooks are client-only.",
            },
            {
              group: ["@/app/api/*", "**/app/api/*"],
              message: "db/ must not import from app/api/ — handlers depend on db, not the reverse.",
            },
          ],
          paths: noModalsPaths,
        },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
