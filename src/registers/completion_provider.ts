import * as vscode from 'vscode';
import {ASSET_REGEX, TRANSLATION_REGEX} from '../config/regex';
import { translationSubject } from '../extension';

export function createCompletionProvider(
  assetFiles: string[],
): vscode.CompletionItemProvider {
  return {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
    ): vscode.CompletionItem[] | undefined {
      const {
        translationKeys,
        reversedTranslationKeys,
      } = translationSubject.value;
      
      let suggestions: Array<vscode.CompletionItem> = [];

      const line = document.lineAt(position);
      let lineText = line.text;

      const assetMatches = lineText.match(ASSET_REGEX);

      if (assetMatches) {
        const assetMatch = assetMatches[1];

        suggestions = [
          ...suggestions,
          ...assetFiles
            .filter((file) => {
              return file.includes(assetMatch);
            })
            .map((file) => {
              const item = new vscode.CompletionItem(
                file,
                vscode.CompletionItemKind.File,
              );
              item.insertText = `${file.replace(assetMatch, '')}`;
              return item;
            }),
        ];
        return suggestions;
      }

      const previousLine = position.line - 1;
      const previousLineText = document.lineAt(previousLine).text;
      lineText = `${previousLineText} ${lineText}`;

      const translationMatches = lineText.match(TRANSLATION_REGEX);

      if (translationMatches) {
        const openingQuote = translationMatches[2];
        const translationKey = translationMatches[3];
        let closeQuote = translationMatches[4];
        if (closeQuote === '') {
          closeQuote = openingQuote;
        } else {
          closeQuote = '';
        }

        suggestions = [
          ...suggestions,
          ...translationKeys
            .filter((key) => key.startsWith(translationKey))
            .map((key) => {
              const item = new vscode.CompletionItem(
                key,
                vscode.CompletionItemKind.Text,
              );
              item.insertText = `${key.replace(
                translationKey,
                '',
              )}${closeQuote}`;
              return item;
            }),
        ];

        suggestions = [
          ...suggestions,
          ...reversedTranslationKeys
            .filter((entry) => {
              const [key] = Object.entries(entry)[0];
              return key.startsWith(translationKey);
            })
            .map((entry) => {
              const [key, value] = Object.entries(entry)[0];
              const item = new vscode.CompletionItem(
                key,
                vscode.CompletionItemKind.Text,
              );
              item.insertText = `${value.replace(
                translationKey,
                '',
              )}${closeQuote}`;
              item.label = `${key} (${value})`;
              return item;
            }),
        ];
      }

      return suggestions;
    },
  };
}
