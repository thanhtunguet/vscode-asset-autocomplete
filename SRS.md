# Software Requirements Specification

## Translation File Organization

Translation files are organized as follows:

### Partial Translation Files
- **Language-specific folders**: Each language has its own folder containing multiple JSON files
- **Namespace-based files**: Each file represents a partial translation for a specific feature, component, or domain
- **Namespace naming**: The filename (without the extension) serves as the namespace identifier

### Main Translation Files
- **Combined translations**: Each language has a main JSON file that contains all translations combined from all partial files
- **Namespaced keys**: Keys from partial files are prefixed with their namespace in the main file
- **Naming convention**: Main translation files follow the pattern `<language_code>.json`

### Example

For instance, if a partial file `product.json` contains a key `master.title`, the main translation file will contain the key `product.master.title`.

### Folder Structure

```
assets/i18n/
├── en.json
├── vi.json
├── en/
│   ├── product.json
│   ├── user.json
│   └── order.json
└── vi/
    ├── product.json
    ├── user.json
    └── order.json
```

## Extension Functionality

This VSCode extension provides commands to extract and merge translation files.

### Configuration Options

The extension exposes the following configuration options:

- **Source folders**: List of source code folders to extract translations from
- **Main language**: Programming language used (Dart or TypeScript)
- **Translation file path**: Path to the main translation files (e.g., `assets/i18n/`)
- **Supported languages**: List of language codes to extract translations for
