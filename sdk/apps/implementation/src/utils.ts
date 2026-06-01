import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function loadDotenv(): void {
  for (const candidate of [
    resolve(here, '../.env'),
    resolve(process.cwd(), '.env'),
  ]) {
    if (existsSync(candidate)) {
      loadEnv({ path: candidate });
      return;
    }
  }
}

export type ParsedArgs = {
  positional: string[];
  flags: Record<string, string | string[] | true>;
};

export function parseArgs(argv: string[], repeatable: ReadonlySet<string> = new Set()): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | string[] | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] as string;
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    if (repeatable.has(key)) {
      const prev = flags[key];
      flags[key] = Array.isArray(prev) ? [...prev, next] : prev ? [prev as string, next] : [next];
    } else {
      flags[key] = next;
    }
    i += 1;
  }
  return { positional, flags };
}

export function requireFlag(args: ParsedArgs, name: string): string {
  const value = args.flags[name];
  if (typeof value !== 'string' || !value) {
    throw new Error(`Missing required flag --${name}`);
  }
  return value;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, replacer, 2));
}

/** Print an error as structured JSON on stderr. SDK errors expose a stable `code` and `cause` chain. */
export function printError(err: unknown): void {
  console.error(JSON.stringify({ ok: false, error: serializeError(err) }, replacer, 2));
}

function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { message: String(err) };
  }
  const out: Record<string, unknown> = { name: err.name, message: err.message };
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string') {
    out.code = code;
  }
  const cause = (err as { cause?: unknown }).cause;
  if (cause !== undefined) {
    out.cause = serializeError(cause);
  }
  return out;
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
  return value;
}
