import { SpriteBox } from './oggySpriteData';

// Sprite sheet coordinates for VOLT DASH (sonic slot)
export const SONIC_SPRITES: {
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
    { x: 14, y: 14, w: 76, h: 134 },
  ],
  walk: [
    { x: 104, y: 28, w: 102, h: 120 },
    { x: 218, y: 28, w: 104, h: 120 },
  ],
  jump: [
    { x: 336, y: 18, w: 90, h: 130 },
  ],
  power_1: [
    { x: 14, y: 162, w: 116, h: 124 },
    { x: 144, y: 162, w: 114, h: 124 },
    { x: 272, y: 162, w: 116, h: 124 },
    { x: 402, y: 162, w: 118, h: 124 },
  ],
  power_2: [
    { x: 14, y: 300, w: 82, h: 132 },
    { x: 110, y: 302, w: 132, h: 130 },
    { x: 256, y: 302, w: 122, h: 130 },
    { x: 390, y: 312, w: 92, h: 120 },
  ],
  hurt: [
    { x: 14, y: 454, w: 112, h: 130 },
  ],
  knockdown: [
    { x: 138, y: 486, w: 134, h: 98 },
  ],
  victory: [
    { x: 284, y: 446, w: 106, h: 138 },
  ],
};
