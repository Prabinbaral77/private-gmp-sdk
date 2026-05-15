import { NetworkError } from '../utils/errors';


export const scannerError = (context: string, result: unknown): NetworkError => {
  const r = (result ?? {}) as { status?: number; error?: { message?: string } };
  return new NetworkError(
    `Failed to ${context}: status=${r.status ?? 'unknown'}, message=${r.error?.message ?? 'No message'}`,
  );
};