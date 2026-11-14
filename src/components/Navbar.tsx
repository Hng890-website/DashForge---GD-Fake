import React from 'react';
import { LogIn, LogOut, Star } from 'lucide-react';
import { PlayerPublicProfile } from '../types/game';

export type AppTab = 'official' | 'server' | 'editor' | 'icons';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  profile: PlayerPublicProfile;
  isSignedIn: boolean;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  profile,
  isSignedIn,
  authLoading,
  onSignIn,
  onSignOut,
}) => {
  const navItems: { id: AppTab; label: string }[] = [
    { id: 'official', label: 'Official Levels' },
    { id: 'server', label: 'Server' },
    { id: 'editor', label: 'Level Editor' },
    { id: 'icons', label: 'Icon Kit' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B14]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('official')}
          className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer hover:text-cyan-400 transition-colors"
        >
          DashForge
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="flex items-center gap-6 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[15px] h-[2px] bg-cyan-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary account action */}
        <div className="flex items-center gap-3 shrink-0">
          {isSignedIn ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap">
                <span className="font-semibold text-white max-w-[140px] truncate">{profile.displayName}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="inline-flex items-center gap-1 font-mono-num text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  {profile.stars}
                </span>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={authLoading}
              onClick={onSignIn}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{authLoading ? 'Đang kết nối...' : 'Đăng nhập Google'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
