import { SpriteBox } from './oggySpriteData';

export const DEATH_WOLF_SPRITES: {
  idle_walk: SpriteBox[];
  jump: SpriteBox[];
  power_1: SpriteBox[];
  power_2_hurt: SpriteBox[];
} = {
  idle_walk: [
    { x: 20, y: 20, w: 212, h: 201 },
    { x: 252, y: 26, w: 163, h: 195 },
    { x: 435, y: 27, w: 175, h: 194 },
    { x: 630, y: 46, w: 201, h: 175 },
  ],
  jump: [
    { x: 20, y: 331, w: 185, h: 192 },
    { x: 225, y: 241, w: 198, h: 282 },
    { x: 443, y: 342, w: 183, h: 181 },
  ],
  power_1: [
    { x: 20, y: 543, w: 173, h: 258 },
    { x: 213, y: 561, w: 228, h: 240 },
    { x: 461, y: 576, w: 219, h: 225 },
    { x: 700, y: 610, w: 203, h: 191 },
  ],
  power_2_hurt: [
    { x: 20, y: 847, w: 240, h: 168 },
    { x: 280, y: 852, w: 281, h: 163 },
    { x: 581, y: 821, w: 171, h: 194 },
  ],
};
