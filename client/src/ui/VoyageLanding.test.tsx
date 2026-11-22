import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { VoyageLanding } from './VoyageLanding';

const render = () => renderToStaticMarkup(<VoyageLanding onStart={() => {}} onOnline={() => {}} />);

describe('VoyageLanding', () => {
  afterEach(() => setLocale('en'));

  it('shows local and online entry points without a bilingual title', () => {
    setLocale('en');
    const html = render();
    expect(html).toContain('>Happy Voyage</h1>');
    expect(html).toContain('New voyage');
    expect(html).toContain('Host online room');
    expect(html).not.toContain('欢乐大航海');
  });

  it('localizes the title and both entry points', () => {
    setLocale('zh');
    const html = render();
    expect(html).toContain('>欢乐大航海</h1>');
    expect(html).toContain('开始航程');
    expect(html).toContain('创建在线房间');
  });
});
