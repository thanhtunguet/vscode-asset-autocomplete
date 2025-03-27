import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {showLog} from './helpers/log';
import {detectProjectType} from './helpers/project_type';
import {loadAssetFiles} from './registers/asset';
import {createCompletionProvider} from './registers/completion_provider';
import {registerFlutterLocalizationCommands} from './registers/flutter_l10n_commands';
import {loadTranslationKeys} from './registers/translation';
import {ExtensionConfig} from './types/ExtensionConfig';
import {ProjectType} from './types/ProjectType';
import {registerYarnI18NCommands} from './registers/yarn_i18n_commands';

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
  registerYarnI18NCommands(context, workspaceFolder);

  const config = vscode.workspace.getConfiguration('i18n-autocomplete');

  const projectType = detectProjectType(workspaceFolder.uri.fsPath);

  vscode.window.showInformationMessage(`Detected project type: ${projectType}`);

  let defaultLocalizationPath: string;
  let defaultAssetPath: string;

  if (projectType === ProjectType.Unknown) {
    return;
  }

  switch (projectType) {
    case ProjectType.Flutter:
      defaultLocalizationPath = 'assets/i18n';
      defaultAssetPath = 'assets';
      break;

    case ProjectType.NodeJS:
      defaultLocalizationPath = 'src/locales';
      defaultAssetPath = 'src/assets';
      break;
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

  const assetFiles = loadAssetFiles(workspaceFolder.uri.fsPath, assetPath);

  showLog('Asset files: ' + JSON.stringify(assetFiles, null, 2));

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
  dartDisposableProvider?.dispose();
  jsDisposableProvider?.dispose();
  tsDisposableProvider?.dispose();
}
