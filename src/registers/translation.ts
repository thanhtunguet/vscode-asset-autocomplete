import * as fs from 'fs';
import path from 'path';
import { showLog } from '../helpers/log';
import {
  translationSubject,
  type ReversedTranslationKeyEntry,
  type TranslationKeyEntry,
} from '../extension';
import vscode from 'vscode';
import { detectProjectType } from '../helpers/project_type';
import { ProjectType } from '../types/ProjectType';
import { ExtensionConfig } from '../types/ExtensionConfig';

/**
 * Get default paths based on project type
 */
export function getDefaultPaths(projectType: ProjectType): { 
  defaultLocalizationPath: string;
  defaultAssetPath: string;
} {
  switch (projectType) {
    case ProjectType.Flutter:
      return {
        defaultLocalizationPath: 'assets/i18n',
        defaultAssetPath: 'assets',
      };

    case ProjectType.NodeJS:
      return {
        defaultLocalizationPath: 'src/locales',
        defaultAssetPath: 'src/assets',
      };
      
    default:
      return {
        defaultLocalizationPath: '',
        defaultAssetPath: '',
      };
  }
}

/**
 * Load and return workspace configuration
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeLocalePattern(pattern: string): string {
  return pattern.trim();
}

function buildLocaleFileRegex(pattern: string): RegExp {
  const normalized = normalizeLocalePattern(pattern);

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

function parseLocaleJsonFile(filePath: string): any | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (_error) {
    showLog('Error parsing translation file: ' + filePath);
    return null;
  }
}

function extractKeyValuePairs(
  obj: any,
  prefix: string,
  pairs: Array<{ key: string; value: string }>,
): void {
  for (const key in obj) {
    const value = obj[key];
    const fullKey = `${prefix}${key}`;

    if (typeof value === 'object' && value !== null) {
      extractKeyValuePairs(value, `${fullKey}.`, pairs);
      continue;
    }

    if (typeof value === 'string') {
      pairs.push({
        key: fullKey,
        value,
      });
    }
  }
}

function buildLocalePriority(
  preferredTranslationLanguage: string | undefined,
  configuredLanguages: string[],
  discoveredLocales: string[],
): string[] {
  const localePriority: string[] = [];

  if (preferredTranslationLanguage && preferredTranslationLanguage.trim()) {
    localePriority.push(preferredTranslationLanguage.trim());
  }

  configuredLanguages.forEach((locale) => {
    if (!localePriority.includes(locale)) {
      localePriority.push(locale);
    }
  });

  discoveredLocales.forEach((locale) => {
    if (!localePriority.includes(locale)) {
      localePriority.push(locale);
    }
  });

  return localePriority;
}

function pickPreferredTranslation(
  translationsByLocale: Map<string, string>,
  localePriority: string[],
): string {
  for (const locale of localePriority) {
    const value = translationsByLocale.get(locale);
    if (value !== undefined && value !== '') {
      return value;
    }
  }

  for (const value of translationsByLocale.values()) {
    if (value !== '') {
      return value;
    }
  }

  const firstValue = translationsByLocale.values().next();
  return firstValue.done ? '' : firstValue.value;
}

function applyNamespaceStrategy(
  key: string,
  namespace: string | undefined,
  mode: 'single' | 'multiple',
  multipleModeConcatNamespace: boolean,
): string {
  if (mode !== 'multiple' || !namespace || !multipleModeConcatNamespace) {
    return key;
  }

  if (key === namespace || key.startsWith(`${namespace}.`)) {
    return key;
  }

  return `${namespace}.${key}`;
}

interface LocaleFileEntry {
  filePath: string;
  locale: string;
  namespace?: string;
}

function getLocaleFiles(
  i18nPath: string,
  languages: string[],
  mode: 'single' | 'multiple',
  localeFileRegex: RegExp,
): LocaleFileEntry[] {
  if (mode === 'single') {
    return fs.readdirSync(i18nPath)
      .filter((file) => localeFileRegex.test(file))
      .map((file) => {
        const locale = path.basename(file, path.extname(file));
        return {
          filePath: path.join(i18nPath, file),
          locale,
        };
      });
  }

  const localeFiles: LocaleFileEntry[] = [];

  languages.forEach((locale) => {
    const localeDir = path.join(i18nPath, locale);

    if (!fs.existsSync(localeDir) || !fs.statSync(localeDir).isDirectory()) {
      return;
    }

    const filesInLocale = fs.readdirSync(localeDir)
      .filter((file) => localeFileRegex.test(file))
      .map((file) => ({
        filePath: path.join(localeDir, file),
        locale,
        namespace: path.basename(file, path.extname(file)),
      }));

    localeFiles.push(...filesInLocale);
  });

  return localeFiles;
}

export function getWorkspaceConfig(workspacePath: string) {
  const config = vscode.workspace.getConfiguration('i18n-autocomplete');
  const projectType = detectProjectType(workspacePath);
  
  if (projectType === ProjectType.Unknown) {
    return null;
  }
  
  const { defaultLocalizationPath, defaultAssetPath } = getDefaultPaths(projectType);
  
  const i18nPathSetting = config.get<string>(
    nameof(ExtensionConfig.prototype.jsonPath),
    defaultLocalizationPath,
  );
  
  const assetPathSetting = config.get<string>(
    nameof(ExtensionConfig.prototype.assetPath),
    defaultAssetPath,
  );

  const localeFileMode = config.get<'single' | 'multiple'>(
    nameof(ExtensionConfig.prototype.localeFileMode),
    'multiple',
  );

  const localeFilePattern = config.get<string>(
    nameof(ExtensionConfig.prototype.localeFilePattern),
    '*.json',
  );

  const multipleModeConcatNamespace = config.get<boolean>(
    nameof(ExtensionConfig.prototype.multipleModeConcatNamespace),
    false,
  );

  const preferredTranslationLanguage = config.get<string>(
    nameof(ExtensionConfig.prototype.preferredTranslationLanguage),
    '',
  );
  
  const i18nPath = path.join(workspacePath, i18nPathSetting);
  
  return {
    projectType,
    i18nPath,
    assetPath: path.join(workspacePath, assetPathSetting),
    i18nPathSetting,
    assetPathSetting,
    localeFileMode,
    localeFilePattern,
    multipleModeConcatNamespace,
    preferredTranslationLanguage,
  };
}

/**
 * Load translation keys from files and update the translation subject
 */
