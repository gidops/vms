// Shared flat ESLint config for React library packages (e.g. @vms/ui).
// Extends the base config with React, hooks, and accessibility rules.
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { base } from "./base.mjs";

/** @type {import("eslint").Linter.Config[]} */
export const reactLib = [
  ...base,
  {
    files: ["**/*.{ts,tsx,jsx}"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // The new JSX transform makes React-in-scope unnecessary.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
];

export default reactLib;
