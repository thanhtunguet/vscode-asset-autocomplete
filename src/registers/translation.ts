import * as fs from 'fs';
import path from 'path';
import {showLog} from '../helpers/log';

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

export function loadTranslationKeys(
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
