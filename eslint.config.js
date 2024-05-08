import ts from "@typescript-eslint/eslint-plugin"
import {FlatCompat} from "@eslint/eslintrc";
import path from "path";
import {fileURLToPath} from "url";

// mimic CommonJS variables -- not needed if using CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    recommendedConfig: {},
    baseDirectory: __dirname,
});

/**
 * @type {import('eslint').Linter.FlatConfig}
 */
export default [
    {
        plugins: {
            ts
        }
    },
    ...compat.config({
        extends: [
            "plugin:@typescript-eslint/recommended",
            ]
    }),
    {
        ignores: ["dist", "node_modules", "src/lib/core/time"]
    }
];
