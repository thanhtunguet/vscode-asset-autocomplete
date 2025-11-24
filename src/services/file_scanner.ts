import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { LanguageConfig } from '../types/ExtensionConfig';

export interface ScanResult {
  filePath: string;
  relativePath: string;
  content: string;
  languageType: 'dart' | 'typescript' | 'javascript';
}

export class FileScanner {
  private workspacePath: string;
  private excludePatterns: string[];

  public constructor(workspacePath: string, excludePatterns: string[] = []) {
    this.workspacePath = workspacePath;
    this.excludePatterns = excludePatterns;
  }

  /**
   * Scan multiple directories for source files
   */
  public async scanDirectories(sourceDirs: string[]): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    for (const sourceDir of sourceDirs) {
      const dirPath = path.join(this.workspacePath, sourceDir);
      
      if (!fs.existsSync(dirPath)) {
        // Source directory does not exist
        continue;
      }

      const files = await this.scanDirectory(dirPath, sourceDir);
      results.push(...files);
    }

    return results;
  }

  /**
   * Scan a single directory recursively for source files
   */
  private async scanDirectory(dirPath: string, relativeDirPath: string): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const relativeFilePath = path.join(relativeDirPath, file);
        
        // Skip if matches exclude patterns
        if (this.shouldExclude(relativeFilePath)) {
          continue;
        }

        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          // Recursively scan subdirectories
          const subResults = await this.scanDirectory(filePath, relativeFilePath);
          results.push(...subResults);
        } else if (stat.isFile() && this.isSourceFile(file)) {
          // Process source files
          const content = fs.readFileSync(filePath, 'utf-8');
          const languageType = this.getLanguageType(file);
          
          if (languageType) {
            results.push({
              filePath,
              relativePath: relativeFilePath,
              content,
              languageType,
            });
          }
        }
      }
    } catch (error) {
      // Error scanning directory
    }

    return results;
  }

  /**
   * Check if file should be excluded based on patterns
   */
  private shouldExclude(relativePath: string): boolean {
    return this.excludePatterns.some(pattern => {
      // Simple glob pattern matching - could be enhanced with a proper glob library
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
      
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(relativePath);
    });
  }

  /**
   * Check if file is a source file we should scan
   */
  private isSourceFile(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return ['.dart', '.ts', '.tsx', '.js', '.jsx'].includes(ext);
  }

  /**
   * Determine the language type of a file
   */
  private getLanguageType(fileName: string): 'dart' | 'typescript' | 'javascript' | null {
    const ext = path.extname(fileName).toLowerCase();
    
    switch (ext) {
      case '.dart':
        return 'dart';
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      default:
        return null;
    }
  }

  /**
   * Scan files for a specific language configuration
   */
  public async scanForLanguage(languageConfig: LanguageConfig): Promise<ScanResult[]> {
    return this.scanDirectories(languageConfig.sourceDirs);
  }
}