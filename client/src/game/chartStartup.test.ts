import { afterEach, expect, it, vi } from 'vitest';
import { waitForSeaFont } from './chartStartup';

afterEach(() => vi.useRealTimers());

it.each([() => Promise.resolve([]), () => Promise.reject(new Error('offline')), () => { throw new Error('unavailable'); }])('starts after font loading settles, including failures', async (load) => {
  await expect(waitForSeaFont(load)).resolves.toBeUndefined();
});

it('starts after the deadline even if the font never responds', async () => {
  vi.useFakeTimers();
  const ready = vi.fn();
  const waiting = waitForSeaFont(() => new Promise(() => {})).then(ready);
  await vi.advanceTimersByTimeAsync(1499);
  expect(ready).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await waiting;
  expect(ready).toHaveBeenCalledOnce();
});
