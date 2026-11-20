import Phaser from 'phaser';

/**
 * The bridge between the React overlay, the game controller and Phaser scenes.
 *
 * Events:
 *   'state-changed'          ()                       any game state change; scenes redraw
 *   'animate-move'           ({ playerId, path, id }) scene animates a fleet along `path`
 *   'move-complete'          (id)                     scene finished animating
 *   'pacing-changed'         ()                       update active movement speed
 *   'cancel-move'            ()                       discard an old game's movement
 */
export const EventBus = new Phaser.Events.EventEmitter();
