import { FighterState, Projectile, HitSpark } from '../types/game';
import { OGGY_SPRITES, SpriteBox } from '../data/oggySpriteData';
import { BUSTER_SPRITES } from '../data/busterSpriteData';
import { HEROBRINE_SPRITES } from '../data/herobrineSpriteData';
import { IMPOSTOR_SPRITES } from '../data/impostorSpriteData';
import { LION_SPRITES } from '../data/lionSpriteData';
import { NINJA_SPRITES } from '../data/ninjaSpriteData';
import { BRAWLER_SPRITES } from '../data/brawlerSpriteData';
import { MARIO_SPRITES } from '../data/marioSpriteData';
import { SONIC_SPRITES } from '../data/sonicSpriteData';
import { HERO_A_SPRITES } from '../data/heroASpriteData';
import { DEATH_WOLF_SPRITES } from '../data/deathWolfSpriteData';
import { HELLFIRE_SPRITES } from '../data/hellfireSpriteData';
import { AKITA_SPRITES } from '../data/akitaSpriteData';
import { NEON_VOID_SPRITES } from '../data/neonVoidSpriteData';
import { getPreloadedImage } from '../utils/assetLoader';

const oggyMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/oggy/oggy_spritesheet.png') : null;
const busterMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/buster/buster_spritesheet.png') : null;
const herobrineMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/herobrine/herobrine_spritesheet.png') : null;
const impostorMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/impostor/impostor_spritesheet.png') : null;
const lionMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/lion/lion_spritesheet.png') : null;
const ninjaMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/ninja/ninja_spritesheet.png') : null;
const brawlerMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/brawler/brawler_spritesheet.png') : null;
const marioMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/mario/mario_spritesheet.png') : null;
const sonicMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/sonic/sonic_spritesheet.png') : null;
const heroAMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/hero_a/hero_a_spritesheet.png') : null;
const deathWolfMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/death_wolf/death_wolf_spritesheet.png') : null;
const hellfireMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/hellfire/hellfire_spritesheet.png') : null;
const akitaMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/akita/akita_spritesheet.png') : null;
const neonVoidMasterImage = typeof window !== 'undefined' ? getPreloadedImage('/assets/neon_void/neon_void_spritesheet.png') : null;

export const WORLD_FIGHTER_SCALE = 1.44;

export interface ResolvedPose {
  image: HTMLImageElement;
  box: SpriteBox;
  targetWidth: number;
  targetHeight: number;
  destX: number;
  destY: number;
  flipHoriz: boolean;
  rotate: number;
  tx: number;
  ty: number;
  blockColor?: string;
  defeatStars?: boolean;
}

interface AlphaMaskCache {
  w: number;
  h: number;
  alpha: Uint8Array;
}

/**
 * Crisp Low-to-Medium Pixel Art Sprite Renderer & Pixel-Exact Collision Detector
 * Renders all 13 tournament fighters from cleaned, overlap-free transparent sprite sheets.
 */
export class SpriteRenderer {
  private alphaCaches = new WeakMap<HTMLImageElement, AlphaMaskCache>();

  private getAlphaMask(img: HTMLImageElement): AlphaMaskCache | null {
    if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;
    const cached = this.alphaCaches.get(img);
    if (cached && cached.w === img.naturalWidth && cached.h === img.naturalHeight) {
      return cached;
    }
    if (typeof document === 'undefined') return null;

    const off = document.createElement('canvas');
    off.width = img.naturalWidth;
    off.height = img.naturalHeight;
    const octx = off.getContext('2d');
    if (!octx) return null;

    octx.drawImage(img, 0, 0);
    const data = octx.getImageData(0, 0, off.width, off.height).data;
    const alpha = new Uint8Array(off.width * off.height);
    for (let i = 0, p = 3; i < alpha.length; i++, p += 4) {
      alpha[i] = data[p];
    }
    const mask = { w: off.width, h: off.height, alpha };
    this.alphaCaches.set(img, mask);
    return mask;
  }

  /**
   * Resolve exact image, source box, world scale, anchor, and transform for any fighter's current state
   */
  public resolveFighterPose(
    f: FighterState,
    timeMs: number,
    scaleMultiplier: number = WORLD_FIGHTER_SCALE
  ): ResolvedPose | null {
    const base = this.resolveBaseFighterPose(f, timeMs);
    if (!base) return null;
    if (scaleMultiplier === 1) return base;
    return {
      ...base,
      targetWidth: base.targetWidth * scaleMultiplier,
      targetHeight: base.targetHeight * scaleMultiplier,
      destX: base.destX * scaleMultiplier,
      destY: base.destY * scaleMultiplier,
      tx: base.tx * scaleMultiplier,
      ty: base.ty * scaleMultiplier,
    };
  }

