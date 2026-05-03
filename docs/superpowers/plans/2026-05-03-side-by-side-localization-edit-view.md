# Side-by-Side Localization Edit View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VS Code command that opens configured localization JSON files side by side in native editor columns for 2–3 selected languages.

**Architecture:** Add a focused service for config-derived locale file discovery and missing-file creation, then add a command registration module for VS Code QuickPick/editor interactions. Wire the command into the existing extension activation and `package.json` command contributions.

**Tech Stack:** TypeScript, VS Code Extension API, Node `fs`/`path`/`os`, Mocha-style VS Code extension tests, Yarn scripts, GitNexus impact/change analysis.

**Important workflow constraints:** Use Serena symbolic tools for code reads/edits. Run GitNexus impact analysis before modifying existing symbols. Do not create git commits unless the user explicitly asks.

---

## File structure

- Create `src/services/side_by_side_translation_service.ts`
  - Owns filesystem and path logic for side-by-side locale batches.
  - Has no QuickPick/editor UI logic.
- Create `src/test/side_by_side_translation_service.test.ts`
  - Covers service behavior using temporary directories.
- Create `src/registers/side_by_side_translation_commands.ts`
  - Owns command registration, QuickPick prompts, user-facing messages, and native editor opening.
- Modify `src/extension.ts`
  - Import and call `registerSideBySideTranslationCommands(context, workspaceFolder)` inside `activate`.
- Modify `package.json`
  - Add the contributed command `i18n-autocomplete.openSideBySideTranslations` with label `I18n: Open Side-by-Side Translation Files`.

---

### Task 1: Implement side-by-side translation service with tests

**Goal:** Add a tested `SideBySideTranslationService` that discovers comparable localization file batches and creates missing files as `{}`.

**Files:**
- Create: `src/services/side_by_side_translation_service.ts`
- Create: `src/test/side_by_side_translation_service.test.ts`

**Acceptance Criteria:**
- [ ] `single` mode returns one batch with one file per selected language.
- [ ] `multiple` mode returns the sorted union of matching namespace files across selected language folders.
- [ ] `localeFilePattern` supports glob-like patterns and regex literals.
- [ ] Invalid regex-style `localeFilePattern` values fail with `InvalidLocaleFilePatternError`.
- [ ] Missing files are created as `{}` plus newline with parent directories.

**Verify:** `yarn run compile-tests` → expected: TypeScript test compilation completes without errors.

**Steps:**

- [ ] **Step 1: Create failing service tests**

Create `src/test/side_by_side_translation_service.test.ts` with this content:

