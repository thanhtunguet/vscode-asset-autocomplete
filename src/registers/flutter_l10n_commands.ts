import {execSyncOnFolder} from '../helpers/exec';
import * as vscode from 'vscode';

export function registerFlutterLocalizationCommands(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-autocomplete.l10nMerge', () => {
      vscode.window.showInformationMessage('Localization keys merged');
      /// Run command in current root folder of the workspace: dart run supa_l10n_manager merge
      execSyncOnFolder(
        'dart run supa_l10n_manager merge',
        workspaceFolder.uri.fsPath,
      );
    }),

    vscode.commands.registerCommand(
      'i18n-autocomplete.l10nExtract',
      async () => {
        const locale = await vscode.window.showInputBox({
          prompt: 'Enter locale code (e.g. en, vi)',
          placeHolder: 'en',
          validateInput: (text) =>
            text.trim() === '' ? 'Locale cannot be empty' : null,
        });

        if (!locale) {
          vscode.window.showWarningMessage('Locale input was cancelled.');
          return;
        }

        execSyncOnFolder(
          `dart run supa_l10n_manager extract --locale ${locale}`,
          vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',
        );
        vscode.window.showInformationMessage(`${locale} keys extracted`);
      },
    ),

    vscode.commands.registerCommand('i18n-autocomplete.l10nExtractVi', () => {
      execSyncOnFolder(
        `dart run supa_l10n_manager extract --locale vi`,
        workspaceFolder.uri.fsPath,
      );
      vscode.window.showInformationMessage('Vietnamese keys extracted');
    }),

    vscode.commands.registerCommand('i18n-autocomplete.l10nExtractEn', () => {
      execSyncOnFolder(
        `dart run supa_l10n_manager extract --locale en`,
        workspaceFolder.uri.fsPath,
      );
      vscode.window.showInformationMessage('English keys extracted');
    }),
  );
}
