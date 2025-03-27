import {execSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {ProjectType} from './types/ProjectType';
import {ExtensionConfig} from './types/ExtensionConfig';

const outputChannel = vscode.window.createOutputChannel(
  'VSCode i18n AutoComplete',
);

var dartDisposableProvider: vscode.Disposable | undefined;
var jsDisposableProvider: vscode.Disposable | undefined;
var tsDisposableProvider: vscode.Disposable | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const workspaceFolder = workspaceFolders[0];

  registerFlutterLocalizationCommands(context, workspaceFolder);

  const config = vscode.workspace.getConfiguration('i18n-autocomplete');

  const projectType = detectProjectType(workspaceFolder.uri.fsPath);

  vscode.window.showInformationMessage(`Detected project type: ${projectType}`);

  let defaultLocalizationPath: string;
  let defaultAssetPath: string;

  if (projectType === ProjectType.Flutter) {
    defaultLocalizationPath = 'assets/i18n';
    defaultAssetPath = 'assets';
  } else {
    defaultLocalizationPath = 'src/locales';
    defaultAssetPath = 'src/assets';
  }

  const i18nPathSetting = config.get<string>(
    nameof(ExtensionConfig.prototype.jsonPath),
    defaultLocalizationPath,
  );

  const i18nPath = path.join(workspaceFolder.uri.fsPath, i18nPathSetting);

  if (!fs.existsSync(i18nPath)) {
    showLog('Translation files directory not found: ' + i18nPath);
    return;
  }

  const files = fs
    .readdirSync(i18nPath)
    .filter((file) => file.endsWith('.json'));

  if (files.length === 0) {
    showLog('No translation files found in directory: ' + i18nPath);
    return;
  }

  const {translationKeys, reversedTranslationKeys} = loadTranslationKeys(
    i18nPath,
    files,
  );

  const assetPath = config.get<string>(
    nameof(ExtensionConfig.prototype.assetPath),
    defaultAssetPath,
  );

  const assetFiles = loadAssetFiles(
    path.join(workspaceFolder.uri.fsPath, assetPath),
    defaultAssetPath,
  );

  // Register completion provider
  const completionProvider = createCompletionProvider(
    translationKeys,
    reversedTranslationKeys,
    assetFiles,
  );

  dartDisposableProvider = vscode.languages.registerCompletionItemProvider(
    'dart',
    completionProvider,
    "'",
  );
  jsDisposableProvider = vscode.languages.registerCompletionItemProvider(
    'javascript',
    completionProvider,
    "'",
  );
  tsDisposableProvider = vscode.languages.registerCompletionItemProvider(
    'typescript',
    completionProvider,
    "'",
  );

  context.subscriptions.push(dartDisposableProvider);
  context.subscriptions.push(jsDisposableProvider);
  context.subscriptions.push(tsDisposableProvider);
}

export function deactivate() {
  if (dartDisposableProvider) {
    dartDisposableProvider.dispose();
  }
  if (jsDisposableProvider) {
    jsDisposableProvider.dispose();
  }
  if (tsDisposableProvider) {
    tsDisposableProvider.dispose();
  }
}

export function detectProjectType(workspacePath: string): ProjectType {
  const pubspecPath = path.join(workspacePath, 'pubspec.yaml');
  const packageJsonPath = path.join(workspacePath, 'package.json');

  if (fs.existsSync(pubspecPath)) {
    return ProjectType.Flutter;
  }

  if (fs.existsSync(packageJsonPath)) {
    return ProjectType.NodeJS;
  }

  return ProjectType.Unknown;
}

function execSyncOnFolder(command: string, folder: string) {
  try {
    const result = execSync(command, {
      cwd: folder,
      encoding: 'utf-8',
    });
    outputChannel.appendLine(result);
  } catch (error) {
    if (error instanceof Error) {
      showLog(`Error executing command: ${error.message}`);
    } else {
      showLog(`Unknown error occurred during command execution`);
    }
  }
}

function showLog(message: string, showOutputLog: boolean = true) {
  vscode.window.showWarningMessage(message);
  outputChannel.appendLine(message);
  if (showOutputLog) {
    outputChannel.show();
  }
}

function registerFlutterLocalizationCommands(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-autocomplete.l10nMerge', () => {
      vscode.window.showInformationMessage('Localization keys merged');
      /// Run command in current root folder of the workspace: dart run supa_l10n_manager merge
      execSyncOnFolder(
        'dart run supa_l10n_manager merge',
        workspaceFolder.uri.fsPath,
      );
    }),

    vscode.commands.registerCommand(
      'i18n-autocomplete.l10nExtract',
      (locale: string) => {
        vscode.window.showInformationMessage('Extracting localization keys...');
        execSyncOnFolder(
          `dart run supa_l10n_manager extract --locale ${locale}`,
          workspaceFolder.uri.fsPath,
        );
      },
    ),

    vscode.commands.registerCommand('i18n-autocomplete.l10nExtractVi', () => {
      vscode.window.showInformationMessage('Extracting localization keys...');
      execSyncOnFolder(
        `dart run supa_l10n_manager extract --locale vi`,
        workspaceFolder.uri.fsPath,
      );
    }),

    vscode.commands.registerCommand('i18n-autocomplete.l10nExtractEn', () => {
      vscode.window.showInformationMessage('Extracting localization keys...');
      execSyncOnFolder(
        `dart run supa_l10n_manager extract --locale en`,
        workspaceFolder.uri.fsPath,
      );
    }),
  );
}

