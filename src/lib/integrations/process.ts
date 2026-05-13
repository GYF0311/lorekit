import { spawn } from 'node:child_process';

export interface ExternalCommandArgs {
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
}

export interface ExternalCommandResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  error?: string;
}

export function runExternalCommand(opts: ExternalCommandArgs): Promise<ExternalCommandResult> {
  const startedAt = Date.now();
  const timeoutMs = opts.timeoutMs ?? 120_000;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('error', (e: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command: opts.command,
        args: opts.args,
        exitCode: -1,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        timedOut,
        error: e.message,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command: opts.command,
        args: opts.args,
        exitCode: code ?? (timedOut ? 124 : 1),
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
  });
}
