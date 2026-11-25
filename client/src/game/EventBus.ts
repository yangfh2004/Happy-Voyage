import Phaser from 'phaser';

/**
 * The bridge between the React overlay, the game controller and Phaser scenes.
 *
 * Events:
 *   'state-changed'          ()                       any game state change; scenes redraw
 *   'animate-move'           ({ playerId, path, id }) scene animates a fleet along `path`
 *   'move-complete'          (id)                     scene finished animating
 *   'pacing-changed'         ()                       update active movement speed
 *   'palette-changed'        (enabled)                redraw chart colors and seat markers
 *   'cancel-move'            ()                       discard an old game's movement
 *   'navigate-preview'       ({ playerId, nodeId } | null) preview the focused Navigate selector
 *   'chart-focus'            ({ x, y, bottom } | null) viewport position of target or landed stop
 *   'engine-event'           (GameEvent)              every engine event, for board effects
 *   'fight-requested'       ()                       submit the current battle selection
 */
export const EventBus = new Phaser.Events.EventEmitter();
