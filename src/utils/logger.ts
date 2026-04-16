import chalk from 'chalk';

export const ok = (msg: string) => console.log(`${chalk.green('✓')} ${msg}`);
export const bad = (msg: string) => console.log(`${chalk.red('✗')} ${msg}`);
export const warn = (msg: string) => console.error(`${chalk.yellow('lorekit:')} ${msg}`);
export const err = (msg: string) => console.error(`${chalk.red('lorekit:')} ${msg}`);
