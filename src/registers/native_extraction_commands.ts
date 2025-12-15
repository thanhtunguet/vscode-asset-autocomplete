import * as vscode from 'vscode';
import { ExtractionService } from '../services/extraction_service';
import type { LanguageConfig } from '../types/ExtensionConfig';
import { loadTranslationKeys } from './translation';
import { showLog } from '../helpers/log';

export function registerNativeExtractionCommands(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder,
) {
  const extractionService = new ExtractionService(workspaceFolder.uri.fsPath);

  context.subscriptions.push(
    // Extract all configured languages
    vscode.commands.registerCommand('i18n-autocomplete.nativeExtractAll', async () => {
      try {
        vscode.window.showInformationMessage('Starting native extraction for all languages...');
        await extractionService.extractAndGenerateAll();
        
        // Reload translation keys after extraction
        loadTranslationKeys(workspaceFolder.uri.fsPath);
        vscode.window.showInformationMessage('Native extraction completed for all languages');
      } catch (error) {
        vscode.window.showErrorMessage(`Native extraction failed: ${error}`);
        showLog(`Native extraction error: ${error}`);
      }
    }),

    // Extract for specific language
    vscode.commands.registerCommand('i18n-autocomplete.nativeExtract', async () => {
      try {
        const languageConfigs = getLanguageConfigs();
        
        if (languageConfigs.length === 0) {
          vscode.window.showWarningMessage('No language configurations found. Please configure projectLanguages in settings.');
          return;
        }

        // Show language picker
        const languageOptions = languageConfigs.map(config => ({
          label: config.code,
          description: `Source: ${config.sourceDirs.join(', ')} → Target: ${config.targetPath}`,
          config,
        }));

        const selected = await vscode.window.showQuickPick(languageOptions, {
          placeHolder: 'Select language to extract',
        });

        if (!selected) {
          return;
        }

        vscode.window.showInformationMessage(`Starting native extraction for ${selected.config.code}...`);
        await extractionService.extractAndGenerate(selected.config);
        
        // Reload translation keys after extraction
        loadTranslationKeys(workspaceFolder.uri.fsPath);
        vscode.window.showInformationMessage(`Native extraction completed for ${selected.config.code}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Native extraction failed: ${error}`);
        showLog(`Native extraction error: ${error}`);
      }
    }),

    // Extract without generating files (for analysis)
    vscode.commands.registerCommand('i18n-autocomplete.nativeAnalyze', async () => {
      try {
        const languageConfigs = getLanguageConfigs();
        
        if (languageConfigs.length === 0) {
          vscode.window.showWarningMessage('No language configurations found. Please configure projectLanguages in settings.');
          return;
        }

        vscode.window.showInformationMessage('Analyzing translations...');
        const results = await extractionService.extractAll();
        
        // Show results in output channel
        const totalTranslations = results.reduce((sum, result) => sum + result.translations.length, 0);
        const totalFiles = results.reduce((sum, result) => sum + result.totalFiles, 0);
        
        showLog('=== Translation Analysis Results ===');
        showLog(`Total files scanned: ${totalFiles}`);
        showLog(`Total unique translations found: ${totalTranslations}`);
        showLog('');
        
        results.forEach(result => {
          showLog(`Language: ${result.languageCode}`);
          showLog(`  Files: ${result.totalFiles}`);
          showLog(`  Unique translations: ${result.translations.length}`);
          showLog(`  Total matches: ${result.totalMatches}`);
          showLog('  Sample translations:');
          
          result.translations.slice(0, 10).forEach(t => {
            showLog(`    ${t.key} (${t.filePath}:${t.line})`);
          });
          
          if (result.translations.length > 10) {
            showLog(`    ... and ${result.translations.length - 10} more`);
          }
          showLog('');
        });

        vscode.window.showInformationMessage(`Analysis complete. Found ${totalTranslations} translations in ${totalFiles} files. Check output for details.`);
      } catch (error) {
        vscode.window.showErrorMessage(`Analysis failed: ${error}`);
        showLog(`Analysis error: ${error}`);
      }
    }),

    // Configure new language
    vscode.commands.registerCommand('i18n-autocomplete.configureLanguage', async () => {
      try {
        // Get language code
        const code = await vscode.window.showInputBox({
          prompt: 'Enter language code to add (e.g., en, vi, fr)',
          placeHolder: 'en',
          validateInput: (text) => text.trim() === '' ? 'Language code cannot be empty' : null,
        });

        if (!code) {
          return;
        }

        // Add to configuration
        const config = vscode.workspace.getConfiguration('i18n-autocomplete');
        const languages = config.get<string[]>('languages', []);
        
        // Check if language already exists
        if (languages.includes(code)) {
          vscode.window.showInformationMessage(`Language ${code} is already configured`);
          return;
        }

        languages.push(code);
        await config.update('languages', languages, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Added language: ${code}`);
        
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to configure language: ${error}`);
      }
    }),

    // Merge all configured languages
    vscode.commands.registerCommand('i18n-autocomplete.nativeMergeAll', async () => {
      try {
        vscode.window.showInformationMessage('Starting translation file merge for all languages...');
        await extractionService.mergeTranslationFiles();
        
        // Reload translation keys after merge
        loadTranslationKeys(workspaceFolder.uri.fsPath);
        vscode.window.showInformationMessage('Translation file merge completed for all languages');
      } catch (error) {
        vscode.window.showErrorMessage(`Translation merge failed: ${error}`);
        showLog(`Translation merge error: ${error}`);
      }
    }),

    // Merge for specific language
    vscode.commands.registerCommand('i18n-autocomplete.nativeMerge', async () => {
      try {
        const languageConfigs = getLanguageConfigs();
        
        if (languageConfigs.length === 0) {
          vscode.window.showWarningMessage('No language configurations found. Please configure projectLanguages in settings.');
          return;
        }

        // Show language picker
        const languageOptions = languageConfigs.map(config => ({
          label: config.code,
          description: `Source: ${config.sourceDirs.join(', ')} → Target: ${config.targetPath}`,
          config,
        }));

        const selected = await vscode.window.showQuickPick(languageOptions, {
          placeHolder: 'Select language to merge',
        });

        if (!selected) {
          return;
        }

        vscode.window.showInformationMessage(`Starting translation file merge for ${selected.config.code}...`);
        await extractionService.mergeTranslationFile(selected.config);
        
        // Reload translation keys after merge
        loadTranslationKeys(workspaceFolder.uri.fsPath);
        vscode.window.showInformationMessage(`Translation file merge completed for ${selected.config.code}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Translation merge failed: ${error}`);
        showLog(`Translation merge error: ${error}`);
      }
    }),
  );
}

/**
 * Get language configurations from workspace settings
 */
function getLanguageConfigs(): LanguageConfig[] {
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