# Suggested commands

Use Yarn scripts from `package.json`:

- Install dependencies: `yarn install`
- Compile extension bundle: `yarn run compile`
- Watch webpack build: `yarn run watch`
- Production package build: `yarn run package`
- Compile tests/typecheck to `out`: `yarn run compile-tests`
- Watch test compilation: `yarn run watch-tests`
- Lint TypeScript sources: `yarn run lint`
- Run full test flow: `yarn test` (pretest runs compile-tests, compile, and lint before `vscode-test`)
- VS Code prepublish build: `yarn run vscode:prepublish`

GitNexus commands:

- Refresh GitNexus index if stale: `npx gitnexus analyze`
- If embeddings exist in `.gitnexus/meta.json` (`stats.embeddings > 0`), refresh preserving embeddings with: `npx gitnexus analyze --embeddings`

Darwin/macOS utility commands commonly useful in this repo:

- `git status --short` to inspect changed files.
- `git diff -- <path>` to inspect changes in a file.
- `ls` to list directories.
- Prefer Serena/GitNexus tools for code exploration rather than shell grep/find; if shell search is needed, use repo-scoped commands only.