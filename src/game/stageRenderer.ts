import { ARENAS } from '../data/arenas';
import { ArenaId } from '../types/game';
import { getPreloadedImage } from '../utils/assetLoader';
import { GameEngine } from './gameEngine';
import { spriteRenderer } from './spriteRenderer';

export function getStageArenaImage(id: ArenaId): HTMLImageElement | null {
  const def = ARENAS[id];
  if (!def) return null;
  return getPreloadedImage(def.imageUrl);
}

export function drawLivingMapMotion(
  ctx: CanvasRenderingContext2D,
  stageId: ArenaId,
  img: HTMLImageElement | null,
  drawX: number,
  drawY: number,
  drawW: number,
  drawH: number,
  groundY: number,
  centerX: number,
  tSec: number
): void {
  if (!img || !img.complete || img.naturalWidth <= 0 || drawW <= 0 || drawH <= 0) return;

  const foliageStages: ArenaId[] = [
    'jungle_temple',
    'bamboo_dojo',
    'sakura_falls',
    'shadow_woods',
    'emerald_loop',
    'cyber_shrine',
    'celestial_temple',
  ];
  const waterStages: ArenaId[] = [
    'jungle_temple',
    'emerald_loop',
    'sakura_falls',
    'sunken_atlantis',
    'starlight_carnival',
    'cyber_shrine',
    'rooftop',
    'cyber_sector',
  ];
  const heatStages: ArenaId[] = [
    'nether_fortress',
    'brimstone_highway',
    'obsidian_colosseum',
    'desert',
    'pharaoh_sanctuary',
  ];
  const skyCloudStages: ArenaId[] = [
    'mushroom_kingdom',
    'thunder_airship',
    'celestial_temple',
    'luxe_citadel',
    'aurora_glacier',
  ];

  if (foliageStages.includes(stageId)) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    const canopyTop = drawY;
    const canopyH = drawH * 0.34;
    const sliceH = 10;
    for (let offset = 0; offset < canopyH; offset += sliceH) {
      const syWorld = canopyTop + offset;
      const weight = 1 - offset / canopyH;
      const swayX = Math.sin(tSec * 2.15 + offset * 0.05) * (3.2 * weight);
      const srcY = (offset / drawH) * img.naturalHeight;
      const srcH = (sliceH / drawH) * img.naturalHeight;
      if (srcY >= 0 && srcY + srcH <= img.naturalHeight) {
        ctx.drawImage(img, 0, srcY, img.naturalWidth, srcH, drawX + swayX, syWorld, drawW, sliceH + 1);
      }
    }
    ctx.restore();
  }

  if (waterStages.includes(stageId)) {
    ctx.save();
    ctx.globalAlpha = stageId === 'sunken_atlantis' ? 0.34 : 0.42;
    const waterStart = stageId === 'sunken_atlantis' ? groundY - 220 : groundY - 4;
    const waterEnd = groundY + 62;
    const wSlice = 4;
    for (let wy = waterStart; wy < waterEnd; wy += wSlice) {
      const relY = wy - drawY;
      if (relY < 0 || relY >= drawH) continue;
      const waveX = Math.sin(tSec * 4.4 + wy * 0.22) * (stageId === 'sunken_atlantis' ? 3.2 : 2.6);
      const srcY = (relY / drawH) * img.naturalHeight;
      const srcH = (wSlice / drawH) * img.naturalHeight;
      if (srcY >= 0 && srcY + srcH <= img.naturalHeight) {
        ctx.drawImage(img, 0, srcY, img.naturalWidth, srcH, drawX + waveX, wy, drawW, wSlice + 0.6);
      }
    }
    ctx.restore();
  }

  if (heatStages.includes(stageId)) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    const hStart = groundY - 110;
    const hEnd = groundY - 6;
    const hSlice = 5;
    for (let hy = hStart; hy < hEnd; hy += hSlice) {
      const relY = hy - drawY;
      if (relY < 0 || relY >= drawH) continue;
      const heatX = Math.sin(tSec * 6.5 + hy * 0.35) * 1.8;
      const srcY = (relY / drawH) * img.naturalHeight;
      const srcH = (hSlice / drawH) * img.naturalHeight;
      if (srcY >= 0 && srcY + srcH <= img.naturalHeight) {
        ctx.drawImage(img, 0, srcY, img.naturalWidth, srcH, drawX + heatX, hy, drawW, hSlice + 0.5);
      }
    }
    ctx.restore();
  }

  if (skyCloudStages.includes(stageId)) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    const cloudOffsetX = ((tSec * 12) % 80) - 40;
    const skySrcH = img.naturalHeight * 0.28;
    ctx.drawImage(img, 0, 0, img.naturalWidth, skySrcH, drawX + cloudOffsetX, drawY, drawW, drawH * 0.28);
    ctx.restore();
  }

  if (stageId === 'emerald_loop' || stageId === 'sakura_falls' || stageId === 'celestial_temple') {
    ctx.save();
    const wfX = stageId === 'sakura_falls' ? centerX + 275 : centerX + 235;
    for (let s = 0; s < 5; s++) {
      const sy = groundY - 190 + ((tSec * 95 + s * 42) % 190);
      ctx.fillStyle = 'rgba(224, 242, 254, 0.22)';
      ctx.fillRect(wfX - 18 + s * 9, sy, 3, 22);
    }
    ctx.restore();
  }

  if (stageId === 'jungle_temple' || stageId === 'bamboo_dojo' || stageId === 'shadow_woods') {
    ctx.save();
    const vineColor =
      stageId === 'bamboo_dojo'
        ? 'rgba(132, 204, 22, 0.26)'
        : stageId === 'shadow_woods'
        ? 'rgba(30, 41, 59, 0.45)'
        : 'rgba(34, 197, 94, 0.28)';
    ctx.strokeStyle = vineColor;
    ctx.lineWidth = 3;
    for (let v = 0; v < 4; v++) {
      const vx = centerX + (v < 2 ? -330 + v * 52 : 280 + (v - 2) * 52);
      const swayTip = Math.sin(tSec * 1.9 + v * 1.3) * 14;
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.quadraticCurveTo(vx + swayTip * 0.5, 55, vx + swayTip, 108 + (v % 2) * 26);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (stageId === 'sunken_atlantis') {
    ctx.save();
    ctx.strokeStyle = 'rgba(20, 184, 166, 0.35)';
    ctx.lineWidth = 4;
    for (let k = 0; k < 4; k++) {
      const kx = centerX + (k < 2 ? -340 + k * 34 : 310 + (k - 2) * 34);
      const tip = Math.sin(tSec * 2.1 + k) * 15;
      ctx.beginPath();
      ctx.moveTo(kx, groundY);
      ctx.quadraticCurveTo(kx + tip * 0.5, groundY - 55, kx + tip, groundY - 110);
      ctx.stroke();
    }
    for (let b = 0; b < 8; b++) {
      const bx = centerX - 300 + b * 85 + Math.sin(tSec * 2 + b) * 8;
      const by = groundY - ((tSec * 36 + b * 48) % 260);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.38)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(bx, by, 3 + (b % 3), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawStageAtmosphere(
  ctx: CanvasRenderingContext2D,
  stageId: ArenaId,
  groundY: number,
  centerX: number,
  tSec: number
): void {
  const drawGlowOrb = (gx: number, gy: number, r: number, inner: string, mid: string) => {
    const g = ctx.createRadialGradient(gx, gy, 4, gx, gy, r);
    g.addColorStop(0, inner);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawLightRay = (topX: number, topW: number, botX: number, botW: number, colorTop: string, alpha: number) => {
    ctx.save();
    const grad = ctx.createLinearGradient(topX, 40, botX, groundY + 10);
    grad.addColorStop(0, colorTop.replace('ALPHA', (alpha * 0.85).toFixed(3)));
    grad.addColorStop(0.65, colorTop.replace('ALPHA', (alpha * 0.35).toFixed(3)));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(topX - topW * 0.5, 40);
    ctx.lineTo(topX + topW * 0.5, 40);
    ctx.lineTo(botX + botW * 0.5, groundY + 12);
    ctx.lineTo(botX - botW * 0.5, groundY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawWaterRipples = (rx: number, ry: number, count: number, maxR: number, rgb: string) => {
    ctx.save();
    for (let r = 0; r < count; r++) {
      const rad = ((tSec * 28 + r * (maxR / count)) % maxR) + 10;
      const alpha = Math.max(0, 0.32 - rad / (maxR * 1.35));
      ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(rx + Math.sin(r * 1.9) * 26, ry + (r % 2) * 8, rad, rad * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawMistBand = (mx: number, my: number, w: number, h: number, rgb: string, alpha: number) => {
    ctx.save();
    const shift = Math.sin(tSec * 0.7 + mx * 0.01) * 45;
    const g = ctx.createRadialGradient(mx + shift, my, 12, mx + shift, my, w);
    g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(mx + shift, my, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawTwinkles = (baseX: number, baseY: number, spreadX: number, spreadY: number, count: number, rgb: string) => {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const px = baseX + Math.sin(i * 4.7 + 1.1) * spreadX;
      const py = baseY + Math.cos(i * 3.3 + 0.5) * spreadY;
      const a = 0.2 + Math.max(0, Math.sin(tSec * (2.5 + (i % 3)) + i * 2.1)) * 0.55;
      ctx.fillStyle = `rgba(${rgb}, ${a})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.8 + (i % 2) * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const flickerA = 0.22 + Math.sin(tSec * 3.2) * 0.05 + Math.sin(tSec * 9.7) * 0.035;
  const flickerB = 0.2 + Math.cos(tSec * 2.6) * 0.05 + Math.sin(tSec * 7.4) * 0.025;

  switch (stageId) {
    case 'jungle_temple':
      drawLightRay(centerX - 180 + Math.sin(tSec * 0.4) * 20, 65, centerX - 60, 175, 'rgba(253, 224, 71, ALPHA)', 0.14);
      drawGlowOrb(centerX - 270, groundY - 78, 135, `rgba(251, 191, 36, ${flickerA})`, `rgba(245, 158, 11, ${flickerA * 0.45})`);
      drawGlowOrb(centerX + 275, groundY - 115, 150, `rgba(134, 239, 172, ${flickerB * 0.85})`, `rgba(74, 222, 128, ${flickerB * 0.35})`);
      drawWaterRipples(centerX + 250, groundY + 16, 3, 78, '186, 230, 253');
      drawMistBand(centerX, groundY - 8, 320, 34, '220, 252, 231', 0.07);
      break;

    case 'nether_fortress':
      drawGlowOrb(centerX - 285, groundY - 62, 155, `rgba(249, 115, 22, ${flickerA * 1.25})`, `rgba(220, 38, 38, ${flickerA * 0.5})`);
      drawGlowOrb(centerX + 285, groundY - 82, 160, `rgba(192, 132, 252, ${flickerB * 1.05})`, `rgba(147, 51, 234, ${flickerB * 0.42})`);
      drawGlowOrb(centerX, groundY + 22, 260, `rgba(239, 68, 68, ${flickerA * 0.65})`, 'rgba(127, 29, 29, 0.08)');
      drawTwinkles(centerX, groundY - 40, 340, 75, 8, '251, 146, 60');
      break;

    case 'spaceship_deck': {
      const sweepX = centerX + Math.sin(tSec * 1.1) * 240;
      drawLightRay(sweepX, 34, sweepX + 70, 120, 'rgba(248, 113, 113, ALPHA)', 0.12);
      drawGlowOrb(centerX - 285, groundY - 115, 150, `rgba(56, 189, 248, ${flickerA})`, `rgba(14, 165, 233, ${flickerA * 0.4})`);
      drawGlowOrb(centerX + 285, groundY - 115, 150, `rgba(192, 132, 252, ${flickerB})`, `rgba(236, 72, 153, ${flickerB * 0.35})`);
      drawTwinkles(centerX, 140, 360, 85, 10, '224, 231, 255');
      break;
    }

    case 'cyber_shrine':
      drawGlowOrb(centerX - 260, groundY - 95, 145, `rgba(251, 146, 60, ${flickerA * 1.15})`, `rgba(244, 114, 182, ${flickerA * 0.42})`);
      drawGlowOrb(centerX + 260, groundY - 105, 150, `rgba(56, 189, 248, ${flickerB})`, `rgba(244, 114, 182, ${flickerB * 0.35})`);
      drawWaterRipples(centerX - 140, groundY + 14, 3, 46, '147, 197, 253');
      drawWaterRipples(centerX + 180, groundY + 18, 3, 46, '244, 114, 182');
      drawMistBand(centerX, groundY - 10, 340, 36, '203, 213, 225', 0.08);
      break;

    case 'rooftop':
      drawGlowOrb(centerX - 280, groundY - 125, 155, `rgba(56, 189, 248, ${flickerA * 1.1})`, `rgba(14, 165, 233, ${flickerA * 0.4})`);
      drawGlowOrb(centerX + 280, groundY - 125, 155, `rgba(236, 72, 153, ${flickerB * 1.1})`, `rgba(168, 85, 247, ${flickerB * 0.38})`);
      drawWaterRipples(centerX - 220, groundY + 14, 3, 44, '147, 197, 253');
      drawWaterRipples(centerX + 190, groundY + 18, 3, 44, '103, 232, 249');
      drawTwinkles(centerX, 175, 360, 70, 9, '253, 224, 71');
      break;

    case 'desert':
      drawLightRay(centerX + 90 + Math.sin(tSec * 0.5) * 30, 120, centerX - 110, 290, 'rgba(253, 224, 71, ALPHA)', 0.16);
      drawGlowOrb(centerX - 140, 110, 210, `rgba(251, 191, 36, ${flickerA})`, 'rgba(245, 158, 11, 0.06)');
      drawMistBand(centerX, groundY - 18, 380, 28, '253, 186, 116', 0.11);
      break;

    case 'mushroom_kingdom':
      drawLightRay(centerX - 140 + Math.sin(tSec * 0.4) * 25, 85, centerX - 20, 220, 'rgba(254, 249, 195, ALPHA)', 0.15);
      drawGlowOrb(centerX + 240, 120, 180, `rgba(253, 224, 71, ${flickerA * 0.9})`, 'rgba(56, 189, 248, 0.08)');
      drawMistBand(centerX - 120, 125, 220, 32, '255, 255, 255', 0.09);
      drawTwinkles(centerX, groundY - 155, 320, 60, 7, '253, 224, 71');
      break;

    case 'emerald_loop':
      drawLightRay(centerX + 120 + Math.cos(tSec * 0.45) * 22, 85, centerX + 20, 220, 'rgba(254, 240, 138, ALPHA)', 0.14);
      drawGlowOrb(centerX - 260, groundY - 95, 145, `rgba(74, 222, 128, ${flickerA})`, `rgba(250, 204, 21, ${flickerA * 0.35})`);
      drawWaterRipples(centerX + 260, groundY + 14, 3, 76, '125, 211, 252');
      drawTwinkles(centerX - 190, groundY - 120, 140, 65, 6, '186, 230, 253');
      break;

    case 'cyber_sector':
      drawGlowOrb(centerX - 280, groundY - 125, 165, `rgba(34, 211, 238, ${flickerA * 1.15})`, `rgba(14, 165, 233, ${flickerA * 0.45})`);
      drawGlowOrb(centerX + 280, groundY - 115, 160, `rgba(217, 70, 239, ${flickerB * 1.05})`, `rgba(147, 51, 234, ${flickerB * 0.35})`);
      drawWaterRipples(centerX - 110, groundY + 16, 3, 46, '103, 232, 249');
      drawTwinkles(centerX, 165, 370, 75, 10, '103, 232, 249');
      break;

    case 'luxe_citadel':
      drawLightRay(centerX - 160 + Math.sin(tSec * 0.35) * 22, 95, centerX - 30, 250, 'rgba(253, 224, 71, ALPHA)', 0.15);
      drawGlowOrb(centerX, 135, 225, `rgba(251, 191, 36, ${flickerA})`, 'rgba(234, 179, 8, 0.08)');
      drawTwinkles(centerX, groundY - 120, 340, 85, 8, '254, 240, 138');
      break;

    case 'shadow_woods':
      drawGlowOrb(centerX, 118, 195, `rgba(239, 68, 68, ${flickerA * 1.15})`, `rgba(153, 27, 27, ${flickerA * 0.42})`);
      drawMistBand(centerX - 180, groundY - 18, 300, 38, '148, 163, 184', 0.12);
      drawMistBand(centerX + 190, groundY - 14, 280, 34, '226, 232, 240', 0.1);
      drawTwinkles(centerX, groundY - 110, 360, 80, 7, '248, 113, 113');
      break;

    case 'brimstone_highway':
      drawGlowOrb(centerX - 285, groundY - 68, 155, `rgba(249, 115, 22, ${flickerA * 1.25})`, `rgba(220, 38, 38, ${flickerA * 0.5})`);
      drawGlowOrb(centerX + 285, groundY - 75, 155, `rgba(250, 204, 21, ${flickerB * 1.15})`, `rgba(234, 88, 12, ${flickerB * 0.45})`);
      drawMistBand(centerX, groundY + 4, 380, 34, '249, 115, 22', 0.12);
      drawTwinkles(centerX, groundY - 60, 360, 80, 9, '253, 186, 116');
      break;

    case 'bamboo_dojo':
      drawLightRay(centerX - 190 + Math.sin(tSec * 0.4) * 20, 75, centerX - 75, 200, 'rgba(253, 186, 116, ALPHA)', 0.14);
      drawGlowOrb(centerX - 260, groundY - 88, 145, `rgba(251, 146, 60, ${flickerA * 1.1})`, `rgba(245, 158, 11, ${flickerA * 0.4})`);
      drawGlowOrb(centerX + 265, groundY - 92, 145, `rgba(250, 204, 21, ${flickerB})`, 'rgba(217, 119, 6, 0.12)');
      drawMistBand(centerX, groundY - 12, 340, 30, '254, 243, 199', 0.08);
      break;

    case 'junkyard_alley':
      drawLightRay(centerX - 220, 48, centerX - 135, 165, 'rgba(253, 224, 71, ALPHA)', 0.13 + Math.sin(tSec * 11) * 0.02);
      drawGlowOrb(centerX + 260, groundY - 115, 145, `rgba(56, 189, 248, ${flickerB * 0.9})`, 'rgba(14, 165, 233, 0.1)');
      drawMistBand(centerX + 160, groundY - 38, 220, 34, '203, 213, 225', 0.1);
      break;

    case 'aurora_glacier': {
      const auroraShift = Math.sin(tSec * 0.85) * 85;
      drawGlowOrb(centerX - 180 + auroraShift, 92, 225, `rgba(52, 211, 153, ${flickerA * 1.2})`, `rgba(34, 211, 238, ${flickerA * 0.45})`);
      drawGlowOrb(centerX + 200 - auroraShift * 0.65, 108, 215, `rgba(56, 189, 248, ${flickerB * 1.15})`, `rgba(167, 139, 250, ${flickerB * 0.35})`);
      drawMistBand(centerX, groundY - 6, 360, 28, '186, 230, 253', 0.09);
      drawTwinkles(centerX, groundY - 20, 350, 24, 10, '224, 242, 254');
      break;
    }

    case 'sakura_falls':
      drawGlowOrb(centerX, 115, 200, `rgba(224, 242, 254, ${flickerA * 0.95})`, 'rgba(186, 230, 253, 0.12)');
      drawGlowOrb(centerX - 255, groundY - 95, 145, `rgba(244, 114, 182, ${flickerB * 1.05})`, 'rgba(236, 72, 153, 0.14)');
      drawWaterRipples(centerX + 275, groundY + 12, 4, 82, '186, 230, 253');
      drawMistBand(centerX + 220, groundY - 12, 210, 36, '224, 242, 254', 0.11);
      break;

    case 'thunder_airship': {
      drawGlowOrb(centerX - 245, groundY - 125, 175, `rgba(251, 191, 36, ${flickerA * 1.15})`, `rgba(249, 115, 22, ${flickerA * 0.4})`);
      drawMistBand(centerX, groundY + 18, 420, 42, '253, 230, 138', 0.1);
      const flashPulse = Math.max(0, Math.sin(tSec * 7.3) * Math.sin(tSec * 19.7) - 0.72);
      if (flashPulse > 0) {
        drawGlowOrb(centerX + 180, 105, 245, `rgba(224, 231, 255, ${flashPulse * 1.15})`, 'rgba(165, 180, 252, 0.09)');
      }
      break;
    }

    case 'crystal_cavern':
      drawGlowOrb(centerX - 260, groundY - 120, 175, `rgba(192, 132, 252, ${flickerA * 1.15})`, `rgba(56, 189, 248, ${flickerA * 0.45})`);
      drawGlowOrb(centerX + 260, groundY - 120, 175, `rgba(45, 212, 191, ${flickerB * 1.15})`, `rgba(250, 204, 21, ${flickerB * 0.38})`);
      drawTwinkles(centerX, groundY - 110, 350, 95, 12, '167, 243, 208');
      break;

    case 'sunken_atlantis':
      drawLightRay(centerX - 150 + Math.sin(tSec * 0.6) * 28, 70, centerX - 60, 195, 'rgba(94, 234, 212, ALPHA)', 0.16);
      drawLightRay(centerX + 160 + Math.cos(tSec * 0.5) * 28, 60, centerX + 90, 185, 'rgba(56, 189, 248, ALPHA)', 0.14);
      drawGlowOrb(centerX - 240, 130, 195, `rgba(45, 212, 191, ${flickerA * 1.1})`, `rgba(6, 182, 212, ${flickerA * 0.4})`);
      drawTwinkles(centerX, groundY - 120, 340, 110, 10, '186, 230, 253');
      break;

    case 'clockwork_spire': {
      drawGlowOrb(centerX - 255, groundY - 115, 170, `rgba(251, 191, 36, ${flickerA * 1.15})`, `rgba(217, 119, 6, ${flickerA * 0.42})`);
      drawGlowOrb(centerX + 245, groundY - 82, 145, `rgba(245, 158, 11, ${flickerB})`, 'rgba(180, 83, 9, 0.12)');
      ctx.save();
      ctx.translate(centerX + 220, groundY - 155);
      ctx.rotate(tSec * 0.35);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.16)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawMistBand(centerX - 210, groundY - 22, 190, 28, '226, 232, 240', 0.09);
      break;
    }

    case 'obsidian_colosseum': {
      drawGlowOrb(centerX - 260, groundY - 75, 155, `rgba(249, 115, 22, ${flickerA * 1.2})`, `rgba(220, 38, 38, ${flickerA * 0.42})`);
      drawGlowOrb(centerX + 260, groundY - 75, 155, `rgba(249, 115, 22, ${flickerB * 1.2})`, `rgba(220, 38, 38, ${flickerB * 0.42})`);
      const stormFlash = Math.max(0, Math.sin(tSec * 6.1) * Math.cos(tSec * 17.3) - 0.74);
      if (stormFlash > 0) {
        drawGlowOrb(centerX + 90, 95, 250, `rgba(192, 132, 252, ${stormFlash * 1.2})`, 'rgba(126, 34, 206, 0.1)');
      }
      break;
    }

    case 'starlight_carnival': {
      drawGlowOrb(centerX + 185, 145, 195, `rgba(251, 191, 36, ${flickerA * 1.1})`, `rgba(244, 114, 182, ${flickerA * 0.35})`);
      drawGlowOrb(centerX - 245, groundY - 92, 155, `rgba(56, 189, 248, ${flickerB})`, 'rgba(234, 179, 8, 0.1)');
      ctx.save();
      ctx.translate(centerX + 225, groundY - 165);
      ctx.rotate(tSec * 0.28);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(253, 224, 71, 0.48)' : 'rgba(244, 114, 182, 0.48)';
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * 62, Math.sin(ang) * 62, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      drawWaterRipples(centerX - 180, groundY + 20, 3, 62, '125, 211, 252');
      break;
    }

    case 'pharaoh_sanctuary':
      drawLightRay(centerX - 40, 100, centerX - 140, 260, 'rgba(251, 146, 60, ALPHA)', 0.14);
      drawGlowOrb(centerX, 138, 220, `rgba(251, 146, 60, ${flickerA * 1.1})`, `rgba(220, 38, 38, ${flickerA * 0.35})`);
      drawGlowOrb(centerX - 280, groundY - 82, 135, `rgba(250, 204, 21, ${flickerB * 1.1})`, 'rgba(245, 158, 11, 0.12)');
      drawGlowOrb(centerX + 280, groundY - 82, 135, `rgba(250, 204, 21, ${flickerA * 1.1})`, 'rgba(245, 158, 11, 0.12)');
      drawMistBand(centerX, groundY - 12, 360, 26, '251, 191, 36', 0.08);
      break;

    case 'hyper_rail':
      drawGlowOrb(centerX - 220, groundY - 28, 165, `rgba(34, 211, 238, ${flickerA * 1.2})`, `rgba(14, 165, 233, ${flickerA * 0.44})`);
      drawGlowOrb(centerX + 260, groundY - 118, 165, `rgba(232, 121, 249, ${flickerB * 1.1})`, 'rgba(192, 38, 211, 0.14)');
      ctx.save();
      for (let s = 0; s < 4; s++) {
        const sx = centerX + 380 - ((tSec * 420 + s * 220) % 760);
        const sy = groundY - 55 - (s % 2) * 58;
        ctx.strokeStyle = s % 2 === 0 ? 'rgba(103, 232, 249, 0.3)' : 'rgba(244, 114, 182, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 56, sy);
        ctx.stroke();
      }
      ctx.restore();
      break;

    case 'celestial_temple':
    default:
      drawLightRay(centerX + Math.sin(tSec * 0.3) * 20, 110, centerX - 30, 280, 'rgba(254, 240, 138, ALPHA)', 0.16);
      drawGlowOrb(centerX, 110, 235, `rgba(253, 224, 71, ${flickerA * 1.1})`, `rgba(251, 191, 36, ${flickerA * 0.35})`);
      drawGlowOrb(centerX + 260, groundY - 95, 150, `rgba(110, 231, 183, ${flickerB * 0.9})`, 'rgba(16, 185, 129, 0.12)');
      drawMistBand(centerX, groundY + 6, 400, 34, '255, 255, 255', 0.1);
      drawTwinkles(centerX, groundY - 140, 330, 80, 8, '254, 240, 138');
      break;
  }
}

export function drawZoneTransitionGate(
  ctx: CanvasRenderingContext2D,
  gateX: number,
  groundY: number,
  tSec: number,
  zoneLabel: string
): void {
  ctx.save();
  const mist = ctx.createRadialGradient(gateX, groundY - 12, 10, gateX, groundY - 12, 155);
  mist.addColorStop(0, 'rgba(251, 191, 36, 0.28)');
  mist.addColorStop(0.55, 'rgba(15, 23, 42, 0.45)');
  mist.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = mist;
  ctx.fillRect(gateX - 165, groundY - 170, 330, 210);

  const beamAlpha = 0.14 + Math.sin(tSec * 3.4) * 0.05;
  const veilGrad = ctx.createLinearGradient(gateX - 36, 0, gateX + 36, 0);
  veilGrad.addColorStop(0, 'rgba(251, 191, 36, 0)');
  veilGrad.addColorStop(0.5, `rgba(251, 191, 36, ${beamAlpha})`);
  veilGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = veilGrad;
  ctx.fillRect(gateX - 36, groundY - 265, 72, 268);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(gateX - 34, groundY - 176, 12, 176);
  ctx.fillRect(gateX + 22, groundY - 176, 12, 176);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(gateX - 44, groundY - 186, 88, 10);
  ctx.fillRect(gateX - 52, groundY - 196, 104, 8);

  const orbPulse = 0.72 + Math.sin(tSec * 5.2) * 0.25;
  ctx.fillStyle = `rgba(253, 224, 71, ${orbPulse})`;
  ctx.beginPath();
  ctx.arc(gateX - 28, groundY - 150, 4.5, 0, Math.PI * 2);
  ctx.arc(gateX + 28, groundY - 150, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
  ctx.fillRect(gateX - 38, groundY - 216, 76, 16);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(gateX - 38, groundY - 216, 76, 16);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(zoneLabel, gateX, groundY - 208);

  ctx.restore();
}

export function drawBlackWhiteVCoin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tSec: number,
  bobOffset: number
): void {
  const bobY = cy + Math.sin(tSec * 4.8 + bobOffset) * 3.5;
  const spinScaleX = 0.72 + 0.28 * Math.abs(Math.cos(tSec * 3.2 + bobOffset));

  ctx.save();
  const halo = ctx.createRadialGradient(cx, bobY, 3, cx, bobY, 22);
  halo.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
  halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, bobY, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, bobY);
  ctx.scale(spinScaleX, 1);

  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, 12.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 9.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('V', 0, 1);

  ctx.restore();
}

export interface StageRenderOptions {
  showTouchControls?: boolean;
  getArenaImage?: (id: ArenaId) => HTMLImageElement | null;
}

export function renderGameStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  engine: GameEngine,
  timeMs: number,
  options: StageRenderOptions = {}
): void {
  const getArenaImage = options.getArenaImage || getStageArenaImage;
  const showTouchControls = Boolean(options.showTouchControls);

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;

  const groundY = engine.arena.groundY;
  const tSec = timeMs * 0.001;
  const shakeX = engine.screenShake > 0 ? (Math.random() - 0.5) * Math.min(8, engine.screenShake) : 0;
  const zoom = engine.cameraZoom || 1;
  const camX = engine.cameraX;
  const camY = engine.cameraY;
  const isPortraitLayout = height > width;
  const focusRatioY = isPortraitLayout ? 0.48 : 0.59;

  ctx.translate(width / 2 + shakeX, height * focusRatioY);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  const visLeft = camX - (width / 2 + Math.abs(shakeX)) / zoom;
  const visRight = camX + (width / 2 + Math.abs(shakeX)) / zoom;
  const visTop = camY - (height * focusRatioY) / zoom;
  const visBottom = camY + (height * (1 - focusRatioY)) / zoom;
  const visW = visRight - visLeft;
  const visH = visBottom - visTop;
  const isPortraitView = visH > visW * 1.05;

  if (engine.mode === 'INFINITY') {
    if (isPortraitView) {
      const skyGrad = ctx.createLinearGradient(0, visTop, 0, visBottom);
      skyGrad.addColorStop(0, '#040712');
      skyGrad.addColorStop(0.5, '#0f172a');
      skyGrad.addColorStop(1, '#02040a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(visLeft - 40, visTop - 40, visW + 80, visH + 80);
    }

    const featherW = 160;
    engine.infinitySegments.forEach((seg, sIdx) => {
      if (seg.endX + featherW < visLeft - 120 || seg.startX - featherW > visRight + 120) return;
      const segW = seg.endX - seg.startX;
      const img = getArenaImage(seg.arenaId);
      ctx.save();
      const clipLeft = sIdx > 0 ? seg.startX - featherW * 0.5 : seg.startX - 40;
      const clipRight = seg.endX + featherW * 0.5;
      ctx.beginPath();
      ctx.rect(clipLeft, visTop - 40, clipRight - clipLeft, visH + 100);
      ctx.clip();

      const drawArenaImg = (alpha: number, withMotion: boolean) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        if (img && img.complete && img.naturalWidth > 0) {
          const minCoverW = segW + featherW + 20;
          const minCoverH = isPortraitView ? 500 : Math.max(540, visH + 36);
          const scale = Math.max(minCoverW / img.naturalWidth, minCoverH / img.naturalHeight);
          const drawW = img.naturalWidth * scale;
          const drawH = img.naturalHeight * scale;
          const segCenter = seg.startX + segW / 2;
          const drawX = segCenter - drawW / 2;
          let drawY = groundY + 72 - drawH + (290 - camY) * 0.06;
          if (!isPortraitView) {
            drawY = Math.min(visTop - 4, Math.max(visBottom + 4 - drawH, drawY));
          }
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          if (isPortraitView) {
            if (drawY > visTop) {
              const topFade = ctx.createLinearGradient(0, drawY - 12, 0, drawY + 60);
              topFade.addColorStop(0, '#070b18');
              topFade.addColorStop(1, 'rgba(7,11,24,0)');
              ctx.fillStyle = topFade;
              ctx.fillRect(clipLeft, visTop - 40, clipRight - clipLeft, drawY - visTop + 100);
            }
            const botEdge = drawY + drawH;
            if (botEdge < visBottom) {
              const botFade = ctx.createLinearGradient(0, botEdge - 60, 0, botEdge + 12);
              botFade.addColorStop(0, 'rgba(3,6,14,0)');
              botFade.addColorStop(1, '#03060e');
              ctx.fillStyle = botFade;
              ctx.fillRect(clipLeft, botEdge - 60, clipRight - clipLeft, visBottom - botEdge + 100);
            }
          }
          if (withMotion) {
            drawLivingMapMotion(ctx, seg.arenaId, img, drawX, drawY, drawW, drawH, groundY, segCenter, tSec);
          }
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(clipLeft, visTop - 40, clipRight - clipLeft, visH + 100);
        }
        ctx.restore();
      };

      if (sIdx > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(seg.startX + featherW * 0.5, visTop - 40, segW - featherW * 0.5, visH + 100);
        ctx.clip();
        drawArenaImg(1, true);
        ctx.restore();

        const bands = 14;
        const bandW = featherW / bands;
        for (let b = 0; b < bands; b++) {
          const bx = seg.startX - featherW * 0.5 + b * bandW;
          const alpha = (b + 1) / (bands + 1);
          ctx.save();
          ctx.beginPath();
          ctx.rect(bx, visTop - 40, bandW + 1, visH + 100);
          ctx.clip();
          drawArenaImg(alpha, false);
          ctx.restore();
        }
      } else {
        drawArenaImg(1, true);
      }

      drawStageAtmosphere(ctx, seg.arenaId, groundY, seg.startX + segW / 2, tSec);
      ctx.restore();
    });

    engine.infinitySegments.forEach((seg, sIdx) => {
      if (sIdx > 0 && seg.startX >= visLeft - 180 && seg.startX <= visRight + 180) {
        drawZoneTransitionGate(ctx, seg.startX, groundY, tSec, `ZONE ${sIdx + 1}`);
      }
    });
  } else {
    const bg = getArenaImage(engine.arena.id);
    if (isPortraitView) {
      const skyGrad = ctx.createLinearGradient(0, visTop, 0, visBottom);
      skyGrad.addColorStop(0, '#040712');
      skyGrad.addColorStop(0.5, '#0f172a');
      skyGrad.addColorStop(1, '#02040a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(visLeft - 20, visTop - 20, visW + 40, visH + 40);
    }
    if (bg && bg.complete && bg.naturalWidth > 0) {
      const minCoverW = isPortraitView ? Math.max(920, visW + 60) : Math.max(1060, visW + 64);
      const minCoverH = isPortraitView ? 480 : Math.max(540, visH + 36);
      const bgScale = Math.max(minCoverW / bg.naturalWidth, minCoverH / bg.naturalHeight);
      const drawW = bg.naturalWidth * bgScale;
      const drawH = bg.naturalHeight * bgScale;

      let drawX = 500 - drawW / 2 + (500 - camX) * 0.12;
      drawX = Math.min(visLeft - 4, Math.max(visRight + 4 - drawW, drawX));

      let drawY = groundY + 72 - drawH + (290 - camY) * 0.06;
      if (!isPortraitView) {
        drawY = Math.min(visTop - 4, Math.max(visBottom + 4 - drawH, drawY));
      }

      ctx.drawImage(bg, drawX, drawY, drawW, drawH);
      if (isPortraitView) {
        if (drawY > visTop) {
          const topFade = ctx.createLinearGradient(0, drawY - 12, 0, drawY + 60);
          topFade.addColorStop(0, '#070b18');
          topFade.addColorStop(1, 'rgba(7,11,24,0)');
          ctx.fillStyle = topFade;
          ctx.fillRect(visLeft - 20, visTop - 20, visW + 40, drawY - visTop + 80);
        }
        const botEdge = drawY + drawH;
        if (botEdge < visBottom) {
          const botFade = ctx.createLinearGradient(0, botEdge - 60, 0, botEdge + 12);
          botFade.addColorStop(0, 'rgba(3,6,14,0)');
          botFade.addColorStop(1, '#03060e');
          ctx.fillStyle = botFade;
          ctx.fillRect(visLeft - 20, botEdge - 60, visW + 40, visBottom - botEdge + 90);
        }
      }
      drawLivingMapMotion(ctx, engine.arena.id, bg, drawX, drawY, drawW, drawH, groundY, 500, tSec);
    } else {
      const fallbackGrad = ctx.createLinearGradient(0, visTop, 0, visBottom);
      fallbackGrad.addColorStop(0, '#0f172a');
      fallbackGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = fallbackGrad;
      ctx.fillRect(visLeft - 20, visTop - 20, visW + 40, visH + 40);
    }
    drawStageAtmosphere(ctx, engine.arena.id, groundY, 500, tSec);
  }

  const floorSpanLeft = visLeft - 80;
  const floorSpanW = visW + 160;
  const floorGrad = ctx.createLinearGradient(0, groundY - 14, 0, Math.max(groundY + 140, visBottom + 20));
  floorGrad.addColorStop(0, 'rgba(0,0,0,0)');
  floorGrad.addColorStop(0.28, 'rgba(0,0,0,0.42)');
  floorGrad.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(floorSpanLeft, groundY - 14, floorSpanW, Math.max(180, visBottom - groundY + 40));

  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.fillRect(floorSpanLeft, groundY, floorSpanW, 2);

  if (engine.p1.action === 'super' || engine.p2.action === 'super') {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.fillRect(visLeft - 40, visTop - 40, visW + 80, visH + 80);
  }

  const pType = engine.arena.particleType;
  engine.particles.forEach((p, idx) => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    if (pType === 'rain') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1.2, p.size * 0.6);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 4, p.y + 15);
      ctx.stroke();
    } else if (pType === 'leaves' || pType === 'petals') {
      ctx.translate(p.x, p.y);
      ctx.rotate(tSec * 2.8 + idx * 0.7);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
      ctx.fillStyle = pType === 'leaves' ? '#166534' : 'rgba(255,255,255,0.45)';
      ctx.fillRect(-p.size / 4, 0, p.size / 2, 1);
    } else if (pType === 'embers' || pType === 'dust' || pType === 'snow') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = p.alpha * 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  });

  if (engine.mode === 'INFINITY' || (engine.mode === 'ONLINE' && engine.onlineMatchFormat === 'infinity')) {
    engine.vCoins.forEach(coin => {
      if (!coin.collected && coin.x >= visLeft - 40 && coin.x <= visRight + 40) {
        drawBlackWhiteVCoin(ctx, coin.x, coin.y, tSec, coin.bobOffset);
      }
    });
  }

  const isOnlineInfinityMulti =
    engine.mode === 'ONLINE' &&
    engine.onlineMatchFormat === 'infinity' &&
    (engine.onlineAllies.length > 0 || engine.onlineEnemies.length > 0);

  if (isOnlineInfinityMulti) {
    const visibleEnemies = engine.onlineEnemies.filter(e => !e.isDead && e.health > 0);
    const allUnits = [...engine.onlineAllies, ...visibleEnemies];
    for (const u of allUnits) {
      spriteRenderer.drawFighterShadow(ctx, u, groundY);
    }

    const isStrike = (a: string) =>
      a.includes('power') || a.includes('punch') || a.includes('kick') || a === 'super';
    const sorted = [...allUnits].sort((a, b) => {
      if (Boolean(a.isDead) !== Boolean(b.isDead)) return a.isDead ? -1 : 1;
      const aAtk = isStrike(a.action) ? 1 : 0;
      const bAtk = isStrike(b.action) ? 1 : 0;
      if (aAtk !== bAtk) return aAtk - bAtk;
      return (a.team === 'enemy' ? 0 : 1) - (b.team === 'enemy' ? 0 : 1);
    });
    for (const u of sorted) {
      spriteRenderer.drawFighter(ctx, u, groundY, timeMs, true);
    }

    for (const ally of engine.onlineAllies) {
      if (!ally.isDead) continue;
      const cx = ally.x;
      const cy = groundY - 178;
      ctx.save();
      if (engine.onlineCanReviveNow) {
        const pct = Math.max(0, Math.min(1, (ally.reviveProgress ?? 0) / 5.0));
        const sec = Math.min(5, ally.reviveProgress ?? 0).toFixed(1);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - 82, cy - 22, 164, 30);
        ctx.strokeRect(cx - 82, cy - 22, 164, 30);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cx - 72, cy - 2, 144, 6);
        ctx.fillStyle = '#34d399';
        ctx.fillRect(cx - 72, cy - 2, 144 * pct, 6);

        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#a7f3d0';
        const revivePrompt = showTouchControls
          ? `HOLD REVIVE ${sec}s/5s`
          : `HOLD [Q] REVIVE ${sec}s/5s`;
        ctx.fillText(revivePrompt, cx, cy - 8);
      } else {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - 88, cy - 18, 176, 24);
        ctx.strokeRect(cx - 88, cy - 18, 176, 24);
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fca5a5';
        ctx.fillText('DEAD · CLEAR ENEMIES FIRST', cx, cy - 3);
      }
      ctx.restore();
    }
  } else {
    const showEnemy = engine.mode !== 'INFINITY' || engine.infinityEnemyActive;
    spriteRenderer.drawFighterShadow(ctx, engine.p1, groundY);
    if (showEnemy) {
      spriteRenderer.drawFighterShadow(ctx, engine.p2, groundY);
    }

    const isStrike = (a: string) =>
      a.includes('power') || a.includes('punch') || a.includes('kick') || a === 'super';
    const p1Attacking = isStrike(engine.p1.action);
    const p2Attacking = isStrike(engine.p2.action);
    const drawP1Second = p1Attacking || (!p2Attacking && !engine.p1.isGrounded && engine.p2.isGrounded);

    if (!showEnemy) {
      spriteRenderer.drawFighter(ctx, engine.p1, groundY, timeMs, true);
    } else if (drawP1Second) {
      spriteRenderer.drawFighter(ctx, engine.p2, groundY, timeMs, true);
      spriteRenderer.drawFighter(ctx, engine.p1, groundY, timeMs, true);
    } else {
      spriteRenderer.drawFighter(ctx, engine.p1, groundY, timeMs, true);
      spriteRenderer.drawFighter(ctx, engine.p2, groundY, timeMs, true);
    }
  }

  engine.projectiles.forEach(proj => {
    spriteRenderer.drawProjectile(ctx, proj, timeMs);
  });

  engine.hitSparks.forEach(spark => {
    spriteRenderer.drawHitSpark(ctx, spark);
  });

  engine.floatingPopups.forEach(pop => {
    const alpha = Math.max(0, 1 - pop.life / pop.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.lineWidth = 3.5;
    ctx.strokeText(pop.text, pop.x, pop.y);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
  });

  ctx.restore();
}
