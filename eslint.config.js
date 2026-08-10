// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.vercel/**",
      "**/*.config.js",
      "**/*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      // Remplace no-unused-vars par la version "unused-imports", qui sait
      // distinguer un import mort d'une variable prefixee par `_` (volontaire).
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      // Style de code deja etabli dans le projet (ex: assertions non-null `!`
      // utilisees deliberement apres verification manuelle) - pas d'interdiction.
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
