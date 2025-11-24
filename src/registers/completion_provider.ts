import * as vscode from 'vscode';
import { translationSubject } from '../extension';

// Asset regex (moved from config/regex.ts)
const ASSET_REGEX = /['"](assets\/[^'"]*)['"]/;

/**
 * Get translation regex based on file language
 */
function getTranslationRegex(languageId: string): RegExp {
  switch (languageId) {
    case 'dart':
      // Enhanced Dart pattern with optional second argument (map)
      return /translate\s*\(\s*'([A-Za-z0-9$\{\}\.]+)'\s*(?:,\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?\s*\)/;
    case 'typescript':
    case 'javascript':
      // Enhanced TypeScript/JavaScript pattern with optional second argument (object)
      return /\bt(?:ranslate)?\s*\(\s*(['"`])([^'"`]+)\1\s*(?:,\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?\s*\)/;
    default:
      // Fallback pattern for unknown languages
      return /\bt(?:ranslate)?\s*\(\s*(['"`])([^'"`]+)\1\s*(?:,\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?\s*\)/;
  }
}

/**
 * Extract translation key from regex match based on language
 */
function extractTranslationKey(match: RegExpMatchArray, languageId: string): { openingQuote: string; translationKey: string; closeQuote: string } {
  switch (languageId) {
    case 'dart':
      return {
        openingQuote: "'",
        translationKey: match[1] || '',
        closeQuote: "'",
      };
    case 'typescript':
    case 'javascript':
      return {
        openingQuote: match[1] || "'",
        translationKey: match[2] || '',
        closeQuote: match[1] || "'",
      };
    default:
      return {
        openingQuote: match[1] || "'",
        translationKey: match[2] || '',
        closeQuote: match[1] || "'",
      };
  }
}

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

      const translationRegex = getTranslationRegex(document.languageId);
      const translationMatches = lineText.match(translationRegex);

      if (translationMatches) {
        const { openingQuote, translationKey, closeQuote } = extractTranslationKey(translationMatches, document.languageId);

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
              )}`;
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
              )}`;
              item.label = `${key} (${value})`;
              return item;
            }),
        ];
      }

      return suggestions;
    },
  };
}
