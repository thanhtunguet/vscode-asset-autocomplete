import * as vscode from 'vscode';

export function createCompletionProvider(
  translationKeys: string[],
  reversedTranslationKeys: Record<string, string>[],
  assetFiles: string[],
): vscode.CompletionItemProvider {
  return {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
    ): vscode.CompletionItem[] | undefined {
      const line = document.lineAt(position);
      let previousLine = position.line - 1;
      const lineText = `${document.lineAt(previousLine).text}\n${line.text}`; // get the previous line and the current line

      const matches = lineText.match(/translate\([\s\t\n]*['"]([^'"]*)['"]*/g);

      let suggestions: Array<vscode.CompletionItem> = [];

      if (!matches) {
        const assetMatches = /['"](assets\/.*)['"]/g;
        if (assetMatches) {
          const assetMatchedTexts = lineText
            .split('\n')
            .join(' ')
            .match(/['"]assets\/(.*)['"]/);
          if (assetMatchedTexts) {
            const assetMatch = assetMatchedTexts[1];
            suggestions = [
              ...suggestions,
              ...assetFiles
                .filter((file) => {
                  return file.startsWith(assetMatch);
                })
                .map((file) => {
                  const item = new vscode.CompletionItem(
                    file,
                    vscode.CompletionItemKind.File,
                  );
                  item.insertText = `${file}`;
                  return item;
                }),
            ];
          }
        }
      } else {
        suggestions = [
          ...suggestions,
          ...translationKeys.map((key) => {
            const item = new vscode.CompletionItem(
              key,
              vscode.CompletionItemKind.Text,
            );
            item.insertText = `${key}`;
            return item;
          }),
        ];
        /// Get first group matched text by regex: /translate\([\s\t\n]*['"]([^'"]*)['"]*/g in line text
        const translationMatches = matches[0].match(
          /translate\([\s\t\n]*['"]([^'"]*)['"]*/,
        );
        if (translationMatches) {
          const translationKey = translationMatches[1];
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
                item.insertText = `${value}`;
                item.label = `${key} (${value})`;
                return item;
              }),
          ];
        }
      }

      return suggestions;
    },
  };
}
