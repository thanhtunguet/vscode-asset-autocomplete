import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const outputChannel = vscode.window.createOutputChannel("VSCode i18n autocomplete");
let disposableProvider: vscode.Disposable | undefined;

function showLog(message: string) {
    vscode.window.showWarningMessage(message);
    outputChannel.appendLine(message);
    outputChannel.show();
}

export async function activate(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return;
    }

    const dartAvailable = await vscode.languages.getLanguages().then(langs => langs.includes('dart'));
    if (!dartAvailable) {
        showLog("Dart language not available. Is the Dart extension installed and active?");
        return;
    }

    const config = vscode.workspace.getConfiguration('i18n-autocomplete');
    const i18nPathSetting = config.get<string>('jsonPath', 'assets/i18n');
    const i18nPath = path.join(workspaceFolders[0].uri.fsPath, i18nPathSetting);
    let translationKeys: string[] = [];
    let reversedTranslationKeys: Record<string, string>[] = [];

    // Load translation keys from JSON files
    function loadTranslationKeys(): void {
        translationKeys = [];

        if (!fs.existsSync(i18nPath)) {
            showLog('Translation files directory not found: ' + i18nPath);
            return;
        }

        const files = fs.readdirSync(i18nPath).filter(file => file.endsWith('.json'));

        if (files.length === 0) {
            showLog('There are no translation files in the directory: ' + i18nPath);
            return;
        }

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
    }

    // Recursively extract keys from nested JSON
    function extractKeys(obj: any, prefix: string, keys: string[]): void {
        for (const key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                extractKeys(obj[key], `${prefix}${key}.`, keys);
            } else {
                keys.push(`${prefix}${key}`);
            }
        }
    }

    function extractReversedKeys(obj: any, keys: Record<string, string>[]): void {
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

    loadTranslationKeys();

    // Register completion provider
    disposableProvider = vscode.languages.registerCompletionItemProvider('dart', {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | undefined {
            const line = document.lineAt(position);
            /// get previous line
            let previousLine = position.line - 1;

            const lineText = `${document.lineAt(previousLine).text}\n${line.text}`; // get the previous line and the current line

            const matches = lineText.match(/translate\([\s\t\n]*['"]([^'"]*)['"]*/g);

            if (!matches) {
                return undefined;
            }

            let suggestions: Array<vscode.CompletionItem> = [];

            suggestions = [
                ...suggestions,
                ...translationKeys.map(key => {
                    const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Text);
                    item.insertText = `${key}`;
                    return item;
                }),
            ];

            /// Get first group matched text by regex: /translate\([\s\t\n]*['"]([^'"]*)['"]*/g in line text
            const translationMatches = matches[0].match(/translate\([\s\t\n]*['"]([^'"]*)['"]*/);

            if (translationMatches) {
                const translationKey = translationMatches[1];
                suggestions = [
                    ...suggestions,
                    ...reversedTranslationKeys.filter((entry) => {
                        const [key] = Object.entries(entry)[0];
                        return key.startsWith(translationKey);
                    }).map(entry => {
                        const [key, value] = Object.entries(entry)[0];
                        const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Text);
                        item.insertText = `${value}`;
                        item.label = `${key} (${value})`;
                        return item;
                    }),
                ];
            }

            return suggestions;
        }
    }, "'");

    context.subscriptions.push(disposableProvider);
}

export function deactivate() {
    if (disposableProvider) {
        disposableProvider.dispose();
    }
}