```ts
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  InvalidLocaleFilePatternError,
  SideBySideTranslationService,
  type SideBySideTranslationConfig,
} from '../services/side_by_side_translation_service';

suite('SideBySideTranslationService', () => {
  let tempDir: string;

  setup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-side-by-side-'));
  });

  teardown(() => {
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

  function writeFile(relativePath: string, content = '{}\n'): void {
    const filePath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, content, 'utf8');
  }

  function defaultConfig(
    overrides: Partial<SideBySideTranslationConfig> = {},
  ): SideBySideTranslationConfig {
    return {
      jsonPath: 'assets/i18n',
      localeFileMode: 'multiple',
      localeFilePattern: '*.json',
      ...overrides,
    };
  }

  test('single mode builds one batch with one file per selected language', () => {
    const service = new SideBySideTranslationService(tempDir);

    const batches = service.getComparableFiles(
      defaultConfig({localeFileMode: 'single'}),
      ['en', 'vi'],
    );

    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0].label, 'Locale files');
    assert.deepStrictEqual(
      batches[0].files.map((file) => ({
        language: file.language,
        relativePath: path.relative(tempDir, file.uri.fsPath),
        existed: file.existed,
      })),
      [
        {
          language: 'en',
          relativePath: path.join('assets', 'i18n', 'en.json'),
          existed: false,
        },
        {
          language: 'vi',
          relativePath: path.join('assets', 'i18n', 'vi.json'),
          existed: false,
        },
      ],
    );
  });

  test('multiple mode discovers sorted namespace union across languages', () => {
    writeFile(path.join('assets', 'i18n', 'en', 'home.json'));
    writeFile(path.join('assets', 'i18n', 'vi', 'common.json'));
    writeFile(path.join('assets', 'i18n', 'vi', 'home.json'));

    const service = new SideBySideTranslationService(tempDir);

    const batches = service.getComparableFiles(defaultConfig(), ['en', 'vi']);

    assert.deepStrictEqual(
      batches.map((batch) => batch.label),
      ['common.json', 'home.json'],
    );
    assert.deepStrictEqual(
      batches[0].files.map((file) => ({
        language: file.language,
        relativePath: path.relative(tempDir, file.uri.fsPath),
        existed: file.existed,
      })),
      [
        {
          language: 'en',
          relativePath: path.join('assets', 'i18n', 'en', 'common.json'),
          existed: false,
        },
        {
          language: 'vi',
          relativePath: path.join('assets', 'i18n', 'vi', 'common.json'),
          existed: true,
        },
      ],
    );
  });

  test('localeFilePattern filters namespace files', () => {
    writeFile(path.join('assets', 'i18n', 'en', 'home.json'));
    writeFile(path.join('assets', 'i18n', 'en', 'home.arb'));
    writeFile(path.join('assets', 'i18n', 'vi', 'home.json'));

    const service = new SideBySideTranslationService(tempDir);

    const batches = service.getComparableFiles(
      defaultConfig({localeFilePattern: '*.json'}),
      ['en', 'vi'],
    );

    assert.deepStrictEqual(
      batches.map((batch) => batch.label),
      ['home.json'],
    );
  });

  test('regex localeFilePattern filters namespace files', () => {
    writeFile(path.join('assets', 'i18n', 'en', 'home.json'));
    writeFile(path.join('assets', 'i18n', 'en', 'admin.json'));
    writeFile(path.join('assets', 'i18n', 'vi', 'home.json'));

    const service = new SideBySideTranslationService(tempDir);

    const batches = service.getComparableFiles(
      defaultConfig({localeFilePattern: '/^home\\.json$/'}),
      ['en', 'vi'],
    );

    assert.deepStrictEqual(
      batches.map((batch) => batch.label),
      ['home.json'],
    );
  });

  test('invalid regex localeFilePattern throws a clear error', () => {
    const service = new SideBySideTranslationService(tempDir);

    assert.throws(
      () =>
        service.getComparableFiles(
          defaultConfig({localeFilePattern: '/[/'}),
          ['en', 'vi'],
        ),
      InvalidLocaleFilePatternError,
    );
  });

  test('ensureBatchFiles creates missing files as empty JSON', () => {
    writeFile(
      path.join('assets', 'i18n', 'vi', 'home.json'),
      '{"title":"Trang chủ"}\n',
    );

    const service = new SideBySideTranslationService(tempDir);
    const [batch] = service.getComparableFiles(defaultConfig(), ['en', 'vi']);

    const ensuredBatch = service.ensureBatchFiles(batch);

    const createdPath = path.join(
      tempDir,
      'assets',
      'i18n',
      'en',
      'home.json',
    );
    const existingPath = path.join(
      tempDir,
      'assets',
      'i18n',
      'vi',
      'home.json',
    );

    assert.strictEqual(fs.readFileSync(createdPath, 'utf8'), '{}\n');
    assert.strictEqual(
      fs.readFileSync(existingPath, 'utf8'),
      '{"title":"Trang chủ"}\n',
    );
    assert.deepStrictEqual(
      ensuredBatch.files.map((file) => ({
        language: file.language,
        existed: file.existed,
      })),
      [
        {language: 'en', existed: false},
        {language: 'vi', existed: true},
      ],
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail before implementation**

Run:

```bash
yarn run compile-tests
```

Expected result before implementation: TypeScript fails because `../services/side_by_side_translation_service` does not exist.

- [ ] **Step 3: Implement the service**

Create `src/services/side_by_side_translation_service.ts` with this content:

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export type LocaleFileMode = 'single' | 'multiple';

export interface SideBySideTranslationConfig {
  jsonPath: string;
  localeFileMode: LocaleFileMode;
  localeFilePattern: string;
}

export interface TranslationFileItem {
  language: string;
  uri: vscode.Uri;
  existed: boolean;
}

export interface TranslationFileBatch {
  label: string;
  files: TranslationFileItem[];
}

export class InvalidLocaleFilePatternError extends Error {
  constructor(pattern: string, cause: unknown) {
    super(
      `Invalid locale file pattern "${pattern}": ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'InvalidLocaleFilePatternError';
  }
}

