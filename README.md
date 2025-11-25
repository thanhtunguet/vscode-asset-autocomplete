# VSCode Asset Autocomplete

**VSCode Asset Autocomplete** is a powerful VSCode extension that provides intelligent translation key autocomplete and asset path completions for Flutter, React, and React Native projects. **Version 1.0.0** introduces native translation management directly within VSCode - no external CLI tools required!

---

## ✨ Features

### 🔤 Smart Translation Management
- **Intelligent autocomplete** for translation keys from your JSON i18n files
- **Reverse-lookup suggestions** from translation text
- **Multi-level nested key support** with dot notation
- **Native extraction and merging** - no CLI dependencies needed
- Language support:
  - Dart (Flutter)
  - JavaScript / TypeScript (React, React Native)

### 🖼️ Asset Path Autocompletion
- Provides completions for files in your asset folder:
  - `assets/` for Flutter projects
  - `src/assets/` for React/React Native projects

### 🚀 Built-in Translation Commands

#### ⭐ Native Translation Management (No CLI Required!)
- **`I18n: Native Extract All`** – Extract translations for all configured languages
- **`I18n: Native Extract`** – Extract for a specific language (with picker)
- **`I18n: Merge`** – Merge translation files
- **`I18n: Analyze Translations`** – Analyze translations without generating files
- **`I18n: Configure Language`** – Add new language to configuration

**Smart Extraction Features:**
- ✅ **Preserves existing translations** - keeps your translated text intact
- ✅ **Adds new keys only** - found in source code
- ✅ **Removes orphan keys** - no longer used in code
- ✅ **Flat key structure** - simple `"key.name": "value"` format
- ✅ **Works with nested files** - converts to flat automatically
- ✅ **Zero external dependencies** - everything runs within VSCode

---

## ⚙️ Configuration

### Quick Setup

Add this configuration to your `.vscode/settings.json` file:

#### For Dart/Flutter Projects:
```json
{
  "i18n-autocomplete.languages": ["en", "vi"],
  "i18n-autocomplete.projectLanguage": "dart",
  "i18n-autocomplete.jsonPath": "assets/i18n",
  "i18n-autocomplete.sourceDirs": ["lib/", "src/"],
  "i18n-autocomplete.excludePatterns": [
    "**/*.test.dart",
    "**/*.g.dart",
    "**/build/**",
    "**/.dart_tool/**"
  ]
}
```

#### For TypeScript/JavaScript Projects:
```json
{
  "i18n-autocomplete.languages": ["en", "vi"],
  "i18n-autocomplete.projectLanguage": "typescript",
  "i18n-autocomplete.jsonPath": "src/locales",
  "i18n-autocomplete.sourceDirs": ["src/", "components/", "pages/"],
  "i18n-autocomplete.excludePatterns": [
    "**/*.test.ts",
    "**/*.test.js",
    "**/*.spec.ts",
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**"
  ]
}
```

#### Minimal Configuration (uses defaults):
```json
{
  "i18n-autocomplete.languages": ["en", "vi"],
  "i18n-autocomplete.projectLanguage": "typescript"
}
```

### Configuration Settings

| Setting | Description | Default |
|--------|-------------|---------|
| `i18n-autocomplete.languages` | List of language codes for extraction | `["en", "vi"]` |
| `i18n-autocomplete.projectLanguage` | Project type: "dart" or "typescript" | `"typescript"` |
| `i18n-autocomplete.jsonPath` | Path to the i18n translation folder | `"assets/i18n"` |
| `i18n-autocomplete.sourceDirs` | Source directories to scan for translations | `["src/"]` |
| `i18n-autocomplete.excludePatterns` | Files/folders to exclude from scanning | `["**/*.test.ts", "**/node_modules/**"]` |
| `i18n-autocomplete.assetPath` | Path to your asset folder | `"assets"` |

---

## 🧠 Supported Languages

- Dart (`.dart`)
- JavaScript (`.js`, `.mjs`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)

---

## 💻 Commands

All commands are available through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| **I18n: Native Extract All** | Extract translations for all configured languages |
| **I18n: Native Extract** | Extract for a specific language (with picker) |
| **I18n: Merge** | Merge translation files |
| **I18n: Analyze Translations** | Analyze translations without generating files |
| **I18n: Configure Language** | Add new language to configuration |
| **l10n: Extract** | Extract for specific locale (with prompt) |
| **l10n: Extract All Languages** | Extract for all configured languages |

---

## 🛠 Requirements

**Version 1.0.0 and above:** No external dependencies required! The extension now handles translation management natively within VSCode.

---

## 📦 Installation

Search for **"vscode-asset-autocomplete"** in the VSCode Extensions Marketplace or install manually from VSIX.

## 🚀 Quick Start

1. **Install the extension** from the marketplace
2. **Configure your project** by adding settings to `.vscode/settings.json`
3. **Start using commands** via Command Palette (`Ctrl+Shift+P`)
   - Try **"I18n: Native Extract All"** to extract all translation keys
   - Use **"I18n: Configure Language"** to add new languages

No additional setup or CLI tools required!

---

## 🧪 Feedback / Contributions

Contributions and feature requests are welcome!  
Open an issue or PR on [GitHub](https://github.com/thanhtunguet/vscode-i18n-autocomplete).
