# Code style and conventions

- Language: strict TypeScript (`tsconfig.json` has `strict: true`, module `Node16`, target `ESNext`, libs `ESNext` and `DOM`).
- Formatting: Prettier with `tabWidth: 2`, `singleQuote: true`, `bracketSpacing: false`, `trailingComma: 'all'`, `jsxBracketSameLine: true`.
- ESLint rules include:
  - `semi: ['error', 'always']`.
  - `comma-dangle: ['error', 'always-multiline']`.
  - `eqeqeq`, `curly`, `no-throw-literal` as warnings.
  - `no-console`, `no-debugger`, unreachable/useless code rules as errors.
  - Prefer type-only imports via `@typescript-eslint/consistent-type-imports`.
  - Explicit member accessibility is required for class methods; properties do not need explicit `public`.
  - Import naming convention warns unless imports are camelCase or PascalCase.
- Avoid comments unless they explain non-obvious why/constraints; do not narrate what code does.
- Prefer minimal changes and existing patterns. Do not create docs/README files unless explicitly requested.
- For code work in this project, use Serena symbolic tools first: `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, `replace_symbol_body`, `replace_content`, etc.
- Project-specific GitNexus rule: before modifying any function/class/method symbol, run `gitnexus_impact({target: '<symbol>', direction: 'upstream', repo: 'vscode-asset-autocomplete'})`, report blast radius, and warn before proceeding if risk is HIGH/CRITICAL.