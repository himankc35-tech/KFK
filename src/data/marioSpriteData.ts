import { SpriteBox } from './oggySpriteData';

// Sprite sheet coordinates for GOLD KNUCKLE (mario slot)
export const MARIO_SPRITES: {
  idle: SpriteBox[];
  walk: SpriteBox[];
  jump: SpriteBox[];
  power_1: SpriteBox[];
  power_2: SpriteBox[];
  hurt: SpriteBox[];
  knockdown: SpriteBox[];
  victory: SpriteBox[];
} = {
  idle: [
    { x: 14, y: 14, w: 88, h: 132 },
  ],
  walk: [
    { x: 114, y: 14, w: 86, h: 132 },
    { x: 214, y: 14, w: 85, h: 132 },
  ],
  jump: [
    { x: 311, y: 34, w: 92, h: 112 },
  ],
  power_1: [
    { x: 14, y: 158, w: 94, h: 130 },
    { x: 122, y: 160, w: 122, h: 128 },
    { x: 258, y: 160, w: 145, h: 128 },
    { x: 417, y: 160, w: 102, h: 128 },
  ],
  power_2: [
    { x: 14, y: 301, w: 82, h: 134 },
    { x: 110, y: 305, w: 126, h: 130 },
    { x: 256, y: 300, w: 107, h: 135 },
    { x: 379, y: 319, w: 102, h: 116 },
  ],
  hurt: [
    { x: 14, y: 469, w: 102, h: 120 },
  ],
  knockdown: [
    { x: 128, y: 495, w: 134, h: 94 },
  ],
  victory: [
    { x: 275, y: 447, w: 88, h: 142 },
    { x: 377, y: 451, w: 70, h: 138 },
  ],
};
