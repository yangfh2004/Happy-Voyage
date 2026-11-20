export type TooltipPosition = { left: number; top: number; above: boolean };

type TooltipState = { position: TooltipPosition; engaged: boolean } | null;

type TooltipEvent =
  | { type: 'engage' | 'hover' | 'reposition'; position: TooltipPosition }
  | { type: 'leave'; pointerType: string }
  | { type: 'dismiss' };

export function statTooltipState(state: TooltipState, event: TooltipEvent): TooltipState {
  switch (event.type) {
    case 'engage':
      return { position: event.position, engaged: true };
    case 'hover':
      return state ?? { position: event.position, engaged: false };
    case 'reposition':
      return state && { ...state, position: event.position };
    case 'leave':
      return event.pointerType === 'mouse' && !state?.engaged ? null : state;
    case 'dismiss':
      return null;
  }
}
