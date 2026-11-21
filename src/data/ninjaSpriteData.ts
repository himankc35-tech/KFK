import { SpriteBox } from './oggySpriteData';

export const NINJA_SPRITES: {
  idle: SpriteBox[];
  walk: SpriteBox[];
  jump: SpriteBox[];
  power_1: SpriteBox[];
  power_2: SpriteBox[];
} = {
  idle: [
    { x: 16, y: 16, w: 158, h: 186 },
    { x: 190, y: 16, w: 157, h: 186 },
  ],
  walk: [
    { x: 16, y: 225, w: 124, h: 190 },
    { x: 156, y: 225, w: 110, h: 190 },
    { x: 282, y: 218, w: 128, h: 197 },
    { x: 426, y: 225, w: 125, h: 190 },
    { x: 567, y: 225, w: 103, h: 190 },
    { x: 686, y: 218, w: 127, h: 197 },
  ],
  jump: [
    { x: 16, y: 473, w: 140, h: 177 },
    { x: 172, y: 467, w: 101, h: 183 },
    { x: 289, y: 443, w: 126, h: 207 },
    { x: 431, y: 431, w: 126, h: 219 },
    { x: 573, y: 463, w: 215, h: 187 },
  ],
  power_1: [
    { x: 16, y: 698, w: 142, h: 194 },
    { x: 174, y: 667, w: 179, h: 225 },
    { x: 369, y: 672, w: 186, h: 220 },
    { x: 571, y: 670, w: 180, h: 222 },
    { x: 767, y: 666, w: 179, h: 226 },
  ],
  power_2: [
    { x: 16, y: 919, w: 145, h: 190 },
    { x: 177, y: 908, w: 144, h: 201 },
    { x: 337, y: 921, w: 190, h: 188 },
    { x: 543, y: 913, w: 286, h: 196 },
  ],
};
