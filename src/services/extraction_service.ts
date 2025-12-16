import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { LanguageConfig } from '../types/ExtensionConfig';
import { FileScanner } from './file_scanner';
import { TranslationExtractorFactory, type ExtractionResult, type ExtractedTranslation, BaseTranslationExtractor } from './translation_extractor';
import { detectProjectType } from '../helpers/project_type';
import { ProjectType } from '../types/ProjectType';
import { showLog } from '../helpers/log';

export interface TranslationFile {
  [key: string]: string; // Flat structure - all values are strings
}

export class ExtractionService {
  private workspacePath: string;
  private fileScanner: FileScanner;

  public constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    
    // Get exclude patterns from configuration
    const config = vscode.workspace.getConfiguration('i18n-autocomplete');
    const excludePatterns = config.get<string[]>('excludePatterns', [
      '**/*.test.ts', '**/*.test.js', '**/*.test.dart', 
      '**/node_modules/**', '**/dist/**', '**/build/**',
    ]);
    
    this.fileScanner = new FileScanner(workspacePath, excludePatterns);
  }

  /**
   * Extract translations for all configured languages
   */
  public async extractAll(): Promise<ExtractionResult[]> {
    const languageConfigs = this.getLanguageConfigs();
    const results: ExtractionResult[] = [];

    if (languageConfigs.length === 0) {
      showLog('No language configurations found. Please configure projectLanguages in settings.');
      return results;
    }

    for (const languageConfig of languageConfigs) {
      try {
        const result = await this.extractForLanguage(languageConfig);
        results.push(result);
      } catch (error) {
        showLog(`Error extracting translations for ${languageConfig.code}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Extract translations for a specific language
   */
  public async extractForLanguage(languageConfig: LanguageConfig): Promise<ExtractionResult> {
    showLog(`Extracting translations for language: ${languageConfig.code}`);
    
    // Scan files
    const files = await this.fileScanner.scanForLanguage(languageConfig);
    showLog(`Found ${files.length} source files to scan for ${languageConfig.code}`);

    // Create appropriate extractor based on configured project language
    const extractor = TranslationExtractorFactory.createExtractor(languageConfig, languageConfig.projectLanguage);
    
    // Extract translations
    const result = extractor.extractFromFiles(files);
    
    showLog(`Extracted ${result.translations.length} unique translations from ${result.totalFiles} files (${result.totalMatches} total matches)`);
    
    return result;
  }

  /**
   * Extract and generate translation files for a specific language
   */
  public async extractAndGenerate(languageConfig: LanguageConfig): Promise<void> {
    const result = await this.extractForLanguage(languageConfig);
    
    // Generate partial files (organized by namespace/component)
    await this.generatePartialFiles(result, languageConfig);
    
    // Generate main file (combined translations)
    await this.generateMainFile(result, languageConfig);
    
    showLog(`Generated translation files for ${languageConfig.code}`);
  }

  /**
   * Extract and generate translation files for all configured languages
   */
  public async extractAndGenerateAll(): Promise<void> {
    const languageConfigs = this.getLanguageConfigs();
    
    for (const languageConfig of languageConfigs) {
      await this.extractAndGenerate(languageConfig);
    }
    
    showLog('Translation extraction completed for all languages');
  }

  /**
   * Merge translation files for all configured languages without resetting existing values
   */
  /**
   * Merge translation files for all configured languages without resetting existing values
   */
  public async mergeTranslationFiles(): Promise<void> {
    const languageConfigs = this.getLanguageConfigs();
    
    for (const languageConfig of languageConfigs) {
      await this.mergeTranslationFile(languageConfig);
    }
    
    showLog(`Merged translation files for ${languageConfigs.length} languages`);
  }

  /**
   * Merge translation file for a specific language without resetting existing values
   */
  /**
   * Merge translation file for a specific language without resetting existing values
   */
  public async mergeTranslationFile(languageConfig: LanguageConfig): Promise<void> {
    await this.mergePartialFilesToSingleFile(languageConfig);
    
    showLog(`Merged translation files for ${languageConfig.code}`);
  }

  /**
   * Generate partial translation files organized by namespace
   */
  private async generatePartialFiles(result: ExtractionResult, languageConfig: LanguageConfig): Promise<void> {
    const targetPath = path.join(this.workspacePath, languageConfig.targetPath);
    
    // Ensure target directory exists
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Group translations by namespace (first part of the key)
    const namespaces = new Map<string, string[]>();
    
    result.translations.forEach(translation => {
      const parts = translation.key.split('.');
      const namespace = parts.length > 1 ? parts[0] : 'common';
      
      if (!namespaces.has(namespace)) {
        namespaces.set(namespace, []);
      }
      namespaces.get(namespace)!.push(translation.key);
    });

    // Generate a file for each namespace
    for (const [namespace, keys] of namespaces) {
      const filePath = path.join(targetPath, `${namespace}.json`);
      
      // Load existing translations to preserve them
      const existingTranslations = this.loadExistingTranslations(filePath);
      const updatedTranslations: TranslationFile = {};
      
      // Add/update keys found in code
      keys.forEach(key => {
        // Remove namespace prefix for partial files
        const keyWithoutNamespace = key.startsWith(`${namespace}.`) 
          ? key.substring(namespace.length + 1) 
          : key;
        
        // Preserve existing translation or add empty value for new keys
        updatedTranslations[keyWithoutNamespace] = existingTranslations[keyWithoutNamespace] || '';
      });
      
      // Only keep keys that still exist in code (remove orphans)
      // This automatically removes orphaned keys
      
      // Sort keys alphabetically for better organization
      const sortedTranslations = this.sortTranslationKeys(updatedTranslations);
      
      fs.writeFileSync(filePath, JSON.stringify(sortedTranslations, null, 2), 'utf-8');
      showLog(`Updated partial file: ${filePath} (${Object.keys(updatedTranslations).length} keys)`);
    }
  }

  /**
   * Generate main translation file with all translations combined
   */
  private async generateMainFile(result: ExtractionResult, languageConfig: LanguageConfig): Promise<void> {
    const mainFilePath = path.join(this.workspacePath, languageConfig.mainFilePath);
    const mainFileDir = path.dirname(mainFilePath);
    
    // Ensure directory exists
    if (!fs.existsSync(mainFileDir)) {
      fs.mkdirSync(mainFileDir, { recursive: true });
    }

    // Load existing translations to preserve them
    const existingTranslations = this.loadExistingTranslations(mainFilePath);
    const updatedTranslations: TranslationFile = {};
    
    // Add/update keys found in code (flat structure)
    result.translations.forEach(translation => {
      // Preserve existing translation or add empty value for new keys
      updatedTranslations[translation.key] = existingTranslations[translation.key] || '';
    });
    
    // Only keep keys that still exist in code (remove orphans)
    
    // Sort keys alphabetically for better organization
    const sortedTranslations = this.sortTranslationKeys(updatedTranslations);
    
    fs.writeFileSync(mainFilePath, JSON.stringify(sortedTranslations, null, 2), 'utf-8');
    showLog(`Updated main file: ${mainFilePath} (${Object.keys(updatedTranslations).length} keys)`);
  }

  /**
   * Merge partial files with existing translations preserved
   */
  /**
   * Merge all partial files from a language folder into a single language file
   * Only includes namespaced keys (with filename prefix)
   */
  private async mergePartialFilesToSingleFile(languageConfig: LanguageConfig): Promise<void> {
    const partialDir = path.join(this.workspacePath, languageConfig.targetPath);
    const mainFilePath = path.join(this.workspacePath, languageConfig.mainFilePath);
    const mainFileDir = path.dirname(mainFilePath);
    
    // Ensure main file directory exists
    if (!fs.existsSync(mainFileDir)) {
      fs.mkdirSync(mainFileDir, { recursive: true });
    }

    // Check if partial directory exists
    if (!fs.existsSync(partialDir)) {
      showLog(`Partial directory does not exist: ${partialDir}`);
      return;
    }

    // Read all JSON files from the partial directory
    const partialFiles = fs.readdirSync(partialDir)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(partialDir, file));

    if (partialFiles.length === 0) {
      showLog(`No partial JSON files found in: ${partialDir}`);
      return;
    }

    // Load existing main file to preserve translation values (but start fresh to avoid prefix duplication)
    const existingTranslations = this.loadExistingTranslations(mainFilePath);
    
    // Start with empty translations to avoid duplication from previous merges
    const mergedTranslations: TranslationFile = {};

    // Read and merge all partial files
    for (const partialFilePath of partialFiles) {
      try {
        const partialContent = fs.readFileSync(partialFilePath, 'utf-8');
        const partialTranslations = JSON.parse(partialContent);
        
        // Get the namespace from the filename (without extension)
        const namespace = path.basename(partialFilePath, '.json');
        
        // Add each translation with namespace prefix only
        Object.entries(partialTranslations).forEach(([key, value]) => {
          const stringValue = String(value);
          
          // Add only the namespaced key (with filename as namespace prefix)
          const namespacedKey = `${namespace}.${key}`;
          
          // Preserve existing translation values over partial file values
          if (existingTranslations[namespacedKey] && existingTranslations[namespacedKey].trim() !== '') {
            // Preserve existing non-empty translation values
            mergedTranslations[namespacedKey] = existingTranslations[namespacedKey];
          } else if (stringValue && stringValue.trim() !== '') {
            // Use the value from partial file if existing is empty and partial has content
            mergedTranslations[namespacedKey] = stringValue;
          } else {
            // Use empty string for new keys
            mergedTranslations[namespacedKey] = '';
          }
        });
        
        showLog(`Merged partial file: ${partialFilePath} (added namespaced keys with prefix: ${namespace})`);
      } catch (error) {
        showLog(`Error reading partial file ${partialFilePath}: ${error}`);
      }
    }

    // Sort keys alphabetically for better organization
    const sortedTranslations = this.sortTranslationKeys(mergedTranslations);
    
    // Write the merged translations to the main file
    fs.writeFileSync(mainFilePath, JSON.stringify(sortedTranslations, null, 2), 'utf-8');
    showLog(`Merged ${partialFiles.length} partial files into: ${mainFilePath} (${Object.keys(sortedTranslations).length} namespaced keys total)`);
  }

  /**
   * Merge main file with existing translations preserved
   */
  /**
   * Legacy method - no longer used in merge functionality
   * Merge main file with existing translations preserved
   */
  private async mergeMainFile(result: ExtractionResult, languageConfig: LanguageConfig): Promise<void> {
    // This method is deprecated in favor of mergePartialFilesToSingleFile
    // Keeping for backward compatibility but no longer used in merge operations
    const mainFilePath = path.join(this.workspacePath, languageConfig.mainFilePath);
    const mainFileDir = path.dirname(mainFilePath);
    
    // Ensure directory exists
    if (!fs.existsSync(mainFileDir)) {
      fs.mkdirSync(mainFileDir, { recursive: true });
    }

    // Load existing translations to preserve them
    const existingTranslations = this.loadExistingTranslations(mainFilePath);
    const updatedTranslations: TranslationFile = { ...existingTranslations };
    
    // Add new keys found in code while preserving existing values
    result.translations.forEach(translation => {
      if (!updatedTranslations.hasOwnProperty(translation.key)) {
        // Only add new keys, don't overwrite existing ones with empty values
        updatedTranslations[translation.key] = '';
      }
      // Existing keys keep their current values
    });
    
    // Sort keys alphabetically for better organization
    const sortedTranslations = this.sortTranslationKeys(updatedTranslations);
    
    fs.writeFileSync(mainFilePath, JSON.stringify(sortedTranslations, null, 2), 'utf-8');
    showLog(`Merged main file: ${mainFilePath} (${Object.keys(updatedTranslations).length} keys)`);
  }

  /**
   * Load existing translations from a file to preserve them
   */
  private loadExistingTranslations(filePath: string): TranslationFile {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const existing = JSON.parse(content);
        
        // Handle both flat and nested existing files
        if (this.isNestedTranslationFile(existing)) {
          return this.flattenTranslations(existing);
        }
        
        return existing;
      }
    } catch (error) {
      showLog(`Warning: Could not load existing translations from ${filePath}: ${error}`);
    }
    
    return {};
  }

  /**
   * Check if translation file has nested structure
   */
  private isNestedTranslationFile(obj: any): boolean {
    return Object.values(obj).some(value => typeof value === 'object' && value !== null);
  }

  /**
   * Flatten nested translation object to flat structure
   */
  private flattenTranslations(obj: any, prefix = ''): TranslationFile {
    const result: TranslationFile = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null) {
        Object.assign(result, this.flattenTranslations(value, fullKey));
      } else {
        result[fullKey] = String(value);
      }
    }
    
    return result;
  }

  /**
   * Sort translation keys alphabetically for better organization
   */
  private sortTranslationKeys(translations: TranslationFile): TranslationFile {
    const sortedKeys = Object.keys(translations).sort();
    const sortedTranslations: TranslationFile = {};
    
    sortedKeys.forEach(key => {
      sortedTranslations[key] = translations[key];
    });
    
    return sortedTranslations;
  }

  /**
   * Get language configurations from workspace settings
   */
  private getLanguageConfigs(): LanguageConfig[] {
    const config = vscode.workspace.getConfiguration('i18n-autocomplete');
    
    // Get configuration values
    const languages = config.get<string[]>('languages', ['en', 'vi']);
    const jsonPath = config.get<string>('jsonPath', 'assets/i18n');
    const sourceDirs = config.get<string[]>('sourceDirs', ['src/']);
    const projectLanguage = config.get<'dart' | 'typescript'>('projectLanguage', 'typescript');
    
    return languages.map(code => ({
      code,
      sourceDirs,
      targetPath: `${jsonPath}/${code}/`,
      mainFilePath: `${jsonPath}/${code}.json`,
      projectLanguage,
    }));
  }

  /**
   * Detect project type from scanned files
   */
  private detectProjectTypeFromFiles(files: any[]): 'dart' | 'typescript' | 'mixed' {
    const hasDart = files.some(f => f.languageType === 'dart');
    const hasTS = files.some(f => f.languageType === 'typescript' || f.languageType === 'javascript');
    
    if (hasDart && hasTS) {return 'mixed';}
    if (hasDart) {return 'dart';}
    if (hasTS) {return 'typescript';}
    
    // Default fallback
    const projectType = detectProjectType(this.workspacePath);
    return projectType === ProjectType.Flutter ? 'dart' : 'typescript';
  }
}