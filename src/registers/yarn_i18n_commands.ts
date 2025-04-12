import {execSyncOnFolder} from '../helpers/exec';
import * as vscode from 'vscode';
import { loadTranslationKeys } from './translation';

export function registerYarnI18NCommands(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-autocomplete.yarnExtract', () => {
      execSyncOnFolder(
        'react3l translate extract -i src/ -o src/locales/ -p src/locales/',
        workspaceFolder.uri.fsPath,
      );
      // Reload translation keys after extraction
      loadTranslationKeys(workspaceFolder.uri.fsPath);
      vscode.window.showInformationMessage('Yarn extract command executed');
    }),

    vscode.commands.registerCommand('i18n-autocomplete.yarnMerge', () => {
      execSyncOnFolder(
        'yarn react3l translate merge -i src/ -o src/locales/ -p src/locales/',
        workspaceFolder.uri.fsPath,
      );
      // Reload translation keys after merging
      loadTranslationKeys(workspaceFolder.uri.fsPath);
      vscode.window.showInformationMessage('Yarn merge command executed');
    }),
  );
}
