import { execFile } from 'child_process';

export interface RunOptions {
  timeoutMs?: number;
  /** Values replaced with ****** in any error message. */
  secrets?: string[];
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a binary without a shell, so arguments (SSIDs, passwords) need no quoting.
 * Resolves with stdout; rejects with an error whose message includes stderr.
 */
export function run(file: string, args: string[], options: RunOptions = {}): Promise<string> {
  const { timeoutMs = 30_000, secrets = [] } = options;

  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        const detail = stderr.trim() ? ` (stderr: ${stderr.trim()})` : '';
        error.message = redact(error.message + detail, secrets);
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function redact(text: string, secrets: string[]): string {
  return secrets
    .filter(Boolean)
    .reduce((message, secret) => message.split(secret).join('******'), text);
}
