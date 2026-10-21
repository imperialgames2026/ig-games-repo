import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "legacy-frontend/**",
      "solana/**",
      "supabase/**",
      "scripts/**",
      "tests/**",
    ],
  },
  {
    files: [
      "App.jsx",
      "Layout.jsx",
      "main.jsx",
      "pages.config.js",
      "components/**/*.{js,jsx}",
      "pages/**/*.{js,jsx}",
      "hooks/**/*.{js,jsx}",
      "lib/**/*.{js,jsx}",
      "api/**/*.{js,jsx}",
      "utils/**/*.{js,jsx}",
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      "no-unused-vars": "off",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "react/jsx-no-undef": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-key": "error",
      "react/no-direct-mutation-state": "error",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
