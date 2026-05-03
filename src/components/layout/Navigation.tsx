import React from 'react';
import { 
  LayoutDashboard, 
  Pill, 
  History, 
  BarChart3, 
  Settings, 
  LogOut, 
  Activity,
  User
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  role: 'patient' | 'caregiver';
  badges?: Record<string, number>;
}

export function Navigation({ activeTab, setActiveTab, onLogout, role, badges = {} }: NavigationProps) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'medicines', label: role === 'patient' ? 'Medicines' : 'Patient Meds', icon: Pill },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'device', label: 'IoT', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-[280px] h-screen border-r border-slate-900/50 flex-col p-6 bg-black/60 backdrop-blur-3xl gap-10">
        <div className="flex flex-col gap-1 px-2 py-4">
          <h1 className="text-2xl font-light tracking-tight text-white">
            MedSync <span className="font-bold text-emerald-400 text-[10px] align-top ml-1 tracking-widest uppercase">IoT Pro</span>
          </h1>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em]">Smart Patient Hub</p>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          {items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-sm group",
                  isActive 
                    ? "bg-slate-900 text-white border border-slate-800 shadow-xl"
                    : "text-slate-500 hover:text-white hover:bg-white/5"
                )}
              >
                <div className="relative">
                  <item.icon size={18} className={cn(
                    "transition-transform group-hover:scale-110",
                    isActive ? "text-emerald-500" : "text-white/20"
                  )} />
                  {badges[item.id] > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0A0A0A]">
                      {badges[item.id]}
                    </span>
                  )}
                </div>
                <span className="font-medium tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-6">
          <div className="p-4 rounded-[1.5rem] bg-slate-900/40 border border-slate-800/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center border border-slate-700 shadow-inner">
              <User size={16} className="text-white/80" />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate capitalize">{role}</p>
              <p className="text-[10px] text-slate-500 tracking-wider">SECURE SESSION</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-2 text-sm text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/5 rounded-xl transition-all group"
          >
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform opacity-60 group-hover:opacity-100" />
            <span className="font-medium uppercase tracking-[0.1em] text-[10px]">Disconnect</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-black/60 backdrop-blur-2xl border-t border-white/5 z-[100] flex items-center justify-around px-4 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.4)] pb-safe">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 transition-all p-2 relative min-w-[64px] min-h-[44px]",
                isActive ? "text-emerald-400" : "text-slate-500"
              )}
            >
              {isActive && (
                <motion.div 
                  layoutId="activeTabMobile"
                  className="absolute -top-1 w-8 h-1 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                />
              )}
              <div className="relative">
                <item.icon size={22} className={cn("transition-transform", isActive && "scale-110")} />
                {badges[item.id] > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 text-black text-[9px] font-black rounded-full flex items-center justify-center">
                    {badges[item.id]}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
