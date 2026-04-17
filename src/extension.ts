import * as vscode from 'vscode';
import * as path from 'path';
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
  localeFileMode: 'single' | 'multiple';
  multipleModeConcatNamespace: boolean;
}>({
  translationKeys: [],
  reversedTranslationKeys: [],
  translationKeyEntries: [],
  reversedTranslationKeyEntries: [],
  localeFileMode: 'multiple',
  multipleModeConcatNamespace: false,
});

var dartDisposableProvider: vscode.Disposable | undefined;
var jsDisposableProvider: vscode.Disposable | undefined;
var tsDisposableProvider: vscode.Disposable | undefined;
let translationFileWatcher: vscode.FileSystemWatcher | undefined;
let translationReloadInterval: NodeJS.Timeout | undefined;
let translationReloadDebounceTimeout: NodeJS.Timeout | undefined;
let configChangeDisposable: vscode.Disposable | undefined;

const TRANSLATION_RELOAD_DEBOUNCE_MS = 200;
const MIN_RELOAD_INTERVAL_MS = 1000;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLocaleFileRegex(pattern: string): RegExp {
  const normalized = pattern.trim();

  if (normalized.startsWith('/') && normalized.lastIndexOf('/') > 0) {
    const lastSlash = normalized.lastIndexOf('/');
    const regexBody = normalized.slice(1, lastSlash);
    const regexFlags = normalized.slice(lastSlash + 1);
    return new RegExp(regexBody, regexFlags);
  }

  const escapedPattern = escapeRegex(normalized)
    .replace(/\\\*/g, '.*')
    .replace(/\\\?/g, '.');

  return new RegExp(`^${escapedPattern}$`);
}

function normalizeFsPath(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, '/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function normalizeReloadIntervalMs(rawInterval: number): number {
  if (!Number.isFinite(rawInterval) || rawInterval <= 0) {
    return 0;
  }

  if (rawInterval < MIN_RELOAD_INTERVAL_MS) {
    return MIN_RELOAD_INTERVAL_MS;
  }

  return Math.floor(rawInterval);
}

function createLocaleFileMatcher(
  currentWorkspaceConfig: ReturnType<typeof getWorkspaceConfig>,
): ((uri: vscode.Uri) => boolean) | undefined {
  if (!currentWorkspaceConfig) {
    return undefined;
  }

  const localeFileRegex = buildLocaleFileRegex(currentWorkspaceConfig.localeFilePattern);
  const normalizedI18nPath = normalizeFsPath(path.resolve(currentWorkspaceConfig.i18nPath));
  const i18nPrefix = `${normalizedI18nPath}/`;

  const configuredLanguages = vscode.workspace.getConfiguration('i18n-autocomplete')
    .get<string[]>('languages', ['en', 'vi'])
    .map((language) => language.trim().toLowerCase())
    .filter(Boolean);
  const languageSet = new Set(configuredLanguages);

  return (uri: vscode.Uri) => {
    const normalizedUriPath = normalizeFsPath(uri.fsPath);

    if (!normalizedUriPath.startsWith(i18nPrefix)) {
      return false;
    }

    const relativePath = normalizedUriPath.slice(i18nPrefix.length);
    if (!relativePath) {
      return false;
    }

    const segments = relativePath.split('/').filter(Boolean);
    if (segments.length === 0) {
      return false;
    }

    const fileName = segments[segments.length - 1];
    if (!localeFileRegex.test(fileName)) {
      return false;
    }

    if (currentWorkspaceConfig.localeFileMode === 'single') {
      return segments.length === 1;
    }

    if (segments.length < 2) {
      return false;
    }

    if (languageSet.size === 0) {
      return true;
    }

    return languageSet.has(segments[0].toLowerCase());
  };
}

function cleanupTranslationReloadResources() {
  translationFileWatcher?.dispose();
  translationFileWatcher = undefined;

  if (translationReloadInterval) {
    clearInterval(translationReloadInterval);
    translationReloadInterval = undefined;
  }

  if (translationReloadDebounceTimeout) {
    clearTimeout(translationReloadDebounceTimeout);
    translationReloadDebounceTimeout = undefined;
  }
}

function triggerTranslationReload(workspacePath: string, reason: string): void {
  const loaded = loadTranslationKeys(workspacePath);
  if (loaded) {
    showLog(`Translation keys reloaded (${reason}).`);
  }
}

function setupTranslationAutoReload(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder,
  workspacePath: string,
): void {
  cleanupTranslationReloadResources();

  const config = vscode.workspace.getConfiguration('i18n-autocomplete');
  const autoReloadOnSave = config.get<boolean>('autoReloadOnSave', true);
  const rawReloadIntervalMs = config.get<number>('reloadIntervalMs', 0);
  const reloadIntervalMs = normalizeReloadIntervalMs(rawReloadIntervalMs);
  const currentWorkspaceConfig = getWorkspaceConfig(workspacePath);

  if (!currentWorkspaceConfig) {
    return;
  }

  const localeFileMatcher = createLocaleFileMatcher(currentWorkspaceConfig);
  if (rawReloadIntervalMs > 0 && rawReloadIntervalMs < MIN_RELOAD_INTERVAL_MS) {
    showLog(
      `reloadIntervalMs=${rawReloadIntervalMs} is below minimum ${MIN_RELOAD_INTERVAL_MS}. ` +
      `Using ${MIN_RELOAD_INTERVAL_MS}ms.`,
    );
  }

  if (autoReloadOnSave) {
    const normalizedI18nPathSetting = currentWorkspaceConfig.i18nPathSetting
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\.\/+/, '')
      .replace(/\/+$/, '');

    if (!normalizedI18nPathSetting) {
      showLog('Auto reload on save is enabled but jsonPath is empty. Skipping file watcher setup.');
    } else {
    const watchPattern = new vscode.RelativePattern(
      workspaceFolder,
      `${normalizedI18nPathSetting}/**/*`,
    );

    translationFileWatcher = vscode.workspace.createFileSystemWatcher(watchPattern);

    const queueReload = (reason: string, uri: vscode.Uri) => {
      if (localeFileMatcher && !localeFileMatcher(uri)) {
        return;
      }

      if (translationReloadDebounceTimeout) {
        clearTimeout(translationReloadDebounceTimeout);
      }

      translationReloadDebounceTimeout = setTimeout(() => {
        triggerTranslationReload(workspacePath, reason);
      }, TRANSLATION_RELOAD_DEBOUNCE_MS);
    };

    translationFileWatcher.onDidChange((uri) => queueReload('file change', uri), null, context.subscriptions);
    translationFileWatcher.onDidCreate((uri) => queueReload('file create', uri), null, context.subscriptions);
    translationFileWatcher.onDidDelete((uri) => queueReload('file delete', uri), null, context.subscriptions);
    context.subscriptions.push(translationFileWatcher);
    }
  }

  if (reloadIntervalMs > 0) {
    translationReloadInterval = setInterval(() => {
      triggerTranslationReload(workspacePath, 'periodic refresh');
    }, reloadIntervalMs);
  }
}

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

  setupTranslationAutoReload(context, workspaceFolder, workspacePath);
  configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('i18n-autocomplete')) {
      setupTranslationAutoReload(context, workspaceFolder, workspacePath);
      triggerTranslationReload(workspacePath, 'configuration change');
    }
  });
  context.subscriptions.push(configChangeDisposable);
  
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
  cleanupTranslationReloadResources();
  configChangeDisposable?.dispose();
  dartDisposableProvider?.dispose();
  jsDisposableProvider?.dispose();
  tsDisposableProvider?.dispose();
}
