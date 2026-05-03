# Project overview

- Project: `vscode-asset-autocomplete` / display name `Localization AutoComplete`.
- Purpose: VS Code extension providing intelligent translation key autocomplete, reverse lookup suggestions, translation extraction/merge/analyze commands, JSON translation sorting, and asset path completion for Flutter/Dart and JavaScript/TypeScript projects.
- Main extension entrypoint: `src/extension.ts`; packaged output: `dist/extension.js` via webpack.
- Activation events: `onLanguage:dart`, `onLanguage:javascript`, `onLanguage:typescript`.
- Tech stack: TypeScript, VS Code Extension API, webpack, ESLint 9, Prettier, vscode-test, Node 20 types, RxJS, reflect-metadata, `@typescript-nameof`.
- Repository is indexed by GitNexus as `vscode-asset-autocomplete`; CLAUDE.md/AGENTS.md require GitNexus impact analysis before editing any symbol and detect_changes before committing.

## Rough source structure

- `src/extension.ts`: extension activation/registration entrypoint.
- `src/registers/`: VS Code command/provider registration modules (`native_extraction_commands`, `translation`, `json_sort_commands`, `completion_provider`, `asset`).
- `src/services/`: implementation services for extraction, file scanning, translation extraction, and JSON sorting.
- `src/helpers/`: helper utilities for filesystem, logging, project type.
- `src/types/`: TypeScript types/interfaces for extension config and project type.
- `src/config/`: shared configuration such as output channel.
- `src/test/`: extension tests.
- Other project files include `package.json`, `webpack.config.js`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.js`, VS Code test config, Dart pubspec/lock and `script.dart`.