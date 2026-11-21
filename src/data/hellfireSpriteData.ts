import { SpriteBox } from './oggySpriteData';

// Sprite sheet coordinates for MAGMA KNIGHT (hellfire slot)
export const HELLFIRE_SPRITES: {
  idle: SpriteBox[];
  walk: SpriteBox[];
  jump: SpriteBox[];
  power_1: SpriteBox[];
  power_2: SpriteBox[];
  guard: SpriteBox[];
  hurt: SpriteBox[];
  knockdown: SpriteBox[];
  victory: SpriteBox[];
} = {
  idle: [
    { x: 14, y: 24, w: 86, h: 126 },
  ],
  walk: [
    { x: 112, y: 24, w: 94, h: 126 },
    { x: 218, y: 24, w: 96, h: 126 },
  ],
  jump: [
    { x: 328, y: 14, w: 112, h: 136 },
  ],
  power_1: [
    { x: 14, y: 164, w: 132, h: 128 },
    { x: 158, y: 164, w: 134, h: 128 },
    { x: 320, y: 164, w: 128, h: 128 },
    { x: 460, y: 162, w: 132, h: 130 },
  ],
  power_2: [
    { x: 14, y: 306, w: 116, h: 130 },
    { x: 144, y: 304, w: 142, h: 132 },
    { x: 304, y: 304, w: 276, h: 132 },
  ],
  guard: [
    { x: 14, y: 454, w: 128, h: 138 },
  ],
  hurt: [
    { x: 154, y: 456, w: 126, h: 136 },
  ],
  knockdown: [
    { x: 294, y: 468, w: 128, h: 124 },
  ],
  victory: [
    { x: 434, y: 448, w: 116, h: 144 },
  ],
};
