import React, { useState } from 'react';
import { auth, googleProvider, db } from '../../lib/firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Pill, ShieldCheck, Heart, Users, Mail, Lock, User, Sparkles, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthScreenProps {
  onDemoLogin?: (role: 'patient' | 'caregiver') => void;
}

export function AuthScreen({ onDemoLogin }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'patient' | 'caregiver'>('patient');
  const [activeTab, setActiveTab] = useState<'demo' | 'email' | 'google'>('demo');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
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
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setErrorMsg('Domain not authorized for Google Sign-in. Please use "Email Auth" or "Quick Demo".');
      } else {
        setErrorMsg(error.message || 'Google authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Email login failed:", error);
      setErrorMsg(error.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Name is required.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(userRef, {
        userId: result.user.uid,
        email: result.user.email,
        name: name,
        role: role,
        patientId: role === 'caregiver' ? 'mock_patient_1' : undefined,
        createdAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Email registration failed:", error);
      setErrorMsg(error.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center technical-grid p-6 bg-[#050505]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full immersive-card p-8 sm:p-10 space-y-8 relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 blur-[100px]"></div>
        
        <div className="text-center space-y-3 relative">
          <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-black rounded-[2rem] flex items-center justify-center border border-slate-700 shadow-2xl mx-auto mb-6 group hover:scale-110 transition-transform">
            <ShieldCheck size={40} className="text-emerald-500 group-hover:text-emerald-400 transition-colors" />
          </div>
          <h1 className="text-4xl font-light tracking-tight text-white">
            MedSync <span className="font-bold text-emerald-400 text-sm align-top ml-1 tracking-widest uppercase">Pro</span>
          </h1>
          <p className="text-slate-500 text-xs uppercase tracking-[0.2em]">Patient Adherence Intelligence</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5 w-full">
          {(['demo', 'email', 'google'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === tab ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white"
              }`}
            >
              {tab === 'demo' ? 'Quick Demo' : tab === 'email' ? 'Email Auth' : 'Google Auth'}
            </button>
          ))}
        </div>

        {/* Role Selector */}
        <div className="space-y-4">
          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 block text-center">
            Identify Role {activeTab === 'email' && authMode === 'login' ? '(Defined on Signup)' : ''}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setRole('patient')}
              disabled={activeTab === 'email' && authMode === 'login'}
              className={`p-4 rounded-[2rem] border transition-all flex flex-col items-center gap-2 group relative overflow-hidden ${
                role === 'patient' 
                ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-[0_0_45px_rgba(16,185,129,0.08)]' 
                : 'border-slate-800 bg-slate-900/20 text-slate-500 hover:bg-slate-900/40'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {role === 'patient' && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />}
              <Heart size={22} className={role === 'patient' ? 'text-emerald-500' : 'text-slate-700'} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Patient</span>
            </button>
            <button
              onClick={() => setRole('caregiver')}
              disabled={activeTab === 'email' && authMode === 'login'}
              className={`p-4 rounded-[2rem] border transition-all flex flex-col items-center gap-2 group relative overflow-hidden ${
                role === 'caregiver' 
                ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-[0_0_45px_rgba(245,158,11,0.08)]' 
                : 'border-slate-800 bg-slate-900/20 text-slate-500 hover:bg-slate-900/40'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {role === 'caregiver' && <div className="absolute inset-0 bg-amber-500/5 animate-pulse" />}
              <Users size={22} className={role === 'caregiver' ? 'text-amber-500' : 'text-slate-700'} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Caregiver</span>
            </button>
          </div>
        </div>

        {/* Error Messages */}
        {errorMsg && (
          <div className="flex gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-xs items-center leading-relaxed">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Active Content Body */}
        <div className="space-y-4">
          {activeTab === 'demo' && (
            <div className="space-y-6">
              <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2.5rem space-y-2 text-center">
                <Sparkles className="text-emerald-500 mx-auto" size={20} />
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  Bypass authentication and explore all MedSync Pro capabilities locally with mock data and active simulated hardware.
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Interactive IoT Simulation Mode
                </p>
              </div>

              <button
                onClick={() => onDemoLogin && onDemoLogin(role)}
                className="w-full h-14 bg-white text-black font-black uppercase tracking-[0.15em] text-xs rounded-full hover:bg-slate-100 transition-all flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(255,255,255,0.05)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Launch Demo Workspace
              </button>
            </div>
          )}

          {activeTab === 'email' && (
            <form onSubmit={authMode === 'login' ? handleEmailLogin : handleEmailRegister} className="space-y-4">
              {authMode === 'register' && (
                <div className="space-y-1 relative">
                  <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Full Name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                      required
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-1 relative">
                <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="email"
                    placeholder="name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1 relative">
                <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-white text-black font-black uppercase tracking-[0.1em] text-xs rounded-full hover:bg-slate-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] cursor-pointer mt-4"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  authMode === 'login' ? 'Sign In' : 'Create Account'
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setErrorMsg('');
                  }}
                  className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-white transition-colors cursor-pointer"
                >
                  {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign In"}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'google' && (
            <div className="space-y-4">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white text-black font-black uppercase tracking-[0.1em] h-14 rounded-full hover:bg-slate-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_20px_40px_rgba(255,255,255,0.05)] hover:scale-[1.02] active:scale-[0.98]"
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
            </div>
          )}
        </div>

        <div className="pt-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-700 font-bold">IoT Encryption Enabled</p>
        </div>
      </motion.div>
    </div>
  );
}
