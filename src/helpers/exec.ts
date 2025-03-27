import {execSync} from 'child_process';
import {outputChannel} from '../config/output_channel';
import {showLog} from './log';

export function execSyncOnFolder(command: string, folder: string) {
  try {
    const result = execSync(command, {
      cwd: folder,
      encoding: 'utf-8',
    });
    outputChannel.appendLine(result);
  } catch (error) {
    if (error instanceof Error) {
      showLog(`Error executing command: ${error.message}`);
    } else {
      showLog(`Unknown error occurred during command execution`);
    }
  }
}