function extractKeys(obj: any, prefix: string, keys: string[]): void {
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      extractKeys(obj[key], `${prefix}${key}.`, keys);
    } else {
      keys.push(`${prefix}${key}`);
    }
  }
}

function extractReversedKeys(obj: any, keys: Record<string, string>[]): void {
  for (const key in obj) {
    const value = obj[key];

    if (typeof value === 'object' && obj[key] !== null) {
      extractReversedKeys(obj[key], keys);
    } else {
      if (typeof value === 'string') {
        keys.push({
          [value]: key,
        });
      }
    }
  }
}

function loadTranslationKeys(
  i18nPath: string,
  files: string[],
): {
  translationKeys: string[];
  reversedTranslationKeys: Record<string, string>[];
} {
  const translationKeys: string[] = [];
  const reversedTranslationKeys: Record<string, string>[] = [];

  const file = files[0];

  const filePath = path.join(i18nPath, file);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    extractKeys(json, '', translationKeys);
  } catch (error) {
    showLog('Error parsing translation file: ' + file);
  }

  files.forEach((file) => {
    const filePath = path.join(i18nPath, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(content);
      extractReversedKeys(json, reversedTranslationKeys);
    } catch (error) {
      showLog('Error parsing translation file: ' + file);
    }
  });

  return {
    translationKeys,
    reversedTranslationKeys,
  };
}

function createCompletionProvider(
  translationKeys: string[],
  reversedTranslationKeys: Record<string, string>[],
  assetFiles: string[],
): vscode.CompletionItemProvider {
  return {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
    ): vscode.CompletionItem[] | undefined {
      const line = document.lineAt(position);
      let previousLine = position.line - 1;
      const lineText = `${document.lineAt(previousLine).text}\n${line.text}`; // get the previous line and the current line

      const matches = lineText.match(/translate\([\s\t\n]*['"]([^'"]*)['"]*/g);

      let suggestions: Array<vscode.CompletionItem> = [];

      if (!matches) {
        const assetMatches = /['"](assets\/.*)['"]/g;
        if (assetMatches) {
          const assetMatchedTexts = lineText
            .split('\n')
            .join(' ')
            .match(/['"]assets\/(.*)['"]/);
          if (assetMatchedTexts) {
            const assetMatch = assetMatchedTexts[1];
            suggestions = [
              ...suggestions,
              ...assetFiles
                .filter((file) => {
                  return file.startsWith(assetMatch);
                })
                .map((file) => {
                  const item = new vscode.CompletionItem(
                    file,
                    vscode.CompletionItemKind.File,
                  );
                  item.insertText = `${file}`;
                  return item;
                }),
            ];
          }
        }
      } else {
        suggestions = [
          ...suggestions,
          ...translationKeys.map((key) => {
            const item = new vscode.CompletionItem(
              key,
              vscode.CompletionItemKind.Text,
            );
            item.insertText = `${key}`;
            return item;
          }),
        ];
        /// Get first group matched text by regex: /translate\([\s\t\n]*['"]([^'"]*)['"]*/g in line text
        const translationMatches = matches[0].match(
          /translate\([\s\t\n]*['"]([^'"]*)['"]*/,
        );
        if (translationMatches) {
          const translationKey = translationMatches[1];
          suggestions = [
            ...suggestions,
            ...reversedTranslationKeys
              .filter((entry) => {
                const [key] = Object.entries(entry)[0];
                return key.startsWith(translationKey);
              })
              .map((entry) => {
                const [key, value] = Object.entries(entry)[0];
                const item = new vscode.CompletionItem(
                  key,
                  vscode.CompletionItemKind.Text,
                );
                item.insertText = `${value}`;
                item.label = `${key} (${value})`;
                return item;
              }),
          ];
        }
      }

      return suggestions;
    },
  };
}

function traverseDirectory(
  directory: string,
  basePath: string,
  results: string[],
) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const relativePath = path.join(basePath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      traverseDirectory(fullPath, relativePath, results);
    } else {
      results.push(relativePath);
    }
  }
}

function loadAssetFiles(workspaceFolder: string, subPath: string): string[] {
  const assetsDir = path.join(workspaceFolder, subPath);
  const results: string[] = [];

  if (!fs.existsSync(assetsDir)) {
    return results;
  }

  traverseDirectory(assetsDir, '', results);
  return results;
}
