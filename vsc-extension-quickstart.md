# 🚀 Quick Start: VSCode Asset Autocomplete

## 1️⃣ Install the Extension

Search `vscode-i18n-autocomplete` in the Extensions Marketplace  
→ Or install manually from VSIX if needed.

---

## 2️⃣ Configure Your Project

Go to your `.vscode/settings.json` or use the VSCode Settings UI:

```json
{
  "i18n-autocomplete.jsonPath": "assets/i18n",
  "i18n-autocomplete.assetPath": "assets"
}
```

For React, set `"src/assets"` if needed.

---

## 3️⃣ Use Translation Key Suggestions

In your Dart/JS/TS files, type:

```dart
translate('  // ⇨ Autocomplete will suggest i18n keys
```

It works with nested keys and reverse-maps translation values to keys.

---

## 4️⃣ Use Asset Path Suggestions

In your code (e.g. `Image.asset(...)`, `require(...)`, etc.), asset paths in the configured folder will autocomplete.

---

## 5️⃣ Run i18n Commands

Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **Flutter**:
  - `l10n: Extract`
  - `l10n: Extract Vietnamese`
  - `l10n: Extract English`
  - `l10n: Merge`

- **React**:
  - `I18n: Yarn Extract`
  - `I18n: Yarn Merge`

Make sure your `package.json` has the correct `yarn extract` / `yarn merge` scripts.

---

You're all set! 🎉  
Enjoy faster i18n workflows in Flutter and React apps.
