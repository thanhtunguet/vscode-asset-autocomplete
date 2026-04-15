import * as vscode from 'vscode';
import {showLog} from './helpers/log';
import {loadAssetFiles} from './registers/asset';
import {createCompletionProvider} from './registers/completion_provider';

import {loadTranslationKeys, getWorkspaceConfig} from './registers/translation';

import {registerNativeExtractionCommands} from './registers/native_extraction_commands';
import {registerJsonSortCommands} from './registers/json_sort_commands';
import {BehaviorSubject} from 'rxjs';

export interface TranslationKeyEntry {
  key: string;
  namespace?: string;
}

export interface ReversedTranslationKeyEntry {
  value: string;
  key: string;
  namespace?: string;
}

export const translationSubject = new BehaviorSubject<{
  translationKeys: string[];
  reversedTranslationKeys: Record<string, string>[];
  translationKeyEntries: TranslationKeyEntry[];
  reversedTranslationKeyEntries: ReversedTranslationKeyEntry[];
}>({
  translationKeys: [],
  reversedTranslationKeys: [],
  translationKeyEntries: [],
  reversedTranslationKeyEntries: [],
});

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
  const workspacePath = workspaceFolder.uri.fsPath;

  // Register commands


  registerNativeExtractionCommands(context, workspaceFolder);
  registerJsonSortCommands(context, workspaceFolder);

  // Get workspace configuration
  const config = getWorkspaceConfig(workspacePath);
  
  if (!config) {
    return;
  }
  
  const { projectType, assetPathSetting } = config;

  // Show detected project type
  vscode.window.showInformationMessage(`Detected project type: ${projectType}`);
  
  // Load translation keys
  const translationsLoaded = loadTranslationKeys(workspacePath);
  
  if (!translationsLoaded) {
    return;
  }
  
  // Load asset files
  const assetFiles = loadAssetFiles(workspacePath, assetPathSetting);

  // Register completion provider
  const completionProvider = createCompletionProvider(assetFiles, assetPathSetting);

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
