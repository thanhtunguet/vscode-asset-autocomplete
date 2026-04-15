import * as fs from 'fs';
import path from 'path';
import { showLog } from '../helpers/log';
import { translationSubject } from '../extension';
import vscode from 'vscode';
import { detectProjectType } from '../helpers/project_type';
import { ProjectType } from '../types/ProjectType';
import { ExtensionConfig } from '../types/ExtensionConfig';

export function extractKeys(obj: any, prefix: string, keys: string[]): void {
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      extractKeys(obj[key], `${prefix}${key}.`, keys);
    } else {
      keys.push(`${prefix}${key}`);
    }
  }
}

export function extractReversedKeys(
  obj: any,
  keys: Record<string, string>[],
): void {
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

function getLocaleFiles(
  i18nPath: string,
  languages: string[],
  mode: 'single' | 'multiple',
  localeFileRegex: RegExp,
): string[] {
  if (mode === 'single') {
    return fs.readdirSync(i18nPath)
      .filter((file) => localeFileRegex.test(file))
      .map((file) => path.join(i18nPath, file));
  }

  const localeFiles: string[] = [];

  languages.forEach((locale) => {
    const localeDir = path.join(i18nPath, locale);

    if (!fs.existsSync(localeDir) || !fs.statSync(localeDir).isDirectory()) {
      return;
    }

    const filesInLocale = fs.readdirSync(localeDir)
      .filter((file) => localeFileRegex.test(file))
      .map((file) => path.join(localeDir, file));

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
  
  const i18nPath = path.join(workspacePath, i18nPathSetting);
  
  return {
    projectType,
    i18nPath,
    assetPath: path.join(workspacePath, assetPathSetting),
    i18nPathSetting,
    assetPathSetting,
    localeFileMode,
    localeFilePattern,
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
  const files = getLocaleFiles(i18nPath, languages, localeFileMode, localeFileRegex);
  
  if (files.length === 0) {
    showLog(`No translation files found in directory: ${i18nPath} (mode: ${localeFileMode}, pattern: ${localeFilePattern})`);
    return false;
  }
  
  const translationKeys: string[] = [];
  const reversedTranslationKeys: Record<string, string>[] = [];

  const firstJson = parseLocaleJsonFile(files[0]);
  if (firstJson) {
    extractKeys(firstJson, '', translationKeys);
  }
  
  files.forEach((filePath) => {
    const json = parseLocaleJsonFile(filePath);
    if (json) {
      extractReversedKeys(json, reversedTranslationKeys);
    }
  });
  
  translationSubject.next({
    translationKeys,
    reversedTranslationKeys,
  });
  
  return true;
}
