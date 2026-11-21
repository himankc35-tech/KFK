import { SpriteBox } from './oggySpriteData';

// Sprite sheet coordinates for PHANTOM KNIGHT (herobrine slot)
export const HEROBRINE_SPRITES: {
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
    { x: 14, y: 20, w: 128, h: 112 },
  ],
  walk: [
    { x: 154, y: 20, w: 96, h: 112 },
    { x: 264, y: 20, w: 92, h: 112 },
  ],
  jump: [
    { x: 368, y: 14, w: 102, h: 118 },
  ],
  power_1: [
    { x: 14, y: 152, w: 94, h: 110 },
    { x: 154, y: 152, w: 128, h: 110 },
    { x: 310, y: 146, w: 136, h: 116 },
    { x: 460, y: 152, w: 100, h: 110 },
  ],
  power_2: [
    { x: 14, y: 274, w: 122, h: 112 },
    { x: 150, y: 278, w: 118, h: 108 },
    { x: 320, y: 274, w: 152, h: 112 },
    { x: 486, y: 274, w: 124, h: 112 },
  ],
  hurt: [
    { x: 14, y: 436, w: 94, h: 112 },
  ],
  knockdown: [
    { x: 122, y: 450, w: 132, h: 98 },
  ],
  victory: [
    { x: 268, y: 398, w: 104, h: 150 },
  ],
};