export class SideBySideTranslationService {
  constructor(private workspacePath: string) {}

  public getComparableFiles(
    config: SideBySideTranslationConfig,
    selectedLanguages: string[],
  ): TranslationFileBatch[] {
    if (config.localeFileMode === 'single') {
      return [this.createSingleFileBatch(config, selectedLanguages)];
    }

    return this.createMultipleFileBatches(config, selectedLanguages);
  }

  public ensureBatchFiles(batch: TranslationFileBatch): TranslationFileBatch {
    return {
      label: batch.label,
      files: batch.files.map((file) => {
        if (!fs.existsSync(file.uri.fsPath)) {
          fs.mkdirSync(path.dirname(file.uri.fsPath), {recursive: true});
          fs.writeFileSync(file.uri.fsPath, '{}\n', 'utf8');
        }

        return file;
      }),
    };
  }

  private createSingleFileBatch(
    config: SideBySideTranslationConfig,
    selectedLanguages: string[],
  ): TranslationFileBatch {
    return {
      label: 'Locale files',
      files: selectedLanguages.map((language) => {
        const filePath = path.join(
          this.workspacePath,
          config.jsonPath,
          `${language}.json`,
        );

        return {
          language,
          uri: vscode.Uri.file(filePath),
          existed: fs.existsSync(filePath),
        };
      }),
    };
  }

  private createMultipleFileBatches(
    config: SideBySideTranslationConfig,
    selectedLanguages: string[],
  ): TranslationFileBatch[] {
    const matchesLocaleFile = this.createLocaleFileMatcher(
      config.localeFilePattern,
    );
    const namespaceFiles = new Set<string>();

    for (const language of selectedLanguages) {
      const languageDir = path.join(this.workspacePath, config.jsonPath, language);

      if (!fs.existsSync(languageDir) || !fs.statSync(languageDir).isDirectory()) {
        continue;
      }

      for (const fileName of fs.readdirSync(languageDir)) {
        const filePath = path.join(languageDir, fileName);

        if (fs.statSync(filePath).isFile() && matchesLocaleFile(fileName)) {
          namespaceFiles.add(fileName);
        }
      }
    }

    return Array.from(namespaceFiles)
      .sort((left, right) => left.localeCompare(right))
      .map((fileName) => ({
        label: fileName,
        files: selectedLanguages.map((language) => {
          const filePath = path.join(
            this.workspacePath,
            config.jsonPath,
            language,
            fileName,
          );

          return {
            language,
            uri: vscode.Uri.file(filePath),
            existed: fs.existsSync(filePath),
          };
        }),
      }));
  }

  private createLocaleFileMatcher(pattern: string): (fileName: string) => boolean {
    if (pattern.startsWith('/')) {
      const lastSlashIndex = pattern.lastIndexOf('/');

      if (lastSlashIndex === 0) {
        return this.createGlobMatcher(pattern);
      }

      try {
        const regexBody = pattern.slice(1, lastSlashIndex);
        const regexFlags = pattern.slice(lastSlashIndex + 1);
        const regex = new RegExp(regexBody, regexFlags);

        return (fileName: string) => regex.test(fileName);
      } catch (error) {
        throw new InvalidLocaleFilePatternError(pattern, error);
      }
    }

    return this.createGlobMatcher(pattern);
  }

