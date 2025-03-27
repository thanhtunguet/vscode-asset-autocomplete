import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [{
    files: ["**/*.ts"],
}, {
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: "module",
    },

    rules: {
        "@typescript-eslint/naming-convention": ["warn", {
            selector: "import",
            format: ["camelCase", "PascalCase"],
        }],
        curly: "warn",
        eqeqeq: "warn",
        "no-throw-literal": "warn",
        semi: "warn",
        'comma-dangle': ['error', 'always-multiline'],
        'no-array-constructor': 'error',
        'no-cond-assign': 'error',
        'no-console': 'error',
        'no-debugger': 'error',
        'no-delete-var': 'error',
        'no-else-return': 'error',
        'no-eq-null': 'error',
        'no-return-await': 'error',
        'no-shadow': 'off',
        'no-undef': 'off',
        'no-unreachable': 'error',
        'no-unused-vars': 'off',
        'no-use-before-define': 'off',
        'no-useless-computed-key': 'error',
        'no-useless-concat': 'error',
        'no-useless-constructor': 'error',
        'no-useless-rename': 'error',
        'no-useless-return': 'error',
        semi: ['error', 'always'],
        '@typescript-eslint/consistent-type-imports': [
            'error',
            {
                prefer: 'type-imports',
            },
        ],
        'react/react-in-jsx-scope': 'off',
        '@typescript-eslint/no-shadow': 'off',
        '@typescript-eslint/explicit-member-accessibility': [
            'error',
            {
                accessibility: 'explicit',
                overrides: {
                    properties: 'no-public', // Ensures methods require `public`, but properties don't need it.
                },
            },
        ],
    },
}];