import { 
  FighterState, 
  Projectile, 
  HitSpark, 
  Particle, 
  CharacterId, 
  ArenaDef, 
  ArenaId,
  GameSettings, 
  GameMode, 
  ActionState,
  VCoin,
  InfinityStageSegment,
  InfinityAchievementId,
  FloatingPopup,
  OnlinePlayerInput,
  OnlineEngineSnapshot,
  OnlineFighterSnapshot
} from '../types/game';
import { CHARACTERS, CHARACTER_LIST, applyCharacterCoinBonus } from '../data/characters';
import { ARENAS, ARENA_LIST } from '../data/arenas';
import {
  INFINITY_ACHIEVEMENTS,
  loadUnlockedAchievements,
  saveUnlockedAchievements,
  loadTotalVCoins,
  saveTotalVCoins,
  loadTotalXP,
  addTotalXP,
} from '../data/achievements';
import { soundManager } from '../audio/soundManager';
import { spriteRenderer } from './spriteRenderer';

export interface AttackBox {
  x: number;
  y: number;
  w: number;
  h: number;
  damage: number;
  hitStun: number;
  blockStun: number;
  pushback: number;
  isKnockdown: boolean;
  type: 'punch' | 'heavy_punch' | 'kick' | 'heavy_kick' | 'special' | 'super';
}

export class GameEngine {
  public p1: FighterState;
  public p2: FighterState;
  public projectiles: Projectile[] = [];
  public hitSparks: HitSpark[] = [];
  public particles: Particle[] = [];
  public vCoins: VCoin[] = [];
  public floatingPopups: FloatingPopup[] = [];
  
  public arena: ArenaDef;
  public settings: GameSettings;
  public mode: GameMode;

  // Infinity Mode State
  public infinitySegments: InfinityStageSegment[] = [];
  public infinityZoneIndex: number = 0;
  public infinityDefeatedCount: number = 0;
  public infinityRunCoins: number = 0;
  public infinityTotalCoins: number = 0;
  public infinityRunXP: number = 0;
  public infinityTotalXP: number = 0;
  public infinityZoneCleared: boolean = false;
  public infinityEnemyActive: boolean = true;
  public infinityBannerTimer: number = 0;
  public infinityAchievementsUnlocked: Set<InfinityAchievementId> = new Set();
  public infinityPendingToasts: InfinityAchievementId[] = [];
  private infinityCharQueue: CharacterId[] = [];
  private infinityArenaCycle: ArenaId[] = [];
  private readonly infinitySegmentWidth = 1040;
  private nextCoinId: number = 1;
  private nextPopupId: number = 1;
  private infinityKoWaitTimer: number = 0;

  // Round & Match State
  public roundNumber: number = 1;
  public roundTimeRemaining: number = 99;
  public roundTimerAcc: number = 0;
  public matchState: 'INTRO' | 'FIGHT' | 'ROUND_OVER' | 'MATCH_OVER' | 'PAUSED' = 'INTRO';
  public introTimer: number = 2.4; // 2.4 seconds for "ROUND 1 ... FIGHT!"
  public roundOverTimer: number = 0;
  public roundAnnounceText: string = 'ROUND 1';
  public winnerId: 'p1' | 'p2' | 'DRAW' | null = null;
  public matchWinnerId: 'p1' | 'p2' | null = null;

  // Camera & FX State
  public cameraX: number = 500;
  public cameraY: number = 270;
  public cameraZoom: number = 1.05;
  public viewportAspect: number = 16 / 9;
  public viewportW: number = 960;
  public viewportH: number = 540;
  public screenShake: number = 0;
  public hitStopTimer: number = 0; // Freeze frame impact duration
  public static readonly COMBO_WINDOW_FRAMES = 75;
  public static readonly COMBO_WINDOW_SEC = GameEngine.COMBO_WINDOW_FRAMES / 60;

  // Input states
  private p1HeldKeys: Set<string> = new Set();
  private p1JustPressed: Set<string> = new Set();
  private p2HeldKeys: Set<string> = new Set();
  private p2JustPressed: Set<string> = new Set();
  private p1TouchDir: -1 | 0 | 1 = 0;
  private p1TouchSprint: boolean = false;
  private p1TouchCrouch: boolean = false;

  // AI State for P2 (when in ARCADE or TRAINING mode)
  private aiDecisionTimer: number = 0;
  private aiCurrentIntent: 'idle' | 'advance' | 'run' | 'retreat' | 'jump_in' | 'attack' | 'block' | 'special' = 'idle';
  private aiAttackCooldown: number = 0;
  private aiBlockTimer: number = 0;
  private aiBlockCooldown: number = 0;
  private aiLastAttack: 'power_1' | 'power_2' | 'super' | null = null;
  private aiConsecutiveSameAttack: number = 0;
  private simTimeMs: number = 0;
  private onlineTick: number = 0;
  public onlineMatchFormat: 'play' | 'infinity' = 'play';
  public onlineRoundsToWin: number = 2;
  public onlineRoundTimerSec: number = 99;
  public onlineP1ZoneCoins: number = 0;
  public onlineP2ZoneCoins: number = 0;
  public onlineAllies: FighterState[] = [];
  public onlineEnemies: FighterState[] = [];
  public onlineCanReviveNow: boolean = false;
  public onlineInfinityZone: number = 1;
  public onlineInfinityDefeated: number = 0;
  public onlineInfinityZoneCleared: boolean = false;

  private nextProjId: number = 1;

  constructor(
    p1Char: CharacterId,
    p2Char: CharacterId,
    arena: ArenaDef,
    settings: GameSettings,
    mode: GameMode = 'ARCADE'
  ) {
    this.arena = arena;
    this.settings = settings;
    this.mode = mode;
    this.roundTimeRemaining = settings.roundTimerSec;

    if (mode === 'INFINITY') {
      this.infinityAchievementsUnlocked = new Set(loadUnlockedAchievements());
      this.infinityTotalCoins = loadTotalVCoins();
      this.infinityTotalXP = loadTotalXP();
      this.initInfinitySegments();
      this.arena = ARENAS[this.infinitySegments[0].arenaId];
      this.refillInfinityCharQueue(p1Char);
      const firstOpp = this.infinityCharQueue.shift() || p2Char;
      this.p1 = this.createFighter('p1', p1Char, 220, this.arena.groundY, 1);
      this.p2 = this.createFighter('p2', firstOpp, 780, this.arena.groundY, -1);
      this.cameraX = 500;
      this.spawnPathVCoins(this.infinitySegments[0].startX, this.infinitySegments[0].endX);
      this.roundTimeRemaining = 0;
      this.matchState = 'INTRO';
      this.introTimer = 1.6;
      this.roundAnnounceText = `ZONE 1 · ${this.arena.name}`;
      soundManager.playAnnouncer('ROUND_1');
    } else {
      this.p1 = this.createFighter('p1', p1Char, 340, arena.groundY, 1);
      this.p2 = this.createFighter('p2', p2Char, 660, arena.groundY, -1);
      this.startRound(1);
    }
  }

  private shuffleArray<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  private initInfinitySegments() {
    this.infinitySegments = [];
    // Include all 25 unique arenas in an exact repeatable 25-map cycle (Zone 26 returns to Map #1 forever!)
    this.infinityArenaCycle = this.shuffleArray(ARENA_LIST.map(a => a.id));
    this.ensureInfinitySegments(2);
  }

  private ensureInfinitySegments(upToIndex: number) {
    const cycleLen = Math.max(1, this.infinityArenaCycle.length);
    while (this.infinitySegments.length <= upToIndex) {
      const idx = this.infinitySegments.length;
      const arenaId = this.infinityArenaCycle[idx % cycleLen];
      const startX = idx * this.infinitySegmentWidth;
      this.infinitySegments.push({
        index: idx,
        arenaId,
        startX,
        endX: startX + this.infinitySegmentWidth,
      });
    }
  }

  private spawnFloatingPopup(x: number, y: number, text: string, color: string) {
    this.floatingPopups.push({
      id: this.nextPopupId++,
      x,
      y,
      text,
      color,
      life: 0,
      maxLife: 1.5,
    });
  }

  private refillInfinityCharQueue(playerCharId: CharacterId) {
    const others = CHARACTER_LIST.filter(c => c.id !== playerCharId && !c.ownerOnly).map(c => c.id);
    this.infinityCharQueue = this.shuffleArray(others);
  }

  private spawnPathVCoins(segStart: number, segEnd: number) {
    const span = segEnd - segStart;
    const count = 5;
    for (let i = 0; i < count; i++) {
      const frac = 0.28 + i * 0.13;
      const x = segStart + span * frac;
      const airborne = i % 2 === 1;
      this.vCoins.push({
        id: this.nextCoinId++,
        x,
        y: airborne ? this.arena.groundY - 115 : this.arena.groundY - 34,
        vx: 0,
        vy: 0,
        value: 1,
        bobOffset: Math.random() * Math.PI * 2,
        collected: false,
      });
    }
  }

  private unlockAchievement(id: InfinityAchievementId) {
    if (this.mode !== 'INFINITY' || this.infinityAchievementsUnlocked.has(id)) return;
    this.infinityAchievementsUnlocked.add(id);
    saveUnlockedAchievements(Array.from(this.infinityAchievementsUnlocked));
    this.infinityPendingToasts.push(id);
    const def = INFINITY_ACHIEVEMENTS.find(a => a.id === id);
    if (def) {
      this.infinityRunCoins += def.rewardCoins;
      this.infinityTotalCoins += def.rewardCoins;
      saveTotalVCoins(this.infinityTotalCoins);
    }
    soundManager.playAchievementUnlock();
  }

  private createFighter(id: 'p1' | 'p2', charId: CharacterId, x: number, y: number, facing: 1 | -1): FighterState {
    const def = CHARACTERS[charId];
    return {
      id,
      characterId: charId,
      name: def.name,
      x,
      y,
      vx: 0,
      vy: 0,
      width: 50,
      height: 90,
      facing,
      health: 200,
      maxHealth: 200,
      damageGhost: 200,
      superMeter: 0, // Starts at 0; charges strictly from hits landed or taken (~8-10 hits)
      maxSuperMeter: 100,
      action: 'idle',
      frameIndex: 0,
      frameTimer: 0,
      animSpeed: 0.075,
      isGrounded: true,
      isBlocking: false,
      isInvincible: false,
      hitStun: 0,
      blockStun: 0,
      comboHits: 0,
      comboDamage: 0,
      comboTimer: 0,
      wins: 0,
      hasFiredProjectileInAction: false,
      hasHitInCurrentAction: false,
      overdriveArmed: false,
      attackCooldown: 0,
      lastAttackAction: null,
      sameAttackStreak: 0,
      spamResetTimer: 0,
    };
  }

