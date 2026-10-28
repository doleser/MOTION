
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";

export default defineConfig([
  expoConfig,

  {
    ignores: ["dist/*"],
  },

  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    ...js.configs.recommended,
    languageOptions: {
      globals: globals.browser,
    },
  },

  ...tseslint.configs.recommended,

  pluginReact.configs.flat.recommended,

  // React 17+ uses the automatic JSX transform.
  {
    files: ["**/*.{jsx,tsx}"],
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
    },
  },
]);
