import React, { useState } from 'react';
import { auth, googleProvider, db } from '../../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Pill, ShieldCheck, Heart, Users } from 'lucide-react';
import { motion } from 'motion/react';

export function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'patient' | 'caregiver'>('patient');

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          userId: result.user.uid,
          email: result.user.email,
          name: result.user.displayName,
          role: role,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center technical-grid p-6 bg-[#050505]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full immersive-card p-10 space-y-10 relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 blur-[100px]"></div>
        
        <div className="text-center space-y-3 relative">
          <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-black rounded-[2rem] flex items-center justify-center border border-slate-700 shadow-2xl mx-auto mb-8 group hover:scale-110 transition-transform">
            <ShieldCheck size={40} className="text-emerald-500 group-hover:text-emerald-400 transition-colors" />
          </div>
          <h1 className="text-4xl font-light tracking-tight text-white">
            MedSync <span className="font-bold text-emerald-400 text-sm align-top ml-1 tracking-widest uppercase">Pro</span>
          </h1>
          <p className="text-slate-500 text-xs uppercase tracking-[0.2em]">Patient Adherence Intelligence</p>
        </div>

        <div className="space-y-5">
          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 block text-center">Establish Identity</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setRole('patient')}
              className={`p-6 rounded-[2.5rem] border transition-all flex flex-col items-center gap-3 group relative overflow-hidden ${
                role === 'patient' 
                ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-[0_0_40px_rgba(16,185,129,0.1)]' 
                : 'border-slate-800 bg-slate-900/20 text-slate-500 hover:bg-slate-900/40'
              }`}
            >
              {role === 'patient' && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />}
              <Heart size={28} className={role === 'patient' ? 'text-emerald-500' : 'text-slate-700'} />
              <span className="text-xs font-bold uppercase tracking-widest">Patient</span>
            </button>
            <button
              onClick={() => setRole('caregiver')}
              className={`p-6 rounded-[2.5rem] border transition-all flex flex-col items-center gap-3 group relative overflow-hidden ${
                role === 'caregiver' 
                ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-[0_0_40px_rgba(245,158,11,0.1)]' 
                : 'border-slate-800 bg-slate-900/20 text-slate-500 hover:bg-slate-900/40'
              }`}
            >
              {role === 'caregiver' && <div className="absolute inset-0 bg-amber-500/5 animate-pulse" />}
              <Users size={28} className={role === 'caregiver' ? 'text-amber-500' : 'text-slate-700'} />
              <span className="text-xs font-bold uppercase tracking-widest">Caregiver</span>
            </button>
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-white text-black font-black uppercase tracking-[0.1em] h-14 rounded-full hover:bg-slate-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:scale-[1.02] active:scale-[0.98]"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Sign In With Google
            </>
          )}
        </button>

        <div className="pt-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-700 font-bold">IoT Encryption Enabled</p>
        </div>
      </motion.div>
    </div>
  );
}
