# Task completion checklist

Before saying code work is complete:

1. Verify every modified function/class/method had GitNexus impact analysis run before editing.
2. Ensure no HIGH/CRITICAL GitNexus risk was ignored; warn user before edits if such risk appears.
3. Run appropriate project checks depending on scope:
   - `yarn run lint` for lint/style changes.
   - `yarn run compile` and/or `yarn run compile-tests` for TypeScript build/typecheck changes.
   - `yarn test` for full validation when changes affect extension behavior/tests.
4. Run `gitnexus_detect_changes({scope: 'all', repo: 'vscode-asset-autocomplete'})` before committing or when verifying changed execution flows after refactors.
5. If committing, use specific `git add <paths>` only, never broad `git add .`/`git add -A`, and end commit messages with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
6. Do not push unless explicitly asked.
7. If GitNexus reports stale index, refresh with `npx gitnexus analyze`; use `--embeddings` if `.gitnexus/meta.json` indicates embeddings exist.