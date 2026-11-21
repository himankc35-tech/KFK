export type GameState = 
  | 'LOBBY' 
  | 'SETTINGS' 
  | 'CHARACTER_SELECT' 
  | 'ARENA_SELECT' 
  | 'FIGHTING' 
  | 'ROUND_RESULT' 
  | 'MATCH_OVER'
  | 'VISUAL_REFERENCES'
  | 'ONLINE_HUB'
  | 'OWNER_PANEL';

export type CharacterId =
  | 'oggy'
  | 'buster'
  | 'herobrine'
  | 'impostor'
  | 'lion'
  | 'ninja'
  | 'brawler'
  | 'mario'
  | 'sonic'
  | 'hero_a'
  | 'death_wolf'
  | 'hellfire'
  | 'akita'
  | 'neon_void';

export type ArenaId =
  | 'jungle_temple'
  | 'nether_fortress'
  | 'spaceship_deck'
  | 'cyber_shrine'
  | 'rooftop'
  | 'desert'
  | 'mushroom_kingdom'
  | 'emerald_loop'
  | 'cyber_sector'
  | 'luxe_citadel'
  | 'shadow_woods'
  | 'brimstone_highway'
  | 'bamboo_dojo'
  | 'junkyard_alley'
  | 'aurora_glacier'
  | 'sakura_falls'
  | 'thunder_airship'
  | 'crystal_cavern'
  | 'sunken_atlantis'
  | 'clockwork_spire'
  | 'obsidian_colosseum'
  | 'starlight_carnival'
  | 'pharaoh_sanctuary'
  | 'hyper_rail'
  | 'celestial_temple';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export type GameMode = 'ARCADE' | 'VERSUS' | 'TRAINING' | 'INFINITY' | 'ONLINE';

export type OnlineMatchFormat = 'play' | 'infinity';

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'MASTER';

export type ActionState = 
  | 'idle' 
  | 'walk_fwd' 
  | 'walk_back' 
  | 'run_fwd'
  | 'crouch' 
  | 'jump' 
  | 'power_1' 
  | 'power_2' 
  | 'light_punch' 
  | 'heavy_punch' 
  | 'light_kick' 
  | 'heavy_kick' 
  | 'block' 
  | 'crouch_block' 
  | 'hurt' 
  | 'heavy_hurt' 
  | 'knockdown' 
  | 'getup' 
  | 'special_1' 
  | 'special_2' 
  | 'super' 
  | 'victory' 
  | 'defeat';

export interface PowerMove {
  name: string;
  command: string;
  description: string;
  type: 'melee' | 'projectile' | 'aerial' | 'blast';
}

export interface SpecialMove {
  name: string;
  command: string;
  description: string;
  meterCost?: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  country: string;
  style: string;
  portraitUrl: string;
  themeColor: string;
  glowColor: string;
  stats: {
    power: number;
    speed: number;
    defense: number;
    technique: number;
  };
  power1: PowerMove;
  power2: PowerMove;
  specialMoves: SpecialMove[];
  superMove: SpecialMove;
  victoryQuote: string;
  defeatQuote: string;
  description: string;
  unlockCost?: number;
  ownerOnly?: boolean;
}

export interface ArenaDef {
  id: ArenaId;
  name: string;
  location: string;
  timeOfDay: string;
  imageUrl: string;
  description: string;
  bgmStyle: string;
  groundY: number;
  particleType: 'leaves' | 'rain' | 'petals' | 'dust' | 'embers' | 'snow' | 'sand';
}

export interface Projectile {
  id: number;
  ownerId: 'p1' | 'p2';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  color: string;
  glowColor: string;
  trail: { x: number; y: number; alpha: number }[];
  life: number;
  maxLife: number;
  type:
    | 'swatter'
    | 'shockwave'
    | 'cursed_slash'
    | 'dagger'
    | 'golden_wave'
    | 'fire'
    | 'plasma'
    | 'sonic'
    | 'chi'
    | 'lightning'
    | 'shadow'
    | 'seismic'
    | 'tempest';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  alpha: number;
  gravity?: number;
}

