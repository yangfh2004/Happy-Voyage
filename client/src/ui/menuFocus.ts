export function menuTabTarget<T>(items: T[], active: T | null, backwards: boolean): T | null {
  if (!items.length) return null;
  if (!items.includes(active!)) return backwards ? items.at(-1)! : items[0];
  if (backwards && active === items[0]) return items.at(-1)!;
  if (!backwards && active === items.at(-1)) return items[0];
  return null;
}

export function trapMenuFocus(menu: HTMLElement, close: () => void) {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const items = () => Array.from(menu.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), summary, a[href], [tabindex]:not([tabindex="-1"])')).filter(item => item.getClientRects().length > 0 && item.tabIndex >= 0);
  const focusFirst = () => (items()[0] ?? menu).focus();
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      const target = menuTabTarget(items(), document.activeElement as HTMLElement | null, event.shiftKey);
      if (target || !items().length) {
        event.preventDefault();
        (target ?? menu).focus();
      }
    }
  };
  const focusin = (event: FocusEvent) => { if (!menu.contains(event.target as Node)) focusFirst(); };
  focusFirst();
  document.addEventListener('keydown', keydown, true);
  document.addEventListener('focusin', focusin);
  return () => {
    document.removeEventListener('keydown', keydown, true);
    document.removeEventListener('focusin', focusin);
    if (opener?.isConnected) opener.focus();
  };
}
