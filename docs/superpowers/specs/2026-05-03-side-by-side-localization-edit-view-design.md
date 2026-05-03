# Side-by-side localization edit view design

## Goal

Add a VS Code command that opens configured localization JSON files side by side so users can compare and edit translations across languages. The first version uses native VS Code JSON editors only; it does not add key-difference diagnostics or a custom comparison UI.

## Command

- Command id: `i18n-autocomplete.openSideBySideTranslations`
- Command Palette label: `I18n: Open Side-by-Side Translation Files`

## User flow

1. The command reads existing `i18n-autocomplete` settings:
   - `jsonPath`
   - `languages`
   - `localeFileMode`
   - `localeFilePattern`
2. It asks the user to select languages from the configured languages.
   - Minimum: 2 languages.
   - Maximum: 3 languages.
3. It discovers comparable JSON files from the selected languages.
   - In `single` mode, it builds one batch with one locale file per selected language, such as `assets/i18n/en.json` and `assets/i18n/vi.json`.
   - In `multiple` mode, it scans selected language folders, such as `assets/i18n/en/` and `assets/i18n/vi/`, and collects the union of matching namespace files.
4. It asks the user which discovered files or namespaces to compare.
   - All discovered files are selected by default.
   - The user can compare one file or multiple files.
5. For each selected file or namespace, the command ensures every selected language has a matching file.
   - Missing parent directories are created.
   - Missing JSON files are created with `{}`.
6. The command opens each selected batch in native VS Code editor columns.

## Native editor layout

The feature uses native editors as a best-effort side-by-side layout:

- First selected language opens in `ViewColumn.One`.
- Second selected language opens in `ViewColumn.Two`.
- Third selected language opens in `ViewColumn.Three`.
- In `single` mode, only one batch is opened.
- In `multiple` mode, selected namespace batches are opened sequentially in sorted filename order.

For multiple selected namespaces, VS Code may display earlier namespaces as tabs in the same editor groups rather than as a perfect vertical grid. This is acceptable for v1 because files remain real editable JSON documents.

## Components

### `SideBySideTranslationService`

Create `src/services/side_by_side_translation_service.ts`.

Responsibilities:

- Convert existing i18n settings into expected locale file paths.
- Discover namespace files in `multiple` mode.
- Apply `localeFilePattern` filtering.
- Build ordered translation file batches.
- Create missing files as `{}`.

The service should keep filesystem/config-derived logic separate from VS Code command UI logic.

Suggested core shape:

```ts
type TranslationFileBatch = {
  label: string;
  files: Array<{
    language: string;
    uri: vscode.Uri;
    existed: boolean;
  }>;
};
```

### `registerSideBySideTranslationCommands`

Create `src/registers/side_by_side_translation_commands.ts`.

Responsibilities:

- Register `i18n-autocomplete.openSideBySideTranslations`.
- Read current workspace configuration.
- Ask for 2–3 languages with a multi-select QuickPick.
- Ask for files/namespaces with all options selected by default.
- Call the service to build and ensure batches.
- Open files via `vscode.window.showTextDocument` in columns 1–3.
- Show concise warning/error messages for invalid states.

### Wiring

Modify:

- `src/extension.ts` to call `registerSideBySideTranslationCommands(context, workspaceFolder)` alongside existing registrations.
- `package.json` to contribute the new command label.

## Data ordering

- Languages keep the user's selected order.
- Multiple-mode filenames are sorted alphabetically for predictable display.
- Selected filenames are opened in the selected/sorted order.

## Error handling

- No workspace folder: show `No workspace folder found` and stop.
- Fewer than 2 configured languages: warn that at least 2 languages are required.
- User cancels language or file selection: stop without changes.
- User selects fewer than 2 languages: warn and stop.
- User selects more than 3 languages: prevent or warn and stop.
- Invalid `localeFilePattern`: show a clear error and stop.
- No matching files in `multiple` mode: warn that no matching localization files were found; do not guess namespace names.
- Missing file creation failure: show the path that failed and stop the affected operation.

## Testing and verification

Service-level tests should cover:

- `single` mode builds expected per-language file batches.
- `multiple` mode discovers the union of namespace files across selected language folders.
- `localeFilePattern` filters filenames.
- Missing files are created as `{}`.

Command-level editor layout is difficult to assert in headless tests, so verification should include compile and lint checks:

- `yarn run lint`
- `yarn run compile-tests`
- `yarn run compile`

## Out of scope for v1

- Custom webview comparison grid.
- Missing/extra key diagnostics.
- Inline translation table editing.
- Automatic key synchronization between locale files.
- Opening more than 3 languages at once.