export interface HitSpark {
  x: number;
  y: number;
  type: 'light' | 'heavy' | 'block' | 'fire' | 'slash' | 'chi' | 'ko';
  timer: number;
  maxTimer: number;
  color: string;
  particles: Particle[];
}

export interface FighterState {
  id: 'p1' | 'p2';
  characterId: CharacterId;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: 1 | -1;
  health: number;
  maxHealth: number;
  damageGhost: number;
  superMeter: number;
  maxSuperMeter: number;
  action: ActionState;
  frameIndex: number;
  frameTimer: number;
  animSpeed: number;
  isGrounded: boolean;
  isBlocking: boolean;
  isInvincible: boolean;
  hitStun: number;
  blockStun: number;
  comboHits: number;
  comboDamage: number;
  comboTimer?: number;
  wins: number;
  hasFiredProjectileInAction: boolean;
  hasHitInCurrentAction: boolean;
  overdriveArmed: boolean;
  attackCooldown?: number;
  lastAttackAction?: 'power_1' | 'power_2' | null;
  sameAttackStreak?: number;
  spamResetTimer?: number;
  team?: 'ally' | 'enemy';
  isDead?: boolean;
  reviveProgress?: number;
  isAi?: boolean;
}

export interface GameSettings {
  soundVolume: number;
  musicVolume: number;
  soundMuted: boolean;
  musicMuted: boolean;
  roundsToWin: number;
  roundTimerSec: number;
  difficulty: Difficulty;
  touchControls?: 'auto' | 'on' | 'off';
  audioDefaultsV2Applied?: boolean;
}

export interface UserAccountProfile {
  id: string;
  playerId?: string;
  email?: string;
  username: string;
  avatarUrl: string;
  vCoins: number;
  xp: number;
  wins?: number;
  losses?: number;
  isOnline?: boolean;
  isOwner?: boolean;
  banned?: boolean;
  bannedReason?: string;
  walletRevision?: number;
  authProvider?: 'supabase' | 'local';
  unlockedCharacters?: CharacterId[];
  createdAt: string;
}

export interface VCoin {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  bobOffset: number;
  collected: boolean;
}

export interface InfinityStageSegment {
  index: number;
  arenaId: ArenaId;
  startX: number;
  endX: number;
}

export type InfinityAchievementId =
  | 'first_blood'
  | 'coin_collector_25'
  | 'coin_tycoon_100'
  | 'zone_explorer_3'
  | 'world_traveler_6'
  | 'overdrive_master'
  | 'combo_king'
  | 'roster_sweep';

export interface InfinityAchievement {
  id: InfinityAchievementId;
  title: string;
  description: string;
  rewardCoins: number;
}

export interface FloatingPopup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface OnlinePlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  sprint: boolean;
  block: boolean;
  power1?: boolean;
  power2?: boolean;
  overdrive?: boolean;
  revive?: boolean;
}

export interface OnlineFighterSnapshot {
  id: 'p1' | 'p2';
  characterId: CharacterId;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  health: number;
  maxHealth: number;
  damageGhost: number;
  superMeter: number;
  maxSuperMeter: number;
  action: ActionState;
  frameIndex: number;
  frameTimer: number;
  isGrounded: boolean;
  isBlocking: boolean;
  isInvincible: boolean;
  hitStun: number;
  blockStun: number;
  comboHits: number;
  comboDamage: number;
  comboTimer?: number;
  wins: number;
  overdriveArmed: boolean;
  team?: 'ally' | 'enemy';
  isDead?: boolean;
  reviveProgress?: number;
  isAi?: boolean;
}

