# VSCode Asset Autocomplete

**VSCode Asset Autocomplete** is a powerful extension that provides translation key suggestions and asset path completions for Flutter, React, and React Native projects. It also includes convenient commands to extract and merge localization files using your preferred tooling.

---

## ✨ Features

### 🔤 Translation Key Suggestions
- Autocomplete translation keys from your JSON i18n files.
- Reverse-lookup suggestions from translation text.
- Supports multi-level nested keys.
- Language support:
  - Dart (Flutter)
  - JavaScript / TypeScript (React, React Native)

### 🖼️ Asset Path Autocompletion
- Provides completions for files in your asset folder:
  - `assets/` for Flutter
  - `src/assets/` for React/React Native

### ⚙️ Quick Commands for i18n Management

#### Flutter
- `l10n: Extract` – run `dart run supa_l10n_manager extract`
- `l10n: Extract Vietnamese` – `--locale vi`
- `l10n: Extract English` – `--locale en`
- `l10n: Merge` – run `dart run supa_l10n_manager merge`

#### React / React Native
- `I18n: Yarn Extract` – runs `yarn extract`  
  _(Defined as: `react3l translate extract -i src/ -o src/locales/ -p src/locales/`)_
- `I18n: Yarn Merge` – runs `yarn merge`  
  _(Defined as: `react3l translate merge -i src/ -o src/locales/ -p src/locales/`)_

---

## ⚙️ Configuration

Configure these settings in `.vscode/settings.json` or through the Settings UI:

| Setting | Description | Default |
|--------|-------------|---------|
| `i18n-autocomplete.jsonPath` | Path to the i18n translation folder | `assets/i18n` |
| `i18n-autocomplete.assetPath` | Path to your asset folder | `assets` |

---

## 🧠 Supported Languages

- Dart (`.dart`)
- JavaScript (`.js`, `.mjs`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)

---

## 💻 Commands

| Command ID | Title |
|------------|-------|
| `i18n-autocomplete.l10nMerge` | l10n: Merge |
| `i18n-autocomplete.l10nExtract` | l10n: Extract |
| `i18n-autocomplete.l10nExtractVi` | l10n: Extract Vietnamese |
| `i18n-autocomplete.l10nExtractEn` | l10n: Extract English |
| `i18n-autocomplete.yarnExtract` | I18n: Yarn Extract |
| `i18n-autocomplete.yarnMerge` | I18n: Yarn Merge |

Use these commands via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

---

## 🛠 Requirements

- For Flutter projects: `supa_l10n_manager` must be available via Dart.
- For React/React Native: The following scripts must be defined in `package.json`:

```json
"scripts": {
  "extract": "react3l translate extract -i src/ -o src/locales/ -p src/locales/",
  "merge": "react3l translate merge -i src/ -o src/locales/ -p src/locales/"
}
```

---

## 📦 Installation

Search for **"vscode-i18n-autocomplete"** in the Extensions Marketplace or install manually from VSIX.

---

## 🧪 Feedback / Contributions

Contributions and feature requests are welcome!  
Open an issue or PR on [GitHub](https://github.com/thanhtunguet/vscode-i18n-autocomplete).
