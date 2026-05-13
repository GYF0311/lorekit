import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { runExternalCommand } from './process.js';

export const GBRAIN_INSTALL_HINT = [
  'git clone https://github.com/garrytan/gbrain.git ~/code/gbrain',
  'cd ~/code/gbrain',
  'bun install',
  'bun link',
  'gbrain init',
].join('\n');

export interface GbrainStatusResult {
  installed: boolean;
  binary: string;
  version: string | null;
  brainInitialized: boolean;
  installHint: string;
  errors: string[];
}

export async function getGbrainStatus(): Promise<GbrainStatusResult> {
  const binary = process.env.LOREKIT_GBRAIN_BIN || 'gbrain';
  const errors: string[] = [];
  const versionProbe = await runExternalCommand({
    command: binary,
    args: ['--version'],
    timeoutMs: 10_000,
  });

  if (versionProbe.exitCode !== 0) {
    errors.push(versionProbe.error || versionProbe.stderr.trim() || 'gbrain binary not installed');
    return {
      installed: false,
      binary,
      version: null,
      brainInitialized: existsSync(join(homedir(), '.gbrain')),
      installHint: GBRAIN_INSTALL_HINT,
      errors,
    };
  }

  const version = (versionProbe.stdout || versionProbe.stderr).trim() || null;
  return {
    installed: true,
    binary,
    version,
    brainInitialized: existsSync(join(homedir(), '.gbrain')),
    installHint: GBRAIN_INSTALL_HINT,
    errors,
  };
}
