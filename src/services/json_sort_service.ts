import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class JsonSortService {
  constructor(private workspacePath: string) {}

  async sortAllJsonTranslationFiles(): Promise<void> {
    const translationDirs = this.getTranslationDirectories();
    let totalFiles = 0;
    let sortedFiles = 0;

    for (const dir of translationDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        totalFiles += jsonFiles.length;
        
        for (const file of jsonFiles) {
          const filePath = path.join(dir, file);
          try {
            if (await this.sortJsonFile(filePath)) {
              sortedFiles++;
            }
          } catch (error) {
            vscode.window.showWarningMessage(`Failed to sort ${file}: ${error}`);
          }
        }
      }
    }

    return { totalFiles, sortedFiles };
  }

  private async sortJsonFile(filePath: string): Promise<boolean> {
    try {
      // Read the file
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Parse JSON
      const jsonData = JSON.parse(content);
      
      // Sort the object recursively
      const sortedData = this.sortObjectRecursively(jsonData);
      
      // Convert back to JSON with proper formatting
      const sortedContent = JSON.stringify(sortedData, null, 2) + '\n';
      
      // Only write if content changed
      if (content !== sortedContent) {
        fs.writeFileSync(filePath, sortedContent, 'utf8');
        return true;
      }
      
      return false;
    } catch (error) {
      throw new Error(`Error sorting ${filePath}: ${error.message}`);
    }
  }

  private sortObjectRecursively(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectRecursively(item));
    }
    
    // Sort object keys
    const sortedKeys = Object.keys(obj).sort();
    const sortedObject: any = {};
    
    for (const key of sortedKeys) {
      sortedObject[key] = this.sortObjectRecursively(obj[key]);
    }
    
    return sortedObject;
  }

  private getTranslationDirectories(): string[] {
    const dirs: string[] = [];
    
    // Common translation directory patterns
    const commonPaths = [
      'locales',
      'i18n',
      'translations',
      'lang',
      'languages',
      'src/locales',
      'src/i18n',
      'src/translations',
      'src/lang',
      'src/languages',
      'assets/locales',
      'assets/i18n',
      'assets/translations',
      'public/locales',
      'public/i18n',
      'public/translations'
    ];

    for (const relativePath of commonPaths) {
      const fullPath = path.join(this.workspacePath, relativePath);
      if (fs.existsSync(fullPath)) {
        dirs.push(fullPath);
      }
    }

    return dirs;
  }
}