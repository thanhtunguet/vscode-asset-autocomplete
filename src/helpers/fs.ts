import fs from 'fs';
import path from 'path';

export function traverseDirectory(
  directory: string,
  basePath: string,
  results: string[],
) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const relativePath = path.join(basePath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      traverseDirectory(fullPath, relativePath, results);
    } else {
      results.push(relativePath);
    }
  }
}