  public startRound(roundNum: number) {
    this.roundNumber = roundNum;
    this.roundTimeRemaining = this.settings.roundTimerSec;
    this.roundTimerAcc = 0;
    this.matchState = 'INTRO';
    this.introTimer = 2.4;
    this.roundOverTimer = 0;
    this.winnerId = null;

    this.p1.x = 340;
    this.p1.y = this.arena.groundY;
    this.p1.vx = 0;
    this.p1.vy = 0;
    this.p1.facing = 1;
    this.p1.health = this.p1.maxHealth;
    this.p1.damageGhost = this.p1.maxHealth;
    this.p1.action = 'idle';
    this.p1.hitStun = 0;
    this.p1.blockStun = 0;
    this.p1.comboHits = 0;
    this.p1.comboDamage = 0;
    this.p1.comboTimer = 0;
    this.p1.overdriveArmed = false;

    this.p2.x = 660;
    this.p2.y = this.arena.groundY;
    this.p2.vx = 0;
    this.p2.vy = 0;
    this.p2.facing = -1;
    this.p2.health = this.p2.maxHealth;
    this.p2.damageGhost = this.p2.maxHealth;
    this.p2.action = 'idle';
    this.p2.hitStun = 0;
    this.p2.blockStun = 0;
    this.p2.comboHits = 0;
    this.p2.comboDamage = 0;
    this.p2.comboTimer = 0;
    this.p2.overdriveArmed = false;
    this.p1.hasHitInCurrentAction = false;
    this.p2.hasHitInCurrentAction = false;
    this.p1.attackCooldown = 0;
    this.p2.attackCooldown = 0;
    this.p1.lastAttackAction = null;
    this.p2.lastAttackAction = null;
    this.p1.sameAttackStreak = 0;
    this.p2.sameAttackStreak = 0;
    this.p1.spamResetTimer = 0;
    this.p2.spamResetTimer = 0;

    this.aiDecisionTimer = 0.25;
    this.aiCurrentIntent = 'idle';
    this.aiAttackCooldown = 0.4;
    this.aiBlockTimer = 0;
    this.aiBlockCooldown = 0;
    this.aiLastAttack = null;
    this.aiConsecutiveSameAttack = 0;

    this.projectiles = [];
    this.hitSparks = [];

    const isFinalRound = this.p1.wins === this.settings.roundsToWin - 1 && this.p2.wins === this.settings.roundsToWin - 1;
    this.roundAnnounceText = isFinalRound ? 'FINAL ROUND' : `ROUND ${roundNum}`;
    
    soundManager.playAnnouncer(isFinalRound ? 'FINAL_ROUND' : roundNum === 1 ? 'ROUND_1' : 'ROUND_2');
  }

  // --- INPUT HANDLING ---

  private isActionBusy(f: FighterState): boolean {
    return (
      f.hitStun > 0 ||
      f.blockStun > 0 ||
      f.action === 'power_1' ||
      f.action === 'power_2' ||
      f.action === 'light_punch' ||
      f.action === 'heavy_punch' ||
      f.action === 'light_kick' ||
      f.action === 'heavy_kick' ||
      f.action === 'special_1' ||
      f.action === 'special_2' ||
      f.action === 'super' ||
      f.action === 'hurt' ||
      f.action === 'heavy_hurt' ||
      f.action === 'knockdown' ||
      f.action === 'getup' ||
      f.action === 'victory' ||
      f.action === 'defeat'
    );
  }

  public handleMouseDown(button: number): boolean {
    if (this.matchState !== 'FIGHT' || this.isActionBusy(this.p1)) return false;
    // 0 = Left click, 2 = Right click
    if (button === 0) {
      // Left click = Light attack / Combo attack
      this.p1JustPressed.add('mouse_left');
      this.p1HeldKeys.add('mouse_left');
      return true;
    } else if (button === 2) {
      // Right click = Heavy attack / Special power move
      this.p1JustPressed.add('mouse_right');
      this.p1HeldKeys.add('mouse_right');
      return true;
    }
    return false;
  }

  public handleMouseUp(button: number) {
    if (button === 0) {
      this.p1HeldKeys.delete('mouse_left');
    } else if (button === 2) {
      this.p1HeldKeys.delete('mouse_right');
    }
  }

  public handleKeyDown(key: string) {
    const k = key.toLowerCase();
    if (!this.p1HeldKeys.has(k)) {
      this.p1JustPressed.add(k);
    }
    this.p1HeldKeys.add(k);

    if (this.mode === 'VERSUS') {
      if (!this.p2HeldKeys.has(k)) {
        this.p2JustPressed.add(k);
      }
      this.p2HeldKeys.add(k);
    }
  }

  public handleKeyUp(key: string) {
    const k = key.toLowerCase();
    this.p1HeldKeys.delete(k);
    if (this.mode === 'VERSUS') {
      this.p2HeldKeys.delete(k);
    }
  }

  public setTouchJoystick(dir: -1 | 0 | 1, sprint: boolean, crouch: boolean) {
    this.p1TouchDir = dir;
    this.p1TouchSprint = sprint;
    this.p1TouchCrouch = crouch;
  }

  public releaseAllKeys() {
    this.p1HeldKeys.clear();
    this.p1JustPressed.clear();
    this.p2HeldKeys.clear();
    this.p2JustPressed.clear();
    this.p1TouchDir = 0;
    this.p1TouchSprint = false;
    this.p1TouchCrouch = false;
  }

