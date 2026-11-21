import { SpriteBox } from './oggySpriteData';

export const NEON_VOID_SPRITES: {
  idle: SpriteBox[];
  walk: SpriteBox[];
  run: SpriteBox[];
  jump: SpriteBox[];
  fall: SpriteBox[];
  attack1: SpriteBox[];
  attack2: SpriteBox[];
  hurt: SpriteBox[];
  death: SpriteBox[];
} = {
  idle: [
    { x: 14, y: 14, w: 140, h: 158 },
  ],
  walk: [
    { x: 168, y: 88, w: 58, h: 84 },
    { x: 240, y: 84, w: 48, h: 88 },
    { x: 300, y: 84, w: 48, h: 88 },
    { x: 362, y: 84, w: 46, h: 88 },
    { x: 422, y: 84, w: 46, h: 88 },
  ],
  run: [
    { x: 14, y: 202, w: 88, h: 78 },
    { x: 116, y: 196, w: 68, h: 84 },
    { x: 198, y: 196, w: 68, h: 84 },
    { x: 278, y: 204, w: 72, h: 76 },
  ],
  jump: [
    { x: 14, y: 320, w: 70, h: 53 },
    { x: 96, y: 302, w: 62, h: 71 },
    { x: 172, y: 308, w: 54, h: 65 },
    { x: 238, y: 294, w: 56, h: 79 },
    { x: 308, y: 324, w: 74, h: 49 },
  ],
  fall: [
    { x: 396, y: 300, w: 56, h: 73 },
    { x: 466, y: 308, w: 68, h: 65 },
    { x: 548, y: 331, w: 96, h: 42 },
  ],
  attack1: [
    { x: 14, y: 411, w: 88, h: 94 },
    { x: 114, y: 399, w: 142, h: 106 },
    { x: 268, y: 387, w: 148, h: 118 },
    { x: 452, y: 403, w: 70, h: 102 },
  ],
  attack2: [
    { x: 14, y: 543, w: 64, h: 94 },
    { x: 92, y: 543, w: 62, h: 94 },
    { x: 168, y: 519, w: 250, h: 118 },
  ],
  hurt: [
    { x: 364, y: 186, w: 78, h: 94 },
  ],
  death: [
    { x: 456, y: 196, w: 152, h: 84 },
  ],
};
