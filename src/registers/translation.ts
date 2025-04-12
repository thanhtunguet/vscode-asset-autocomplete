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
  
  const i18nPath = path.join(workspacePath, i18nPathSetting);
  
  return {
    projectType,
    i18nPath,
    assetPath: path.join(workspacePath, assetPathSetting),
    i18nPathSetting,
    assetPathSetting,
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
  
  const { i18nPath, projectType } = config;
  
  if (!fs.existsSync(i18nPath)) {
    // Project does not need i18n
    return false;
  }
  
  const files = fs
    .readdirSync(i18nPath)
    .filter((file) => file.endsWith('.json'));
  
  if (files.length === 0) {
    showLog('No translation files found in directory: ' + i18nPath);
    return false;
  }
  
  const translationKeys: string[] = [];
  const reversedTranslationKeys: Record<string, string>[] = [];
  
  // Load first file for translation keys
  const firstFile = files[0];
  const firstFilePath = path.join(i18nPath, firstFile);
  
  try {
    const content = fs.readFileSync(firstFilePath, 'utf-8');
    const json = JSON.parse(content);
    extractKeys(json, '', translationKeys);
  } catch (error) {
    showLog('Error parsing translation file: ' + firstFile);
  }
  
  // Load all files for reversed translation keys
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
  
  translationSubject.next({
    translationKeys,
    reversedTranslationKeys,
  });
  
  return true;
}