  public activateOverdrive(player: 'p1' | 'p2'): boolean {
    const f = player === 'p1' ? this.p1 : this.p2;
    if (this.matchState !== 'FIGHT' || f.superMeter < f.maxSuperMeter || f.overdriveArmed) return false;
    f.superMeter = 0;
    f.overdriveArmed = true;
    this.hitStopTimer = 0.14;
    this.screenShake = 5;
    soundManager.playSuperFlash();

    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const spd = 2.2 + Math.random() * 2.5;
      this.particles.push({
        x: f.x,
        y: f.y - 75,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 4 + Math.random() * 3,
        color: i % 2 === 0 ? '#facc15' : '#38bdf8',
        life: 0,
        maxLife: 0.45,
        alpha: 1,
      });
    }
    return true;
  }

  public triggerAction(player: 'p1' | 'p2', action: ActionState): boolean {
    const f = player === 'p1' ? this.p1 : this.p2;
    if (this.matchState !== 'FIGHT' || this.isActionBusy(f)) return false;

    if (action === 'super') {
      return this.activateOverdrive(player);
    }

    if (action === 'power_1' || action === 'power_2') {
      if ((f.attackCooldown ?? 0) > 0) return false;
      if (f.lastAttackAction === action) {
        f.sameAttackStreak = (f.sameAttackStreak ?? 0) + 1;
      } else {
        f.lastAttackAction = action;
        f.sameAttackStreak = 1;
      }
      f.spamResetTimer = 1.15;
      f.attackCooldown = action === 'power_1' ? 0.24 : 0.38;
    }

    f.action = action;
    f.frameIndex = 0;
    f.frameTimer = 0;
    f.hasFiredProjectileInAction = false;
    f.hasHitInCurrentAction = false;
    f.isBlocking = false;
    if (f.isGrounded) f.vx = 0;

    if (action === 'power_1') {
      if (
        f.characterId === 'ninja' ||
        f.characterId === 'impostor' ||
        f.characterId === 'herobrine' ||
        f.characterId === 'death_wolf' ||
        f.characterId === 'akita'
      ) {
        soundManager.playHit(false, 'slash');
      } else if (f.characterId === 'hellfire') {
        soundManager.playHit(false, 'fire');
      } else if (f.characterId === 'oggy' || f.characterId === 'mario' || f.characterId === 'sonic' || f.characterId === 'hero_a') {
        soundManager.playPunch(false);
      } else {
        soundManager.playPunch(true);
      }
    } else if (action === 'power_2') {
      if (
        f.characterId === 'oggy' ||
        f.characterId === 'impostor' ||
        f.characterId === 'herobrine' ||
        f.characterId === 'hero_a' ||
        f.characterId === 'death_wolf'
      ) {
        soundManager.playHit(true, 'slash');
      } else if (f.characterId === 'sonic') {
        soundManager.playKick(true);
      } else if (f.characterId === 'ninja' || f.characterId === 'mario') {
        soundManager.playPunch(true);
      } else {
        soundManager.playHit(true, 'fire');
      }
    } else if (action.includes('punch')) {
      soundManager.playPunch(action === 'heavy_punch');
    } else if (action.includes('kick')) {
      soundManager.playKick(action === 'heavy_kick');
    }
    return true;
  }

  // --- MAIN SIMULATION UPDATE (60 FPS) ---

  public update(dt: number, nowMs?: number) {
    // Clamp delta time to avoid physics explosion on tab blur
    const delta = Math.min(dt, 0.05);
    this.simTimeMs = nowMs !== undefined ? nowMs : this.simTimeMs + delta * 1000;
    if (this.mode === 'ONLINE') {
      this.onlineTick++;
    }

    // Hitstop freeze frame handling
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= delta;
      return;
    }

    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - delta * 25);
    }

    // Smooth damage ghost health bar decay
    this.updateDamageGhosts(delta);

    // State machine updates
    if (this.matchState === 'INTRO') {
      this.updateIntro(delta);
    } else if (this.matchState === 'FIGHT') {
      this.updateFight(delta);
    } else if (this.matchState === 'ROUND_OVER') {
      this.updateRoundOver(delta);
    }

    // Always update visual particles, projectiles, floating popups, and Infinity V-Coins
    this.updateParticles(delta);
    this.updateProjectiles(delta);
    this.updateFloatingPopups(delta);
    if (this.mode === 'INFINITY') {
      this.updateVCoins(delta);
      if (this.infinityBannerTimer > 0) {
        this.infinityBannerTimer -= delta;
        if (this.infinityBannerTimer <= 0 && this.matchState === 'FIGHT' && !this.infinityKoWaitTimer) {
          this.roundAnnounceText = '';
        }
      }
    }

    // Update dynamic camera position
    this.updateCamera();

    // Clear edge-triggered inputs at end of frame
    this.p1JustPressed.clear();
    this.p2JustPressed.clear();
  }

  private updateFloatingPopups(dt: number) {
    for (let i = this.floatingPopups.length - 1; i >= 0; i--) {
      const pop = this.floatingPopups[i];
      pop.life += dt;
      pop.y -= 28 * dt;
      if (pop.life >= pop.maxLife) {
        this.floatingPopups.splice(i, 1);
      }
    }
  }

  private updateDamageGhosts(dt: number) {
    const decaySpeed = 35 * dt;
    if (this.p1.damageGhost > this.p1.health) {
      this.p1.damageGhost = Math.max(this.p1.health, this.p1.damageGhost - decaySpeed);
    }
    if (this.p2.damageGhost > this.p2.health) {
      this.p2.damageGhost = Math.max(this.p2.health, this.p2.damageGhost - decaySpeed);
    }
  }

  private updateIntro(dt: number) {
    this.introTimer -= dt;
    if (this.introTimer <= 0.85 && this.roundAnnounceText !== 'FIGHT!') {
      this.roundAnnounceText = 'FIGHT!';
      soundManager.playAnnouncer('FIGHT');
    }
    if (this.introTimer <= 0) {
      this.matchState = 'FIGHT';
      this.roundAnnounceText = '';
    }
  }

  private updateFight(dt: number) {
    // Timer Countdown (Standard modes only; Infinity is untimed endless adventure)
    if (this.mode !== 'INFINITY' && this.mode !== 'TRAINING' && this.settings.roundTimerSec > 0) {
      this.roundTimerAcc += dt;
      if (this.roundTimerAcc >= 1.0) {
        this.roundTimerAcc -= 1.0;
        this.roundTimeRemaining = Math.max(0, this.roundTimeRemaining - 1);
        if (this.roundTimeRemaining === 0) {
          this.handleTimeUp();
          return;
        }
      }
    }

    // Combo frame-window decay (75 frames / 1.25s between unblocked hits)
    this.updateComboTimers(dt);

    // Poll Player 1 Inputs
    this.processPlayerInputs(this.p1, this.p1HeldKeys, this.p1JustPressed, this.p2);

    // Poll Player 2 Inputs or CPU AI (In Infinity when zone cleared, challenger stays defeated until advancing!)
    if (this.mode === 'VERSUS' || this.mode === 'ONLINE') {
      this.processPlayerInputs(this.p2, this.p2HeldKeys, this.p2JustPressed, this.p1);
    } else if (this.mode !== 'INFINITY' || (this.infinityEnemyActive && this.infinityKoWaitTimer <= 0)) {
      this.processCpuAi(this.p2, this.p1, dt);
    }

    // Physics & Animations
    this.updateFighterPhysics(this.p1, this.p2, dt);
    if (this.mode !== 'INFINITY' || this.infinityEnemyActive) {
      this.updateFighterPhysics(this.p2, this.p1, dt);
      this.updateFacing();
      if (this.infinityKoWaitTimer <= 0) {
        this.checkCombatCollisions();
      }
    } else {
      this.updateFacing();
    }

    // Infinity Mode: Handle Zone Challenger Defeat, Post-KO Advance & Infinite Map Expansion
    if (this.mode === 'INFINITY') {
      if (this.p1.comboHits >= 5) {
        this.unlockAchievement('combo_king');
      }

      if (this.p1.health <= 0) {
        this.handleKo();
        return;
      }

      if (this.infinityEnemyActive && this.p2.health <= 0 && this.infinityKoWaitTimer <= 0) {
        this.handleInfinityEnemyDefeated();
      }

      if (this.infinityKoWaitTimer > 0) {
        this.infinityKoWaitTimer -= dt;
        if (this.infinityKoWaitTimer <= 0) {
          this.infinityEnemyActive = false;
          this.infinityZoneCleared = true;
          this.roundAnnounceText = '';
        }
      }

      if (this.infinityZoneCleared) {
        const nextSeg = this.infinitySegments[this.infinityZoneIndex + 1];
        if (nextSeg && this.p1.x >= nextSeg.startX + 125) {
          this.advanceInfinityZone();
        }
      }
      return;
    }

    // Standard Mode KO Check
    if (this.p1.health <= 0 || this.p2.health <= 0) {
      this.handleKo();
    }
  }

  private handleInfinityEnemyDefeated() {
    this.infinityDefeatedCount++;
    this.p1.wins = this.infinityDefeatedCount;
    this.p2.action = 'defeat';
    this.p2.vx = -this.p2.facing * 5;
    this.p2.vy = -7;
    this.p2.isGrounded = false;
    this.screenShake = 9;
    this.hitStopTimer = 0.25;
    this.infinityKoWaitTimer = 0.95;
    this.roundAnnounceText = 'K.O.!';
    soundManager.playAnnouncer('KO');

    // Restore HALF HP (+100 HP) & grant +100 XP extra immediately on defeating the zone's NPC!
    const halfHpHeal = Math.round(this.p1.maxHealth * 0.5);
    this.p1.health = Math.min(this.p1.maxHealth, this.p1.health + halfHpHeal);
    this.p1.damageGhost = Math.max(this.p1.damageGhost, this.p1.health);
    this.infinityRunXP += 100;
    this.infinityTotalXP = addTotalXP(100);
    soundManager.playHealAndXp();
    this.spawnFloatingPopup(this.p1.x - 16, this.p1.y - 115, `+${halfHpHeal} HP`, '#4ade80');
    this.spawnFloatingPopup(this.p1.x + 20, this.p1.y - 142, '+100 XP', '#38bdf8');

    // Burst 8 Black & White V-Coins from defeated challenger
    for (let i = 0; i < 8; i++) {
      this.vCoins.push({
        id: this.nextCoinId++,
        x: this.p2.x + (Math.random() - 0.5) * 32,
        y: this.p2.y - 60,
        vx: -1.5 + Math.random() * 5.8,
        vy: -5.5 - Math.random() * 5.5,
        value: 1,
        bobOffset: Math.random() * Math.PI * 2,
        collected: false,
      });
    }

    this.unlockAchievement('first_blood');
    if (this.infinityDefeatedCount >= 12) {
      this.unlockAchievement('roster_sweep');
    }
  }

  private advanceInfinityZone() {
    this.infinityZoneIndex++;
    this.ensureInfinitySegments(this.infinityZoneIndex + 2);
    const seg = this.infinitySegments[this.infinityZoneIndex];
    this.arena = ARENAS[seg.arenaId];

    // Prune far-behind VCoins to keep memory lean across endless runs
    this.vCoins = this.vCoins.filter(c => !c.collected && c.x >= seg.startX - 200);

    // Spawn next 1-by-1 remaining challenger endlessly
    if (this.infinityCharQueue.length === 0) {
      this.refillInfinityCharQueue(this.p1.characterId);
    }
    const nextCharId = this.infinityCharQueue.shift()!;
    const spawnX = Math.max(this.p1.x + 420, seg.startX + 760);
    const nextEnemy = this.createFighter('p2', nextCharId, Math.min(seg.endX - 110, spawnX), this.arena.groundY, -1);
    const waveBoost = Math.floor(this.infinityDefeatedCount / 12) * 35;
    nextEnemy.maxHealth = 200 + waveBoost;
    nextEnemy.health = nextEnemy.maxHealth;
    nextEnemy.damageGhost = nextEnemy.maxHealth;
    this.p2 = nextEnemy;

    this.infinityZoneCleared = false;
    this.infinityEnemyActive = true;
    this.infinityKoWaitTimer = 0;

    // Scatter fresh V-Coins on the newly expanded map
    this.spawnPathVCoins(seg.startX, seg.endX);

    const zoneNum = this.infinityZoneIndex + 1;
    if (zoneNum >= 3) this.unlockAchievement('zone_explorer_3');
    if (zoneNum >= 6) this.unlockAchievement('world_traveler_6');

    // Keep fight live without jarring input freeze while displaying smooth zone banner!
    this.matchState = 'FIGHT';
    this.infinityBannerTimer = 1.65;
    this.roundAnnounceText = `ZONE ${zoneNum} · ${this.arena.name}`;
    soundManager.playAnnouncer('ROUND_2');
  }

  private updateVCoins(dt: number) {
    const step = dt * 60;
    for (let i = this.vCoins.length - 1; i >= 0; i--) {
      const c = this.vCoins[i];
      if (c.collected) {
        this.vCoins.splice(i, 1);
        continue;
      }
      if (c.vx !== 0 || c.vy !== 0) {
        c.x += c.vx * step;
        c.y += c.vy * step;
        c.vy += 0.45 * step;
        c.vx *= Math.pow(0.94, step);
        const floorY = this.arena.groundY - 30;
        if (c.y >= floorY) {
          c.y = floorY;
          if (Math.abs(c.vy) > 1.8) {
            c.vy = -c.vy * 0.42;
          } else {
            c.vy = 0;
            c.vx = 0;
          }
        }
      }

      // Check pickup by Player 1
      const dx = Math.abs(this.p1.x - c.x);
      const dy = Math.abs((this.p1.y - 68) - c.y);
      if (dx < 52 && dy < 76) {
        c.collected = true;
        const earned = applyCharacterCoinBonus(c.value, this.p1.characterId);
        this.infinityRunCoins += earned;
        this.infinityTotalCoins += earned;
        saveTotalVCoins(this.infinityTotalCoins);
        soundManager.playCoinPickup();
        this.spawnHitSpark(c.x, c.y, 'block');
        if (this.infinityTotalCoins >= 25) this.unlockAchievement('coin_collector_25');
        if (this.infinityTotalCoins >= 100) this.unlockAchievement('coin_tycoon_100');
      }
    }
  }

  private updateRoundOver(dt: number) {
    this.roundOverTimer += dt;
    const waitTime = this.mode === 'INFINITY' ? 2.1 : 3.0;
    if (this.roundOverTimer >= waitTime) {
      if (this.mode === 'INFINITY') {
        this.matchState = 'MATCH_OVER';
        this.matchWinnerId = 'p2';
        return;
      }
      const winsNeeded = this.settings.roundsToWin;
      if (this.p1.wins >= winsNeeded || this.p2.wins >= winsNeeded) {
        this.matchState = 'MATCH_OVER';
        this.matchWinnerId = this.p1.wins >= winsNeeded ? 'p1' : 'p2';
      } else {
        this.startRound(this.roundNumber + 1);
      }
    }
  }

  private handleTimeUp() {
    this.matchState = 'ROUND_OVER';
    soundManager.playAnnouncer('TIME_UP');
    this.roundAnnounceText = 'TIME UP!';
    if (this.p1.health > this.p2.health) {
      this.p1.wins++;
      this.winnerId = 'p1';
    } else if (this.p2.health > this.p1.health) {
      this.p2.wins++;
      this.winnerId = 'p2';
    } else {
      this.winnerId = 'DRAW';
    }
  }

  private handleKo() {
    this.matchState = 'ROUND_OVER';
    this.screenShake = 10;
    this.hitStopTimer = 0.5;
    soundManager.playAnnouncer('KO');
    this.roundAnnounceText = 'K.O.!';

    if (this.p1.health <= 0 && this.p2.health <= 0) {
      this.winnerId = 'DRAW';
    } else if (this.p1.health <= 0) {
      this.p2.wins++;
      this.winnerId = 'p2';
      this.p1.action = 'defeat';
      this.p2.action = 'victory';
      if (this.p2.health >= this.p2.maxHealth) {
        setTimeout(() => soundManager.playAnnouncer('PERFECT'), 1200);
      }
    } else {
      this.p1.wins++;
      this.winnerId = 'p1';
      this.p2.action = 'defeat';
      this.p1.action = 'victory';
      if (this.p1.health >= this.p1.maxHealth) {
        setTimeout(() => soundManager.playAnnouncer('PERFECT'), 1200);
      }
    }
  }

  // --- INPUT PROCESSING FOR FIGHTERS ---

  private processPlayerInputs(
    f: FighterState, 
    held: Set<string>, 
    just: Set<string>, 
    _opponent: FighterState
  ) {
    // Strictly block any new attack or movement until current attack/stun/recovery finishes
    if (this.isActionBusy(f)) return;

    // Movement keys + Mobile Touch Joystick: P1 merges touch joystick seamlessly with silent PC inputs
    const isP1 = f.id === 'p1';
    const allowArrowsForP1 = isP1 && this.mode !== 'VERSUS';
    const kLeft = isP1
      ? (held.has('a') || this.p1TouchDir === -1 || (allowArrowsForP1 && held.has('arrowleft')))
      : held.has('arrowleft');
    const kRight = isP1
      ? (held.has('d') || this.p1TouchDir === 1 || (allowArrowsForP1 && held.has('arrowright')))
      : held.has('arrowright');
    const kUp = isP1
      ? (held.has('w') || held.has(' ') || held.has('space') || (allowArrowsForP1 && held.has('arrowup')))
      : held.has('arrowup');
    const kDown = isP1
      ? (held.has('s') || this.p1TouchCrouch || (allowArrowsForP1 && held.has('arrowdown')))
      : held.has('arrowdown');
    const kRun = held.has('shift') || (isP1 && this.p1TouchSprint);

    // ONLY TWO ATTACKS: Power 1 (Left Click / J) and Power 2 (Right Click / K)
    const mouseLeft = isP1 && just.has('mouse_left');
    const mouseRight = isP1 && just.has('mouse_right');

    const kPower1 = mouseLeft || (isP1 ? just.has('j') : (just.has('1') || just.has('numpad1') || just.has('j')));
    const kPower2 = mouseRight || (isP1 ? just.has('k') : (just.has('2') || just.has('numpad2') || just.has('k')));
    
    // E (P1) / Enter or 0 (P2) = Activate 70-Damage Empowered Single Strike when bar is 100%
    const kOverdrive = isP1 ? just.has('e') : (just.has('0') || just.has('enter'));

    if (kOverdrive && f.superMeter >= f.maxSuperMeter && !f.overdriveArmed) {
      this.activateOverdrive(f.id);
    }

    // LEFT CLICK = POWER 1 (Signature Strike / Aerial Kick)
    if (kPower1) {
      this.triggerAction(f.id, 'power_1');
      return;
    }

    // RIGHT CLICK = POWER 2 (Heavy Power Technique)
    if (kPower2) {
      this.triggerAction(f.id, 'power_2');
      return;
    }

    // Guard/Shield removed: pure offensive/evasive combat
    f.isBlocking = false;

    // Snappy movement speed lookup across all 13 fighters
    const { walkSpeed, runSpeed } = this.getFighterSpeeds(f);
    const activeSpeed = kRun ? runSpeed : walkSpeed;

    // Fast, crisp Arcade Jump (Spacebar or W / Up arrow) with diagonal momentum
    if (kUp && f.isGrounded) {
      f.vy = -17.5;
      f.isGrounded = false;
      f.action = 'jump';
      if (kLeft) {
        f.vx = -activeSpeed * 0.95;
      } else if (kRight) {
        f.vx = activeSpeed * 0.95;
      } else {
        f.vx = 0;
      }
      soundManager.playJump();
      this.spawnDust(f.x, this.arena.groundY);
      return;
    }

    // Crouch (S or Down arrow)
    if (kDown && f.isGrounded) {
      f.action = 'crouch';
      f.vx = 0;
      return;
    } else if (!kDown && f.isGrounded && (f.action === 'crouch' || f.action === 'crouch_block' || f.action === 'block')) {
      f.action = 'idle';
    }

    // Horizontal Movement (A / D or Arrows - smooth forward and backward walking!)
    if (kLeft) {
      f.vx = -activeSpeed;
      if (f.isGrounded) {
        if (kRun && f.facing === -1) f.action = 'run_fwd';
        else f.action = f.facing === -1 ? 'walk_fwd' : 'walk_back';
      }
    } else if (kRight) {
      f.vx = activeSpeed;
      if (f.isGrounded) {
        if (kRun && f.facing === 1) f.action = 'run_fwd';
        else f.action = f.facing === 1 ? 'walk_fwd' : 'walk_back';
      }
    } else {
      if (f.isGrounded) {
        f.vx = 0;
        if (f.action === 'walk_fwd' || f.action === 'walk_back' || f.action === 'run_fwd' || f.action === 'block' || f.action === 'crouch_block') {
          f.action = 'idle';
        }
      }
    }
  }

  private getFighterSpeeds(f: FighterState): { walkSpeed: number; runSpeed: number } {
    const walkSpeed =
      f.characterId === 'sonic' ? 7.8
      : f.characterId === 'hero_a' ? 7.6
      : f.characterId === 'neon_void' ? 7.5
      : f.characterId === 'akita' ? 7.5
      : f.characterId === 'ninja' ? 7.4
      : f.characterId === 'death_wolf' ? 7.2
      : f.characterId === 'impostor' ? 7.2
      : f.characterId === 'mario' ? 7.0
      : f.characterId === 'oggy' ? 7.0
      : f.characterId === 'hellfire' ? 6.8
      : f.characterId === 'brawler' ? 6.8
      : f.characterId === 'herobrine' ? 6.6
      : f.characterId === 'lion' ? 6.5
      : 6.2;
    const runSpeed =
      f.characterId === 'sonic' ? 11.4
      : f.characterId === 'hero_a' ? 11.0
      : f.characterId === 'neon_void' ? 10.9
      : f.characterId === 'akita' ? 10.8
      : f.characterId === 'ninja' ? 10.6
      : f.characterId === 'death_wolf' ? 10.4
      : f.characterId === 'impostor' ? 10.2
      : f.characterId === 'mario' ? 10.0
      : f.characterId === 'oggy' ? 10.0
      : f.characterId === 'hellfire' ? 9.8
      : f.characterId === 'brawler' ? 9.8
      : f.characterId === 'herobrine' ? 9.4
      : f.characterId === 'lion' ? 9.2
      : 8.8;
    return { walkSpeed, runSpeed };
  }

  // --- CPU AI BEHAVIOR (SHARP, VARIED, NON-SPAMMING, NON-RUNNING) ---

  private getAiCooldownRange(): [number, number] {
    switch (this.settings.difficulty) {
      case 'EASY':
        return [0.72, 1.05];
      case 'NORMAL':
        return [0.36, 0.56];
      case 'HARD':
        return [0.24, 0.38];
      case 'MASTER':
        return [0.16, 0.28];
    }
  }

  private pickVariedCpuAttack(): 'attack' | 'special' {
    // Strictly alternate strikes so NPC never spams the same move repeatedly
    if (this.aiLastAttack === 'power_1' && this.aiConsecutiveSameAttack >= 1) {
      return 'special';
    }
    if (this.aiLastAttack === 'power_2' && this.aiConsecutiveSameAttack >= 1) {
      return 'attack';
    }
    return Math.random() < 0.52 ? 'attack' : 'special';
  }

  private recordCpuAttack(move: 'power_1' | 'power_2') {
    if (this.aiLastAttack === move) {
      this.aiConsecutiveSameAttack++;
    } else {
      this.aiLastAttack = move;
      this.aiConsecutiveSameAttack = 1;
    }
    const [minCd, maxCd] = this.getAiCooldownRange();
    this.aiAttackCooldown = minCd + Math.random() * (maxCd - minCd);
    // Stay engaged in neutral/pressure instead of running away after every strike
    this.aiCurrentIntent = Math.random() < 0.45 ? 'advance' : 'idle';
    this.aiDecisionTimer = 0.14 + Math.random() * 0.14;
  }

  private processCpuAi(ai: FighterState, player: FighterState, dt: number) {
    this.aiAttackCooldown = Math.max(0, this.aiAttackCooldown - dt);
    this.aiBlockCooldown = Math.max(0, this.aiBlockCooldown - dt);

    const dist = Math.abs(ai.x - player.x);
    const dirToPlayer = Math.sign(player.x - ai.x) || 1;
    const difficulty = this.settings.difficulty;
    const { walkSpeed, runSpeed } = this.getFighterSpeeds(ai);

    // Wait until current attack, hitstun, knockdown, or recovery finishes completely
    if (this.isActionBusy(ai)) return;

    // Smart Overdrive activation: arm 70-DMG boost when charged and within engagement range
    if (ai.superMeter >= ai.maxSuperMeter && !ai.overdriveArmed && dist < 185 && ai.isGrounded) {
      const armChance = difficulty === 'EASY' ? 0.45 : difficulty === 'NORMAL' ? 0.72 : 0.9;
      if (Math.random() < armChance) {
        this.activateOverdrive(ai.id);
      }
    }

    // Mid-air behavior when CPU jumped in: do at most 1 clean air kick on descent
    if (!ai.isGrounded) {
      ai.isBlocking = false;
      if (ai.vy > 0.5 && dist < 115 && this.aiAttackCooldown <= 0 && Math.random() < 0.55) {
        if (this.triggerAction(ai.id, 'power_1')) {
          this.recordCpuAttack('power_1');
        }
      }
      return;
    }

    this.aiDecisionTimer -= dt;
    if (this.aiDecisionTimer <= 0) {
      const baseInterval =
        difficulty === 'MASTER' ? 0.11
        : difficulty === 'HARD' ? 0.15
        : difficulty === 'NORMAL' ? 0.21
        : 0.36;
      this.aiDecisionTimer = baseInterval + Math.random() * 0.14;

      // 2. Punish player whiff / recovery cleanly when in strike range
      if (dist < 102 && this.aiAttackCooldown <= 0) {
        const strikeChance = difficulty === 'EASY' ? 0.6 : 0.84;
        if (Math.random() < strikeChance || ai.overdriveArmed) {
          this.aiCurrentIntent = this.pickVariedCpuAttack();
        } else if (dist < 54) {
          this.aiCurrentIntent = 'retreat';
        } else {
          this.aiCurrentIntent = 'idle';
        }
      }
      // 3. Close spacing while on attack cooldown (rare brief micro-step back, never running away)
      else if (dist < 102) {
        if (dist < 52 && Math.random() < 0.28) {
          this.aiCurrentIntent = 'retreat';
        } else if (dist > 78) {
          this.aiCurrentIntent = 'advance';
        } else {
          this.aiCurrentIntent = 'idle';
        }
      }
      // 4. Mid Range Footsies & Approach
      else if (dist < 245) {
        const roll = Math.random();
        if (roll < 0.62) this.aiCurrentIntent = 'advance';
        else if (roll < 0.82) this.aiCurrentIntent = 'run';
        else if (roll < 0.94 && this.aiAttackCooldown <= 0.12) this.aiCurrentIntent = 'jump_in';
        else this.aiCurrentIntent = 'idle';
      }
      // 5. Long Range Closing
      else {
        const roll = Math.random();
        if (roll < 0.35) this.aiCurrentIntent = 'advance';
        else if (roll < 0.88) this.aiCurrentIntent = 'run';
        else this.aiCurrentIntent = 'jump_in';
      }
    }

    // Execute current intent cleanly using fighter-appropriate movement speed
    ai.isBlocking = false;
    if (this.aiCurrentIntent === 'advance') {
      ai.vx = dirToPlayer * walkSpeed * 0.92;
      ai.action = 'walk_fwd';
    } else if (this.aiCurrentIntent === 'run') {
      ai.vx = dirToPlayer * runSpeed * 0.94;
      ai.action = 'run_fwd';
    } else if (this.aiCurrentIntent === 'retreat') {
      // Only allow short step back when safe inside arena walls
      const wallMin = this.mode === 'INFINITY' && this.infinitySegments[this.infinityZoneIndex]
        ? this.infinitySegments[this.infinityZoneIndex].startX + 120
        : 170;
      const wallMax = this.mode === 'INFINITY' && this.infinitySegments[this.infinityZoneIndex]
        ? this.infinitySegments[this.infinityZoneIndex].endX - 120
        : 830;
      if ((dirToPlayer === 1 && ai.x < wallMin) || (dirToPlayer === -1 && ai.x > wallMax)) {
        ai.vx = dirToPlayer * walkSpeed * 0.85;
        ai.action = 'walk_fwd';
      } else {
        ai.vx = -dirToPlayer * walkSpeed * 0.78;
        ai.action = 'walk_back';
      }
    } else if (this.aiCurrentIntent === 'jump_in') {
      ai.vy = -17.5;
      ai.isGrounded = false;
      ai.vx = dirToPlayer * walkSpeed * 0.98;
      ai.action = 'jump';
      soundManager.playJump();
      this.spawnDust(ai.x, this.arena.groundY);
      this.aiCurrentIntent = 'advance';
    } else if (this.aiCurrentIntent === 'attack') {
      if (this.aiAttackCooldown <= 0 && this.triggerAction(ai.id, 'power_1')) {
        this.recordCpuAttack('power_1');
      } else {
        this.aiCurrentIntent = 'advance';
      }
    } else if (this.aiCurrentIntent === 'special') {
      if (this.aiAttackCooldown <= 0 && this.triggerAction(ai.id, 'power_2')) {
        this.recordCpuAttack('power_2');
      } else {
        this.aiCurrentIntent = 'advance';
      }
    } else {
      ai.vx = 0;
      ai.action = 'idle';
    }
  }

  private getStageBounds(): { minX: number; maxX: number } {
    if (this.mode === 'INFINITY') {
      const seg = this.infinitySegments[this.infinityZoneIndex];
      const segStart = seg ? seg.startX : 0;
      const segEnd = seg ? seg.endX : this.infinitySegmentWidth;
      const minX = segStart + 70;
      // When current challenger is defeated, unlock the right wall so player marches smoothly into the next map!
      const maxX = this.infinityZoneCleared ? segEnd + 340 : segEnd - 70;
      return { minX, maxX };
    }
    return { minX: 105, maxX: 895 };
  }

  // --- FIGHTER PHYSICS & ANIMATIONS ---

  private updateFighterPhysics(f: FighterState, opponent: FighterState, dt: number) {
    // Frame-rate independent time step normalized to 60 FPS so jump height & speed are identical on 60Hz/120Hz/144Hz monitors
    const step = dt * 60;

    // Apply snappy arcade gravity
    if (!f.isGrounded) {
      f.vy += 1.13 * step;
      f.y += f.vy * step;

      if (f.y >= this.arena.groundY) {
        f.y = this.arena.groundY;
        f.vy = 0;
        f.isGrounded = true;
        soundManager.playLand();
        this.spawnDust(f.x, this.arena.groundY);
        if (f.action === 'jump') f.action = 'idle';
      }
    }

    // Apply horizontal velocity (frame-rate independent)
    f.x += f.vx * step;

    // Arena boundary limits (expands forward in Infinity Mode)
    const { minX, maxX } = this.getStageBounds();
    f.x = Math.max(minX, Math.min(maxX, f.x));

    // Fighter-to-fighter body pushing (skipped once challenger is defeated in Infinity Mode)
    const canPush = this.mode !== 'INFINITY' || (this.infinityEnemyActive && this.infinityKoWaitTimer <= 0);
    const dist = Math.abs(f.x - opponent.x);
    if (canPush && dist < 64 && f.isGrounded && opponent.isGrounded) {
      const push = (64 - dist) * 0.5;
      if (f.x < opponent.x) {
        f.x -= push;
        opponent.x += push;
      } else {
        f.x += push;
        opponent.x -= push;
      }
      // Re-clamp BOTH fighters inside stage bounds after push separation
      f.x = Math.max(minX, Math.min(maxX, f.x));
      opponent.x = Math.max(minX, Math.min(maxX, opponent.x));
    }

    // Ground friction during attacks / stun / recovery so knockback & strikes stop cleanly
    if (f.isGrounded && this.isActionBusy(f)) {
      f.vx *= Math.pow(0.82, step);
      if (Math.abs(f.vx) < 0.15) f.vx = 0;
    }

    if ((f.attackCooldown ?? 0) > 0) {
      f.attackCooldown = Math.max(0, (f.attackCooldown ?? 0) - dt);
    }
    if ((f.spamResetTimer ?? 0) > 0) {
      f.spamResetTimer = Math.max(0, (f.spamResetTimer ?? 0) - dt);
      if (f.spamResetTimer <= 0) {
        f.sameAttackStreak = 0;
        f.lastAttackAction = null;
      }
    }

    // Hitstun and Blockstun timers
    if (f.hitStun > 0) {
      f.hitStun -= dt;
      if (
        f.hitStun <= 0 &&
        f.action !== 'knockdown' &&
        f.action !== 'getup' &&
        f.action !== 'defeat' &&
        f.action !== 'victory'
      ) {
        f.action = 'idle';
      }
    }
    if (f.blockStun > 0) {
      f.blockStun -= dt;
      if (f.blockStun <= 0) {
        f.action = 'idle';
      }
    }

    // Animation frame progression
    f.frameTimer += dt;
    if (f.frameTimer >= f.animSpeed) {
      f.frameTimer = 0;
      f.frameIndex++;

      // Check attack completion or projectile spawn frames
      this.handleAnimationEvent(f);
    }
  }

  private handleAnimationEvent(f: FighterState) {
    // Allow Super Finisher to land a second strike halfway through the rush
    if (f.action === 'super' && f.frameIndex === 7) {
      f.hasHitInCurrentAction = false;
    }

    // End attack/stun/knockdown animation after its full frame sequence completes
    const attackFrames: Record<string, number> = {
      power_1: 8,
      power_2: 10,
      light_punch: 4,
      heavy_punch: 6,
      light_kick: 4,
      heavy_kick: 7,
      special_1: 8,
      special_2: 9,
      super: 14,
      hurt: 5,
      heavy_hurt: 7,
      knockdown: 8,
      getup: 3,
    };

    const maxFrames = attackFrames[f.action];
    if (maxFrames && f.frameIndex >= maxFrames) {
      // E-Overdrive empowers strictly ONE single move even if the swing whiffs
      if (f.overdriveArmed && (f.action === 'power_1' || f.action === 'power_2' || f.action === 'super')) {
        f.overdriveArmed = false;
      }
      f.frameIndex = 0;
      f.hasHitInCurrentAction = false;
      if (f.action === 'knockdown') {
        f.action = 'getup';
        f.isInvincible = true;
      } else if (f.action === 'getup') {
        f.action = 'idle';
        f.isInvincible = false;
      } else {
        f.action = 'idle';
      }
    }
  }

  private updateFacing() {
    const attacking1 = this.p1.action.includes('punch') || this.p1.action.includes('kick') || this.p1.action.includes('special') || this.p1.action.includes('power') || this.p1.action === 'super';
    const attacking2 = this.p2.action.includes('punch') || this.p2.action.includes('kick') || this.p2.action.includes('special') || this.p2.action.includes('power') || this.p2.action === 'super';

    if (this.mode === 'INFINITY' && (!this.infinityEnemyActive || this.infinityZoneCleared)) {
      if (!attacking1 && Math.abs(this.p1.vx) > 0.2) {
        this.p1.facing = this.p1.vx > 0 ? 1 : -1;
      }
      return;
    }

    if (!attacking1 && this.p1.isGrounded) {
      this.p1.facing = this.p1.x < this.p2.x ? 1 : -1;
    }
    if (!attacking2 && this.p2.isGrounded) {
      this.p2.facing = this.p2.x < this.p1.x ? 1 : -1;
    }
  }

  // --- COMBAT HITBOXES & COLLISIONS ---

  private checkCombatCollisions() {
    this.checkFighterAttack(this.p1, this.p2);
    this.checkFighterAttack(this.p2, this.p1);
  }

  private checkFighterAttack(attacker: FighterState, defender: FighterState) {
    if (attacker.hasHitInCurrentAction) return;
    if (defender.action === 'knockdown' || defender.action === 'defeat' || defender.isInvincible) return;

    const frame = attacker.frameIndex;
    const action = attacker.action;

    let box: AttackBox | null = null;
    const dir = attacker.facing;

    // Symmetrical forward melee hitbox helper (used as fallback if sheet alpha is not decoded yet)
    const makeMeleeBox = (
      reachStart: number,
      width: number,
      topOffset: number,
      height: number,
      meta: Omit<AttackBox, 'x' | 'y' | 'w' | 'h'>
    ): AttackBox => ({
      x: dir === 1 ? attacker.x + reachStart : attacker.x - reachStart - width,
      y: attacker.y - topOffset,
      w: width,
      h: height,
      ...meta,
    });

    // Power 1 (Left Click) - Signature physical strike (or flying air kick)
    if (action === 'power_1' && frame >= 2 && frame <= 5) {
      const airOffset = attacker.isGrounded ? 0 : 14;
      box = makeMeleeBox(10, 94, 122 - airOffset, 102, {
        damage: 12,
        hitStun: 0.32,
        blockStun: 0.18,
        pushback: 8,
        isKnockdown: false,
        type: attacker.isGrounded ? 'punch' : 'kick',
      });
    }
    // Power 2 (Right Click) - Heavy close-range knockdown strike
    else if (action === 'power_2' && frame >= 3 && frame <= 6) {
      box = makeMeleeBox(10, 108, 138, 118, {
        damage: 20,
        hitStun: 0.5,
        blockStun: 0.26,
        pushback: 14,
        isKnockdown: true,
        type: 'special',
      });
    } else if (action === 'light_punch' && frame >= 1 && frame <= 3) {
      box = makeMeleeBox(10, 68, 102, 52, { damage: 7, hitStun: 0.2, blockStun: 0.12, pushback: 4, isKnockdown: false, type: 'punch' });
    } else if (action === 'heavy_punch' && frame >= 1 && frame <= 5) {
      box = makeMeleeBox(10, 82, 108, 62, { damage: 14, hitStun: 0.35, blockStun: 0.22, pushback: 9, isKnockdown: false, type: 'heavy_punch' });
    } else if (action === 'light_kick' && frame >= 1 && frame <= 3) {
      box = makeMeleeBox(10, 72, 88, 52, { damage: 8, hitStun: 0.22, blockStun: 0.14, pushback: 5, isKnockdown: false, type: 'kick' });
    } else if (action === 'heavy_kick' && frame >= 1 && frame <= 5) {
      box = makeMeleeBox(10, 88, 116, 68, { damage: 16, hitStun: 0.4, blockStun: 0.25, pushback: 12, isKnockdown: true, type: 'heavy_kick' });
    } else if (action === 'special_1' && frame >= 1 && frame <= 6) {
      box = makeMeleeBox(10, 94, 128, 102, { damage: 16, hitStun: 0.42, blockStun: 0.22, pushback: 12, isKnockdown: false, type: 'special' });
    } else if (action === 'special_2' && frame >= 1 && frame <= 6) {
      box = makeMeleeBox(10, 98, 136, 108, { damage: 18, hitStun: 0.5, blockStun: 0.25, pushback: 14, isKnockdown: true, type: 'special' });
    } else if (action === 'super' && frame >= 2 && frame <= 12) {
      box = makeMeleeBox(10, 118, 136, 118, { damage: 24, hitStun: 0.6, blockStun: 0.35, pushback: 16, isKnockdown: true, type: 'super' });
    }

    if (!box) return;

    // Anti-spam stale-move scaling for repetitive single-move spam (preserves Overdrive & Neon Void)
    if (
      (action === 'power_1' || action === 'power_2') &&
      attacker.characterId !== 'neon_void' &&
      !attacker.overdriveArmed &&
      (attacker.sameAttackStreak ?? 0) >= 3
    ) {
      const streak = attacker.sameAttackStreak ?? 3;
      const mult = streak >= 4 ? 0.7 : 0.85;
      box.damage = Math.max(4, Math.round(box.damage * mult));
    }

    // If E Overdrive is armed, empower this single move (Power 1 or Power 2) to deal 70 damage!
    if (attacker.overdriveArmed && (action === 'power_1' || action === 'power_2')) {
      box.damage = 70;
      box.isKnockdown = true;
      box.pushback = 18;
      box.hitStun = 0.65;
      box.type = 'super';
    }

    // Owner-exclusive NEON VOID deals 200 damage (instant KO) on both strikes
    if (attacker.characterId === 'neon_void' && (action === 'power_1' || action === 'power_2' || action === 'super')) {
      box.damage = 200;
      box.isKnockdown = true;
      box.pushback = 18;
      box.hitStun = 0.65;
      box.type = 'super';
    }

    // 1. Exact Pixel-Touch Detection: if even 1 pixel of attacker's sprite touches defender's sprite, register hit!
    const pxHit = spriteRenderer.checkPixelCollision(attacker, defender, this.simTimeMs);
    let overlap = false;
    let impactX = (attacker.x + defender.x) / 2;
    let impactY = box.y + box.h / 2;

    if (pxHit !== null) {
      overlap = pxHit.hit;
      if (pxHit.hit) {
        impactX = pxHit.impactX;
        impactY = pxHit.impactY;
      }
    } else {
      // Fallback geometric box check only if sprite sheet image isn't decoded yet
      const defLeft = defender.x - 34;
      const defRight = defender.x + 34;
      const defTop = defender.y - 138;
      const defBottom = defender.y;
      overlap = box.x < defRight && box.x + box.w > defLeft && box.y < defBottom && box.y + box.h > defTop;
    }

    if (overlap && defender.hitStun <= 0) {
      attacker.hasHitInCurrentAction = true;
      this.applyHit(attacker, defender, box, impactX, impactY);
    }
  }

  private applyHit(
    attacker: FighterState,
    defender: FighterState,
    box: AttackBox,
    customImpactX?: number,
    customImpactY?: number
  ) {
    const isBlocked = defender.isBlocking;
    const impactX = customImpactX ?? (attacker.x + defender.x) / 2;
    const impactY = customImpactY ?? box.y + box.h / 2;
    const usedOverdrive = attacker.overdriveArmed && box.type === 'super';
    if (usedOverdrive) {
      attacker.overdriveArmed = false;
      if (this.mode === 'INFINITY' && attacker.id === 'p1') {
        this.unlockAchievement('overdrive_master');
      }
    }

    if (isBlocked) {
      // Blocked attack (charge bar does NOT increase on blocks — only on clean combat hits!)
      attacker.comboHits = 0;
      attacker.comboDamage = 0;
      attacker.comboTimer = 0;
      defender.blockStun = box.blockStun;
      defender.vx = attacker.facing * (box.pushback * 0.7);
      const chip = usedOverdrive ? 25 : box.type === 'super' ? 5 : box.type === 'special' ? 3 : 1;
      defender.health = Math.max(0, defender.health - chip);
      
      this.spawnHitSpark(impactX, impactY, 'block');
      soundManager.playBlock();
      this.screenShake = usedOverdrive ? 7 : 3;
      this.hitStopTimer = usedOverdrive ? 0.1 : 0.05;
    } else {
      // Clean hit! Continue combo if within frame window, otherwise start fresh
      if ((attacker.comboTimer ?? 0) > 0) {
        attacker.comboHits++;
        attacker.comboDamage += box.damage;
      } else {
        attacker.comboHits = 1;
        attacker.comboDamage = box.damage;
      }
      attacker.comboTimer = GameEngine.COMBO_WINDOW_SEC;
      // Taking a clean hit interrupts any active combo window for the defender
      defender.comboHits = 0;
      defender.comboDamage = 0;
      defender.comboTimer = 0;
      defender.health = Math.max(0, defender.health - box.damage);

      // Charge meter strictly on hits landed (~8 hits) or taken (~10 hits) — never advances passively
      if (!usedOverdrive) {
        attacker.superMeter = Math.min(attacker.maxSuperMeter, attacker.superMeter + 12.5);
      }
      defender.superMeter = Math.min(defender.maxSuperMeter, defender.superMeter + 10);

      defender.hitStun = box.hitStun;
      defender.vx = attacker.facing * box.pushback;

      if (box.isKnockdown || defender.health <= 0) {
        defender.action = defender.health <= 0 ? 'defeat' : 'knockdown';
        defender.vy = -8; // Airborne bounce
        defender.isGrounded = false;
        this.screenShake = usedOverdrive || box.damage >= 200 ? 12 : 9;
        this.hitStopTimer = usedOverdrive || box.damage >= 200 ? 0.22 : 0.12;
      } else {
        defender.action = box.damage >= 12 ? 'heavy_hurt' : 'hurt';
        this.screenShake = box.damage >= 12 ? 6 : 3;
        this.hitStopTimer = box.damage >= 12 ? 0.08 : 0.04;
      }

      const sparkType = box.type === 'super' ? 'ko' : box.damage >= 14 ? 'heavy' : 'light';
      this.spawnHitSpark(impactX, impactY, sparkType);
      const hitSfxType =
        box.type === 'special' || attacker.characterId === 'neon_void'
          ? attacker.characterId === 'hero_a'
            ? 'chi'
            : attacker.characterId === 'herobrine' ||
              attacker.characterId === 'impostor' ||
              attacker.characterId === 'oggy' ||
              attacker.characterId === 'death_wolf' ||
              attacker.characterId === 'neon_void'
            ? 'slash'
            : 'fire'
          : 'normal';
      soundManager.playHit(box.damage >= 12, hitSfxType);
    }
  }

  private updateComboTimers(dt: number) {
    for (const f of [this.p1, this.p2]) {
      if ((f.comboTimer ?? 0) > 0) {
        f.comboTimer = Math.max(0, (f.comboTimer ?? 0) - dt);
        if (f.comboTimer <= 0) {
          f.comboHits = 0;
          f.comboDamage = 0;
        }
      }
    }
  }

  // --- PROJECTILE SIMULATION & COLLISIONS ---

  private updateProjectiles(dt: number) {
    const step = dt * 60;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.life += dt;

      // Add to trail
      p.trail.unshift({ x: p.x, y: p.y, alpha: 1.0 });
      if (p.trail.length > 6) p.trail.pop();
      p.trail.forEach(t => t.alpha -= dt * 2.5);

      // Check collision with opponent
      const target = p.ownerId === 'p1' ? this.p2 : this.p1;
      const dist = Math.hypot(p.x - target.x, p.y - (target.y - 72));

      if (dist < p.radius + 38 && target.action !== 'knockdown' && target.action !== 'defeat') {
        // Hit opponent!
        const attacker = p.ownerId === 'p1' ? this.p1 : this.p2;
        const box: AttackBox = {
          x: p.x,
          y: p.y,
          w: p.radius * 2,
          h: p.radius * 2,
          damage: p.damage,
          hitStun: 0.35,
          blockStun: 0.2,
          pushback: 10,
          isKnockdown: false,
          type: 'special',
        };
        this.applyHit(attacker, target, box);
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check stage / camera boundary or max life
      const projOut = this.mode === 'INFINITY'
        ? Math.abs(p.x - this.cameraX) > 780
        : p.x < 20 || p.x > 980;
      if (projOut || p.life >= p.maxLife) {
        this.spawnHitSpark(p.x, p.y, 'light');
        this.projectiles.splice(i, 1);
      }
    }
  }

  // --- PARTICLES & HIT SPARKS ---

  private spawnHitSpark(x: number, y: number, type: HitSpark['type']) {
    const particles: Particle[] = [];
    const count = type === 'ko' ? 24 : type === 'heavy' ? 14 : 8;
    const colors = type === 'block' ? ['#38bdf8', '#0284c7', '#ffffff'] : ['#fef08a', '#f97316', '#ef4444', '#ffffff'];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5);
      const speed = 2 + Math.random() * 6;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: 0.25 + Math.random() * 0.2,
        alpha: 1.0,
      });
    }

    this.hitSparks.push({
      x,
      y,
      type,
      timer: 0,
      maxTimer: 0.2,
      color: colors[0],
      particles,
    });
  }

  private spawnDust(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y - 2,
        vx: (Math.random() - 0.5) * 3,
        vy: -0.5 - Math.random() * 1.5,
        size: 3 + Math.random() * 4,
        color: 'rgba(212, 212, 216, 0.7)',
        life: 0,
        maxLife: 0.35,
        alpha: 0.8,
      });
    }
  }

  private updateParticles(dt: number) {
    const step = dt * 60;
    const spawnBaseX = this.mode === 'INFINITY' ? this.cameraX - 620 : 0;
    const arenaW = this.mode === 'INFINITY' ? 1240 : 1040;
    const arenaH = 440;

    // Spawn rich lobby-style ambient atmospheric particles across all 18 stages
    if (this.particles.length < 66 && Math.random() < 0.85 * step) {
      const type = this.arena.particleType;

      if (type === 'embers') {
        this.particles.push({
          x: spawnBaseX + Math.random() * arenaW,
          y: this.arena.groundY - 6 + Math.random() * 24,
          vx: (Math.random() - 0.5) * 2.1,
          vy: -2.0 - Math.random() * 2.6,
          size: 3 + Math.random() * 3.5,
          color: Math.random() > 0.35 ? '#f97316' : '#fde047',
          life: 0,
          maxLife: 1.9 + Math.random() * 1.2,
          alpha: 0.92,
        });
      } else if (type === 'snow') {
        this.particles.push({
          x: spawnBaseX + Math.random() * arenaW,
          y: -10,
          vx: -0.9 + Math.random() * 1.8,
          vy: 1.2 + Math.random() * 1.4,
          size: 3 + Math.random() * 3.5,
          color: this.arena.id === 'aurora_glacier' && Math.random() > 0.5 ? '#67e8f9' : '#e0f2fe',
          life: 0,
          maxLife: 4.5,
          alpha: 0.85,
        });
      } else if (type === 'sand') {
        this.particles.push({
          x: spawnBaseX - 20,
          y: 160 + Math.random() * 270,
          vx: 5.0 + Math.random() * 4.2,
          vy: (Math.random() - 0.5) * 0.9,
          size: 2.5 + Math.random() * 3,
          color: Math.random() > 0.45 ? '#f59e0b' : '#fde68a',
          life: 0,
          maxLife: 2.5,
          alpha: 0.8,
        });
      } else if (type === 'rain') {
        this.particles.push({
          x: spawnBaseX + Math.random() * (arenaW + 220) - 100,
          y: -10,
          vx: -2.6,
          vy: 12.5 + Math.random() * 4,
          size: 2.5,
          color: this.arena.id === 'cyber_sector' ? '#67e8f9' : '#93c5fd',
          life: 0,
          maxLife: 0.9,
          alpha: 0.78,
        });
      } else if (type === 'petals') {
        this.particles.push({
          x: spawnBaseX + Math.random() * (arenaW + 120) - 60,
          y: -10,
          vx: 1.1 + Math.random() * 1.6,
          vy: 1.4 + Math.random() * 1.3,
          size: 4 + Math.random() * 3.5,
          color:
            this.arena.id === 'bamboo_dojo'
              ? Math.random() > 0.45 ? '#f97316' : '#ef4444'
              : Math.random() > 0.5 ? '#f472b6' : '#fb7185',
          life: 0,
          maxLife: 3.6,
          alpha: 0.88,
        });
      } else if (type === 'leaves') {
        this.particles.push({
          x: spawnBaseX + Math.random() * arenaW,
          y: -10,
          vx: 0.7 + Math.random() * 1.5,
          vy: 1.2 + Math.random() * 1.4,
          size: 4 + Math.random() * 4,
          color:
            this.arena.id === 'shadow_woods'
              ? Math.random() > 0.5 ? '#ef4444' : '#94a3b8'
              : Math.random() > 0.4 ? '#4ade80' : '#84cc16',
          life: 0,
          maxLife: 3.4,
          alpha: 0.86,
        });
      } else {
        // Golden fireflies / prism light motes
        this.particles.push({
          x: spawnBaseX + Math.random() * arenaW,
          y: 40 + Math.random() * (arenaH - 40),
          vx: (Math.random() - 0.5) * 0.9,
          vy: -0.45 - Math.random() * 0.6,
          size: 3 + Math.random() * 2.5,
          color:
            this.arena.id === 'spaceship_deck' || this.arena.id === 'crystal_cavern'
              ? Math.random() > 0.5 ? '#38bdf8' : '#c084fc'
              : '#fde047',
          life: 0,
          maxLife: 3.2,
          alpha: 0.78,
        });
      }
    }

    // Update Hit Sparks
    for (let i = this.hitSparks.length - 1; i >= 0; i--) {
      const s = this.hitSparks[i];
      s.timer += dt;
      s.particles.forEach(p => {
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.life += dt;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      });
      if (s.timer >= s.maxTimer) {
        this.hitSparks.splice(i, 1);
      }
    }

    // Update Dust & Misc Ambient Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.life += dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      const outX = this.mode === 'INFINITY'
        ? Math.abs(p.x - this.cameraX) > 950
        : p.x > 1050 || p.x < -50;
      if (p.life >= p.maxLife || p.y > this.arena.groundY + 40 || outX) {
        this.particles.splice(i, 1);
      }
    }
  }

  // --- DYNAMIC 2D FIGHTING CAMERA TRACKING ---

  private updateCamera() {
    const viewW = Math.max(480, this.viewportW || Math.round(540 * this.viewportAspect));
    const viewH = Math.max(540, this.viewportH || 540);
    const isPortrait = viewH > viewW;
    const focusRatioY = isPortrait ? 0.48 : 0.59;
    const bottomPad = isPortrait ? Math.round(viewH * 0.24) : 48;
    const safeHudHeight = Math.max(260, viewH - (isPortrait ? bottomPad + 140 : 120));

    if (this.mode === 'INFINITY') {
      const seg = this.infinitySegments[this.infinityZoneIndex];
      const segStart = seg ? seg.startX : 0;
      const lastSeg = this.infinitySegments[this.infinitySegments.length - 1];
      const worldEnd = lastSeg ? lastSeg.endX : this.infinitySegmentWidth;

      if (this.infinityZoneCleared || !this.infinityEnemyActive) {
        // Smooth side-scrolling chase camera ahead of P1 when marching forward to next map
        const targetZoom = isPortrait ? 0.92 : 1.02;
        this.cameraZoom += (targetZoom - this.cameraZoom) * 0.08;
        const halfVisibleW = viewW / (2 * this.cameraZoom);
        const minCamX = Math.min(this.p1.x + 140, segStart + halfVisibleW);
        const maxCamX = worldEnd - halfVisibleW;
        const targetCamX = Math.max(minCamX, Math.min(maxCamX, this.p1.x + 140));
        this.cameraX += (targetCamX - this.cameraX) * 0.085;

        const halfBotH = (viewH * (1 - focusRatioY)) / this.cameraZoom;
        const targetCamY = this.arena.groundY - halfBotH + bottomPad / this.cameraZoom - Math.max(0, (this.arena.groundY - this.p1.y) * 0.35);
        this.cameraY += (targetCamY - this.cameraY) * 0.09;
        return;
      }

      const left = Math.min(this.p1.x, this.p2.x) - 125;
      const right = Math.max(this.p1.x, this.p2.x) + 125;
      const highestFeetY = Math.min(this.p1.y, this.p2.y);
      const boxTop = highestFeetY - 242;
      const boxBottom = this.arena.groundY + 52;
      const spanX = Math.max(460, right - left);
      const spanY = Math.max(320, boxBottom - boxTop);

      const fitZoomX = (viewW - 36) / spanX;
      const fitZoomY = safeHudHeight / spanY;
      const adaptiveMinZoom = isPortrait
        ? Math.max(0.62, Math.min(0.95, (viewW - 32) / 760))
        : Math.max(0.76, Math.min(0.92, (viewW - 44) / 1000));
      const maxZoom = isPortrait ? 1.06 : 1.12;
      const targetZoom = Math.max(adaptiveMinZoom, Math.min(maxZoom, Math.min(fitZoomX, fitZoomY)));
      this.cameraZoom += (targetZoom - this.cameraZoom) * 0.09;

      const halfVisibleW = viewW / (2 * this.cameraZoom);
      const rawCamX = (left + right) / 2;
      // Smoothly unlock minimum clamp while entering a newly started zone so camera never snaps forward
      const entryProgressX = this.p1.x - segStart;
      const easedMinCamX = entryProgressX < halfVisibleW
        ? Math.max(segStart + 180, Math.min(segStart + halfVisibleW, rawCamX))
        : segStart + halfVisibleW;
      const maxCamX = (seg ? seg.endX : this.infinitySegmentWidth) - halfVisibleW;
      const targetCamX = Math.max(easedMinCamX, Math.min(Math.max(easedMinCamX, maxCamX), rawCamX));
      this.cameraX += (targetCamX - this.cameraX) * 0.095;

      const halfBotH = (viewH * (1 - focusRatioY)) / this.cameraZoom;
      const defaultCamY = this.arena.groundY - halfBotH + bottomPad / this.cameraZoom;
      const jumpLift = Math.max(0, (this.arena.groundY - highestFeetY) * 0.35);
      const targetCamY = defaultCamY - jumpLift;
      this.cameraY += (targetCamY - this.cameraY) * 0.1;
      return;
    }

    // Standard Arena & Online Camera Framing
    const frameUnits: FighterState[] =
      this.mode === 'ONLINE' && this.onlineMatchFormat === 'infinity' && (this.onlineAllies.length > 0 || this.onlineEnemies.length > 0)
        ? (() => {
            const combined = [...this.onlineAllies, ...this.onlineEnemies];
            const living = combined.filter(u => !u.isDead && u.health > 0);
            return living.length > 0 ? living : combined;
          })()
        : [this.p1, this.p2];
    const left = Math.min(...frameUnits.map(u => u.x)) - 125;
    const right = Math.max(...frameUnits.map(u => u.x)) + 125;
    const highestFeetY = Math.min(...frameUnits.map(u => u.y));
    const boxTop = highestFeetY - 242;
    const boxBottom = this.arena.groundY + 52;

    const spanX = Math.max(460, right - left);
    const spanY = Math.max(320, boxBottom - boxTop);

    const fitZoomX = (viewW - 36) / spanX;
    const fitZoomY = safeHudHeight / spanY;
    const adaptiveMinZoom = isPortrait
      ? Math.max(0.62, Math.min(0.95, (viewW - 32) / 760))
      : Math.max(0.76, Math.min(0.92, (viewW - 44) / 1000));
    const maxZoom = isPortrait ? 1.06 : 1.12;
    const targetZoom = Math.max(adaptiveMinZoom, Math.min(maxZoom, Math.min(fitZoomX, fitZoomY)));
    this.cameraZoom += (targetZoom - this.cameraZoom) * 0.12;

    const halfVisibleW = viewW / (2 * this.cameraZoom);
    const bgMinX = -45;
    const bgMaxX = 1045;
    const rawCamX = (left + right) / 2;
    const minCamX = Math.min(500, bgMinX + halfVisibleW + 10);
    const maxCamX = Math.max(500, bgMaxX - halfVisibleW - 10);
    const targetCamX = Math.max(minCamX, Math.min(maxCamX, rawCamX));
    this.cameraX += (targetCamX - this.cameraX) * 0.12;

    const halfTopH = (viewH * focusRatioY) / this.cameraZoom;
    const halfBotH = (viewH * (1 - focusRatioY)) / this.cameraZoom;
    const defaultCamY = this.arena.groundY - halfBotH + bottomPad / this.cameraZoom;
    const jumpLift = Math.max(0, (this.arena.groundY - highestFeetY) * 0.35);
    const rawCamY = defaultCamY - jumpLift;

    const bgMinY = -360;
    const bgMaxY = 820;
    const minCamY = Math.min(defaultCamY, bgMinY + halfTopH + 6);
    const maxCamY = Math.max(defaultCamY, bgMaxY - halfBotH - 6);
    const targetCamY = Math.max(minCamY, Math.min(maxCamY, rawCamY));
    this.cameraY += (targetCamY - this.cameraY) * 0.12;
  }

  // --- ONLINE SERVER-AUTHORITATIVE MULTIPLAYER BRIDGE ---

  public setOnlinePlayerInput(side: 'p1' | 'p2', input: OnlinePlayerInput) {
    const held = side === 'p1' ? this.p1HeldKeys : this.p2HeldKeys;
    const just = side === 'p1' ? this.p1JustPressed : this.p2JustPressed;
    const leftKey = side === 'p1' ? 'a' : 'arrowleft';
    const rightKey = side === 'p1' ? 'd' : 'arrowright';
    const upKey = side === 'p1' ? 'w' : 'arrowup';
    const downKey = side === 'p1' ? 's' : 'arrowdown';

    held.clear();
    if (input.left) held.add(leftKey);
    if (input.right) held.add(rightKey);
    if (input.up) held.add(upKey);
    if (input.down) held.add(downKey);
    if (input.sprint) held.add('shift');
    if (input.block) held.add('l');

    if (input.power1) just.add('j');
    if (input.power2) just.add('k');
    if (input.overdrive) just.add(side === 'p1' ? 'e' : 'enter');
  }

  private packFighterSnapshot(f: FighterState): OnlineFighterSnapshot {
    return {
      id: f.id,
      characterId: f.characterId,
      name: f.name,
      x: Math.round(f.x * 100) / 100,
      y: Math.round(f.y * 100) / 100,
      vx: Math.round(f.vx * 100) / 100,
      vy: Math.round(f.vy * 100) / 100,
      facing: f.facing,
      health: f.health,
      maxHealth: f.maxHealth,
      damageGhost: Math.round(f.damageGhost * 10) / 10,
      superMeter: Math.round(f.superMeter * 10) / 10,
      maxSuperMeter: f.maxSuperMeter,
      action: f.action,
      frameIndex: f.frameIndex,
      frameTimer: f.frameTimer,
      isGrounded: f.isGrounded,
      isBlocking: f.isBlocking,
      isInvincible: f.isInvincible,
      hitStun: f.hitStun,
      blockStun: f.blockStun,
      comboHits: f.comboHits,
      comboDamage: f.comboDamage,
      comboTimer: Math.round((f.comboTimer ?? 0) * 1000) / 1000,
      wins: f.wins,
      overdriveArmed: f.overdriveArmed,
    };
  }

  public exportOnlineSnapshot(): OnlineEngineSnapshot {
    return {
      tick: this.onlineTick,
      simTimeMs: this.simTimeMs,
      arenaId: this.arena.id,
      roundNumber: this.roundNumber,
      roundTimeRemaining: this.roundTimeRemaining,
      matchState: this.matchState === 'PAUSED' ? 'FIGHT' : this.matchState,
      winnerId: this.winnerId,
      matchWinnerId: this.matchWinnerId,
      roundAnnounceText: this.roundAnnounceText,
      cameraX: this.cameraX,
      cameraY: this.cameraY,
      cameraZoom: this.cameraZoom,
      screenShake: this.screenShake,
      hitStopTimer: this.hitStopTimer,
      p1: this.packFighterSnapshot(this.p1),
      p2: this.packFighterSnapshot(this.p2),
      projectiles: this.projectiles.map(p => ({
        ...p,
        trail: p.trail.slice(0, 4),
      })),
    };
  }

  private syncFighterFromSnapshot(target: FighterState, snap: OnlineFighterSnapshot) {
    const prevHp = target.health;
    const prevAction = target.action;
    const prevBlockStun = target.blockStun;
    const prevOverdrive = target.overdriveArmed;

    target.characterId = snap.characterId;
    target.name = snap.name;
    target.x = snap.x;
    target.y = snap.y;
    target.vx = snap.vx;
    target.vy = snap.vy;
    target.facing = snap.facing;
    target.health = snap.health;
    target.maxHealth = snap.maxHealth;
    target.damageGhost = snap.damageGhost;
    target.superMeter = snap.superMeter;
    target.maxSuperMeter = snap.maxSuperMeter;
    target.action = snap.action;
    target.frameIndex = snap.frameIndex;
    target.frameTimer = snap.frameTimer;
    target.isGrounded = snap.isGrounded;
    target.isBlocking = snap.isBlocking;
    target.isInvincible = snap.isInvincible;
    target.hitStun = snap.hitStun;
    target.blockStun = snap.blockStun;
    target.comboHits = snap.comboHits;
    target.comboDamage = snap.comboDamage;
    target.comboTimer = snap.comboTimer ?? 0;
    target.wins = snap.wins;
    target.overdriveArmed = snap.overdriveArmed;
    target.team = snap.team;
    target.isDead = Boolean(snap.isDead);
    target.reviveProgress = snap.reviveProgress ?? 0;
    target.isAi = Boolean(snap.isAi);

    if (!prevOverdrive && snap.overdriveArmed) {
      soundManager.playSuperFlash();
    }
    if (snap.health < prevHp) {
      const dmg = prevHp - snap.health;
      if (snap.blockStun > prevBlockStun) {
        this.spawnHitSpark(target.x, target.y - 48, 'block');
        soundManager.playBlock();
      } else {
        this.spawnHitSpark(target.x, target.y - 50, dmg >= 30 ? 'ko' : dmg >= 14 ? 'heavy' : 'light');
        soundManager.playHit(dmg >= 12, 'normal');
      }
    }
    if (snap.action !== prevAction) {
      if (snap.action === 'power_1') soundManager.playPunch(false);
      else if (snap.action === 'power_2') soundManager.playHit(true, 'fire');
      else if (snap.action === 'jump') {
        soundManager.playJump();
        this.spawnDust(target.x, this.arena.groundY);
      }
    }
  }

  public applyOnlineSnapshot(snap: OnlineEngineSnapshot, dtVisual: number) {
    this.simTimeMs = snap.simTimeMs;
    this.onlineTick = snap.tick;

    if (snap.matchFormat === 'play' || snap.matchFormat === 'infinity') {
      this.onlineMatchFormat = snap.matchFormat;
    }
    if (typeof snap.roundsToWin === 'number' && snap.roundsToWin > 0) {
      this.onlineRoundsToWin = snap.roundsToWin;
    }
    if (typeof snap.roundTimerSec === 'number') {
      this.onlineRoundTimerSec = snap.roundTimerSec;
    }
    this.onlineCanReviveNow = Boolean(snap.canReviveNow);
    if (typeof snap.infinityZone === 'number') {
      this.onlineInfinityZone = snap.infinityZone;
    }
    if (typeof snap.infinityDefeated === 'number') {
      this.onlineInfinityDefeated = snap.infinityDefeated;
    }
    this.onlineInfinityZoneCleared = Boolean(snap.infinityZoneCleared);

    if (snap.arenaId && ARENAS[snap.arenaId] && this.arena.id !== snap.arenaId) {
      this.arena = ARENAS[snap.arenaId];
    }

    if (snap.roundAnnounceText !== this.roundAnnounceText) {
      if (snap.roundAnnounceText === 'FIGHT!') soundManager.playAnnouncer('FIGHT');
      else if (snap.roundAnnounceText === 'K.O.!') soundManager.playAnnouncer('KO');
      else if (snap.roundAnnounceText === 'TIME UP!') soundManager.playAnnouncer('TIME_UP');
      else if (snap.roundAnnounceText.startsWith('ROUND') || snap.roundAnnounceText.startsWith('ZONE') || snap.roundAnnounceText.startsWith('FINAL')) {
        soundManager.playAnnouncer(
          snap.roundAnnounceText.startsWith('FINAL') || snap.roundNumber >= 3
            ? 'FINAL_ROUND'
            : snap.roundNumber === 2
              ? 'ROUND_2'
              : 'ROUND_1'
        );
      }
    }

    const prevP1Coins = this.onlineP1ZoneCoins;
    const prevP2Coins = this.onlineP2ZoneCoins;
    this.onlineP1ZoneCoins = snap.p1ZoneCoins ?? this.onlineP1ZoneCoins;
    this.onlineP2ZoneCoins = snap.p2ZoneCoins ?? this.onlineP2ZoneCoins;
    if (this.onlineP1ZoneCoins > prevP1Coins || this.onlineP2ZoneCoins > prevP2Coins) {
      soundManager.playCoinPickup();
    }

    if (Array.isArray(snap.onlineCoins)) {
      this.vCoins = snap.onlineCoins;
    }

    this.roundNumber = snap.roundNumber;
    this.roundTimeRemaining = snap.roundTimeRemaining;
    this.matchState = snap.matchState;
    this.winnerId = snap.winnerId;
    this.matchWinnerId = snap.matchWinnerId;
    this.roundAnnounceText = snap.roundAnnounceText;
    this.screenShake = snap.screenShake;
    this.hitStopTimer = snap.hitStopTimer;

    this.syncFighterFromSnapshot(this.p1, snap.p1);
    this.syncFighterFromSnapshot(this.p2, snap.p2);

    if (Array.isArray(snap.onlineAllies)) {
      this.onlineAllies = snap.onlineAllies.map((s, idx) => {
        const existing = this.onlineAllies[idx] || this.createFighter(s.id, s.characterId, s.x, s.y, s.facing);
        this.syncFighterFromSnapshot(existing, s);
        return existing;
      });
    } else {
      this.onlineAllies = [];
    }

    if (Array.isArray(snap.onlineEnemies)) {
      this.onlineEnemies = snap.onlineEnemies.map((s, idx) => {
        const existing = this.onlineEnemies[idx] || this.createFighter(s.id, s.characterId, s.x, s.y, s.facing);
        this.syncFighterFromSnapshot(existing, s);
        return existing;
      });
    } else {
      this.onlineEnemies = [];
    }

    this.projectiles = snap.projectiles;

    this.updateParticles(dtVisual);
    this.updateFloatingPopups(dtVisual);
    this.updateCamera();
  }
}