export interface OnlineEngineSnapshot {
  tick: number;
  simTimeMs: number;
  matchFormat?: OnlineMatchFormat;
  roundsToWin?: number;
  roundTimerSec?: number;
  arenaId: ArenaId;
  roundNumber: number;
  roundTimeRemaining: number;
  matchState: 'INTRO' | 'FIGHT' | 'ROUND_OVER' | 'MATCH_OVER';
  winnerId: 'p1' | 'p2' | 'DRAW' | null;
  matchWinnerId: 'p1' | 'p2' | null;
  roundAnnounceText: string;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  screenShake: number;
  hitStopTimer: number;
  p1: OnlineFighterSnapshot;
  p2: OnlineFighterSnapshot;
  onlineAllies?: OnlineFighterSnapshot[];
  onlineEnemies?: OnlineFighterSnapshot[];
  canReviveNow?: boolean;
  infinityZone?: number;
  infinityDefeated?: number;
  infinityZoneCleared?: boolean;
  projectiles: Projectile[];
  onlineCoins?: VCoin[];
  p1ZoneCoins?: number;
  p2ZoneCoins?: number;
}

export interface OnlineRoomSlot {
  playerId: string;
  playerCode: string;
  username: string;
  avatarUrl: string;
  characterId: CharacterId;
  ready: boolean;
  connected: boolean;
}

export interface OnlineRoomInfo {
  code: string;
  name: string;
  visibility: 'public' | 'private';
  status: 'waiting' | 'ready' | 'playing' | 'finished';
  matchFormat: OnlineMatchFormat;
  arenaId: ArenaId;
  roundsToWin?: number;
  roundTimerSec?: number;
  host: OnlineRoomSlot;
  guest: OnlineRoomSlot | null;
  isQuickMatch?: boolean;
  createdAt: string;
}

export interface OnlinePlayerSummary {
  id: string;
  playerId: string;
  username: string;
  avatarUrl: string;
  vCoins?: number;
  wins: number;
  losses: number;
  xp: number;
  isOnline: boolean;
  isOwner?: boolean;
  banned?: boolean;
  lastSeen?: string;
  friendStatus?: 'none' | 'friend' | 'incoming' | 'outgoing';
  friendshipId?: string | null;
}

export interface FriendRelation {
  friendshipId: string;
  status: 'pending' | 'accepted' | 'rejected';
  direction: 'incoming' | 'outgoing' | 'friend';
  profile: OnlinePlayerSummary;
  createdAt: string;
}

export interface RoomInviteInfo {
  id: string;
  roomCode: string;
  roomName: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  sender: OnlinePlayerSummary;
  createdAt: string;
}

export interface OnlineMatchRecord {
  id: string;
  roomCode: string | null;
  p1Id: string;
  p2Id: string;
  p1Name: string;
  p2Name: string;
  p1Char: CharacterId;
  p2Char: CharacterId;
  arenaId: ArenaId;
  winnerId: string;
  p1Wins: number;
  p2Wins: number;
  xpAwarded: number;
  createdAt: string;
}

export interface LeaderboardEntry extends OnlinePlayerSummary {
  winRate: number;
}

export interface OwnerPlayerRecord {
  id: string;
  playerId: string;
  username: string;
  avatarUrl: string;
  vCoins: number;
  xp: number;
  wins: number;
  losses: number;
  isOnline: boolean;
  isOwner: boolean;
  banned: boolean;
  bannedReason?: string;
  walletRevision: number;
  unlockedCharacters: CharacterId[];
  lastSeen: string;
  createdAt: string;
  activeRoomCode: string | null;
}

export interface OwnerWorldSummary {
  code: string;
  name: string;
  visibility: 'public' | 'private';
  status: 'waiting' | 'ready' | 'playing' | 'finished';
  matchFormat: OnlineMatchFormat;
  arenaId: ArenaId;
  roundsToWin: number;
  roundTimerSec: number;
  spectatorCount: number;
  host: OnlineRoomSlot;
  guest: OnlineRoomSlot | null;
  createdAt: string;
}

export interface SupabaseHealthReport {
  configured: boolean;
  url: string;
  authReachable: boolean;
  emailAutoconfirm: boolean;
  schemaReady: boolean;
  missingTables: string[];
  errorMessage: string | null;
}



