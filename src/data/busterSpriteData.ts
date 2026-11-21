import { SpriteBox } from './oggySpriteData';

export const BUSTER_SPRITES: {
  idle: SpriteBox;
  walk: SpriteBox;
  run: SpriteBox;
  jump: SpriteBox;
  punch: SpriteBox;
  hurt: SpriteBox;
  uppercut: SpriteBox;
  victory: SpriteBox;
} = {
  idle: { x: 20, y: 45, w: 227, h: 247 },
  walk: { x: 267, y: 20, w: 270, h: 272 },
  run: { x: 557, y: 45, w: 305, h: 247 },
  punch: { x: 882, y: 37, w: 329, h: 255 },
  uppercut: { x: 20, y: 333, w: 370, h: 297 },
  jump: { x: 410, y: 383, w: 293, h: 247 },
  hurt: { x: 723, y: 312, w: 254, h: 318 },
  victory: { x: 997, y: 334, w: 278, h: 296 },
};