  private createGlobMatcher(pattern: string): (fileName: string) => boolean {
    const regexPattern = pattern
      .split('')
      .map((character) => {
        if (character === '*') {
          return '.*';
        }

        if (character === '?') {
          return '.';
        }

        return this.escapeRegex(character);
      })
      .join('');
    const regex = new RegExp(`^${regexPattern}$`);

    return (fileName: string) => regex.test(fileName);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
  }
}
```

- [ ] **Step 4: Run tests to verify the service compiles**

Run:

```bash
yarn run compile-tests
```

Expected result: command exits successfully and writes compiled test output under `out/`.

- [ ] **Step 5: Review scope before moving on**

Run:

```bash
git diff -- src/services/side_by_side_translation_service.ts src/test/side_by_side_translation_service.test.ts
```

Expected result: only the new service and test file are shown. Do not commit unless the user explicitly asks.

---

### Task 2: Register and wire the side-by-side command

**Goal:** Add the VS Code command flow that prompts for languages/files and opens selected batches in native editor columns.

**Files:**
- Create: `src/registers/side_by_side_translation_commands.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`

**Acceptance Criteria:**
- [ ] Command id `i18n-autocomplete.openSideBySideTranslations` is registered.
- [ ] Command Palette label is `I18n: Open Side-by-Side Translation Files`.
- [ ] The command reads existing `i18n-autocomplete` config: `jsonPath`, `languages`, `localeFileMode`, `localeFilePattern`.
- [ ] The language picker accepts 2–3 configured languages.
- [ ] The file picker defaults all discovered batches selected when more than one batch exists.
- [ ] Files open in `ViewColumn.One`, `ViewColumn.Two`, and `ViewColumn.Three` according to selected language order.
- [ ] Invalid pattern, too few languages, empty selections, and no multiple-mode files show concise warnings/errors.

**Verify:** `yarn run compile-tests && yarn run lint && yarn run compile` → expected: all commands complete successfully.

**Steps:**

- [ ] **Step 1: Run required GitNexus impact analysis before editing `activate`**

Run GitNexus impact analysis for the existing `activate` symbol in `src/extension.ts` before modifying it:

```json
{"target":"activate","direction":"upstream","repo":"vscode-asset-autocomplete","maxDepth":3}
```

Expected result: record the risk level, direct callers/importers, and affected processes in the implementation notes. If GitNexus reports HIGH or CRITICAL risk, warn the user before editing.

- [ ] **Step 2: Inspect existing symbols with Serena**

Use Serena before editing:

```text
get_symbols_overview(relative_path="src/extension.ts", depth=1)
find_symbol(relative_path="src/extension.ts", name_path_pattern="activate", include_body=true)
```

Expected result: confirm `activate` currently calls `registerNativeExtractionCommands` and `registerJsonSortCommands` before extension config loading.

- [ ] **Step 3: Create command registration module**

Create `src/registers/side_by_side_translation_commands.ts` with this content:

```ts
import * as vscode from 'vscode';

import {
  InvalidLocaleFilePatternError,
  SideBySideTranslationService,
  type LocaleFileMode,
  type TranslationFileBatch,
} from '../services/side_by_side_translation_service';

interface LanguageQuickPickItem extends vscode.QuickPickItem {
  code: string;
}

interface BatchQuickPickItem extends vscode.QuickPickItem {
  batch: TranslationFileBatch;
}

const SIDE_BY_SIDE_COMMAND = 'i18n-autocomplete.openSideBySideTranslations';

