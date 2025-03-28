import path from 'path';
import fs from 'fs';
import {traverseDirectory} from '../helpers/fs';
import {showLog} from '../helpers/log';

export function loadAssetFiles(
  workspaceFolder: string,
  subPath: string,
): string[] {
  const fullPath = path.join(workspaceFolder, subPath);

  const results: string[] = [];

  if (!fs.existsSync(fullPath)) {
    return results;
  }

  traverseDirectory(fullPath, subPath, results);
  return results;
}
