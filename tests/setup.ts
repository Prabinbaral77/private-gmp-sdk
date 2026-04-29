// Vitest setup. Add global test hooks here as the suite grows.
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});
