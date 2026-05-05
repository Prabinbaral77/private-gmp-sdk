// Vitest setup. Add global test hooks here as the suite grows.
import 'dotenv/config';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});