  private resolveBaseFighterPose(f: FighterState, timeMs: number): ResolvedPose | null {
    const action = f.action;
    const frame = f.frameIndex;

    if (f.characterId === 'oggy') {
      if (!oggyMasterImage || !oggyMasterImage.complete || oggyMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = OGGY_SPRITES.walk[0];
      let targetHeight = 108;
      let anchorFrac = 0.48;
      let defeatStars = false;

      if (action === 'idle') {
        const idleIdx = Math.floor(timeMs / 360) % 2;
        box = OGGY_SPRITES.walk[idleIdx] || OGGY_SPRITES.walk[0];
      } else if (action === 'walk_fwd') {
        const frameIdx = (Math.floor(timeMs / 90) % 4) + 2;
        box = OGGY_SPRITES.walk[frameIdx] || OGGY_SPRITES.walk[2];
      } else if (action === 'walk_back') {
        const frameIdx = 5 - (Math.floor(timeMs / 90) % 4);
        box = OGGY_SPRITES.walk[frameIdx] || OGGY_SPRITES.walk[2];
      } else if (action === 'run_fwd') {
        const runIdx = (Math.floor(timeMs / 65) % 4) + 6;
        box = OGGY_SPRITES.walk[runIdx] || OGGY_SPRITES.walk[7];
      } else if (action === 'jump') {
        if (f.vy < -12) box = OGGY_SPRITES.jump[1];
        else if (f.vy < -5) box = OGGY_SPRITES.jump[2];
        else if (f.vy < 0) box = OGGY_SPRITES.jump[3];
        else if (f.vy < 5) box = OGGY_SPRITES.jump[4];
        else if (f.vy < 11) box = OGGY_SPRITES.jump[5];
        else box = OGGY_SPRITES.jump[6];
      } else if (action === 'crouch') {
        targetHeight = 76;
        box = OGGY_SPRITES.jump[9] || OGGY_SPRITES.jump[8];
      } else if (action === 'block' || action === 'crouch_block') {
        if (action === 'crouch_block') targetHeight = 82;
        const guardIdx = 4 + (Math.floor(timeMs / 150) % 3);
        box = OGGY_SPRITES.kick_defend[guardIdx] || OGGY_SPRITES.kick_defend[5];
      } else if (action === 'power_1') {
        if (!f.isGrounded) {
          const airIdx = Math.min(3, 1 + Math.floor((frame / 8) * 3));
          box = OGGY_SPRITES.kick_defend[airIdx] || OGGY_SPRITES.kick_defend[2];
          anchorFrac = 0.40;
        } else {
          const punchIdx = Math.min(6, Math.max(0, Math.floor((frame / 8) * 7)));
          box = OGGY_SPRITES.punch[punchIdx] || OGGY_SPRITES.punch[3];
          anchorFrac = punchIdx === 6 ? 0.36 : punchIdx >= 3 ? 0.42 : 0.46;
        }
      } else if (action === 'power_2') {
        if (frame <= 3) {
          const pIdx = Math.min(9, 7 + Math.floor((frame / 4) * 3));
          box = OGGY_SPRITES.punch[pIdx] || OGGY_SPRITES.punch[9];
          anchorFrac = pIdx === 9 ? 0.32 : 0.40;
        } else {
          const spinIdx = ((frame - 4) % 4) + 1;
          box = OGGY_SPRITES.special_victory_defeat[spinIdx] || OGGY_SPRITES.special_victory_defeat[2];
          anchorFrac = 0.48;
        }
      } else if (action === 'super') {
        if (frame <= 1) {
          box = OGGY_SPRITES.special_victory_defeat[0];
        } else {
          const spinIdx = (frame % 4) + 1;
          box = OGGY_SPRITES.special_victory_defeat[spinIdx] || OGGY_SPRITES.special_victory_defeat[2];
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = OGGY_SPRITES.hurt_knockdown[action === 'heavy_hurt' ? 2 : 1] || OGGY_SPRITES.hurt_knockdown[1];
      } else if (action === 'knockdown') {
        const kdIdx = Math.min(7, 3 + Math.floor(frame / 2));
        box = OGGY_SPRITES.hurt_knockdown[kdIdx] || OGGY_SPRITES.hurt_knockdown[6];
        targetHeight = Math.max(54, Math.round(108 * (box.h / 148)));
      } else if (action === 'getup') {
        const gIdx = Math.min(9, 8 + frame);
        box = OGGY_SPRITES.hurt_knockdown[gIdx] || OGGY_SPRITES.hurt_knockdown[9];
        targetHeight = Math.max(70, Math.round(108 * (box.h / 148)));
      } else if (action === 'victory') {
        const vIdx = 5 + (Math.floor(timeMs / 250) % 2);
        box = OGGY_SPRITES.special_victory_defeat[vIdx] || OGGY_SPRITES.special_victory_defeat[5];
      } else if (action === 'defeat') {
        box = OGGY_SPRITES.special_victory_defeat[7] || OGGY_SPRITES.hurt_knockdown[7];
        targetHeight = 84;
        defeatStars = true;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: oggyMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight,
        flipHoriz: false,
        rotate: 0,
        tx: 0,
        ty: 0,
        blockColor: 'rgba(56, 189, 248, 0.75)',
        defeatStars,
      };
    }

    if (f.characterId === 'buster') {
      if (!busterMasterImage || !busterMasterImage.complete || busterMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = BUSTER_SPRITES.idle;
      let targetHeight = 112;
      let anchorFrac = 0.45;
      let offsetY = 0;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = BUSTER_SPRITES.idle;
        targetHeight = 112 + Math.sin(timeMs / 150) * 2;
      } else if (action === 'walk_fwd' || action === 'walk_back') {
        box = Math.floor(timeMs / 140) % 2 === 0 ? BUSTER_SPRITES.walk : BUSTER_SPRITES.idle;
        offsetY = Math.abs(Math.sin(timeMs / 95)) * -4;
      } else if (action === 'run_fwd') {
        box = BUSTER_SPRITES.run;
        targetHeight = 108;
        offsetY = Math.abs(Math.sin(timeMs / 65)) * -5;
      } else if (action === 'jump') {
        box = BUSTER_SPRITES.jump;
        targetHeight = 110;
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = BUSTER_SPRITES.idle;
        targetHeight = 86;
      } else if (action === 'block') {
        box = BUSTER_SPRITES.idle;
        anchorFrac = 0.48;
      } else if (action === 'power_1') {
        if (frame <= 1) {
          box = BUSTER_SPRITES.idle;
          anchorFrac = 0.50;
        } else if (frame <= 5) {
          box = BUSTER_SPRITES.punch;
          targetHeight = 114;
          anchorFrac = 0.34;
        } else {
          box = BUSTER_SPRITES.idle;
        }
      } else if (action === 'power_2' || action === 'super') {
        if (frame <= 2) {
          box = BUSTER_SPRITES.idle;
          targetHeight = 102;
        } else if (frame <= 7) {
          box = BUSTER_SPRITES.uppercut;
          targetHeight = 124;
          anchorFrac = 0.38;
        } else {
          box = BUSTER_SPRITES.idle;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = BUSTER_SPRITES.hurt;
        targetHeight = 114;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = BUSTER_SPRITES.hurt;
        targetHeight = 108;
        rotate = -Math.PI / 2.2;
        tx = 22;
        ty = -16;
      } else if (action === 'getup') {
        box = BUSTER_SPRITES.idle;
        targetHeight = 95;
      } else if (action === 'victory') {
        box = BUSTER_SPRITES.victory;
        targetHeight = 120;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: busterMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight + offsetY,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(249, 115, 22, 0.85)',
      };
    }

    if (f.characterId === 'herobrine') {
      if (!herobrineMasterImage || !herobrineMasterImage.complete || herobrineMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = HEROBRINE_SPRITES.idle[0];
      let targetHeight = 116;
      let anchorFrac = 0.46;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = HEROBRINE_SPRITES.idle[0];
        targetHeight = 116 + Math.sin(timeMs / 170) * 1.5;
      } else if (action === 'walk_fwd' || action === 'walk_back') {
        const cycle = [HEROBRINE_SPRITES.walk[0], HEROBRINE_SPRITES.idle[0], HEROBRINE_SPRITES.walk[1], HEROBRINE_SPRITES.idle[0]];
        box = cycle[Math.floor(timeMs / 95) % cycle.length];
      } else if (action === 'run_fwd') {
        const idx = Math.floor(timeMs / 65) % HEROBRINE_SPRITES.walk.length;
        box = HEROBRINE_SPRITES.walk[idx];
        rotate = 0.09;
      } else if (action === 'jump') {
        box = HEROBRINE_SPRITES.jump[0];
        targetHeight = 116;
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = HEROBRINE_SPRITES.jump[0];
        targetHeight = 86;
      } else if (action === 'block') {
        box = HEROBRINE_SPRITES.power_1[0];
        anchorFrac = 0.44;
      } else if (action === 'power_1') {
        const pIdx = Math.min(HEROBRINE_SPRITES.power_1.length - 1, Math.max(0, Math.floor((frame / 8) * HEROBRINE_SPRITES.power_1.length)));
        box = HEROBRINE_SPRITES.power_1[pIdx];
        targetHeight = 120;
        anchorFrac = [0.44, 0.34, 0.36, 0.44][pIdx] ?? 0.40;
      } else if (action === 'power_2') {
        const lanceSeq = [0, 2, 3];
        const tIdx = lanceSeq[Math.min(lanceSeq.length - 1, Math.max(0, Math.floor((frame / 10) * lanceSeq.length)))];
        box = HEROBRINE_SPRITES.power_2[tIdx];
        targetHeight = 120;
        anchorFrac = [0.46, 0.42, 0.28, 0.42][tIdx] ?? 0.38;
      } else if (action === 'super') {
        if (frame % 2 === 0) {
          const pIdx = Math.floor(frame / 2) % HEROBRINE_SPRITES.power_1.length;
          box = HEROBRINE_SPRITES.power_1[pIdx];
          targetHeight = 122;
          anchorFrac = 0.36;
        } else {
          const tIdx = Math.floor(frame / 2) % HEROBRINE_SPRITES.power_2.length;
          box = HEROBRINE_SPRITES.power_2[tIdx];
          targetHeight = 122;
          anchorFrac = 0.34;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = HEROBRINE_SPRITES.hurt[0];
        rotate = action === 'heavy_hurt' ? -0.12 : -0.06;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = HEROBRINE_SPRITES.knockdown[0];
        targetHeight = 84;
        anchorFrac = 0.5;
      } else if (action === 'getup') {
        box = HEROBRINE_SPRITES.jump[0];
        targetHeight = 96;
      } else if (action === 'victory') {
        box = HEROBRINE_SPRITES.victory[0];
        targetHeight = 124;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: herobrineMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(168, 85, 247, 0.85)',
        defeatStars: action === 'defeat',
      };
    }

    if (f.characterId === 'impostor') {
      if (!impostorMasterImage || !impostorMasterImage.complete || impostorMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = IMPOSTOR_SPRITES.idle[0];
      let targetHeight = 108;
      let anchorFrac = 0.46;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = IMPOSTOR_SPRITES.idle[0];
        targetHeight = 108 + Math.sin(timeMs / 160) * 1.5;
      } else if (action === 'walk_fwd' || action === 'walk_back') {
        const cycle = [IMPOSTOR_SPRITES.walk[0], IMPOSTOR_SPRITES.idle[0], IMPOSTOR_SPRITES.walk[1], IMPOSTOR_SPRITES.idle[0]];
        box = cycle[Math.floor(timeMs / 90) % cycle.length];
        targetHeight = box === IMPOSTOR_SPRITES.idle[0] ? 108 : 114;
      } else if (action === 'run_fwd') {
        const idx = Math.floor(timeMs / 60) % IMPOSTOR_SPRITES.walk.length;
        box = IMPOSTOR_SPRITES.walk[idx];
        targetHeight = 114;
        rotate = 0.1;
      } else if (action === 'jump') {
        box = IMPOSTOR_SPRITES.jump[0];
        targetHeight = 116;
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = IMPOSTOR_SPRITES.idle[0];
        targetHeight = 82;
      } else if (action === 'block') {
        box = IMPOSTOR_SPRITES.power_1[0];
        targetHeight = 112;
      } else if (action === 'power_1') {
        const kIdx = Math.min(IMPOSTOR_SPRITES.power_1.length - 1, Math.max(0, Math.floor((frame / 8) * IMPOSTOR_SPRITES.power_1.length)));
        box = IMPOSTOR_SPRITES.power_1[kIdx];
        targetHeight = 114;
        anchorFrac = [0.46, 0.36, 0.36, 0.44][kIdx] ?? 0.38;
      } else if (action === 'power_2') {
        const tIdx = Math.min(IMPOSTOR_SPRITES.power_2.length - 1, Math.max(0, Math.floor((frame / 10) * IMPOSTOR_SPRITES.power_2.length)));
        box = IMPOSTOR_SPRITES.power_2[tIdx];
        targetHeight = 116;
        anchorFrac = [0.46, 0.38, 0.28, 0.42][tIdx] ?? 0.36;
      } else if (action === 'super') {
        if (frame % 2 === 0) {
          const kIdx = Math.floor(frame / 2) % IMPOSTOR_SPRITES.power_1.length;
          box = IMPOSTOR_SPRITES.power_1[kIdx];
          targetHeight = 116;
          anchorFrac = 0.36;
        } else {
          const tIdx = Math.floor(frame / 2) % IMPOSTOR_SPRITES.power_2.length;
          box = IMPOSTOR_SPRITES.power_2[tIdx];
          targetHeight = 118;
          anchorFrac = 0.32;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = IMPOSTOR_SPRITES.hurt[0];
        targetHeight = 114;
        rotate = action === 'heavy_hurt' ? -0.12 : -0.06;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = IMPOSTOR_SPRITES.knockdown[0];
        targetHeight = 82;
        anchorFrac = 0.5;
      } else if (action === 'getup') {
        box = IMPOSTOR_SPRITES.jump[0];
        targetHeight = 96;
      } else if (action === 'victory') {
        box = IMPOSTOR_SPRITES.victory[0];
        targetHeight = 122;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: impostorMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(239, 68, 68, 0.85)',
        defeatStars: action === 'defeat',
      };
    }

    if (f.characterId === 'lion') {
      if (!lionMasterImage || !lionMasterImage.complete || lionMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = LION_SPRITES.power_1[2];
      let targetHeight = 114;
      let anchorFrac = 0.44;
      let flipHoriz = false;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = LION_SPRITES.power_1[2];
        targetHeight = 114 + Math.sin(timeMs / 180) * 1.5;
        anchorFrac = 0.44;
      } else if (action === 'walk_fwd') {
        // Use frames 0 & 1 cleanly so the golden gauntlet stays consistent on every stride
        const idx = Math.floor(timeMs / 115) % 2;
        box = LION_SPRITES.walk_fwd[idx];
        targetHeight = 114;
      } else if (action === 'walk_back') {
        // Use frames 1 & 2 flipped so Lion keeps facing the opponent with golden gauntlet intact
        const idx = 1 + (Math.floor(timeMs / 115) % 2);
        box = LION_SPRITES.walk_back[idx];
        targetHeight = 114;
        flipHoriz = true;
      } else if (action === 'run_fwd') {
        const idx = Math.floor(timeMs / 70) % 2;
        box = LION_SPRITES.walk_fwd[idx];
        targetHeight = 114;
        rotate = 0.09;
      } else if (action === 'jump') {
        if (f.vy < -11) box = LION_SPRITES.jump[0];
        else if (f.vy < -3) box = LION_SPRITES.jump[1];
        else if (f.vy < 4) box = LION_SPRITES.jump[2];
        else if (f.vy < 11) box = LION_SPRITES.jump[3];
        else box = LION_SPRITES.jump[4];
        targetHeight = 114;
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = LION_SPRITES.power_1[0];
        targetHeight = 88;
      } else if (action === 'block') {
        box = LION_SPRITES.power_1[0];
        targetHeight = 114;
      } else if (action === 'power_1') {
        if (!f.isGrounded) {
          box = LION_SPRITES.power_1[1];
          targetHeight = 116;
          anchorFrac = 0.30;
        } else if (frame <= 1) {
          box = LION_SPRITES.power_1[0];
          targetHeight = 114;
          anchorFrac = 0.44;
        } else if (frame <= 5) {
          box = LION_SPRITES.power_1[1];
          targetHeight = 116;
          anchorFrac = 0.30;
        } else {
          box = LION_SPRITES.power_1[2];
          targetHeight = 114;
          anchorFrac = 0.42;
        }
      } else if (action === 'power_2') {
        if (frame <= 2) {
          box = LION_SPRITES.power_1[0];
          targetHeight = 110;
        } else if (frame <= 7) {
          box = LION_SPRITES.power_2[0];
          targetHeight = 120;
          anchorFrac = 0.38;
        } else {
          box = LION_SPRITES.power_1[2];
          targetHeight = 114;
        }
      } else if (action === 'super') {
        if (frame <= 2) {
          box = LION_SPRITES.idle_hero[0];
          targetHeight = 126;
        } else if (frame % 2 === 0) {
          box = LION_SPRITES.power_1[1];
          targetHeight = 118;
          anchorFrac = 0.30;
        } else {
          box = LION_SPRITES.power_2[0];
          targetHeight = 122;
          anchorFrac = 0.38;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = LION_SPRITES.jump[1];
        rotate = -0.18;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = LION_SPRITES.jump[4];
        rotate = -Math.PI / 2.1;
        tx = 22;
        ty = -14;
      } else if (action === 'getup') {
        box = LION_SPRITES.jump[4];
        targetHeight = 96;
      } else if (action === 'victory') {
        box = LION_SPRITES.idle_hero[0];
        targetHeight = 124;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: lionMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight,
        flipHoriz,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(234, 179, 8, 0.85)',
      };
    }

    if (f.characterId === 'ninja') {
      if (!ninjaMasterImage || !ninjaMasterImage.complete || ninjaMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = NINJA_SPRITES.idle[0];
      let targetHeight = 114;
      let anchorFrac = 0.46;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        const idx = Math.floor(timeMs / 280) % NINJA_SPRITES.idle.length;
        box = NINJA_SPRITES.idle[idx];
      } else if (action === 'walk_fwd') {
        const idx = Math.floor(timeMs / 75) % NINJA_SPRITES.walk.length;
        box = NINJA_SPRITES.walk[idx];
      } else if (action === 'walk_back') {
        const idx = (NINJA_SPRITES.walk.length - 1) - (Math.floor(timeMs / 80) % NINJA_SPRITES.walk.length);
        box = NINJA_SPRITES.walk[idx];
      } else if (action === 'run_fwd') {
        const idx = Math.floor(timeMs / 48) % NINJA_SPRITES.walk.length;
        box = NINJA_SPRITES.walk[idx];
        rotate = 0.11;
      } else if (action === 'jump') {
        if (f.vy < -11) box = NINJA_SPRITES.jump[0];
        else if (f.vy < -4) box = NINJA_SPRITES.jump[1];
        else if (f.vy < 5) box = NINJA_SPRITES.jump[2];
        else box = NINJA_SPRITES.jump[3];
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = NINJA_SPRITES.jump[0];
        targetHeight = 86;
      } else if (action === 'block') {
        box = NINJA_SPRITES.power_2[0];
      } else if (action === 'power_1') {
        const swordSeq = [0, 1, 2, 3];
        const pIdx = swordSeq[Math.min(swordSeq.length - 1, Math.max(0, Math.floor((frame / 8) * swordSeq.length)))];
        box = NINJA_SPRITES.power_1[pIdx];
        targetHeight = 122;
        anchorFrac = [0.44, 0.38, 0.36, 0.40, 0.40][pIdx] ?? 0.38;
      } else if (action === 'power_2') {
        if (frame <= 2) box = NINJA_SPRITES.power_2[0];
        else if (frame <= 4) box = NINJA_SPRITES.power_2[1];
        else if (frame <= 6) {
          box = NINJA_SPRITES.power_2[2];
          anchorFrac = 0.38;
        } else {
          box = NINJA_SPRITES.power_2[3];
          targetHeight = 116;
          anchorFrac = 0.28;
        }
      } else if (action === 'super') {
        if (frame % 2 === 0) {
          const pIdx = (Math.floor(frame / 2) % 4) + 1;
          box = NINJA_SPRITES.power_1[pIdx];
          targetHeight = 124;
          anchorFrac = 0.38;
        } else {
          box = NINJA_SPRITES.power_2[3];
          targetHeight = 118;
          anchorFrac = 0.28;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = NINJA_SPRITES.jump[1];
        rotate = -0.18;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = NINJA_SPRITES.jump[3];
        rotate = -Math.PI / 2.1;
        tx = 22;
        ty = -14;
      } else if (action === 'getup') {
        box = NINJA_SPRITES.jump[4];
        targetHeight = 96;
      } else if (action === 'victory') {
        box = Math.floor(timeMs / 250) % 2 === 0 ? NINJA_SPRITES.power_1[0] : NINJA_SPRITES.idle[1];
        targetHeight = 118;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: ninjaMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(225, 29, 72, 0.85)',
      };
    }

    if (f.characterId === 'mario') {
      if (!marioMasterImage || !marioMasterImage.complete || marioMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = MARIO_SPRITES.idle[0];
      let targetHeight = 114;
      let anchorFrac = 0.46;
      let offsetY = 0;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = MARIO_SPRITES.idle[0];
        targetHeight = 114 + Math.sin(timeMs / 160) * 1.5;
      } else if (action === 'walk_fwd' || action === 'walk_back') {
        const cycle = [MARIO_SPRITES.walk[0], MARIO_SPRITES.idle[0], MARIO_SPRITES.walk[1], MARIO_SPRITES.idle[0]];
        box = cycle[Math.floor(timeMs / 95) % cycle.length];
      } else if (action === 'run_fwd') {
        const idx = Math.floor(timeMs / 65) % MARIO_SPRITES.walk.length;
        box = MARIO_SPRITES.walk[idx];
        rotate = 0.08;
        offsetY = Math.abs(Math.sin(timeMs / 55)) * -4;
      } else if (action === 'jump') {
        box = MARIO_SPRITES.jump[0];
        targetHeight = 108;
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = MARIO_SPRITES.jump[0];
        targetHeight = 84;
      } else if (action === 'block') {
        box = MARIO_SPRITES.power_1[0];
      } else if (action === 'power_1') {
        const pIdx = Math.min(MARIO_SPRITES.power_1.length - 1, Math.max(0, Math.floor((frame / 8) * MARIO_SPRITES.power_1.length)));
        box = MARIO_SPRITES.power_1[pIdx];
        targetHeight = 114;
        anchorFrac = [0.46, 0.36, 0.32, 0.42][pIdx] ?? 0.38;
      } else if (action === 'power_2') {
        const dIdx = Math.min(MARIO_SPRITES.power_2.length - 1, Math.max(0, Math.floor((frame / 10) * MARIO_SPRITES.power_2.length)));
        box = MARIO_SPRITES.power_2[dIdx];
        targetHeight = dIdx === 0 ? 116 : dIdx === 3 ? 110 : 104;
        anchorFrac = [0.46, 0.36, 0.36, 0.42][dIdx] ?? 0.40;
      } else if (action === 'super') {
        if (frame % 2 === 0) {
          const pIdx = Math.floor(frame / 2) % MARIO_SPRITES.power_1.length;
          box = MARIO_SPRITES.power_1[pIdx];
          targetHeight = 116;
          anchorFrac = 0.34;
        } else {
          const dIdx = Math.floor(frame / 2) % MARIO_SPRITES.power_2.length;
          box = MARIO_SPRITES.power_2[dIdx];
          targetHeight = 112;
          anchorFrac = 0.36;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = MARIO_SPRITES.hurt[0];
        targetHeight = 110;
        rotate = action === 'heavy_hurt' ? -0.1 : -0.05;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = MARIO_SPRITES.knockdown[0];
        targetHeight = 84;
        anchorFrac = 0.5;
      } else if (action === 'getup') {
        box = MARIO_SPRITES.jump[0];
        targetHeight = 96;
      } else if (action === 'victory') {
        box = MARIO_SPRITES.victory[Math.floor(timeMs / 300) % MARIO_SPRITES.victory.length];
        targetHeight = 122;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: marioMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight + offsetY,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(239, 68, 68, 0.85)',
        defeatStars: action === 'defeat',
      };
    }

    if (f.characterId === 'sonic') {
      if (!sonicMasterImage || !sonicMasterImage.complete || sonicMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = SONIC_SPRITES.idle[0];
      let targetHeight = 114;
      let anchorFrac = 0.46;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = SONIC_SPRITES.idle[0];
        targetHeight = 114 + Math.sin(timeMs / 150) * 1.5;
      } else if (action === 'walk_fwd' || action === 'walk_back') {
        const cycle = [SONIC_SPRITES.walk[0], SONIC_SPRITES.idle[0], SONIC_SPRITES.walk[1], SONIC_SPRITES.idle[0]];
        box = cycle[Math.floor(timeMs / 80) % cycle.length];
        targetHeight = box === SONIC_SPRITES.idle[0] ? 114 : 108;
      } else if (action === 'run_fwd') {
        const idx = Math.floor(timeMs / 50) % SONIC_SPRITES.walk.length;
        box = SONIC_SPRITES.walk[idx];
        targetHeight = 108;
        rotate = 0.08;
      } else if (action === 'jump') {
        box = SONIC_SPRITES.jump[0];
        targetHeight = 112;
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = SONIC_SPRITES.jump[0];
        targetHeight = 86;
      } else if (action === 'block') {
        box = SONIC_SPRITES.power_1[0];
        targetHeight = 112;
      } else if (action === 'power_1') {
        const pIdx = Math.min(SONIC_SPRITES.power_1.length - 1, Math.max(0, Math.floor((frame / 8) * SONIC_SPRITES.power_1.length)));
        box = SONIC_SPRITES.power_1[pIdx];
        targetHeight = 112;
        anchorFrac = [0.44, 0.36, 0.34, 0.42][pIdx] ?? 0.38;
      } else if (action === 'power_2') {
        const kIdx = Math.min(SONIC_SPRITES.power_2.length - 1, Math.max(0, Math.floor((frame / 10) * SONIC_SPRITES.power_2.length)));
        box = SONIC_SPRITES.power_2[kIdx];
        targetHeight = 116;
        anchorFrac = [0.46, 0.36, 0.34, 0.42][kIdx] ?? 0.38;
      } else if (action === 'super') {
        if (frame % 2 === 0) {
          const pIdx = Math.floor(frame / 2) % SONIC_SPRITES.power_1.length;
          box = SONIC_SPRITES.power_1[pIdx];
          targetHeight = 114;
          anchorFrac = 0.36;
        } else {
          const kIdx = Math.floor(frame / 2) % SONIC_SPRITES.power_2.length;
          box = SONIC_SPRITES.power_2[kIdx];
          targetHeight = 118;
          anchorFrac = 0.34;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = SONIC_SPRITES.hurt[0];
        targetHeight = 112;
        rotate = action === 'heavy_hurt' ? -0.12 : -0.06;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = SONIC_SPRITES.knockdown[0];
        targetHeight = 84;
        anchorFrac = 0.5;
      } else if (action === 'getup') {
        box = SONIC_SPRITES.jump[0];
        targetHeight = 96;
      } else if (action === 'victory') {
        box = SONIC_SPRITES.victory[0];
        targetHeight = 122;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: sonicMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(59, 130, 246, 0.85)',
        defeatStars: action === 'defeat',
      };
    }

    if (f.characterId === 'hero_a') {
      if (!heroAMasterImage || !heroAMasterImage.complete || heroAMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = HERO_A_SPRITES.idle[0];
      let targetHeight = 116;
      let anchorFrac = 0.46;
      let offsetY = 0;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = HERO_A_SPRITES.idle[0];
        targetHeight = 116 + Math.sin(timeMs / 150) * 1.5;
      } else if (action === 'walk_fwd' || action === 'walk_back') {
        const cycle = [HERO_A_SPRITES.walk[0], HERO_A_SPRITES.idle[0], HERO_A_SPRITES.walk[1], HERO_A_SPRITES.idle[0]];
        box = cycle[Math.floor(timeMs / 90) % cycle.length];
      } else if (action === 'run_fwd') {
        const idx = Math.floor(timeMs / 60) % HERO_A_SPRITES.walk.length;
        box = HERO_A_SPRITES.walk[idx];
        rotate = 0.09;
        offsetY = Math.abs(Math.sin(timeMs / 48)) * -4;
      } else if (action === 'jump') {
        box = HERO_A_SPRITES.jump[0];
        targetHeight = 118;
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = HERO_A_SPRITES.jump[0];
        targetHeight = 88;
      } else if (action === 'block') {
        box = HERO_A_SPRITES.power_1[0];
        targetHeight = 112;
      } else if (action === 'power_1') {
        const pIdx = Math.min(HERO_A_SPRITES.power_1.length - 1, Math.max(0, Math.floor((frame / 8) * HERO_A_SPRITES.power_1.length)));
        box = HERO_A_SPRITES.power_1[pIdx];
        targetHeight = 112;
        anchorFrac = [0.46, 0.34, 0.32, 0.42][pIdx] ?? 0.38;
      } else if (action === 'power_2') {
        const kIdx = Math.min(HERO_A_SPRITES.power_2.length - 1, Math.max(0, Math.floor((frame / 10) * HERO_A_SPRITES.power_2.length)));
        box = HERO_A_SPRITES.power_2[kIdx];
        targetHeight = kIdx === 0 ? 120 : 108;
        anchorFrac = [0.46, 0.36, 0.36, 0.44][kIdx] ?? 0.40;
      } else if (action === 'super') {
        if (frame % 2 === 0) {
          const pIdx = Math.floor(frame / 2) % HERO_A_SPRITES.power_1.length;
          box = HERO_A_SPRITES.power_1[pIdx];
          targetHeight = 114;
          anchorFrac = 0.34;
        } else {
          const kIdx = Math.floor(frame / 2) % HERO_A_SPRITES.power_2.length;
          box = HERO_A_SPRITES.power_2[kIdx];
          targetHeight = 114;
          anchorFrac = 0.36;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = HERO_A_SPRITES.hurt[0];
        targetHeight = 112;
        rotate = action === 'heavy_hurt' ? -0.12 : -0.06;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = HERO_A_SPRITES.knockdown[0];
        targetHeight = 88;
        anchorFrac = 0.5;
      } else if (action === 'getup') {
        box = HERO_A_SPRITES.jump[0];
        targetHeight = 98;
      } else if (action === 'victory') {
        box = HERO_A_SPRITES.victory[0];
        targetHeight = 122;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: heroAMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight + offsetY,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(6, 182, 212, 0.9)',
        defeatStars: action === 'defeat',
      };
    }

    if (f.characterId === 'death_wolf') {
      if (!deathWolfMasterImage || !deathWolfMasterImage.complete || deathWolfMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = DEATH_WOLF_SPRITES.idle_walk[0];
      let targetHeight = 116;
      let anchorFrac = 0.44;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = DEATH_WOLF_SPRITES.idle_walk[0];
        targetHeight = 116 + Math.sin(timeMs / 170) * 1.5;
      } else if (action === 'walk_fwd') {
        const idx = 1 + (Math.floor(timeMs / 95) % 2);
        box = DEATH_WOLF_SPRITES.idle_walk[idx] || DEATH_WOLF_SPRITES.idle_walk[1];
        targetHeight = 113;
      } else if (action === 'walk_back') {
        const idx = 2 - (Math.floor(timeMs / 95) % 2);
        box = DEATH_WOLF_SPRITES.idle_walk[idx] || DEATH_WOLF_SPRITES.idle_walk[1];
        targetHeight = 113;
      } else if (action === 'run_fwd') {
        box = DEATH_WOLF_SPRITES.idle_walk[3];
        targetHeight = 102;
        anchorFrac = 0.44;
      } else if (action === 'jump') {
        if (f.vy < -8) {
          box = DEATH_WOLF_SPRITES.jump[0];
          targetHeight = 110;
        } else if (f.vy < 4) {
          box = DEATH_WOLF_SPRITES.jump[1];
          targetHeight = 158;
          anchorFrac = 0.46;
        } else {
          box = DEATH_WOLF_SPRITES.jump[2];
          targetHeight = 106;
        }
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = DEATH_WOLF_SPRITES.jump[0];
        targetHeight = 86;
      } else if (action === 'block') {
        box = DEATH_WOLF_SPRITES.power_1[0];
        targetHeight = 136;
      } else if (action === 'power_1') {
        const pIdx = Math.min(DEATH_WOLF_SPRITES.power_1.length - 1, Math.max(0, Math.floor((frame / 8) * DEATH_WOLF_SPRITES.power_1.length)));
        box = DEATH_WOLF_SPRITES.power_1[pIdx];
        targetHeight = [146, 136, 128, 110][pIdx] ?? 130;
        anchorFrac = [0.46, 0.36, 0.44, 0.40][pIdx] ?? 0.42;
      } else if (action === 'power_2') {
        const dIdx = frame <= 3 ? 0 : 1;
        box = DEATH_WOLF_SPRITES.power_2_hurt[dIdx];
        targetHeight = dIdx === 0 ? 102 : 100;
        anchorFrac = dIdx === 0 ? 0.44 : 0.36;
      } else if (action === 'super') {
        if (frame % 2 === 0) {
          const pIdx = Math.floor(frame / 2) % DEATH_WOLF_SPRITES.power_1.length;
          box = DEATH_WOLF_SPRITES.power_1[pIdx];
          targetHeight = [146, 136, 128, 110][pIdx] ?? 130;
          anchorFrac = 0.40;
        } else {
          box = DEATH_WOLF_SPRITES.power_2_hurt[1];
          targetHeight = 102;
          anchorFrac = 0.36;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = DEATH_WOLF_SPRITES.power_2_hurt[2];
        targetHeight = 112;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = DEATH_WOLF_SPRITES.power_2_hurt[2];
        targetHeight = 108;
        rotate = -Math.PI / 2.1;
        tx = 22;
        ty = -14;
      } else if (action === 'getup') {
        box = DEATH_WOLF_SPRITES.jump[2];
        targetHeight = 96;
      } else if (action === 'victory') {
        box = Math.floor(timeMs / 250) % 2 === 0 ? DEATH_WOLF_SPRITES.power_1[0] : DEATH_WOLF_SPRITES.idle_walk[0];
        targetHeight = box === DEATH_WOLF_SPRITES.power_1[0] ? 140 : 118;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: deathWolfMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(220, 38, 38, 0.85)',
        defeatStars: action === 'defeat',
      };
    }

    if (f.characterId === 'hellfire') {
      if (!hellfireMasterImage || !hellfireMasterImage.complete || hellfireMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = HELLFIRE_SPRITES.idle[0];
      let targetHeight = 118;
      let anchorFrac = 0.46;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = HELLFIRE_SPRITES.idle[0];
        targetHeight = 118 + Math.sin(timeMs / 170) * 1.5;
      } else if (action === 'walk_fwd' || action === 'walk_back') {
        const cycle = [HELLFIRE_SPRITES.walk[0], HELLFIRE_SPRITES.idle[0], HELLFIRE_SPRITES.walk[1], HELLFIRE_SPRITES.idle[0]];
        box = cycle[Math.floor(timeMs / 95) % cycle.length];
      } else if (action === 'run_fwd') {
        const idx = Math.floor(timeMs / 65) % HELLFIRE_SPRITES.walk.length;
        box = HELLFIRE_SPRITES.walk[idx];
        rotate = 0.08;
      } else if (action === 'jump') {
        box = HELLFIRE_SPRITES.jump[0];
        targetHeight = 118;
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = HELLFIRE_SPRITES.knockdown[0];
        targetHeight = 90;
      } else if (action === 'block') {
        box = HELLFIRE_SPRITES.guard[0];
        targetHeight = 120;
      } else if (action === 'power_1') {
        const pIdx = Math.min(HELLFIRE_SPRITES.power_1.length - 1, Math.max(0, Math.floor((frame / 8) * HELLFIRE_SPRITES.power_1.length)));
        box = HELLFIRE_SPRITES.power_1[pIdx];
        targetHeight = 118;
        anchorFrac = [0.44, 0.38, 0.36, 0.42][pIdx] ?? 0.40;
      } else if (action === 'power_2') {
        const cIdx = Math.min(HELLFIRE_SPRITES.power_2.length - 1, Math.max(0, Math.floor((frame / 10) * HELLFIRE_SPRITES.power_2.length)));
        box = HELLFIRE_SPRITES.power_2[cIdx];
        targetHeight = 120;
        anchorFrac = [0.46, 0.38, 0.24][cIdx] ?? 0.36;
      } else if (action === 'super') {
        if (frame % 2 === 0) {
          const pIdx = Math.floor(frame / 2) % HELLFIRE_SPRITES.power_1.length;
          box = HELLFIRE_SPRITES.power_1[pIdx];
          targetHeight = 120;
          anchorFrac = 0.38;
        } else {
          box = HELLFIRE_SPRITES.power_2[2];
          targetHeight = 122;
          anchorFrac = 0.24;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = HELLFIRE_SPRITES.hurt[0];
        targetHeight = 118;
        rotate = action === 'heavy_hurt' ? -0.12 : -0.06;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = HELLFIRE_SPRITES.knockdown[0];
        targetHeight = 104;
        rotate = -Math.PI / 2.2;
        tx = 20;
        ty = -14;
      } else if (action === 'getup') {
        box = HELLFIRE_SPRITES.knockdown[0];
        targetHeight = 102;
      } else if (action === 'victory') {
        box = HELLFIRE_SPRITES.victory[0];
        targetHeight = 124;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: hellfireMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(249, 115, 22, 0.85)',
        defeatStars: action === 'defeat',
      };
    }

    if (f.characterId === 'akita') {
      if (!akitaMasterImage || !akitaMasterImage.complete || akitaMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = AKITA_SPRITES.idle_walk[0];
      let targetHeight = 112;
      let anchorFrac = 0.46;
      let rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = AKITA_SPRITES.idle_walk[0];
        targetHeight = 112 + Math.sin(timeMs / 160) * 1.5;
      } else if (action === 'walk_fwd') {
        const idx = 1 + (Math.floor(timeMs / 85) % 2);
        box = AKITA_SPRITES.idle_walk[idx] || AKITA_SPRITES.idle_walk[1];
        targetHeight = 107;
      } else if (action === 'walk_back') {
        const idx = 2 - (Math.floor(timeMs / 85) % 2);
        box = AKITA_SPRITES.idle_walk[idx] || AKITA_SPRITES.idle_walk[1];
        targetHeight = 107;
      } else if (action === 'run_fwd') {
        box = AKITA_SPRITES.idle_walk[3];
        targetHeight = 98;
      } else if (action === 'jump') {
        if (f.vy < -8) {
          box = AKITA_SPRITES.jump[0];
          targetHeight = 112;
        } else if (f.vy < 4) {
          box = AKITA_SPRITES.jump[1];
          targetHeight = 90;
        } else {
          box = AKITA_SPRITES.jump[2];
          targetHeight = 90;
        }
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = AKITA_SPRITES.jump[1];
        targetHeight = 82;
      } else if (action === 'block') {
        box = AKITA_SPRITES.power_2_hurt[0];
        targetHeight = 110;
      } else if (action === 'power_1') {
        const pBoxes = [AKITA_SPRITES.power_1[0], AKITA_SPRITES.power_1[1], AKITA_SPRITES.power_2_hurt[0]];
        const pIdx = Math.min(pBoxes.length - 1, Math.max(0, Math.floor((frame / 8) * pBoxes.length)));
        box = pBoxes[pIdx];
        targetHeight = [110, 144, 110][pIdx] ?? 110;
        anchorFrac = [0.42, 0.42, 0.44][pIdx] ?? 0.42;
      } else if (action === 'power_2') {
        const sIdx = frame <= 2 ? 0 : frame % 2 === 1 ? 1 : 2;
        box = AKITA_SPRITES.power_2_hurt[sIdx];
        targetHeight = sIdx === 0 ? 110 : 126;
        anchorFrac = sIdx === 0 ? 0.40 : 0.48;
      } else if (action === 'super') {
        if (frame % 2 === 0) {
          box = AKITA_SPRITES.power_1[1];
          targetHeight = 144;
          anchorFrac = 0.42;
        } else {
          const sIdx = frame % 3 === 1 ? 1 : 2;
          box = AKITA_SPRITES.power_2_hurt[sIdx];
          targetHeight = 128;
          anchorFrac = 0.48;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = AKITA_SPRITES.power_2_hurt[3];
        targetHeight = 108;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = AKITA_SPRITES.power_2_hurt[3];
        targetHeight = 104;
        rotate = -Math.PI / 2.1;
        tx = 20;
        ty = -14;
      } else if (action === 'getup') {
        box = AKITA_SPRITES.jump[2];
        targetHeight = 90;
      } else if (action === 'victory') {
        box = AKITA_SPRITES.power_1[3];
        targetHeight = 114;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: akitaMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(245, 158, 11, 0.85)',
        defeatStars: action === 'defeat',
      };
    }

    if (f.characterId === 'neon_void') {
      if (!neonVoidMasterImage || !neonVoidMasterImage.complete || neonVoidMasterImage.naturalWidth <= 0) return null;
      let box: SpriteBox = NEON_VOID_SPRITES.idle[0];
      let targetHeight = 148;
      let anchorFrac = 0.5;
      const rotate = 0;
      let tx = 0;
      let ty = 0;

      if (action === 'idle') {
        box = NEON_VOID_SPRITES.idle[0];
        targetHeight = 152 + Math.sin(timeMs / 170) * 2.5;
        anchorFrac = 0.5;
        ty = 6;
      } else if (action === 'walk_fwd') {
        const idx = Math.floor(timeMs / 85) % NEON_VOID_SPRITES.walk.length;
        box = NEON_VOID_SPRITES.walk[idx];
        targetHeight = 112;
        anchorFrac = 0.48;
      } else if (action === 'walk_back') {
        const idx = (NEON_VOID_SPRITES.walk.length - 1) - (Math.floor(timeMs / 90) % NEON_VOID_SPRITES.walk.length);
        box = NEON_VOID_SPRITES.walk[idx];
        targetHeight = 112;
        anchorFrac = 0.48;
      } else if (action === 'run_fwd') {
        const idx = Math.floor(timeMs / 65) % NEON_VOID_SPRITES.run.length;
        box = NEON_VOID_SPRITES.run[idx];
        targetHeight = 110;
        anchorFrac = 0.52;
      } else if (action === 'jump') {
        if (f.vy < -10) {
          box = NEON_VOID_SPRITES.jump[1];
          targetHeight = 116;
        } else if (f.vy < -2) {
          box = NEON_VOID_SPRITES.jump[2];
          targetHeight = 118;
        } else if (f.vy < 4) {
          box = NEON_VOID_SPRITES.fall[0];
          targetHeight = 114;
        } else {
          box = NEON_VOID_SPRITES.fall[1];
          targetHeight = 108;
        }
        anchorFrac = 0.5;
      } else if (action === 'crouch' || action === 'crouch_block') {
        box = NEON_VOID_SPRITES.fall[2];
        targetHeight = 82;
        anchorFrac = 0.5;
      } else if (action === 'block') {
        box = NEON_VOID_SPRITES.attack1[0];
        targetHeight = 114;
        anchorFrac = 0.48;
      } else if (action === 'power_1') {
        const idx = Math.min(NEON_VOID_SPRITES.attack1.length - 1, Math.max(0, Math.floor((frame / 8) * NEON_VOID_SPRITES.attack1.length)));
        box = NEON_VOID_SPRITES.attack1[idx] || NEON_VOID_SPRITES.attack1[2];
        targetHeight = idx === 2 ? 136 : idx === 1 ? 124 : 114;
        anchorFrac = idx === 1 || idx === 2 ? 0.34 : 0.46;
      } else if (action === 'power_2') {
        const idx = Math.min(NEON_VOID_SPRITES.attack2.length - 1, Math.max(0, Math.floor((frame / 10) * NEON_VOID_SPRITES.attack2.length)));
        box = NEON_VOID_SPRITES.attack2[idx] || NEON_VOID_SPRITES.attack2[2];
        targetHeight = idx === 2 ? 132 : 118;
        anchorFrac = idx === 2 ? 0.24 : 0.46;
      } else if (action === 'super') {
        const mod = frame % 4;
        if (mod === 0) {
          box = NEON_VOID_SPRITES.idle[0];
          targetHeight = 156;
          anchorFrac = 0.5;
          ty = 6;
        } else if (mod === 1) {
          box = NEON_VOID_SPRITES.attack1[2];
          targetHeight = 138;
          anchorFrac = 0.34;
        } else if (mod === 2) {
          box = NEON_VOID_SPRITES.attack2[1];
          targetHeight = 122;
          anchorFrac = 0.46;
        } else {
          box = NEON_VOID_SPRITES.attack2[2];
          targetHeight = 136;
          anchorFrac = 0.24;
        }
      } else if (action === 'hurt' || action === 'heavy_hurt') {
        box = NEON_VOID_SPRITES.hurt[0];
        targetHeight = 114;
        anchorFrac = 0.5;
        tx = -4;
      } else if (action === 'knockdown' || action === 'defeat') {
        box = NEON_VOID_SPRITES.death[0];
        targetHeight = 96;
        anchorFrac = 0.5;
        ty = 4;
      } else if (action === 'getup') {
        box = NEON_VOID_SPRITES.fall[2];
        targetHeight = 86;
        anchorFrac = 0.5;
      } else if (action === 'victory') {
        box = NEON_VOID_SPRITES.idle[0];
        targetHeight = 156;
        anchorFrac = 0.5;
        ty = 6;
      }

      const scale = targetHeight / Math.max(box.h, 1);
      const targetWidth = box.w * scale;
      return {
        image: neonVoidMasterImage,
        box,
        targetWidth,
        targetHeight,
        destX: -targetWidth * anchorFrac,
        destY: -targetHeight,
        flipHoriz: false,
        rotate,
        tx,
        ty,
        blockColor: 'rgba(168, 85, 247, 0.9)',
        defeatStars: action === 'defeat',
      };
    }

    // Brawler (Kenji)
    if (!brawlerMasterImage || !brawlerMasterImage.complete || brawlerMasterImage.naturalWidth <= 0) return null;
    let box: SpriteBox = BRAWLER_SPRITES.idle[0];
    let targetHeight = 116;
    let anchorFrac = 0.46;
    let rotate = 0;
    let tx = 0;
    let ty = 0;

    if (action === 'idle') {
      box = BRAWLER_SPRITES.idle[0];
      targetHeight = 116 + Math.sin(timeMs / 170) * 1.5;
    } else if (action === 'walk_fwd') {
      const idx = Math.floor(timeMs / 85) % BRAWLER_SPRITES.walk.length;
      box = BRAWLER_SPRITES.walk[idx];
    } else if (action === 'walk_back') {
      const idx = (BRAWLER_SPRITES.walk.length - 1) - (Math.floor(timeMs / 90) % BRAWLER_SPRITES.walk.length);
      box = BRAWLER_SPRITES.walk[idx];
    } else if (action === 'run_fwd') {
      const idx = Math.floor(timeMs / 65) % BRAWLER_SPRITES.run.length;
      box = BRAWLER_SPRITES.run[idx];
      targetHeight = 112;
      anchorFrac = 0.42;
    } else if (action === 'jump') {
      box = BRAWLER_SPRITES.jump[0];
      targetHeight = 122;
    } else if (action === 'crouch' || action === 'crouch_block') {
      box = BRAWLER_SPRITES.crouch[0];
      targetHeight = 90;
    } else if (action === 'block') {
      box = BRAWLER_SPRITES.guard[0];
    } else if (action === 'power_1') {
      if (!f.isGrounded) {
        box = BRAWLER_SPRITES.air_kick[0];
        targetHeight = 96;
        anchorFrac = 0.34;
      } else if (frame <= 1) {
        box = BRAWLER_SPRITES.guard[0];
      } else if (frame <= 5) {
        box = BRAWLER_SPRITES.punch[0];
        anchorFrac = 0.32;
      } else {
        box = BRAWLER_SPRITES.guard[0];
      }
    } else if (action === 'power_2') {
      if (frame <= 2) {
        box = BRAWLER_SPRITES.log_smash[0];
        targetHeight = 116;
        anchorFrac = 0.38;
      } else if (frame <= 5) {
        box = BRAWLER_SPRITES.log_smash[1];
        targetHeight = 134;
        anchorFrac = 0.46;
      } else if (frame <= 8) {
        box = BRAWLER_SPRITES.log_smash[2];
        targetHeight = 116;
        anchorFrac = 0.34;
      } else {
        box = BRAWLER_SPRITES.guard[0];
        targetHeight = 112;
      }
    } else if (action === 'super') {
      const mod = frame % 4;
      if (mod === 0) {
        box = BRAWLER_SPRITES.punch[0];
        anchorFrac = 0.32;
      } else if (mod === 1) {
        box = BRAWLER_SPRITES.uppercut[0];
        targetHeight = 130;
      } else if (mod === 2) {
        box = BRAWLER_SPRITES.log_smash[1];
        targetHeight = 134;
        anchorFrac = 0.46;
      } else {
        box = BRAWLER_SPRITES.log_smash[2];
        anchorFrac = 0.34;
      }
    } else if (action === 'hurt' || action === 'heavy_hurt') {
      box = BRAWLER_SPRITES.crouch[0];
      targetHeight = 94;
      rotate = -0.18;
    } else if (action === 'knockdown' || action === 'defeat') {
      box = BRAWLER_SPRITES.land[0];
      targetHeight = 96;
      rotate = -Math.PI / 2.1;
      tx = 22;
      ty = -14;
    } else if (action === 'getup') {
      box = BRAWLER_SPRITES.crouch[0];
      targetHeight = 92;
    } else if (action === 'victory') {
      box = BRAWLER_SPRITES.uppercut[0];
      targetHeight = 130;
    }

    const scale = targetHeight / Math.max(box.h, 1);
    const targetWidth = box.w * scale;
    return {
      image: brawlerMasterImage,
      box,
      targetWidth,
      targetHeight,
      destX: -targetWidth * anchorFrac,
      destY: -targetHeight,
      flipHoriz: false,
      rotate,
      tx,
      ty,
      blockColor: 'rgba(239, 68, 68, 0.85)',
    };
  }

  /**
   * Compute world-space AABB for a resolved fighter pose
   */
  private getWorldBounds(f: FighterState, p: ResolvedPose): { left: number; right: number; top: number; bottom: number } {
    const x0 = p.destX;
    const x1 = p.destX + p.targetWidth;
    const y0 = p.destY;
    const y1 = p.destY + p.targetHeight;

    const corners: [number, number][] = [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ];

    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    const cos = p.rotate ? Math.cos(p.rotate) : 1;
    const sin = p.rotate ? Math.sin(p.rotate) : 0;

    for (let i = 0; i < 4; i++) {
      let lx = p.flipHoriz ? -corners[i][0] : corners[i][0];
      let ly = corners[i][1];
      if (p.rotate !== 0) {
        const rx = lx * cos - ly * sin;
        const ry = lx * sin + ly * cos;
        lx = rx;
        ly = ry;
      }
      lx += p.tx;
      ly += p.ty;
      const wx = f.x + lx * f.facing;
      const wy = f.y + ly;
      if (wx < left) left = wx;
      if (wx > right) right = wx;
      if (wy < top) top = wy;
      if (wy > bottom) bottom = wy;
    }

    return { left, right, top, bottom };
  }

  private isWorldPixelOpaque(
    f: FighterState,
    p: ResolvedPose,
    mask: AlphaMaskCache,
    wx: number,
    wy: number
  ): boolean {
    let lx = (wx - f.x) * f.facing - p.tx;
    let ly = wy - f.y - p.ty;

    if (p.rotate !== 0) {
      const cos = Math.cos(-p.rotate);
      const sin = Math.sin(-p.rotate);
      const rx = lx * cos - ly * sin;
      const ry = lx * sin + ly * cos;
      lx = rx;
      ly = ry;
    }

    if (p.flipHoriz) lx = -lx;

    if (lx < p.destX || lx >= p.destX + p.targetWidth || ly < p.destY || ly >= p.destY + p.targetHeight) {
      return false;
    }

    const sx = Math.floor(p.box.x + ((lx - p.destX) / p.targetWidth) * p.box.w);
    const sy = Math.floor(p.box.y + ((ly - p.destY) / p.targetHeight) * p.box.h);
    if (sx < 0 || sx >= mask.w || sy < 0 || sy >= mask.h) return false;

    return mask.alpha[sy * mask.w + sx] > 30;
  }

  /**
   * Pixel-exact collision test between two fighters' currently rendered sprites.
   * Returns null if image alpha masks are not ready yet (so caller can use fallback).
   * Returns { hit: true, impactX, impactY } if ANY opaque pixel of attacker touches ANY opaque pixel of defender.
   */
  public checkPixelCollision(
    attacker: FighterState,
    defender: FighterState,
    timeMs: number
  ): { hit: boolean; impactX: number; impactY: number } | null {
    const atkPose = this.resolveFighterPose(attacker, timeMs);
    const defPose = this.resolveFighterPose(defender, timeMs);
    if (!atkPose || !defPose) return null;

    const atkMask = this.getAlphaMask(atkPose.image);
    const defMask = this.getAlphaMask(defPose.image);
    if (!atkMask || !defMask) return null;

    const aB = this.getWorldBounds(attacker, atkPose);
    const dB = this.getWorldBounds(defender, defPose);

    const iLeft = Math.floor(Math.max(aB.left, dB.left));
    const iRight = Math.ceil(Math.min(aB.right, dB.right));
    const iTop = Math.floor(Math.max(aB.top, dB.top));
    const iBottom = Math.ceil(Math.min(aB.bottom, dB.bottom));

    if (iLeft >= iRight || iTop >= iBottom) {
      return { hit: false, impactX: 0, impactY: 0 };
    }

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let wy = iTop; wy < iBottom; wy++) {
      for (let wx = iLeft; wx < iRight; wx++) {
        if (
          this.isWorldPixelOpaque(attacker, atkPose, atkMask, wx, wy) &&
          this.isWorldPixelOpaque(defender, defPose, defMask, wx, wy)
        ) {
          sumX += wx;
          sumY += wy;
          count++;
        }
      }
    }

    if (count > 0) {
      return {
        hit: true,
        impactX: sumX / count,
        impactY: sumY / count,
      };
    }

    return { hit: false, impactX: 0, impactY: 0 };
  }

  /**
   * Draw ground drop shadow anchored to arena floor (called in shadow pass before fighters)
   */
  public drawFighterShadow(
    ctx: CanvasRenderingContext2D,
    fighter: FighterState,
    groundY: number,
    scaleMultiplier: number = WORLD_FIGHTER_SCALE
  ) {
    ctx.save();
    ctx.translate(fighter.x, fighter.y);
    this.drawShadow(ctx, fighter, groundY, scaleMultiplier);
    ctx.restore();
  }

  /**
   * Main render method for a fighter
   */
  public drawFighter(
    ctx: CanvasRenderingContext2D,
    fighter: FighterState,
    groundY: number,
    timeMs: number,
    skipShadow: boolean = false,
    scaleMultiplier: number = WORLD_FIGHTER_SCALE
  ) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    ctx.translate(fighter.x, fighter.y);
    ctx.scale(fighter.facing, 1);

    const action = fighter.action;

    // Ground Drop-Shadow anchored to arena floor (skipped when rendered in dedicated shadow pass)
    if (!skipShadow) {
      this.drawShadow(ctx, fighter, groundY, scaleMultiplier);
    }

    // Gentle getup invincibility blink (keeps character clearly visible at all times)
    if (fighter.isInvincible && Math.floor(timeMs / 65) % 2 === 0) {
      ctx.globalAlpha = 0.72;
    }

    // Super / Overdrive 70-DMG Mode Aura
    if (fighter.overdriveArmed || fighter.superMeter >= fighter.maxSuperMeter || action === 'super') {
      this.drawSuperAura(ctx, fighter, timeMs, scaleMultiplier);
    }

    const pose = this.resolveFighterPose(fighter, timeMs, scaleMultiplier);
    if (pose) {
      ctx.save();
      if (pose.tx !== 0 || pose.ty !== 0) ctx.translate(pose.tx, pose.ty);
      if (pose.rotate !== 0) ctx.rotate(pose.rotate);
      if (pose.flipHoriz) ctx.scale(-1, 1);

      // Clean slight recoil horizontal shake without GPU ctx.filter rectangular artifacts
      const hurtJitter = (action === 'hurt' || action === 'heavy_hurt') ? ((Math.floor(timeMs / 40) % 2 === 0) ? -2 * scaleMultiplier : 2 * scaleMultiplier) : 0;

      ctx.drawImage(
        pose.image,
        pose.box.x,
        pose.box.y,
        pose.box.w,
        pose.box.h,
        pose.destX + hurtJitter,
        pose.destY,
        pose.targetWidth,
        pose.targetHeight
      );
      ctx.restore();

      if ((action === 'block' || action === 'crouch_block') && pose.blockColor) {
        ctx.strokeStyle = pose.blockColor;
        ctx.lineWidth = 3 * scaleMultiplier;
        ctx.beginPath();
        ctx.arc(22 * scaleMultiplier, -pose.targetHeight * 0.55, 25 * scaleMultiplier, -Math.PI / 2.2, Math.PI / 2.2);
        ctx.stroke();
      }

      if (pose.defeatStars) {
        const starColor = fighter.characterId === 'herobrine' ? '#c084fc' : '#facc15';
        const starSize = Math.round(6 * scaleMultiplier);
        for (let s = 0; s < 3; s++) {
          const starAngle = timeMs / 120 + (s * Math.PI * 2) / 3;
          const sx = Math.cos(starAngle) * (20 * scaleMultiplier);
          const sy = pose.destY - 8 * scaleMultiplier + Math.sin(starAngle) * (6 * scaleMultiplier);
          ctx.fillStyle = starColor;
          ctx.fillRect(sx - starSize / 2, sy - starSize / 2, starSize, starSize);
        }
      }
    } else {
      // Clean pixel silhouette fallback while sheet image loads
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-18 * scaleMultiplier, -86 * scaleMultiplier, 36 * scaleMultiplier, 86 * scaleMultiplier);
    }

    ctx.restore();
  }

  private drawShadow(
    ctx: CanvasRenderingContext2D,
    fighter: FighterState,
    groundY: number,
    scaleMultiplier: number = WORLD_FIGHTER_SCALE
  ) {
    const distFromGround = Math.max(0, groundY - fighter.y);
    const shadowScale = Math.max(0.35, 1 - distFromGround / 300) * scaleMultiplier;
    const shadowAlpha = Math.max(0.12, 0.45 - distFromGround / 450);

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(0, distFromGround, 38 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSuperAura(
    ctx: CanvasRenderingContext2D,
    fighter: FighterState,
    timeMs: number,
    scaleMultiplier: number = WORLD_FIGHTER_SCALE
  ) {
    ctx.save();
    const colors = fighter.characterId === 'oggy'
      ? ['#38bdf8', '#0284c7', '#ffffff']
      : fighter.characterId === 'herobrine'
      ? ['#a855f7', '#c084fc', '#ffffff']
      : fighter.characterId === 'impostor'
      ? ['#ef4444', '#b91c1c', '#93c5fd']
      : fighter.characterId === 'lion'
      ? ['#facc15', '#eab308', '#ffffff']
      : fighter.characterId === 'ninja'
      ? ['#e11d48', '#be123c', '#ffffff']
      : fighter.characterId === 'mario'
      ? ['#ef4444', '#facc15', '#ffffff']
      : fighter.characterId === 'sonic'
      ? ['#2563eb', '#38bdf8', '#facc15']
      : fighter.characterId === 'hero_a'
      ? ['#06b6d4', '#38bdf8', '#ef4444']
      : fighter.characterId === 'death_wolf'
      ? ['#dc2626', '#991b1b', '#f8fafc']
      : fighter.characterId === 'hellfire'
      ? ['#f97316', '#facc15', '#dc2626']
      : fighter.characterId === 'akita'
      ? ['#f59e0b', '#fbbf24', '#ef4444']
      : fighter.characterId === 'neon_void'
      ? ['#a855f7', '#d946ef', '#ffffff']
      : fighter.characterId === 'brawler'
      ? ['#ef4444', '#f59e0b', '#ffffff']
      : ['#f97316', '#dc2626', '#fef08a'];

    if (fighter.overdriveArmed) {
      const pulse = 0.55 + Math.sin(timeMs / 55) * 0.25;
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`;
      ctx.lineWidth = 3 * scaleMultiplier;
      ctx.beginPath();
      ctx.ellipse(
        0,
        -56 * scaleMultiplier,
        (38 + Math.sin(timeMs / 70) * 4) * scaleMultiplier,
        (62 + Math.cos(timeMs / 70) * 4) * scaleMultiplier,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    const orbCount = fighter.overdriveArmed ? 14 : 10;
    const orbSz = Math.round((fighter.overdriveArmed ? 7 : 6) * scaleMultiplier);
    for (let i = 0; i < orbCount; i++) {
      const angle = (i / orbCount) * Math.PI * 2 + (timeMs / (fighter.overdriveArmed ? 140 : 220));
      const rad = ((fighter.overdriveArmed ? 42 : 38) + Math.sin(timeMs / 80 + i) * 10) * scaleMultiplier;
      const ox = Math.cos(angle) * rad;
      const oy = -55 * scaleMultiplier + Math.sin(angle) * (rad * 1.3);

      ctx.fillStyle = fighter.overdriveArmed && i % 2 === 0 ? '#facc15' : colors[i % colors.length];
      ctx.globalAlpha = (fighter.overdriveArmed ? 0.65 : 0.45) + Math.sin(timeMs / 100 + i) * 0.25;
      ctx.fillRect(ox - orbSz / 2, oy - orbSz / 2, orbSz, orbSz);
    }
    ctx.restore();
  }

  /**
   * Draw moving projectiles (kept for Engine interface compatibility)
   */
  public drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile, _timeMs: number) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw hit sparks, block deflections, and particle bursts
   */
  public drawHitSpark(ctx: CanvasRenderingContext2D, spark: HitSpark) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    spark.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });

    ctx.globalAlpha = Math.max(0, 1 - spark.timer / spark.maxTimer);

    if (spark.type === 'block') {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const r = 26 * (1 + spark.timer / spark.maxTimer);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = spark.x + Math.cos(a) * r;
        const y = spark.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      const size = (spark.type === 'heavy' || spark.type === 'ko' ? 38 : 22) * (1 + (spark.timer / spark.maxTimer) * 0.5);
      ctx.fillStyle = spark.color;
      ctx.fillRect(spark.x - size / 2, spark.y - 3, size, 6);
      ctx.fillRect(spark.x - 3, spark.y - size / 2, 6, size);
      const dSize = size * 0.7;
      ctx.fillRect(spark.x - dSize / 2, spark.y - dSize / 2, dSize, dSize);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(spark.x - 4, spark.y - 4, 8, 8);
    }

    ctx.restore();
  }
}

export const spriteRenderer = new SpriteRenderer();
