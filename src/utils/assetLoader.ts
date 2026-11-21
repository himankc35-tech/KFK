import { ARENA_LIST } from '../data/arenas';
import { CHARACTER_LIST } from '../data/characters';
import rosterBg from '../assets/images/pixel_fighters_roster_1794405989323.jpg';

const preloadedImageMap = new Map<string, HTMLImageElement>();
let preloadPromise: Promise<void> | null = null;

export function getPreloadedImage(url: string): HTMLImageElement | null {
  if (!url || typeof window === 'undefined') return null;
  let img = preloadedImageMap.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    preloadedImageMap.set(url, img);
  }
  return img;
}

function loadAndDecodeImage(url: string): Promise<void> {
  return new Promise(resolve => {
    const img = getPreloadedImage(url);
    if (!img) {
      resolve();
      return;
    }

    const finalize = () => {
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {}).finally(resolve);
      } else {
        resolve();
      }
    };

    if (img.complete && img.naturalWidth > 0) {
      finalize();
      return;
    }

    const done = () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', onErr);
      finalize();
    };
    const onErr = () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', onErr);
      resolve();
    };

    img.addEventListener('load', done);
    img.addEventListener('error', onErr);
  });
}

function warmVideoBuffer(url: string): Promise<void> {
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('loadedmetadata', finish);
      video.removeEventListener('loadeddata', finish);
      video.removeEventListener('error', finish);
      resolve();
    };
    video.addEventListener('loadedmetadata', finish);
    video.addEventListener('loadeddata', finish);
    video.addEventListener('error', finish);
    video.src = url;
    video.load();
    window.setTimeout(finish, 900);
  });
}

export function preloadAllGameAssets(
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  if (preloadPromise) return preloadPromise;

  const portraitUrls = CHARACTER_LIST.map(c => c.portraitUrl);
  const spriteSheetUrls = CHARACTER_LIST.map(c => `/assets/${c.id}/${c.id}_spritesheet.png`);
  const arenaUrls = ARENA_LIST.map(a => a.imageUrl);
  const staticImages = [
    '/assets/aistudio/Gemini_Generated_Image_mbj2pxmbj2pxmbj2_b73b2b99.png',
    rosterBg,
  ];

  const priorityImages = Array.from(new Set([...portraitUrls, ...staticImages]));
  const secondaryImages = Array.from(new Set([...spriteSheetUrls, ...arenaUrls]));
  const memeVideos = [
    '/assets/aistudio/Plankton_Meme_Clean.mp4',
    '/assets/aistudio/BlackCatClappingandSmilingmeme_GreenScre_8f3d6943.mp4',
    '/assets/aistudio/Laughing_Cat_Meme_Clean.mp4',
  ];

  const total = priorityImages.length + secondaryImages.length + memeVideos.length;
  let completed = 0;
  const tick = () => {
    completed++;
    onProgress?.(completed, total);
  };

  onProgress?.(0, total);

  preloadPromise = Promise.all(
    priorityImages.map(url => loadAndDecodeImage(url).finally(tick))
  ).then(() =>
    Promise.all([
      ...secondaryImages.map(url => loadAndDecodeImage(url).finally(tick)),
      ...memeVideos.map(url => warmVideoBuffer(url).finally(tick)),
    ]).then(() => undefined)
  );

  return preloadPromise;
}
