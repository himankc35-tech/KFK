import React, { useState } from 'react';
import { ArrowLeft, Image as ImageIcon, Users, Map } from 'lucide-react';
import { CHARACTER_LIST } from '../data/characters';
import { ARENA_LIST } from '../data/arenas';
import { soundManager } from '../audio/soundManager';

interface VisualReferenceModalProps {
  onClose: () => void;
}

type RefTab =
  | 'OGGY'
  | 'BUSTER'
  | 'HEROBRINE'
  | 'IMPOSTOR'
  | 'LION'
  | 'NINJA'
  | 'BRAWLER'
  | 'MARIO'
  | 'SONIC'
  | 'HERO_A'
  | 'DEATH_WOLF'
  | 'HELLFIRE'
  | 'AKITA'
  | 'NEON_VOID'
  | 'FIGHTERS'
  | 'ARENAS';

export const VisualReferenceModal: React.FC<VisualReferenceModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<RefTab>('OGGY');

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-950 select-none flex flex-col p-3 sm:p-6">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-black pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between border-b border-slate-800 pb-3 max-w-6xl mx-auto w-full">
        <button
          onClick={() => {
            soundManager.playUiSelect();
            onClose();
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-pixel text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO LOBBY</span>
        </button>

        <span className="font-pixel text-xs sm:text-sm text-yellow-300 arcade-gold-shadow">
          ART & SPRITE REFERENCE GALLERY
        </span>

        <div className="w-24 hidden sm:block" />
      </header>

      {/* Tabs */}
      <div className="relative z-20 shrink-0 max-h-[24vh] sm:max-h-none overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar flex flex-wrap gap-1.5 sm:gap-2 justify-center py-2.5 sm:py-4">
        {[
          { id: 'OGGY' as const, label: 'OGGY SHEET', icon: ImageIcon },
          { id: 'BUSTER' as const, label: 'BOB SHEET', icon: ImageIcon },
          { id: 'HEROBRINE' as const, label: 'PHANTOM KNIGHT', icon: ImageIcon },
          { id: 'IMPOSTOR' as const, label: 'CRIMSON VIPER', icon: ImageIcon },
          { id: 'LION' as const, label: 'SHERU SHEET', icon: ImageIcon },
          { id: 'NINJA' as const, label: 'NINJA SHEET', icon: ImageIcon },
          { id: 'BRAWLER' as const, label: 'KENJI SHEET', icon: ImageIcon },
          { id: 'MARIO' as const, label: 'GOLD KNUCKLE', icon: ImageIcon },
          { id: 'SONIC' as const, label: 'VOLT DASH', icon: ImageIcon },
          { id: 'HERO_A' as const, label: 'CYBER RANGER', icon: ImageIcon },
          { id: 'DEATH_WOLF' as const, label: 'DEATH WOLF SHEET', icon: ImageIcon },
          { id: 'HELLFIRE' as const, label: 'MAGMA KNIGHT', icon: ImageIcon },
          { id: 'AKITA' as const, label: 'KUTTIYA SHEET', icon: ImageIcon },
          { id: 'NEON_VOID' as const, label: 'NEON VOID SHEET', icon: ImageIcon },
          { id: 'FIGHTERS' as const, label: 'OFFICIAL ROSTER', icon: Users },
          { id: 'ARENAS' as const, label: 'BATTLE ARENAS', icon: Map },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                soundManager.playUiMove();
                setActiveTab(tab.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-pixel text-[10px] border transition-colors ${
                active
                  ? 'bg-amber-500 text-slate-950 border-yellow-300 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <main className="relative z-20 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y max-w-6xl mx-auto w-full pb-6 custom-scrollbar">
        {activeTab === 'OGGY' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-pixel text-sm text-sky-300">OGGY — MASTER PIXEL ART SPRITE SHEET</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Uploaded original 6-row sprite sheet driving Oggy&apos;s idle, walk, sprint, jump, punch, slap, kick, block, hurt, knockdown, cyclone special, victory, and defeat poses.
                </p>
              </div>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/oggy/oggy_spritesheet.png"
                alt="Oggy Master Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'BUSTER' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-orange-400">BOB — ALLEY BRUISER SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Cleaned transparent pixel-art sprite sheet for heavyweight bulldog BOB: idle guard, boxing walk, dash rush, piston punch, devastating uppercut, jump, hurt, and victory poses.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/buster/buster_spritesheet.png"
                alt="BOB Cleaned Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated rounded"
              />
            </div>
          </div>
        )}

        {activeTab === 'HEROBRINE' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-purple-400">PHANTOM KNIGHT — HOODED RUNE BLADE SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Crisp pixel-art sprite sheet for Phantom Knight: idle stance, walk &amp; jump, Amethyst Slash (Power 1), Phantom Lance Thrust (Power 2), hurt recoil, knockdown, and victory.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/herobrine/herobrine_spritesheet.png"
                alt="Phantom Knight Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'IMPOSTOR' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-red-400">CRIMSON VIPER — VISOR BIO-HUNTER SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Crisp pixel-art sprite sheet for Crimson Viper: stealth crouch idle, walk &amp; leap, Plasma Claw Rip (Power 1), Crimson Whip Lance (Power 2), knockdown, and victory.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/impostor/impostor_spritesheet.png"
                alt="Crimson Viper Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'LION' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-yellow-400">SHERU — GOLDEN MONARCH SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Cleaned transparent sprite sheet featuring the white-suited monarch with his gem-inlaid Golden Gauntlet: Regal Idle, Walk Forward/Backward, 5-frame Jump Arc, Midas Strike (Power 1), and Golden Upper-Cut (Power 2).
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/lion/lion_spritesheet.png"
                alt="SHERU Cleaned Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'NINJA' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-red-400">SHADOW NINJA — CRIMSON SHINOBI SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Cleaned transparent 5-row sprite sheet extracted for stealth idle, shinobi dash walk, agile jump &amp; landing, Crimson Katana Slash (Power 1), and Iron Shinobi Fist (Power 2).
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/ninja/ninja_spritesheet.png"
                alt="Shadow Ninja Cleaned Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'BRAWLER' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-amber-400">KENJI — FOREST BRAWLER SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Cleaned transparent 3-row sprite sheet featuring Kenji&apos;s fighting stance, walk &amp; sprint, guard, straight jab, Heavy Log Smash, crouch, dragon uppercut, flying kick, and dust landing.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/brawler/brawler_spritesheet.png"
                alt="Kenji Cleaned Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'MARIO' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-red-400">GOLD KNUCKLE — GOGGLED SKY BRAWLER SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Crisp pixel-art sprite sheet for Gold Knuckle: jacket idle guard, walk &amp; jump, Brass Knuckle Jab (Power 1), Meteor Uppercut (Power 2), knockdown, and victory.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/mario/mario_spritesheet.png"
                alt="Gold Knuckle Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'SONIC' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-blue-400">VOLT DASH — ELECTRIC SCARF SPRINTER SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Crisp pixel-art sprite sheet for Volt Dash: cyber sprinter idle, walk &amp; jump, Thunder Blitz Punch (Power 1), Spark Tornado Kick (Power 2), knockdown, and victory.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/sonic/sonic_spritesheet.png"
                alt="Volt Dash Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'HERO_A' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-cyan-400">CYBER RANGER — WHITE-ARMOR PLASMA ACE SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Crisp pixel-art sprite sheet for Cyber Ranger: orbital armor idle, walk &amp; leap, Cyan Plasma Slash (Power 1), Jet Vortex Kick (Power 2), knockdown, and victory.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/hero_a/hero_a_spritesheet.png"
                alt="Cyber Ranger Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'DEATH_WOLF' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-red-400">DEATH WOLF — CRIMSON SCYTHE REAPER SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Cleaned transparent sprite sheet extracted for Death Wolf: idle stance, walk &amp; shadow dash, jump arcs, 4-frame Spinning Reaper (Power 1), 2-frame Phantom Slice (Power 2), and recoil stagger.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/death_wolf/death_wolf_spritesheet.png"
                alt="Death Wolf Cleaned Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'HELLFIRE' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-orange-400">MAGMA KNIGHT — HORNED LAVA GUARDIAN SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Crisp pixel-art sprite sheet for Magma Knight: obsidian armor idle, walk &amp; jump, Magma Claw Sweep (Power 1), Horned Lava Chain Whip (Power 2), guard, hurt, and victory.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/hellfire/hellfire_spritesheet.png"
                alt="Magma Knight Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'AKITA' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-amber-400">KUTTIYA — FLAME RONIN SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Cleaned transparent sprite sheet extracted for KUTTIYA: ronin stance, walk &amp; dash, agile jump &amp; landing, Swift Katana Slash (Power 1), Flame Spin vortex (Power 2), and stun recoil.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/akita/akita_spritesheet.png"
                alt="KUTTIYA Cleaned Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'NEON_VOID' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-pixel text-sm text-purple-400">NEON VOID — OWNER EXCLUSIVE SPRITE SHEET</h3>
              <p className="text-xs text-slate-400 mt-1">
                Cleaned transparent sprite sheet for Owner-exclusive fighter NEON VOID: cosmic Idle, Walk (5), Run (4), Jump (5), Fall (3), Void Slash (Power 1), Void Blast (Power 2), Hurt, and Death frames.
              </p>
            </div>
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex justify-center">
              <img
                src="/assets/neon_void/neon_void_spritesheet.png"
                alt="NEON VOID Cleaned Sprite Sheet"
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain pixelated"
              />
            </div>
          </div>
        )}

        {activeTab === 'FIGHTERS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CHARACTER_LIST.map(char => (
              <div
                key={char.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex gap-4 items-start"
              >
                <img
                  src={char.portraitUrl}
                  alt={char.name}
                  referrerPolicy="no-referrer"
                  className="w-28 h-28 rounded-lg border-2 border-amber-500/80 object-contain pixelated shrink-0 bg-slate-950"
                />
                <div className="space-y-2">
                  <h3 className="font-pixel text-base text-yellow-300">{char.name}</h3>
                  <div className="text-xs text-amber-300 font-semibold">{char.title} · {char.country}</div>
                  <p className="text-xs text-slate-300 leading-relaxed">{char.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ARENAS' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ARENA_LIST.map(arena => (
              <div
                key={arena.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2"
              >
                <img
                  src={arena.imageUrl}
                  alt={arena.name}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-video object-cover pixelated rounded border border-slate-700"
                />
                <div className="font-pixel text-xs text-yellow-300">{arena.name}</div>
                <div className="text-[11px] text-slate-400">{arena.description}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
