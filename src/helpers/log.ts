import {outputChannel} from '../config/output_channel';
import * as vscode from 'vscode';

export function showLog(message: string, showOutputLog: boolean = true) {
  vscode.window.showWarningMessage(message);
  outputChannel.appendLine(message);
  if (showOutputLog) {
    outputChannel.show();
  }
}
