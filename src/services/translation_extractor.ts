import type { LanguageConfig } from '../types/ExtensionConfig';
import type { ScanResult } from './file_scanner';

export interface ExtractedTranslation {
  key: string;
  filePath: string;
  line: number;
  column: number;
  fullMatch: string;
}

export interface ExtractionResult {
  languageCode: string;
  translations: ExtractedTranslation[];
  totalFiles: number;
  totalMatches: number;
}

export abstract class BaseTranslationExtractor {
  protected languageConfig: LanguageConfig;

  public constructor(languageConfig: LanguageConfig) {
    this.languageConfig = languageConfig;
  }

  public abstract extractFromFiles(files: ScanResult[]): ExtractionResult;
  
  protected abstract getRegexPattern(): RegExp;

  /**
   * Extract translations from file content using regex
   */
  protected extractFromContent(content: string, filePath: string): ExtractedTranslation[] {
    const regex = this.getRegexPattern();
    const translations: ExtractedTranslation[] = [];
    let match;

    // Reset regex state before starting
    regex.lastIndex = 0;

    // Run regex on entire content to handle multi-line matches
    while ((match = regex.exec(content)) !== null) {
      const key = this.extractKey(match);
      if (key) {
        // Calculate line and column from match position
        const beforeMatch = content.substring(0, match.index);
        const line = (beforeMatch.match(/\n/g) || []).length + 1;
        const lastNewlineIndex = beforeMatch.lastIndexOf('\n');
        const column = match.index - lastNewlineIndex;

        translations.push({
          key,
          filePath,
          line,
          column,
          fullMatch: match[0],
        });
      }
    }

    return translations;
  }

  /**
   * Extract the translation key from regex match
   * Override in subclasses for language-specific extraction
   */
  protected abstract extractKey(match: RegExpExecArray): string | null;
}

/**
 * Dart translation extractor
 */
export class DartTranslationExtractor extends BaseTranslationExtractor {
  protected getRegexPattern(): RegExp {
    // Use custom regex if provided, otherwise default Dart pattern
    if (this.languageConfig.regex) {
      return new RegExp(this.languageConfig.regex, 'g');
    }

    // Enhanced Dart pattern to handle optional second argument (map):
    // Examples:
    // translate('key') 
    // translate('key', {})
    // translate('key', {'param': value})
    // translate('key', {'param': value, 'other': otherValue})
    return /translate\s*\(\s*'([A-Za-z0-9$\{\}\.]+)'\s*(?:,\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?\s*\)/g;
  }

  protected extractKey(match: RegExpExecArray): string | null {
    // For Dart, the key is typically in the first capture group
    return match[1] || null;
  }

  public extractFromFiles(files: ScanResult[]): ExtractionResult {
    const dartFiles = files.filter(f => f.languageType === 'dart');
    let allTranslations: ExtractedTranslation[] = [];

    dartFiles.forEach(file => {
      const translations = this.extractFromContent(file.content, file.relativePath);
      allTranslations.push(...translations);
    });

    // Remove duplicates based on key
    const uniqueTranslations = allTranslations.filter((translation, index, array) => 
      array.findIndex(t => t.key === translation.key) === index,
    );

    return {
      languageCode: this.languageConfig.code,
      translations: uniqueTranslations,
      totalFiles: dartFiles.length,
      totalMatches: allTranslations.length,
    };
  }
}

/**
 * TypeScript/JavaScript translation extractor
 */
export class TypeScriptTranslationExtractor extends BaseTranslationExtractor {
  protected getRegexPattern(): RegExp {
    // Use custom regex if provided, otherwise default TS/JS pattern
    if (this.languageConfig.regex) {
      return new RegExp(this.languageConfig.regex, 'g');
    }

    // Enhanced TypeScript/JavaScript pattern to handle optional second argument (object):
    // Examples:
    // t('key'), translate('key')
    // t("key"), translate("key") 
    // t(`key`), translate(`key`)
    // t('key', {}), translate('key', {})
    // t('key', {param: value}), translate('key', {param: value, other: 'test'})
    return /\bt(?:ranslate)?\s*\(\s*(['"`])([^'"`]+)\1\s*(?:,\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?\s*\)/g;
  }

  protected extractKey(match: RegExpExecArray): string | null {
    // For TypeScript/JavaScript, the key is typically in the second capture group
    return match[2] || null;
  }

  public extractFromFiles(files: ScanResult[]): ExtractionResult {
    const tsJsFiles = files.filter(f => 
      f.languageType === 'typescript' || f.languageType === 'javascript',
    );
    let allTranslations: ExtractedTranslation[] = [];

    tsJsFiles.forEach(file => {
      const translations = this.extractFromContent(file.content, file.relativePath);
      allTranslations.push(...translations);
    });

    // Remove duplicates based on key
    const uniqueTranslations = allTranslations.filter((translation, index, array) => 
      array.findIndex(t => t.key === translation.key) === index,
    );

    return {
      languageCode: this.languageConfig.code,
      translations: uniqueTranslations,
      totalFiles: tsJsFiles.length,
      totalMatches: allTranslations.length,
    };
  }
}

/**
 * Factory for creating appropriate extractors
 */
export class TranslationExtractorFactory {
  public static createExtractor(
    languageConfig: LanguageConfig, 
    projectType: 'dart' | 'typescript',
  ): BaseTranslationExtractor {
    switch (projectType) {
      case 'dart':
        return new DartTranslationExtractor(languageConfig);
      case 'typescript':
        return new TypeScriptTranslationExtractor(languageConfig);
      default:
        throw new Error(`Unsupported project type: ${projectType}`);
    }
  }
}