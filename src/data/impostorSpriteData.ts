import { SpriteBox } from './oggySpriteData';

// Sprite sheet coordinates for CRIMSON VIPER (impostor slot)
export const IMPOSTOR_SPRITES: {
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
    { x: 14, y: 40, w: 80, h: 104 },
  ],
  walk: [
    { x: 108, y: 20, w: 82, h: 124 },
    { x: 202, y: 16, w: 94, h: 128 },
  ],
  jump: [
    { x: 310, y: 14, w: 94, h: 130 },
  ],
  power_1: [
    { x: 14, y: 156, w: 110, h: 120 },
    { x: 136, y: 158, w: 118, h: 118 },
    { x: 268, y: 156, w: 114, h: 120 },
    { x: 396, y: 156, w: 104, h: 120 },
  ],
  power_2: [
    { x: 14, y: 290, w: 116, h: 121 },
    { x: 142, y: 290, w: 140, h: 121 },
    { x: 296, y: 290, w: 168, h: 121 },
    { x: 478, y: 290, w: 108, h: 121 },
  ],
  hurt: [
    { x: 14, y: 437, w: 104, h: 130 },
  ],
  knockdown: [
    { x: 132, y: 479, w: 140, h: 88 },
  ],
  victory: [
    { x: 286, y: 425, w: 100, h: 142 },
  ],
};
