const PREFIX = 'happy-voyage-';

export type Preference = 'tutorial-dismissed' | 'color-blind';

const sessionValues = new Map<Preference, boolean>();

export function readPreference(name: Preference): boolean {
  const sessionValue = sessionValues.get(name);
  if (sessionValue !== undefined) return sessionValue;
  try { return localStorage.getItem(PREFIX + name) === 'true'; } catch { return false; }
}

export function writePreference(name: Preference, enabled: boolean): void {
  sessionValues.set(name, enabled);
  try { localStorage.setItem(PREFIX + name, String(enabled)); } catch {}
}
