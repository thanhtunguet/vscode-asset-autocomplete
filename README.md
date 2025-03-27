# VSCode Translation Autocomplete

## Overview
The **VSCode Translation Autocomplete** extension provides **auto-completion for translation keys** from JSON files located in `assets/i18n/*.json`. This extension helps developers working with localization files by suggesting available translation keys when using the `translate('key.namespace')` function in Dart files.

## Features
- 🔍 **Auto-complete translation keys** while typing inside `translate('...')`
- 📂 **Reads translation keys from JSON files** in `assets/i18n/`
- 📌 **Supports nested keys** for improved IDE auto-completion
- 🚀 **Works automatically** when editing Dart files

## Installation
1. Download and install **VSCode** if you haven't already.
2. Install this extension manually (or publish and install from the VSCode Marketplace).
3. Ensure your localization files are stored in `assets/i18n/*.json`.

## Usage
1. Open a Dart file in your Flutter project.
2. Start typing `translate('...')`, and **available translation keys** will be suggested.
3. Select a key from the autocomplete suggestions to insert it into your code.

## Configuration
This extension looks for translation files in `assets/i18n/`. If your project structure is different, you can customize the JSON path in VSCode settings:

1. Open **VSCode Settings** (`Cmd + ,` on macOS, `Ctrl + ,` on Windows/Linux).
2. Search for `i18n-autocomplete.jsonPath`.
3. Change the value to your custom path (e.g., `my_custom_folder/i18n`).

## Development
### Prerequisites
- Install **Node.js** and **npm**
- Install VSCode Extension Generator:
  ```sh
  npm install -g yo generator-code
  ```

### Running Locally
To run the extension in a development VSCode instance:
```sh
npm install
npm run compile  # Only needed if using TypeScript
code --extensionDevelopmentPath=.
```

### Packaging & Publishing
To package and publish the extension:
```sh
npm install -g vsce
vsce package
vsce publish
```

## Known Issues
- If JSON files contain errors, the extension may not load the keys correctly.
- Ensure your `assets/i18n/` folder exists, or manually configure the path.

## License
MIT License

## Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.

## Contact
For questions or suggestions, please open an issue on GitHub.

