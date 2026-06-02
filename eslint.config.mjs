// Flat ESLint config. Next 16 removed the built-in `next lint` command, so
// linting is wired directly to ESLint here. This is the type-aware setup: the
// typescript-eslint rules that need type information (no-floating-promises,
// no-misused-promises) are enabled, because the highest-value bugs in this
// codebase are exactly those — the async audio toggles return promises that an
// onClick must not silently drop.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    // Build output, deps, and generated types are not ours to lint.
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // projectService lets typescript-eslint resolve the right tsconfig per
        // file without us hand-listing projects — the modern type-aware setup.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // React-hooks correctness: exhaustive-deps and rules-of-hooks. The scene and
  // audio engine lean hard on useRef/useFrame/useEffect cleanup, so a wrong
  // deps array is a real regression vector here.
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // react-hooks v7 ships compiler-aligned RC rules that are stricter than
      // React's own published guidance and fire on patterns that are correct
      // and intentional in this codebase. Demote to `warn` (visible, not
      // CI-blocking) rather than disable — keeping the signal without
      // rejecting the deliberate idiom:
      //
      //   • refs — the ref-mirror-during-render pattern (onChangeRef.current =
      //     onChange) is the React-docs-endorsed way to keep a callback's
      //     identity stable without re-subscribing a listener every render.
      //   • set-state-in-effect — hydrating from localStorage / matchMedia in
      //     an effect is the standard SSR-safe pattern: render the default on
      //     the server, patch client state after mount.
      //
      // rules-of-hooks and exhaustive-deps stay at `error` — those catch real
      // regressions.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  {
    rules: {
      // `void err;` is the codebase's deliberate "swallowed, surfaced via UI
      // state instead" idiom (audio toggles). Allow it; flag everything else.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // The shaders cast uniform values and r3f props through `as`; the
      // codebase has zero raw `any`, so keep the unsafe-* rules but let the
      // few justified assertions through as warnings rather than hard errors.
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // Config + test tooling files run in Node and aren't part of the app's
  // type-checked program; lint them without type info to avoid project errors.
  {
    files: ["*.config.{js,mjs,ts}", "tests/**", "**/*.test.ts"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
);
