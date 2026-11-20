import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNationRoster, GameEngine, ref, tx } from '@happy-voyage/shared';
import { setLocale } from '../i18n';
import { TurnIndicator } from './TurnIndicator';

afterEach(() => setLocale('en'));

describe('board turn indicator', () => {
  const { state } = new GameEngine({ players: createNationRoster([{ name: 'Ana', nation: 'Spain' }], { totalPlayers: 4 }) });
  it('shows a localized active-player banner and names a Navigate action', () => {
    const notice = tx("{p}'s turn", '{p} 的回合', { p: ref.player(0) });
    const action = tx('{p} used Navigate to {n}.', '{p} 使用「导航」前往{n}。', { p: ref.player(0), n: ref.node(2) });
    const english = renderToStaticMarkup(<TurnIndicator state={state} notice={notice} action={action} />);
    expect(english).toContain('Ana&#x27;s turn');
    expect(english).toContain('Ana used Navigate to');
    expect(english).toContain('role="status"');
    setLocale('zh');
    const chinese = renderToStaticMarkup(<TurnIndicator state={state} notice={notice} action={action} />);
    expect(chinese).toContain('Ana 的回合');
    expect(chinese).toContain('使用「导航」');
  });
  it('renders nothing without notices or after game over', () => {
    expect(renderToStaticMarkup(<TurnIndicator state={state} notice={null} action={null} />)).toBe('');
    expect(renderToStaticMarkup(<TurnIndicator state={{ ...state, phase: 'gameOver' }} notice={tx('Turn', '回合')} action={null} />)).toBe('');
  });
});
