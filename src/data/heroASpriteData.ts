import { SpriteBox } from './oggySpriteData';

// Sprite sheet coordinates for CYBER RANGER (hero_a slot)
export const HERO_A_SPRITES: {
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
    { x: 14, y: 20, w: 76, h: 130 },
  ],
  walk: [
    { x: 102, y: 22, w: 78, h: 128 },
    { x: 192, y: 26, w: 82, h: 124 },
  ],
  jump: [
    { x: 288, y: 14, w: 86, h: 136 },
  ],
  power_1: [
    { x: 14, y: 164, w: 116, h: 122 },
    { x: 142, y: 166, w: 128, h: 120 },
    { x: 282, y: 166, w: 130, h: 120 },
    { x: 426, y: 164, w: 94, h: 122 },
  ],
  power_2: [
    { x: 14, y: 300, w: 86, h: 138 },
    { x: 114, y: 328, w: 140, h: 110 },
    { x: 266, y: 334, w: 134, h: 104 },
    { x: 412, y: 322, w: 92, h: 116 },
  ],
  hurt: [
    { x: 14, y: 460, w: 96, h: 128 },
  ],
  knockdown: [
    { x: 124, y: 480, w: 120, h: 108 },
  ],
  victory: [
    { x: 258, y: 452, w: 80, h: 136 },
  ],
};
