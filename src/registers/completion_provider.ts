import * as vscode from 'vscode';
import {
  translationSubject,
  type ReversedTranslationKeyEntry,
  type TranslationKeyEntry,
} from '../extension';

function normalizePath(pathValue: string): string {
  return pathValue
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '');
}

function getAssetRegex(assetPath: string): RegExp {
  const normalized = normalizePath(assetPath);
  const escapedAssetPath = escapeRegex(normalized);
  return new RegExp(`['\"](${escapedAssetPath}\/[^'\"]*)['\"]`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTranslationFunctions(): string[] {
  const config = vscode.workspace.getConfiguration('i18n-autocomplete');
  const configured = config.get<string[]>('translationFunctions', ['t', 'translate']);

  if (!configured || configured.length === 0) {
    return ['t', 'translate'];
  }

  return configured.map(name => name.trim()).filter(Boolean);
}

/**
 * Get translation regex based on file language
 */
function getTranslationRegex(languageId: string, translationFunctions: string[]): RegExp {
  const functionPattern = translationFunctions
    .map(name => escapeRegex(name))
    .join('|');

  const dartPattern = `\\b(?:${functionPattern})\\s*\\(\\s*'([A-Za-z0-9$\\{\\}\\.]+)'\\s*(?:,\\s*\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\})?\\s*\\)`;
  const tsPattern = `\\b(?:${functionPattern})\\s*\\(\\s*(['"\`])([^'"\`]+)\\1\\s*(?:,\\s*\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\})?\\s*\\)`;

  switch (languageId) {
    case 'dart':
      // Enhanced Dart pattern with optional second argument (map)
      return new RegExp(dartPattern);
    case 'typescript':
    case 'javascript':
      // Enhanced TypeScript/JavaScript pattern with optional second argument (object)
      return new RegExp(tsPattern);
    default:
      // Fallback pattern for unknown languages
      return new RegExp(tsPattern);
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

function createReplaceRange(position: vscode.Position, keyword: string): vscode.Range {
  return new vscode.Range(position.translate(0, -keyword.length), position);
}

function rankByNamespaceMatch<T extends { namespace?: string }>(
  entries: T[],
  keyword: string,
): T[] {
  const lowerKeyword = keyword.toLowerCase();

  return [...entries].sort((a, b) => {
    const aNamespace = (a.namespace || '').toLowerCase();
    const bNamespace = (b.namespace || '').toLowerCase();

    const aMatches = aNamespace.startsWith(lowerKeyword) || lowerKeyword.startsWith(aNamespace);
    const bMatches = bNamespace.startsWith(lowerKeyword) || lowerKeyword.startsWith(bNamespace);

    if (aMatches && !bMatches) {
      return -1;
    }

    if (!aMatches && bMatches) {
      return 1;
    }

    return 0;
  });
}

function matchesTranslationEntry(entry: TranslationKeyEntry, keyword: string): boolean {
  return entry.key.startsWith(keyword) || (entry.namespace?.startsWith(keyword) ?? false);
}

function matchesReversedEntry(entry: ReversedTranslationKeyEntry, keyword: string): boolean {
  return entry.value.startsWith(keyword) || (entry.namespace?.startsWith(keyword) ?? false);
}

export function createCompletionProvider(
  assetFiles: string[],
  assetPath: string,
): vscode.CompletionItemProvider {
  return {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
    ): vscode.CompletionItem[] | undefined {
      const {
        translationKeys,
        reversedTranslationKeys,
        translationKeyEntries,
        reversedTranslationKeyEntries,
      } = translationSubject.value;
      
      let suggestions: Array<vscode.CompletionItem> = [];

      const line = document.lineAt(position);
      let lineText = line.text;

      const assetRegex = getAssetRegex(assetPath);
      const assetMatches = lineText.match(assetRegex);

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

      const translationFunctions = getTranslationFunctions();
      const translationRegex = getTranslationRegex(document.languageId, translationFunctions);
      const translationMatches = lineText.match(translationRegex);

      if (translationMatches) {
        const { translationKey } = extractTranslationKey(translationMatches, document.languageId);

        const keyEntriesToUse = translationKeyEntries.length > 0
          ? translationKeyEntries
          : translationKeys.map((key) => ({ key }));

        const rankedTranslationEntries = rankByNamespaceMatch(
          keyEntriesToUse.filter((entry) => matchesTranslationEntry(entry, translationKey)),
          translationKey,
        );

        suggestions = [
          ...suggestions,
          ...rankedTranslationEntries.map((entry) => {
            const item = new vscode.CompletionItem(
              entry.key,
              vscode.CompletionItemKind.Text,
            );

            item.insertText = entry.key;
            item.range = createReplaceRange(position, translationKey);
            return item;
          }),
        ];

        const reversedEntriesToUse = reversedTranslationKeyEntries.length > 0
          ? reversedTranslationKeyEntries
          : reversedTranslationKeys.map((entry) => {
            const [value, key] = Object.entries(entry)[0];
            return { value, key };
          });

        const rankedReversedEntries = rankByNamespaceMatch(
          reversedEntriesToUse.filter((entry) => matchesReversedEntry(entry, translationKey)),
          translationKey,
        );

        suggestions = [
          ...suggestions,
          ...rankedReversedEntries.map((entry) => {
            const item = new vscode.CompletionItem(
              entry.value,
              vscode.CompletionItemKind.Text,
            );

            item.insertText = entry.key;
            item.range = createReplaceRange(position, translationKey);
            item.label = `${entry.value} (${entry.key})`;
            return item;
          }),
        ];
      }

      return suggestions;
    },
  };
}
