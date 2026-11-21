import { SpriteBox } from './oggySpriteData';

export const AKITA_SPRITES: {
  idle_walk: SpriteBox[];
  jump: SpriteBox[];
  power_1: SpriteBox[];
  power_2_hurt: SpriteBox[];
} = {
  idle_walk: [
    { x: 20, y: 20, w: 164, h: 228 },
    { x: 204, y: 23, w: 170, h: 225 },
    { x: 394, y: 26, w: 173, h: 222 },
    { x: 587, y: 47, w: 217, h: 201 },
  ],
  jump: [
    { x: 20, y: 268, w: 170, h: 226 },
    { x: 210, y: 317, w: 153, h: 177 },
    { x: 383, y: 315, w: 182, h: 179 },
  ],
  power_1: [
    { x: 20, y: 580, w: 228, h: 226 },
    { x: 268, y: 514, w: 237, h: 292 },
    { x: 525, y: 589, w: 189, h: 217 },
    { x: 734, y: 567, w: 180, h: 239 },
  ],
  power_2_hurt: [
    { x: 20, y: 845, w: 191, h: 232 },
    { x: 231, y: 826, w: 226, h: 251 },
    { x: 477, y: 829, w: 227, h: 248 },
    { x: 724, y: 855, w: 159, h: 222 },
  ],
};
