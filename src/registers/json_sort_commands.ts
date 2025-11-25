import * as vscode from 'vscode';
import { JsonSortService } from '../services/json_sort_service';

export function registerJsonSortCommands(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder,
) {
  const sortService = new JsonSortService(workspaceFolder.uri.fsPath);

  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-autocomplete.sortJsonTranslations', async () => {
      try {
        vscode.window.showInformationMessage('Sorting JSON translation files...');
        
        const result = await sortService.sortAllJsonTranslationFiles();
        
        if (result.totalFiles === 0) {
          vscode.window.showWarningMessage('No JSON translation files found in common translation directories.');
          return;
        }
        
        if (result.sortedFiles === 0) {
          vscode.window.showInformationMessage(`All ${result.totalFiles} JSON translation files are already sorted.`);
        } else {
          vscode.window.showInformationMessage(
            `Successfully sorted ${result.sortedFiles} out of ${result.totalFiles} JSON translation files.`
          );
        }
        
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to sort JSON translation files: ${error}`);
      }
    }),
  );
}