export function loadTranslationKeys(workspacePath: string): boolean {
  const config = getWorkspaceConfig(workspacePath);
  
  if (!config) {
    return false;
  }
  
  const {
    i18nPath,
    localeFileMode,
    localeFilePattern,
    multipleModeConcatNamespace,
    preferredTranslationLanguage,
  } = config;
  
  if (!fs.existsSync(i18nPath)) {
    // Project does not need i18n
    return false;
  }

  const workspaceConfig = vscode.workspace.getConfiguration('i18n-autocomplete');
  const languages = workspaceConfig.get<string[]>(
    nameof(ExtensionConfig.prototype.languages),
    ['en', 'vi'],
  );

  const localeFileRegex = buildLocaleFileRegex(localeFilePattern);
  const localeFiles = getLocaleFiles(i18nPath, languages, localeFileMode, localeFileRegex);
  
  if (localeFiles.length === 0) {
    showLog(`No translation files found in directory: ${i18nPath} (mode: ${localeFileMode}, pattern: ${localeFilePattern})`);
    return false;
  }
  
  const translationKeys: string[] = [];
  const reversedTranslationKeys: Record<string, string>[] = [];
  const translationKeyEntries: TranslationKeyEntry[] = [];
  const reversedTranslationKeyEntries: ReversedTranslationKeyEntry[] = [];

  const distinctKeyMap = new Map<string, { namespace?: string; translationsByLocale: Map<string, string> }>();
  const discoveredLocales: string[] = [];

  localeFiles.forEach((entry) => {
    if (!discoveredLocales.includes(entry.locale)) {
      discoveredLocales.push(entry.locale);
    }

    const json = parseLocaleJsonFile(entry.filePath);
    if (!json) {
      return;
    }

    const pairs: Array<{ key: string; value: string }> = [];
    extractKeyValuePairs(json, '', pairs);

    pairs.forEach(({ key, value }) => {
      const finalKey = applyNamespaceStrategy(
        key,
        entry.namespace,
        localeFileMode,
        multipleModeConcatNamespace,
      );

      const existing = distinctKeyMap.get(finalKey) || {
        namespace: entry.namespace,
        translationsByLocale: new Map<string, string>(),
      };

      if (!existing.namespace && entry.namespace) {
        existing.namespace = entry.namespace;
      }

      existing.translationsByLocale.set(entry.locale, value);
      distinctKeyMap.set(finalKey, existing);
    });
  });

  const localePriority = buildLocalePriority(preferredTranslationLanguage, languages, discoveredLocales);

  distinctKeyMap.forEach((entry, key) => {
    const preferredValue = pickPreferredTranslation(entry.translationsByLocale, localePriority);

    translationKeys.push(key);
    translationKeyEntries.push({
      key,
      namespace: entry.namespace,
    });

    reversedTranslationKeys.push({ [preferredValue]: key });
    reversedTranslationKeyEntries.push({
      value: preferredValue,
      key,
      namespace: entry.namespace,
    });
  });
  
  translationSubject.next({
    translationKeys,
    reversedTranslationKeys,
    translationKeyEntries,
    reversedTranslationKeyEntries,
    localeFileMode,
    multipleModeConcatNamespace,
  });
  
  return true;
}
