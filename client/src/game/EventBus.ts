import Phaser from 'phaser';

/**
 * The bridge between the React overlay, the game controller and Phaser scenes.
 *
 * Events:
 *   'state-changed'          ()                       any game state change; scenes redraw
 *   'animate-move'           ({ playerId, path })     scene animates a fleet along `path`
 *   'move-complete'          ()                       scene finished animating
 */
export const EventBus = new Phaser.Events.EventEmitter();
