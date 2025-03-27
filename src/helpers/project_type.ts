import path from 'path';
import {ProjectType} from '../types/ProjectType';
import fs from 'fs';

export function detectProjectType(workspacePath: string): ProjectType {
  const pubspecPath = path.join(workspacePath, 'pubspec.yaml');
  const packageJsonPath = path.join(workspacePath, 'package.json');

  if (fs.existsSync(pubspecPath)) {
    return ProjectType.Flutter;
  }

  if (fs.existsSync(packageJsonPath)) {
    return ProjectType.NodeJS;
  }

  return ProjectType.Unknown;
}
