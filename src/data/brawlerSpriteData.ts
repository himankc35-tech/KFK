import { SpriteBox } from './oggySpriteData';

export const BRAWLER_SPRITES: {
  idle: SpriteBox[];
  walk: SpriteBox[];
  run: SpriteBox[];
  jump: SpriteBox[];
  guard: SpriteBox[];
  punch: SpriteBox[];
  log_smash: SpriteBox[];
  crouch: SpriteBox[];
  uppercut: SpriteBox[];
  air_kick: SpriteBox[];
  land: SpriteBox[];
} = {
  idle: [
    { x: 16, y: 39, w: 140, h: 240 },
  ],
  walk: [
    { x: 172, y: 39, w: 135, h: 240 },
    { x: 323, y: 35, w: 119, h: 244 },
    { x: 458, y: 37, w: 109, h: 242 },
  ],
  run: [
    { x: 583, y: 48, w: 181, h: 231 },
    { x: 780, y: 56, w: 206, h: 223 },
  ],
  jump: [
    { x: 1002, y: 16, w: 136, h: 263 },
  ],
  guard: [
    { x: 16, y: 340, w: 151, h: 244 },
  ],
  punch: [
    { x: 183, y: 340, w: 219, h: 244 },
  ],
  log_smash: [
    { x: 418, y: 348, w: 250, h: 236 },
    { x: 684, y: 295, w: 184, h: 289 },
    { x: 884, y: 359, w: 244, h: 225 },
  ],
  crouch: [
    { x: 16, y: 705, w: 170, h: 194 },
  ],
  uppercut: [
    { x: 202, y: 600, w: 155, h: 299 },
  ],
  air_kick: [
    { x: 373, y: 722, w: 267, h: 177 },
  ],
  land: [
    { x: 697, y: 708, w: 283, h: 191 },
  ],
};
