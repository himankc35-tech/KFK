import React, { useRef, useState } from 'react';
import {
  X,
  Upload,
  LogOut,
  UserCheck,
  LogIn,
  UserPlus,
  Check,
  Eye,
  EyeOff,
  Copy,
  Trophy,
  Swords,
  ShieldCheck,
} from 'lucide-react';
import { UserAccountProfile } from '../types/game';
import { soundManager } from '../audio/soundManager';
import { loadUnlockedCharacters } from '../data/achievements';
import {
  PRESET_AVATAR_LOGOS,
  loginAccount,
  logoutAccount,
  resizeAvatarImageFile,
  signupAccount,
  updateUserProfile,
} from '../services/authClient';
import { logoutSupabase, updateSupabaseUserProfile } from '../services/supabaseService';

interface ProfileModalProps {
  user: UserAccountProfile | null;
  localCoins: number;
  localXP: number;
  initialTab?: 'login' | 'signup';
  onAuthChange: (user: UserAccountProfile | null) => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  localCoins,
  localXP,
  initialTab = 'signup',
  onAuthChange,
  onClose,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'signup'>(initialTab);
  const [username, setUsername] = useState(user?.username || '');
  const isOwnerUser = Boolean(user && (user.isOwner || user.username.trim().toLowerCase() === 'himank'));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || PRESET_AVATAR_LOGOS[0].url);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCopyPlayerId = () => {
    const idText = user?.playerId || user?.id || '';
    if (!idText) return;
    navigator.clipboard?.writeText(idText).catch(() => {});
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1800);
  };

  const handlePickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const dataUrl = await resizeAvatarImageFile(file);
      setAvatarUrl(dataUrl);
      soundManager.playUiMove();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const cleanName = username.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (cleanName.length < 2 || cleanName.length > 32) {
      setErrorMsg('Please enter a name between 2 and 32 characters.');
      return;
    }
    if (password.length < 4) {
      setErrorMsg('Please enter a password of at least 4 characters.');
      return;
    }

    setBusy(true);
    try {
      if (authTab === 'signup') {
        const created = await signupAccount({
          username: cleanName,
          password,
          avatarUrl,
          vCoins: localCoins,
          xp: localXP,
          unlockedCharacters: loadUnlockedCharacters(),
        });
        soundManager.playUiSelect();
        onAuthChange(created);
        setUsername(created.username);
        setPassword('');
        setStatusMsg('Fighter account created!');
      } else {
        const loggedIn = await loginAccount({ username: cleanName, password });
        soundManager.playUiSelect();
        onAuthChange(loggedIn);
        setUsername(loggedIn.username);
        setPassword('');
        setAvatarUrl(loggedIn.avatarUrl);
        setStatusMsg('Signed in successfully!');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);
    setStatusMsg(null);

    const cleanName = username.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (cleanName.length < 2 || cleanName.length > 32) {
      setErrorMsg('Username must be 2 to 32 characters.');
      return;
    }
    const minPass = user.authProvider === 'supabase' ? 6 : 4;
    if (password.trim().length > 0 && password.trim().length < minPass) {
      setErrorMsg(`New password must be at least ${minPass} characters.`);
      return;
    }

    setBusy(true);
    try {
      if (user.authProvider === 'supabase') {
        const updated = await updateSupabaseUserProfile({
          userId: user.id,
          email: user.email,
          username: cleanName,
          avatarUrl,
          ...(password.trim() ? { newPassword: password.trim() } : {}),
        });
        soundManager.playUiSelect();
        onAuthChange({ ...user, ...updated, xp: user.xp, vCoins: user.vCoins });
        setUsername(updated.username);
        setPassword('');
        setStatusMsg('Profile updated!');
      } else {
        const updated = await updateUserProfile({
          username: cleanName,
          avatarUrl,
          ...(password.trim() ? { password: password.trim() } : {}),
        });
        soundManager.playUiSelect();
        onAuthChange({ ...user, ...updated });
        setUsername(updated.username);
        setPassword('');
        setStatusMsg('Profile updated!');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    soundManager.playUiSelect();
    if (user?.authProvider === 'supabase') {
      await logoutSupabase(user.id);
    } else {
      logoutAccount();
    }
    onAuthChange(null);
    setUsername('');
    setPassword('');
    setAuthTab('login');
    setStatusMsg(null);
    setErrorMsg(null);
  };

  const showAvatarPicker = Boolean(user) || authTab === 'signup';
  const displayPlayerId =
    user?.playerId || (user?.id ? `FXP-${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}` : '');

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar flex flex-col items-center p-2 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundManager.playUiSelect();
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-2xl my-auto bg-gradient-to-b from-slate-900 via-slate-900/98 to-slate-950 border-2 border-amber-400/90 rounded-2xl p-4 sm:p-6 shadow-[0_0_55px_rgba(251,191,36,0.28)] space-y-4">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="font-pixel text-sm sm:text-base text-yellow-300 arcade-gold-shadow">
              {user ? 'FIGHTER PROFILE' : 'PLAYER ACCOUNT'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Fighter Username · Player ID · Avatar &amp; Stats</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundManager.playUiSelect();
              onClose();
            }}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePickPhoto}
          className="hidden"
        />

        {user ? (
          <form noValidate onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Left Column: Avatar, Player ID & Logos */}
            <div className="md:col-span-5 space-y-3 bg-slate-950/75 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full border-2 border-amber-400 overflow-hidden bg-slate-900 shrink-0 shadow-lg">
                  <img
                    src={avatarUrl}
                    alt={user.username}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover pixelated"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-pixel text-[9px]">
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>FIGHTER ACTIVE</span>
                  </div>
                  <div className="font-pixel text-xs text-white truncate mt-1">
                    {user.username}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-400/60 text-amber-200 font-pixel text-[8px] cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>UPLOAD PHOTO</span>
                  </button>
                </div>
              </div>

              {/* Unique Player ID */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 border border-slate-700">
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 font-semibold">PLAYER ID</div>
                  <div className="font-mono text-xs font-bold text-amber-300 truncate">{displayPlayerId}</div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPlayerId}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'COPIED' : 'COPY'}</span>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_AVATAR_LOGOS.map(logo => {
                  const selected = avatarUrl === logo.url;
                  return (
                    <button
                      key={logo.id}
                      type="button"
                      onClick={() => {
                        soundManager.playUiMove();
                        setAvatarUrl(logo.url);
                      }}
                      className={`relative p-1.5 rounded-lg border-2 flex flex-col items-center transition-all cursor-pointer ${
                        selected
                          ? 'border-yellow-400 bg-amber-950/60 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
                          : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                      }`}
                    >
                      <img
                        src={logo.url}
                        alt={logo.label}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 object-contain pixelated"
                      />
                      {selected && (
                        <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Stats + Edit Details */}
            <div className="md:col-span-7 space-y-3.5">
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950/85 border border-slate-800 text-center">
                <div>
                  <div className="font-pixel text-[8px] text-slate-400 flex items-center justify-center gap-1">
                    <Trophy className="w-3 h-3 text-emerald-400" /> WINS
                  </div>
                  <div className="font-pixel text-sm text-emerald-300 mt-0.5 tabular-nums">
                    {(user.wins ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="font-pixel text-[8px] text-slate-400 flex items-center justify-center gap-1">
                    <Swords className="w-3 h-3 text-rose-400" /> LOSSES
                  </div>
                  <div className="font-pixel text-sm text-rose-300 mt-0.5 tabular-nums">
                    {(user.losses ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="font-pixel text-[8px] text-slate-400">XP</div>
                  <div className="font-pixel text-sm text-cyan-300 mt-0.5 tabular-nums">
                    {Math.max(localXP, user.xp || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-pixel text-[9px] text-slate-300 mb-1.5">
                  FIGHTER USERNAME {isOwnerUser ? '(OWNER LOCKED)' : ''}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => {
                    if (!isOwnerUser) setUsername(e.target.value);
                  }}
                  readOnly={isOwnerUser}
                  maxLength={32}
                  placeholder="Enter your name"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm text-white ${
                    isOwnerUser ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block font-pixel text-[9px] text-slate-300 mb-1.5">
                  {isOwnerUser ? 'CHANGE OWNER PASSWORD (ALL DEVICES)' : 'NEW PASSWORD (OPTIONAL)'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    maxLength={64}
                    placeholder={isOwnerUser ? 'Enter custom private password...' : 'Leave blank to keep current'}
                    className="w-full pl-3.5 pr-11 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-950/75 border border-red-500/80 text-xs text-red-200">
                  {errorMsg}
                </div>
              )}
              {statusMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-950/75 border border-emerald-500/80 text-xs text-emerald-200">
                  {statusMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-pixel text-[10px] font-black border border-yellow-200 disabled:opacity-60 cursor-pointer"
                >
                  {busy ? 'SAVING...' : 'SAVE CHANGES'}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-3 px-4 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 font-pixel text-[10px] border border-red-700 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>LOG OUT</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form noValidate onSubmit={handleSubmitAuth} className="space-y-4">
            {/* Prominent Two-Option Switcher: SIGN UP & LOG IN */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  soundManager.playUiMove();
                  setAuthTab('signup');
                  setErrorMsg(null);
                  setStatusMsg(null);
                }}
                className={`py-2.5 rounded-lg font-pixel text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  authTab === 'signup'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>SIGN UP</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundManager.playUiMove();
                  setAuthTab('login');
                  setErrorMsg(null);
                  setStatusMsg(null);
                }}
                className={`py-2.5 rounded-lg font-pixel text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>LOG IN</span>
              </button>
            </div>

            <div className={`grid grid-cols-1 ${showAvatarPicker ? 'md:grid-cols-12' : ''} gap-5 items-start`}>
              {showAvatarPicker && (
                <div className="md:col-span-5 space-y-2.5 bg-slate-950/75 border border-slate-800 rounded-xl p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full border-2 border-amber-400 overflow-hidden bg-slate-900 shrink-0 shadow">
                      <img
                        src={avatarUrl}
                        alt="Selected Avatar"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover pixelated"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="font-pixel text-[9px] text-amber-300">CHOOSE PHOTO</div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-400/60 text-amber-200 font-pixel text-[8px] cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>UPLOAD PHOTO</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {PRESET_AVATAR_LOGOS.map(logo => {
                      const selected = avatarUrl === logo.url;
                      return (
                        <button
                          key={logo.id}
                          type="button"
                          onClick={() => {
                            soundManager.playUiMove();
                            setAvatarUrl(logo.url);
                          }}
                          className={`relative p-1 rounded-lg border-2 flex flex-col items-center transition-all cursor-pointer ${
                            selected
                              ? 'border-yellow-400 bg-amber-950/60 shadow-[0_0_10px_rgba(250,204,21,0.4)]'
                              : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                          }`}
                        >
                          <img
                            src={logo.url}
                            alt={logo.label}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 object-contain pixelated"
                          />
                          {selected && (
                            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={`${showAvatarPicker ? 'md:col-span-7' : ''} space-y-3`}>
                <div>
                  <label className="block font-pixel text-[9px] text-slate-300 mb-1.5">
                    FIGHTER USERNAME
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    maxLength={32}
                    autoComplete="username"
                    placeholder="Enter your fighter name"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block font-pixel text-[9px] text-slate-300 mb-1.5">
                    PASSWORD
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      maxLength={64}
                      autoComplete={authTab === 'signup' ? 'new-password' : 'current-password'}
                      placeholder="4+ characters"
                      className="w-full pl-3.5 pr-11 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-red-950/75 border border-red-500/80 text-xs text-red-200">
                    {errorMsg}
                  </div>
                )}
                {statusMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/75 border border-emerald-500/80 text-xs text-emerald-200">
                    {statusMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-yellow-500 hover:from-red-500 hover:to-yellow-400 text-slate-950 font-pixel text-xs font-black border-2 border-yellow-200 shadow-lg disabled:opacity-60 cursor-pointer transition-transform active:scale-98"
                >
                  {busy
                    ? 'PLEASE WAIT...'
                    : authTab === 'signup'
                    ? 'CREATE ACCOUNT ▶'
                    : 'LOG IN NOW ▶'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