export function registerSideBySideTranslationCommands(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder,
) {
  const service = new SideBySideTranslationService(workspaceFolder.uri.fsPath);

  context.subscriptions.push(
    vscode.commands.registerCommand(SIDE_BY_SIDE_COMMAND, async () => {
      try {
        const config = vscode.workspace.getConfiguration('i18n-autocomplete');
        const configuredLanguages = config.get<string[]>('languages', [
          'en',
          'vi',
        ]);

        if (configuredLanguages.length < 2) {
          vscode.window.showWarningMessage(
            'Configure at least 2 languages before opening side-by-side translation files.',
          );
          return;
        }

        const selectedLanguages = await selectLanguages(configuredLanguages);

        if (!selectedLanguages) {
          return;
        }

        const batches = service.getComparableFiles(
          {
            jsonPath: config.get<string>('jsonPath', 'assets/i18n'),
            localeFileMode: config.get<LocaleFileMode>(
              'localeFileMode',
              'multiple',
            ),
            localeFilePattern: config.get<string>(
              'localeFilePattern',
              '*.json',
            ),
          },
          selectedLanguages,
        );

        if (batches.length === 0) {
          vscode.window.showWarningMessage(
            'No matching localization files found for the selected languages.',
          );
          return;
        }

        const selectedBatches = await selectBatches(batches);

        if (!selectedBatches || selectedBatches.length === 0) {
          return;
        }

        for (const batch of selectedBatches) {
          await openBatch(service.ensureBatchFiles(batch));
        }

        vscode.window.showInformationMessage(
          `Opened ${selectedBatches.length} translation file set${selectedBatches.length === 1 ? '' : 's'} side by side.`,
        );
      } catch (error) {
        if (error instanceof InvalidLocaleFilePatternError) {
          vscode.window.showErrorMessage(error.message);
          return;
        }

        vscode.window.showErrorMessage(
          `Failed to open side-by-side translation files: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );
}

async function selectLanguages(
  configuredLanguages: string[],
): Promise<string[] | undefined> {
  const languageItems: LanguageQuickPickItem[] = configuredLanguages.map(
    (language) => ({
      label: language,
      code: language,
    }),
  );
  const selectedItems = await vscode.window.showQuickPick(languageItems, {
    canPickMany: true,
    placeHolder: 'Select 2 or 3 languages to compare',
    title: 'Select translation languages',
  });

  if (!selectedItems) {
    return undefined;
  }

  if (selectedItems.length < 2) {
    vscode.window.showWarningMessage(
      'Select at least 2 languages to compare translation files.',
    );
    return undefined;
  }

  if (selectedItems.length > 3) {
    vscode.window.showWarningMessage(
      'Select at most 3 languages to compare translation files side by side.',
    );
    return undefined;
  }

  return selectedItems.map((item) => item.code);
}

async function selectBatches(
  batches: TranslationFileBatch[],
): Promise<TranslationFileBatch[] | undefined> {
  if (batches.length === 1) {
    return batches;
  }

  const batchItems: BatchQuickPickItem[] = batches.map((batch) => ({
    label: batch.label,
    description: batch.files
      .map((file) => `${file.language}${file.existed ? '' : ' (new)'}`)
      .join(', '),
    picked: true,
    batch,
  }));
  const selectedItems = await vscode.window.showQuickPick(batchItems, {
    canPickMany: true,
    placeHolder: 'Select translation files to compare',
    title: 'Select translation files',
  });

  return selectedItems?.map((item) => item.batch);
}

async function openBatch(batch: TranslationFileBatch): Promise<void> {
  const columns = [
    vscode.ViewColumn.One,
    vscode.ViewColumn.Two,
    vscode.ViewColumn.Three,
  ];

  for (const [index, file] of batch.files.entries()) {
    await vscode.window.showTextDocument(file.uri, {
      preview: false,
      preserveFocus: index < batch.files.length - 1,
      viewColumn: columns[index],
    });
  }
}
```

- [ ] **Step 4: Wire command registration into `activate`**

Modify `src/extension.ts` with Serena `replace_content` or symbol-aware editing:

1. Add this import near the other register imports:

```ts
import {registerSideBySideTranslationCommands} from './registers/side_by_side_translation_commands';
```

2. In `activate`, after the existing command registration calls:

```ts
  registerNativeExtractionCommands(context, workspaceFolder);
  registerJsonSortCommands(context, workspaceFolder);
  registerSideBySideTranslationCommands(context, workspaceFolder);
```

Expected result: the new command is registered during activation before config loading, matching existing command registration placement.

- [ ] **Step 5: Add command contribution to `package.json`**

Modify the `contributes.commands` array in `package.json` by adding this command object after `i18n-autocomplete.nativeAnalyze` or near the other i18n commands:

```json
{
  "command": "i18n-autocomplete.openSideBySideTranslations",
  "title": "I18n: Open Side-by-Side Translation Files"
}
```

Expected result: the command appears in the Command Palette with the approved label.

- [ ] **Step 6: Run verification commands**

Run:

```bash
yarn run compile-tests && yarn run lint && yarn run compile
```

Expected result: all three commands exit successfully.

- [ ] **Step 7: Review task diff**

Run:

```bash
git diff -- src/registers/side_by_side_translation_commands.ts src/extension.ts package.json
```

Expected result: the diff only shows the new command module, the `activate` registration/import, and the package command contribution. Do not commit unless the user explicitly asks.

---

### Task 3: Verify feature scope and GitNexus change impact

**Goal:** Confirm the full implementation matches the approved design and does not unexpectedly affect unrelated execution flows.

**Files:**
- Analyze: all changed files

**Acceptance Criteria:**
- [ ] `yarn run compile-tests` passes.
- [ ] `yarn run lint` passes.
- [ ] `yarn run compile` passes.
- [ ] `gitnexus_detect_changes({scope: 'all', repo: 'vscode-asset-autocomplete'})` reports expected side-by-side service, command registration, extension wiring, package contribution, and test changes only.
- [ ] Any HIGH or CRITICAL GitNexus risk found during implementation has been reported to the user.

**Verify:** `yarn run compile-tests && yarn run lint && yarn run compile` plus GitNexus detect changes.

**Steps:**

- [ ] **Step 1: Run project verification**

Run:

```bash
yarn run compile-tests && yarn run lint && yarn run compile
```

Expected result: all commands exit successfully.

- [ ] **Step 2: Run GitNexus change detection**

Run GitNexus detect changes:

```json
{"scope":"all","repo":"vscode-asset-autocomplete"}
```

Expected result: changed symbols and affected processes are limited to the new side-by-side translation feature and `activate` wiring.

- [ ] **Step 3: Inspect working tree diff**

Run:

```bash
git status --short && git diff --stat
```

Expected result: changed files are limited to:

```text
src/services/side_by_side_translation_service.ts
src/test/side_by_side_translation_service.test.ts
src/registers/side_by_side_translation_commands.ts
src/extension.ts
package.json
docs/superpowers/specs/2026-05-03-side-by-side-localization-edit-view-design.md
docs/superpowers/plans/2026-05-03-side-by-side-localization-edit-view.md
docs/superpowers/plans/2026-05-03-side-by-side-localization-edit-view.md.tasks.json
```

Existing user changes to `AGENTS.md` and `CLAUDE.md` may also appear from before this work; do not modify or stage them.

- [ ] **Step 4: Manual VS Code smoke test**

In a VS Code Extension Development Host, run Command Palette command `I18n: Open Side-by-Side Translation Files`.

Use these expected observations:

- With fewer than 2 configured languages, a warning appears and no files open.
- With 2 or 3 configured languages, language selection appears.
- In `single` mode, selected locale files open across editor columns.
- In `multiple` mode, namespace selection appears with all namespaces preselected.
- Missing selected files are created as `{}` and opened.

If this cannot be run in the current environment, state explicitly that browser/editor smoke testing was not performed.

- [ ] **Step 5: Completion report**

Report:

- Verification commands run and their results.
- GitNexus impact/change analysis summary.
- Files changed.
- Whether manual Extension Development Host smoke testing was performed.
- No commit was created unless the user explicitly asked for one.
