import { SpriteBox } from './oggySpriteData';

export const LION_SPRITES: {
  idle_hero: SpriteBox[];
  walk_fwd: SpriteBox[];
  walk_back: SpriteBox[];
  jump: SpriteBox[];
  power_1: SpriteBox[];
  power_2: SpriteBox[];
} = {
  idle_hero: [
    { x: 16, y: 16, w: 210, h: 369 },
  ],
  walk_fwd: [
    { x: 242, y: 247, w: 100, h: 138 },
    { x: 358, y: 247, w: 88, h: 138 },
    { x: 462, y: 247, w: 84, h: 138 },
  ],
  walk_back: [
    { x: 562, y: 247, w: 86, h: 138 },
    { x: 664, y: 247, w: 86, h: 138 },
    { x: 766, y: 247, w: 85, h: 138 },
  ],
  jump: [
    { x: 16, y: 411, w: 127, h: 163 },
    { x: 159, y: 402, w: 124, h: 172 },
    { x: 299, y: 401, w: 123, h: 173 },
    { x: 438, y: 423, w: 118, h: 151 },
    { x: 572, y: 422, w: 122, h: 152 },
  ],
  power_1: [
    { x: 16, y: 600, w: 157, h: 154 },
    { x: 189, y: 593, w: 274, h: 161 },
    { x: 479, y: 593, w: 145, h: 161 },
  ],
  power_2: [
    { x: 640, y: 590, w: 177, h: 164 },
  ],
};
