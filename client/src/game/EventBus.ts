import Phaser from 'phaser';

/**
 * The bridge between the React overlay, the game controller and Phaser scenes.
 *
 * Events:
 *   'state-changed'          ()                       any game state change; scenes redraw
 *   'animate-move'           ({ playerId, path, stepMs })  scene animates a fleet along `path`
 *   'skip-move'              ()                            scene finishes the current move immediately
 *   'move-complete'          ()                            scene finished animating
 */
export const EventBus = new Phaser.Events.EventEmitter();
