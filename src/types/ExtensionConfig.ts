export interface LanguageConfig {
  code: string;                    // Language code: "en", "vi", etc.
  sourceDirs: string[];           // Source directories to scan: ["src/", "lib/", "components/"]
  targetPath: string;             // Target path for partial files: "assets/i18n/en/"
  mainFilePath: string;           // Main translation file: "assets/i18n/en.json"
  regex?: string;                 // Custom regex pattern (optional, falls back to language defaults)
}

// Simplified language config for internal use
export interface LanguageConfig {
  code: string;                        // Language code: "en", "vi", etc.
  sourceDirs: string[];               // Source directories to scan
  targetPath: string;                 // Target path for partial files
  mainFilePath: string;               // Main translation file path
  projectLanguage: 'dart' | 'typescript'; // Project language type
}

export class ExtensionConfig {
  // Main configuration
  jsonPath?: string;                    // Path to i18n files (e.g., "assets/i18n")
  assetPath?: string;                  // Path to assets
  languages?: string[];                // Simple array of language codes: ["en", "vi", "fr"]
  
  // New multi-directory scanning configuration
  projectLanguage?: 'dart' | 'typescript';  // Project type: "dart" or "typescript"
  sourceDirs?: string[];               // Source directories to scan: ["src/", "lib/", "components/"]
  excludePatterns?: string[];          // Patterns to exclude: ["**/*.test.ts", "**/node_modules/**"]
}
