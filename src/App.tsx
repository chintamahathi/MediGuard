import React, { useState, useEffect, useCallback } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { AuthScreen } from './components/auth/AuthScreen';
import { Navigation } from './components/layout/Navigation';
import { parsePrescription, getAdherenceInsights } from './services/geminiService';
import { getScheduleOptimization, AdherenceRisk } from './services/geminiService';
import { PrescriptionUploader } from './components/medicines/PrescriptionUploader';
import { MedicineFormCard } from './components/medicines/MedicineFormCard';
import { 
  UserRole, 
  UserProfile, 
  Medicine, 
  IntakeLog, 
  DeviceStatus 
} from './types';
import { 
  Bell, 
  Plus, 
  Camera,
  Edit3,
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Info,
  Mic,
  Volume2,
  Cpu,
  Trash2,
  ChevronRight,
  Settings,
  Pill,
  LayoutDashboard,
  History,
  BarChart3,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { speak } from './lib/voice';
import { cn } from './lib/utils';
import { MOCK_DATA } from './data/mockData';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format, isSameDay, parseISO, startOfToday, addDays, subDays } from 'date-fns';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [logs, setLogs] = useState<IntakeLog[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [insights, setInsights] = useState<string>("");
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Authentication Listener
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUser(snap.data() as UserProfile);
          }
          setAuthLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
          setAuthLoading(false);
        });
      } else {
        setUser(null);
        setAuthLoading(false);
        setMedicines([]);
        setLogs([]);
        setDeviceStatus(null);
      }
    });
  }, []);

  // Data Fetching based on role
  useEffect(() => {
    if (!user) return;

    const targetPatientId = user.role === 'patient' ? user.userId : user.patientId;
    if (!targetPatientId) {
      setMedicines([]);
      setLogs([]);
      setDeviceStatus(null);
      return;
    }

    // Medicines
    const qMeds = query(collection(db, 'medicines'), where('patientId', '==', targetPatientId));
    const unsubscribeMeds = onSnapshot(qMeds, (snap) => {
      setMedicines(snap.docs.map(d => ({ ...d.data(), id: d.id } as Medicine)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'medicines'));

    // Logs
    const qLogs = query(collection(db, 'logs'), where('patientId', '==', targetPatientId), orderBy('scheduledTime', 'desc'));
    const unsubscribeLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ ...d.data(), id: d.id } as IntakeLog)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'logs'));

    // Device Status
    const deviceRef = doc(db, 'deviceStatus', targetPatientId);
    const unsubscribeDevice = onSnapshot(deviceRef, (snap) => {
      if (snap.exists()) {
        setDeviceStatus(snap.data() as DeviceStatus);
      }
    }, err => handleFirestoreError(err, OperationType.GET, `deviceStatus/${targetPatientId}`));

    // Notifications
    const qNotifs = query(collection(db, 'notifications'), where('patientId', '==', targetPatientId), orderBy('timestamp', 'desc'));
    const unsubscribeNotifs = onSnapshot(qNotifs, (snap) => {
      setNotifications(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    }, err => handleFirestoreError(err, OperationType.LIST, 'notifications'));

    return () => {
      unsubscribeMeds();
      unsubscribeLogs();
      unsubscribeDevice();
      unsubscribeNotifs();
    };
  }, [user]);

  // Insights Trigger
  useEffect(() => {
    if (activeTab === 'analytics' && logs.length > 0 && !insights) {
      setLoadingInsights(true);
      getAdherenceInsights(logs, medicines).then(res => {
        setInsights(res);
        setLoadingInsights(false);
      });
    }
  }, [activeTab, logs, medicines]);

  const handleLogout = () => signOut(auth);

  const badges = {
    dashboard: logs.filter(l => 
      isSameDay(parseISO(l.scheduledTime), new Date()) && 
      l.status === 'missed'
    ).length
  };

  if (authLoading) return (
    <div className="h-screen flex items-center justify-center bg-[#0C0C0D] italic font-serif text-white/20 animate-pulse">
      Initialising secure access...
    </div>
  );

  if (!user) return <AuthScreen />;

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
      <Navigation 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
        role={user.role} 
        badges={badges}
      />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative pb-24 lg:pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-6xl mx-auto space-y-8"
          >
            <Header user={user} deviceStatus={deviceStatus} />
            
            {activeTab === 'dashboard' && (
              <Dashboard 
                medicines={medicines} 
                logs={logs} 
                user={user} 
                deviceStatus={deviceStatus}
                notifications={notifications}
              />
            )}
            
            {activeTab === 'medicines' && (
               <MedicineSchedule 
                 medicines={medicines} 
                 patientId={user.role === 'patient' ? user.userId : user.patientId!}
                 user={user}
               />
            )}

            {activeTab === 'analytics' && (
               <Analytics 
                 logs={logs} 
                 insights={insights} 
                 loading={loadingInsights} 
                 medicines={medicines}
               />
            )}

            {activeTab === 'device' && (
               <DevicePanel 
                 deviceStatus={deviceStatus} 
                 patientId={user.role === 'patient' ? user.userId : user.patientId!}
                 isPatient={user.role === 'patient'}
                 medicines={medicines}
                 logs={logs}
               />
            )}

            {activeTab === 'settings' && (
               <SettingsPage user={user} onLogout={handleLogout} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function SettingsPage({ user, onLogout }: { user: UserProfile, onLogout: () => void }) {
  const isCaregiver = user.role === 'caregiver';
  const [activeSettingTab, setActiveSettingTab] = useState<'profile' | 'notifications' | 'caregiver' | 'device'>('profile');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h3 className="text-3xl font-light tracking-tight text-white">System Settings</h3>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] mt-1">Configuration & Security</p>
        </div>
        
        <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5 w-full sm:w-auto overflow-x-auto">
          {(['profile', 'notifications', 'caregiver', 'device'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSettingTab(tab)}
              className={cn(
                "flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                activeSettingTab === tab ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSettingTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSettingTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="immersive-card p-6 md:p-8 space-y-6">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Account Profile</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <span className="text-sm text-slate-400">Name</span>
                    <span className="text-sm text-white font-medium">{user.name}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <span className="text-sm text-slate-400">Identity Role</span>
                    <span className="text-sm text-emerald-400 font-bold uppercase tracking-widest">{user.role}</span>
                  </div>
                </div>
              </div>

              <div className="immersive-card p-6 md:p-8 space-y-6">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500">Danger Zone</h4>
                <div className="space-y-4">
                  <p className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-widest">
                    Critical operations that modify or destroy clinical data records.
                  </p>
                  <div className="space-y-3">
                    <button 
                      onClick={onLogout}
                      className="w-full py-4 bg-slate-900 border border-slate-800 text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-all"
                    >
                      Disconnect Session
                    </button>
                    <div className="relative group">
                      <button 
                        disabled={isCaregiver}
                        className={cn(
                          "w-full py-4 border rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
                          isCaregiver 
                            ? "bg-slate-900/10 border-slate-900 text-slate-700 cursor-not-allowed" 
                            : "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white"
                        )}
                      >
                        Terminate Patient Account
                      </button>
                      {isCaregiver && (
                        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-slate-900 border border-slate-800 rounded-xl text-[9px] text-slate-500 uppercase tracking-widest text-center opacity-0 group-hover:opacity-100 transition-opacity">
                          Access Denied: Caregivers cannot delete patient records.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSettingTab === 'caregiver' && (
            <div className="space-y-6">
              <div className="immersive-card p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold">Caregiver Authority</h4>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Manage clinical oversight</p>
                  </div>
                </div>
                
                <p className="text-sm text-slate-400 leading-relaxed">
                  Designate a trusted caregiver to monitor adherence, manage prescriptions, and receive emergency alerts.
                </p>

                <div className="pt-6 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-500">JD</div>
                      <div>
                        <p className="text-sm font-bold">John Doe (Primary)</p>
                        <p className="text-[9px] text-emerald-500 uppercase tracking-widest font-bold">Verified Provider</p>
                      </div>
                    </div>
                    <button className="text-[10px] font-bold uppercase tracking-widest text-rose-500 p-2 hover:bg-rose-500/10 rounded-xl transition-all">Revoke</button>
                  </div>

                  <button className="w-full py-4 border border-dashed border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400 transition-all">
                    + Link New Caregiver
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSettingTab === 'notifications' && (
            <div className="immersive-card p-8 space-y-6">
               <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Notification Preferences</h4>
               <div className="space-y-4">
                 {[
                   { label: 'Medicine Reminders', desc: 'Alerts when it is time to take doses' },
                   { label: 'Missed Dose Alerts', desc: 'Critical alerts for missed medications' },
                   { label: 'Device Low Battery', desc: 'IoT hardware maintenance notices' },
                   { label: 'Caregiver Updates', desc: 'Logs of prescription modifications' }
                 ].map((pref) => (
                   <div key={pref.label} className="flex items-center justify-between p-4 bg-slate-900/30 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-sm font-bold">{pref.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{pref.desc}</p>
                      </div>
                      <div className="w-12 h-6 bg-emerald-500 p-1 rounded-full flex justify-end">
                        <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {activeSettingTab === 'device' && (
            <div className="immersive-card p-8 space-y-6">
               <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">IoT Ecosystem Configuration</h4>
               <div className="space-y-4">
                  <div className="p-4 bg-slate-900/30 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-center">
                       <span className="text-sm font-bold">Hardware UUID</span>
                       <span className="text-xs font-mono text-slate-500">SYNC-RX-8829-X</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-widest">
                       <span className="text-slate-500">Connectivity</span>
                       <span className="text-emerald-500 font-black flex items-center gap-1">
                         <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Online
                       </span>
                    </div>
                  </div>
                  
                  <div className="grid gap-3">
                    <button className="w-full py-4 bg-slate-900/50 border border-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-800 transition-all">Re-calibrate Load Cell</button>
                    <button className="w-full py-4 bg-slate-900/50 border border-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-800 transition-all">Factory Reset IoT Hub</button>
                  </div>
               </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Header({ user, deviceStatus }: { user: UserProfile, deviceStatus: DeviceStatus | null }) {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 pb-4">
      <div className="flex flex-col">
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-white flex items-center">
          MedSync <span className="font-bold text-emerald-400 text-xs sm:text-sm align-top ml-1 tracking-widest uppercase">IoT Pro</span>
        </h1>
        <p className="text-slate-500 text-[10px] sm:text-sm uppercase tracking-[0.2em]">{user.role} Dashboard</p>
      </div>

      <div className="flex gap-4 sm:gap-6 items-center w-full sm:w-auto justify-between sm:justify-end">
        <div className="bg-slate-900/50 border border-slate-800 px-4 py-2 rounded-full flex items-center gap-3">
          <div className="relative">
            <div className={cn("w-2 h-2 rounded-full", deviceStatus ? "bg-emerald-500" : "bg-slate-700")}></div>
            {deviceStatus && <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-75"></div>}
          </div>
          <span className="text-[10px] font-bold tracking-wider text-slate-400">
            IOT HUB: {deviceStatus ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
        <button className="w-11 h-11 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl border border-slate-700 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
          <Bell size={18} className="text-slate-300" />
        </button>
      </div>
    </header>
  );
}

interface MedicineCardProps {
  entry: any;
  logs: IntakeLog[];
  patientId: string;
  isNext?: boolean;
}

const MedicineCard: React.FC<MedicineCardProps> = ({ entry, logs, patientId, isNext }) => {
  const log = logs.find(l => l.medicineId === entry.med.id && isSameDay(parseISO(l.scheduledTime), startOfToday()));
  const isTaken = log?.status === 'taken';
  const isMissed = log?.status === 'missed';

  const markTaken = async () => {
    const logId = `${entry.med.id}-${format(new Date(), 'yyyy-MM-dd')}`;
    try {
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        patientId,
        medicineId: entry.med.id,
        medicineName: entry.med.name,
        status: 'taken',
        scheduledTime: entry.fullTime,
        confirmedTime: new Date().toISOString()
      });
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'logs'); }
  };

  if (isNext) {
    return (
      <div className="relative bg-white/5 border border-white/10 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-8 overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent opacity-50"></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex gap-4 md:gap-6 items-center">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-500 rounded-[1rem] md:rounded-[1.5rem] shadow-[0_0_30px_rgba(245,158,11,0.3)] flex items-center justify-center text-black font-black text-xl md:text-2xl">
              {entry.time.split(':')[0]}
            </div>
            <div>
              <span className="text-amber-400 text-[10px] font-bold uppercase tracking-[0.2em] block mb-1">Upcoming - {entry.time}</span>
              <h4 className="text-xl md:text-3xl font-bold text-white break-words">{entry.med.name} <span className="text-slate-400 font-light text-lg md:text-xl ml-2">{entry.med.dosage}</span></h4>
              <p className="text-slate-400 text-xs md:text-sm mt-1">IoT Monitoring active</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-2">
            <button 
              onClick={markTaken}
              className="w-full md:px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl text-[10px] md:text-xs"
            >
              MARK AS TAKEN
            </button>
            <button className="w-full md:px-8 py-3 bg-slate-800 text-white font-medium rounded-full hover:bg-slate-700 transition-all text-[10px] md:text-xs opacity-60">SNOOZE</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900/40 border border-slate-800/50 p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] transition-all gap-4",
      isTaken ? "opacity-60" : ""
    )}>
      <div className="flex gap-4 md:gap-6 items-center w-full sm:w-auto">
        <div className={cn(
          "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all shrink-0",
          isTaken ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : 
          isMissed ? "bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]" :
          "bg-slate-800/50 text-slate-400"
        )}>
          {isTaken ? <CheckCircle2 size={20} /> : isMissed ? <XCircle size={20} /> : <div className="text-[10px] md:text-xs font-bold font-mono">{entry.time.split(':')[0]}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-base md:text-lg font-semibold text-white truncate">{entry.med.name} <span className="text-slate-500 font-normal ml-2">{entry.med.dosage}</span></h4>
          <p className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            {isTaken ? `Taken at ${format(parseISO(log.confirmedTime!), 'hh:mm a')}` : 
             isMissed ? `Missed at ${entry.time}` : 
             `Scheduled at ${entry.time}`}
          </p>
        </div>
      </div>
      <span className="text-slate-600 font-mono text-[9px] md:text-[10px] uppercase tracking-widest hidden sm:block">{entry.time < '12:00' ? 'Morning' : entry.time < '17:00' ? 'Afternoon' : 'Evening'} Cycle</span>
    </div>
  );
};

function Dashboard({ medicines, logs, user, deviceStatus, notifications }: { medicines: Medicine[], logs: IntakeLog[], user: UserProfile, deviceStatus: DeviceStatus | null, notifications: any[] }) {
  const today = startOfToday();
  
  // Calculate upcoming meds
  const upcoming = medicines.flatMap(m => m.times.map(t => ({
    med: m,
    time: t,
    fullTime: `${format(today, 'yyyy-MM-dd')}T${t}:00`
  }))).sort((a, b) => a.time.localeCompare(b.time));

  // Adherence calc for 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, i);
    const dayLogs = logs.filter(l => isSameDay(parseISO(l.scheduledTime), d));
    const takenCount = dayLogs.filter(l => l.status === 'taken').length;
    const totalCount = dayLogs.length;
    return totalCount > 0 ? (takenCount / totalCount) * 100 : 0;
  }).reverse();

  const currentAdherence = last7Days[6] || 0;
  const takenCount = logs.filter(l => isSameDay(parseISO(l.scheduledTime), today) && l.status === 'taken').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      {/* Left Sidebar: Analytics & Stats */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="immersive-card p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 blur-[80px]"></div>
          <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">7-Day Adherence</h3>
          <div className="flex items-end gap-4">
            <span className="text-4xl md:text-6xl font-light text-white leading-none">{Math.round(currentAdherence)}%</span>
            <span className="text-emerald-400 text-[10px] md:text-xs font-semibold mb-1 uppercase tracking-wider">Verified</span>
          </div>
          <div className="mt-4 flex items-end gap-1 h-24 md:h-32">
            {last7Days.map((h, i) => (
              <div 
                key={i} 
                className={cn("flex-grow rounded-t-lg md:rounded-t-xl transition-all", i === 6 ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "bg-emerald-500/20 hover:bg-emerald-500/40")} 
                style={{ height: `${Math.max(h, 5)}%` }}
              ></div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800/50 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Recent Activity</h3>
            <Bell size={14} className="text-slate-600" />
          </div>
          <div className="space-y-4">
            {notifications.slice(0, 3).map((n) => (
              <div key={n.id} className="flex gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-1.5 shrink-0",
                  n.type === 'alert' ? "bg-rose-500" : n.type === 'fall' ? "bg-amber-500" : "bg-emerald-500"
                )} />
                <div>
                  <p className="text-[11px] text-white/80 leading-tight">{n.message}</p>
                  <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-wider">{format(parseISO(n.timestamp), 'hh:mm a')}</p>
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <p className="text-[10px] text-slate-600 italic text-center py-4">No recent activity</p>
            )}
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800/50 p-8 rounded-[2.5rem] space-y-6">
          <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Device Telemetry</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
              <span className="text-slate-500">Weight Load</span>
              <span className="text-white font-mono">{deviceStatus?.lastWeight?.toFixed(1) || '0.0'}g</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
              <span className="text-slate-500">Lid Status</span>
              <span className={cn("font-bold uppercase text-[10px]", deviceStatus?.isBoxOpen ? "text-rose-400" : "text-emerald-400")}>
                {deviceStatus?.isBoxOpen ? "OPENED" : "SECURE"}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Battery Node</span>
              <span className="text-emerald-400 font-mono">{deviceStatus?.batteryLevel || 100}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Main Timeline */}
      <div className="lg:col-span-8 flex flex-col">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl md:text-3xl font-light text-white tracking-tight">Today's Schedule</h2>
          <div className="flex gap-2 text-[8px] md:text-[10px] font-bold uppercase tracking-wider">
            <span className="flex items-center gap-2 px-3 md:px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">Taken ({takenCount})</span>
            <span className="flex items-center gap-2 px-3 md:px-4 py-1.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">Pending ({upcoming.length - takenCount})</span>
          </div>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto pr-2 custom-scrollbar">
          {upcoming.length > 0 ? upcoming.map((u: any, i: number) => {
             const log = logs.find(l => l.medicineId === u.med.id && isSameDay(parseISO(l.scheduledTime), today));
             const isNext = !log && upcoming.findIndex(entry => !logs.find(l => l.medicineId === entry.med.id && isSameDay(parseISO(l.scheduledTime), today))) === i;
             return <MedicineCard key={i} entry={u} logs={logs} patientId={user.role === 'patient' ? user.userId : user.patientId!} isNext={isNext} />;
          }) : (
            <div className="p-20 text-center flex flex-col items-center gap-4 opacity-20 italic">
               <Pill size={48} />
               <p>No medicines detected in schedule.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MedicineSchedule({ medicines, patientId, user }: { medicines: Medicine[], patientId: string, user: UserProfile }) {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'add' | 'scan'>('list');
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [extractMode, setExtractMode] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [tempMedicines, setTempMedicines] = useState<Partial<Medicine>[]>([]);
  
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);

  const createNotification = async (type: string, message: string) => {
    try {
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'notifications', id), {
        id,
        patientId,
        type,
        message,
        timestamp: new Date().toISOString()
      });
    } catch (err) { console.error("Failed to notify:", err); }
  };

  const addMedicine = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const id = Math.random().toString(36).substr(2, 9);
      const audit = {
        lastUpdatedBy: user.userId,
        lastUpdatedByName: user.name,
        lastUpdatedAt: new Date().toISOString(),
      };
      
      await setDoc(doc(db, 'medicines', id), {
        id,
        patientId,
        name,
        dosage,
        times,
        frequency: 'once daily',
        createdAt: new Date().toISOString(),
        ...audit
      });

      if (user.role === 'caregiver') {
        createNotification('info', `Caregiver added new medicine: ${name}`);
      }

      setShowAdd(false);
      setName('');
      setDosage('');
      setTimes(['08:00']);
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'medicines'); }
  };

  const updateMedicine = async (med: Partial<Medicine>) => {
    if (!med.id) return;
    try {
      const audit = {
        lastUpdatedBy: user.userId,
        lastUpdatedByName: user.name,
        lastUpdatedAt: new Date().toISOString(),
      };
      
      await updateDoc(doc(db, 'medicines', med.id), {
        ...med,
        ...audit
      });

      if (user.role === 'caregiver') {
        createNotification('alert', `Caregiver updated prescription for ${med.name}`);
      }

      setEditingMed(null);
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `medicines/${med.id}`); }
  };

  const handleExtracted = (data: any[]) => {
    setTempMedicines(data.map(m => ({
      ...m,
      patientId,
      isVerified: false,
      lastUpdatedBy: user.userId,
      lastUpdatedByName: user.name,
      lastUpdatedAt: new Date().toISOString(),
    })));
    setShowScan(false);
    setExtractMode(true);
  };

  const saveExtracted = async () => {
    try {
      for (const m of tempMedicines) {
        if (!m.name) continue;
        const id = Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'medicines', id), {
          ...m,
          id,
          patientId,
          createdAt: new Date().toISOString(),
          isVerified: true,
          lastUpdatedBy: user.userId,
          lastUpdatedByName: user.name,
          lastUpdatedAt: new Date().toISOString(),
        });
      }
      
      if (user.role === 'caregiver') {
        createNotification('info', `Caregiver verified and added ${tempMedicines.length} medicine(s) from prescription scan`);
      }

      setExtractMode(false);
      setTempMedicines([]);
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'medicines'); }
  };

  const deleteMed = async (id: string) => {
    if (user.role === 'caregiver') {
      alert("Security: Caregivers aren't permitted to delete medications. Please deactivate them or coordinate with the patient.");
      return;
    }
    if (confirm("Remove this medicine from patient registry?")) {
      await deleteDoc(doc(db, 'medicines', id));
    }
  };

  if (extractMode) {
    return (
      <div className="space-y-8 pb-20">
        <div className="flex justify-between items-end">
          <div>
            <h3 className="text-4xl font-light tracking-tight text-white">Review Extraction</h3>
            <p className="text-slate-500 text-xs uppercase tracking-[0.2em] mt-2">Verify AI parsed clinical data</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => { setExtractMode(false); setTempMedicines([]); }}
              className="px-8 py-3 bg-slate-900 border border-slate-800 text-slate-400 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={saveExtracted}
              className="px-8 py-3 bg-white text-black rounded-full font-black text-xs uppercase tracking-widest shadow-xl shadow-white/5 hover:scale-105 active:scale-95 transition-all"
            >
              Save All Medicines
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {tempMedicines.map((m, idx) => (
            <MedicineFormCard 
              key={idx}
              medicine={m}
              onUpdate={(updated) => {
                const newMeds = [...tempMedicines];
                newMeds[idx] = updated;
                setTempMedicines(newMeds);
              }}
              onRemove={() => setTempMedicines(tempMedicines.filter((_, i) => i !== idx))}
              currentUser={user}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h3 className="text-2xl md:text-3xl font-light tracking-tight text-white">Medication Inventory</h3>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] mt-1">Managed via IoT Sync</p>
        </div>
        
        <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5 w-full sm:w-auto">
          {(['list', 'add', 'scan'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                if (tab === 'add') setShowAdd(true);
                else if (tab === 'scan') setShowScan(true);
                else setActiveSubTab('list');
              }}
              className={cn(
                "flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                (activeSubTab === tab && tab === 'list') ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white"
              )}
            >
              {tab === 'list' ? 'My Meds' : tab === 'add' ? 'Add' : 'Scan'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {medicines.length > 0 ? medicines.map(m => (
          <div key={m.id} className="immersive-card p-6 flex flex-col gap-6 group relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/5 blur-[40px] group-hover:bg-emerald-500/10 transition-all"></div>
            <div className="flex justify-between items-start relative">
               <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 bg-slate-900/50 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                    <Pill size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-white leading-tight">{m.name}</h4>
                    <p className="text-emerald-500/60 text-[10px] font-bold uppercase tracking-widest mt-1">{m.dosage}</p>
                  </div>
               </div>
               <div className="flex gap-2">
                 <button 
                  onClick={() => setEditingMed(m)} 
                  className="text-slate-700 hover:text-emerald-500 transition-colors p-2 bg-slate-900/30 rounded-xl"
                  title="Edit Prescription"
                 >
                   <Edit3 size={16} />
                 </button>
                 <button onClick={() => deleteMed(m.id)} className="text-slate-700 hover:text-rose-500 transition-colors p-2 bg-slate-900/30 rounded-xl">
                   <Trash2 size={16} />
                 </button>
               </div>
            </div>
            
            <div className="space-y-3 relative">
               <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-slate-600">
                  <span>Schedule</span>
                  <span>{m.frequency}</span>
               </div>
               <div className="flex flex-wrap gap-2">
                 {m.times.map(t => (
                   <span key={t} className="px-3 py-1.5 bg-slate-900/50 rounded-xl text-[10px] font-mono border border-slate-800 text-slate-400">{t}</span>
                 ))}
               </div>
            </div>

            {m.lastUpdatedByName && (
              <div className="pt-4 border-t border-white/5 flex items-center gap-2">
                <Clock size={12} className="text-slate-700" />
                <span className="text-[9px] text-slate-600 uppercase tracking-wider">
                  Updated by {m.lastUpdatedByName} {m.lastUpdatedAt && ` • ${format(parseISO(m.lastUpdatedAt), 'MMM dd')}`}
                </span>
              </div>
            )}

            {m.notes && (
              <p className="text-[10px] text-slate-500 italic bg-white/5 p-3 rounded-xl border border-white/5">
                "{m.notes}"
              </p>
            )}
          </div>
        )) : (
          <div className="col-span-full py-32 text-center flex flex-col items-center gap-6 opacity-20">
            <Pill size={64} className="animate-pulse" />
            <div className="space-y-1">
              <p className="text-2xl font-light tracking-tight">System Empty</p>
              <p className="text-xs uppercase tracking-widest">Connect prescription to begin</p>
            </div>
          </div>
        )}
      </div>

      {showScan && <PrescriptionUploader onExtracted={handleExtracted} onClose={() => setShowScan(false)} />}

      {showAdd && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-[#0A0A0A] border-t sm:border border-white/10 p-6 md:p-10 rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-2xl min-h-[80vh] sm:min-h-0 gap-8 flex flex-col relative overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 blur-[100px]"></div>
            
            <div className="text-center space-y-1">
              <h3 className="text-2xl md:text-3xl font-light tracking-tight text-white">Manual Registry</h3>
              <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em]">Input clinical specifications</p>
            </div>

            <MedicineFormCard 
              medicine={{ name, dosage, times, frequency: 'once daily' }}
              onUpdate={(u) => {
                if (u.name !== undefined) setName(u.name);
                if (u.dosage !== undefined) setDosage(u.dosage);
                if (u.times !== undefined) setTimes(u.times);
              }}
              isNew
              currentUser={user}
            />

            <div className="flex flex-col sm:flex-row gap-4 mt-auto">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-4 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors order-2 sm:order-1">Cancel</button>
              <button 
                onClick={() => addMedicine()} 
                className="flex-1 py-4 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all order-1 sm:order-2"
              >
                Confirm Meds
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {editingMed && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-[#0A0A0A] border-t sm:border border-white/10 p-6 md:p-10 rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-2xl min-h-[80vh] sm:min-h-0 gap-8 flex flex-col relative overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 blur-[100px]"></div>
            
            <div className="text-center space-y-1">
              <h3 className="text-2xl md:text-3xl font-light tracking-tight text-white">Update Prescription</h3>
              <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em]">Modify medication parameters</p>
            </div>

            <MedicineFormCard 
              medicine={editingMed}
              onUpdate={(updated) => setEditingMed({ ...editingMed, ...updated } as Medicine)}
              currentUser={user}
            />

            <div className="flex flex-col sm:flex-row gap-4 mt-auto">
              <button onClick={() => setEditingMed(null)} className="flex-1 py-4 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors order-2 sm:order-1">Cancel</button>
              <button 
                onClick={() => updateMedicine(editingMed)} 
                className="flex-1 py-4 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all order-1 sm:order-2"
              >
                Update Meds
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Analytics({ logs, insights, loading, medicines }: { logs: IntakeLog[], insights: string, loading: boolean, medicines: Medicine[] }) {
  const [subTab, setSubTab] = useState<'overview' | 'history' | 'ai' | 'reports'>('overview');
  const [aiAnalysis, setAiAnalysis] = useState<{ optimization: string, risks: AdherenceRisk[] } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const performAIAnalysis = useCallback(async () => {
    if (medicines.length === 0) return;
    setAnalyzing(true);
    const result = await getScheduleOptimization(logs, medicines);
    setAiAnalysis(result);
    setAnalyzing(false);
  }, [logs, medicines]);

  useEffect(() => {
    if (subTab === 'ai' && !aiAnalysis && !analyzing) {
      performAIAnalysis();
    }
  }, [subTab, aiAnalysis, analyzing, performAIAnalysis]);

  const chartData = [...Array(7)].map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayLogs = logs.filter(l => isSameDay(parseISO(l.scheduledTime), d));
    const taken = dayLogs.filter(l => l.status === 'taken').length;
    const total = dayLogs.length || 0;
    const rate = total > 0 ? (taken / total) * 100 : 0;
    return {
      date: format(d, 'MMM d'),
      adherence: Math.round(rate)
    };
  });

  const today = startOfToday();
  const todayLogs = logs.filter(l => isSameDay(parseISO(l.scheduledTime), today));
  const adherenceOverall = logs.length > 0 
    ? Math.round((logs.filter(l => l.status === 'taken').length / logs.length) * 100) 
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h3 className="text-3xl font-light tracking-tight text-white italic font-serif">Health Intelligence</h3>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] mt-1">Smart Adherence Analytics</p>
        </div>
        
        <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5 w-full sm:w-auto overflow-x-auto">
          {(['overview', 'ai', 'history', 'reports'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={cn(
                "flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                subTab === tab ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white"
              )}
            >
              {tab === 'ai' ? 'AI Insights' : tab}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {subTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="immersive-card p-8 flex flex-col items-center justify-center text-center gap-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Overall Adherence</div>
                <div className="text-5xl font-light text-emerald-400 font-serif">{adherenceOverall}%</div>
                <div className="text-[10px] text-slate-600 uppercase tracking-widest font-mono">Lifetime Log</div>
              </div>
              <div className="immersive-card p-8 flex flex-col items-center justify-center text-center gap-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Doses Today</div>
                <div className="text-5xl font-light text-white font-serif">{todayLogs.filter(l => l.status === 'taken').length}/{todayLogs.length}</div>
                <div className="text-[10px] text-slate-600 uppercase tracking-widest font-mono">24H Verified</div>
              </div>
              <div className="immersive-card p-8 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5"><Shield size={40} /></div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Health Index</div>
                <div className="text-5xl font-light text-emerald-400 font-serif">{chartData[6]?.adherence || 0}%</div>
                <div className="text-[10px] text-slate-600 uppercase tracking-widest font-mono">Risk Status: Low</div>
              </div>

              <div className="md:col-span-3 immersive-card p-8 space-y-6 flex flex-col relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Volume2 size={120} />
                </div>
                <h4 className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                   <Info size={14} /> Caretaker Adherence Brief
                </h4>
                <div className="flex-1 py-4">
                  {loading ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                    </div>
                  ) : (
                    <p className="text-xl md:text-2xl font-light leading-relaxed italic text-white font-serif max-w-4xl">
                      "{insights || "The medical assistant is awaiting more sensor data to formulate a specific clinical pattern analysis."}"
                    </p>
                  )}
                </div>
                <div className="flex gap-4 pt-4 border-t border-white/5">
                   <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-white transition-all">
                      <Volume2 size={12} /> Play Audio Brief
                   </button>
                   <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest text-emerald-400 transition-all">
                      Export Clinical PDF
                   </button>
                </div>
              </div>
            </div>
          )}

          {subTab === 'ai' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="immersive-card p-10 space-y-8 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 blur-[60px]"></div>
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Intelligent Optimization</h4>
                  {analyzing ? (
                    <div className="space-y-6 animate-pulse">
                      <div className="h-4 bg-white/5 rounded-full w-full"></div>
                      <div className="h-4 bg-white/5 rounded-full w-5/6"></div>
                      <div className="h-4 bg-white/5 rounded-full w-4/6"></div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-lg md:text-2xl font-light italic font-serif leading-relaxed text-white">
                        {aiAnalysis?.optimization || "AI is calibrating to your habits. Continue regular box usage to generate suggestions."}
                      </p>
                      <button 
                        onClick={performAIAnalysis}
                        className="px-6 py-2 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-emerald-500/10 transition-all"
                      >
                        RE-RUN PATTERN ANALYSIS
                      </button>
                    </div>
                  )}
                </div>

                <div className="immersive-card p-10 space-y-8">
                   <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500">Critical Risk Profile</h4>
                   <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                     {aiAnalysis?.risks.length ? aiAnalysis.risks.map((risk, i) => (
                       <div key={i} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-3 group hover:border-emerald-500/20 transition-all">
                         <div className="flex justify-between items-center">
                           <span className="text-base font-bold text-white">{risk.medicineName}</span>
                           <span className={cn(
                             "text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full",
                             risk.riskLevel === 'high' ? "bg-rose-500/20 text-rose-500" : 
                             risk.riskLevel === 'medium' ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-400"
                           )}>{risk.riskLevel} Severity</span>
                         </div>
                         <p className="text-xs text-slate-400 leading-relaxed font-serif italic">{risk.reason}</p>
                         <div className="flex items-center gap-2 text-emerald-400 pt-2 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Shield size={14} />
                           <span className="text-[10px] font-bold uppercase tracking-widest">{risk.suggestion}</span>
                         </div>
                       </div>
                     )) : (
                       <div className="text-center py-20 opacity-20">
                         <Cpu size={48} className="mx-auto mb-4" />
                         <p className="italic">No identified adherence conflicts.</p>
                       </div>
                     )}
                   </div>
                </div>
              </div>
            </div>
          )}

          {subTab === 'history' && <HistoryLogs logs={logs} />}

          {subTab === 'reports' && (
            <div className="grid grid-cols-1 gap-8">
              <div className="immersive-card p-8 space-y-12">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">Weekly Adherence Flux</h4>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                       <span className="text-[10px] text-slate-500 uppercase font-black">Intake Accuracy</span>
                    </div>
                  </div>
                </div>
                <div className="h-[400px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorAdh" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="date" stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} dy={10} fontStyle="italic" />
                        <YAxis stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} fontStyle="italic" />
                        <Tooltip contentStyle={{ backgroundColor: '#0C0C0D', border: '1px solid #ffffff10', borderRadius: '24px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="adherence" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAdh)" dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#0C0C0D' }} />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DevicePanel({ deviceStatus, patientId, isPatient, medicines, logs }: { deviceStatus: DeviceStatus | null, patientId: string, isPatient: boolean, medicines: Medicine[], logs: IntakeLog[] }) {
  
  const simulateEvent = async (updates: Partial<DeviceStatus>) => {
    try {
      const response = await fetch('/api/iot/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          ...updates
        })
      });

      if (!response.ok) throw new Error('Sensor Sync Failure');
      
      console.log('[Simulator] NodeMCU payload pushed to backend.');
    } catch (err) { 
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'deviceStatus'); 
    }
  };

  const seedMockData = async () => {
    if (medicines.length > 0 && !confirm("This will overwrite your current medication regimen with diagnostic data. Proceed?")) return;
    
    try {
      const patientMeds = MOCK_DATA.medicines.filter(m => m.patientId === 'mock_patient_1');
      for (const m of patientMeds) {
        await setDoc(doc(db, 'medicines', m.id), {
          ...m,
          patientId,
          createdAt: new Date().toISOString()
        });
      }

      const mockLogs = MOCK_DATA.generateLogs(patientId, patientMeds);
      for (const l of mockLogs) {
        await setDoc(doc(db, 'logs', l.id), l);
      }

      await setDoc(doc(db, 'deviceStatus', patientId), MOCK_DATA.deviceData(patientId));
      alert("Diagnostic environment primed.");
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'seed'); }
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h3 className="text-4xl font-light tracking-tight text-white mb-2 italic font-serif">Diagnostic Hub</h3>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em]">NodeMCU ESP8266 Live Telemetry</p>
        </div>
        <div className="flex gap-4">
           {isPatient ? (
             <div className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-3">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
               <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Box Online & Secure</span>
             </div>
           ) : (
             <button className="px-8 py-3 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl">Caregiver Remote Trigger</button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="immersive-card p-12 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 flex flex-col items-end opacity-20 group-hover:opacity-40 transition-opacity">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-3">Signal: 82ms</span>
                <div className="flex gap-1.5">
                  {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-5 bg-emerald-500 rounded-full" />)}
                </div>
             </div>

             <div className="space-y-16">
                <div className="space-y-6">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Primary Power & Mass</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                    <div className="space-y-2">
                      <span className="text-6xl font-light tracking-tighter text-white font-serif tabular-nums">{deviceStatus?.batteryLevel || 98}%</span>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Battery Equilibrium</p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-6xl font-light tracking-tighter text-white font-serif tabular-nums">{deviceStatus?.lastWeight?.toFixed(2) || '0.00'}g</span>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">HX711 Strain Gauge</p>
                    </div>
                  </div>
                </div>

                <div className="pt-12 border-t border-white/5 grid grid-cols-3 gap-8">
                  <div>
                    <span className="text-xl font-bold text-slate-400 font-serif">RTC DS3231</span>
                    <p className="text-[10px] text-emerald-500 uppercase tracking-[0.2em] mt-2 font-black">Sync Verified</p>
                  </div>
                  <div>
                    <span className="text-xl font-bold text-slate-400 font-serif">Lid Sensor</span>
                    <p className={cn("text-[10px] uppercase tracking-[0.2em] mt-2 font-black", deviceStatus?.isBoxOpen ? "text-rose-500" : "text-emerald-500")}>
                      {deviceStatus?.isBoxOpen ? 'Opened' : 'Locked'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xl font-bold text-slate-400 font-serif">Accelerometer</span>
                    <p className={cn("text-[10px] uppercase tracking-[0.2em] mt-2 font-black", deviceStatus?.isFalling ? "text-rose-500" : "text-slate-500")}>
                      {deviceStatus?.isFalling ? 'FALL DETECTED' : 'Staionary'}
                    </p>
                  </div>
                </div>
             </div>
           </div>

           <div className="immersive-card p-10 space-y-8">
             <div className="flex justify-between items-center border-b border-white/5 pb-6">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Intake Hardware Logs</h4>
                <History size={16} className="text-slate-700" />
             </div>
             <div className="space-y-4">
               {logs.slice(0, 5).map(log => (
                 <div key={log.id} className="flex justify-between items-center p-5 bg-white/[0.01] border border-white/5 rounded-3xl group hover:border-emerald-500/20 transition-all">
                    <div className="flex items-center gap-5">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <div>
                        <span className="text-sm font-bold text-white/90">{log.medicineName}</span>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">{format(parseISO(log.confirmedTime!), 'MMM d, HH:mm:ss')} • LOAD CELL ACK</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-600 font-mono italic">Δ {log.weightDelta?.toFixed(2) || '0.15'}g</span>
                 </div>
               ))}
               {!logs.length && <p className="text-xs text-slate-600 italic text-center py-10">Searching for encrypted hardware handshake...</p>}
             </div>
           </div>
        </div>

        <div className="space-y-8">
          <div className="immersive-card p-8 border-rose-500/20 bg-rose-500/[0.02] space-y-8">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rose-500">Live Hardware Simulation</h4>
            <div className="grid gap-3">
              <button 
                onClick={() => simulateEvent({ isBoxOpen: !deviceStatus?.isBoxOpen })}
                className="w-full py-5 bg-slate-900 border border-slate-800 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:border-slate-500 hover:text-white transition-all rounded-3xl"
              >
                Sync Lid State: {deviceStatus?.isBoxOpen ? 'CLOSE' : 'OPEN'}
              </button>
              <button 
                onClick={() => simulateEvent({ lastWeight: (deviceStatus?.lastWeight || 10) - 0.5 })}
                className="w-full py-5 bg-slate-900 border border-slate-800 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/80 hover:bg-emerald-500/10 transition-all rounded-3xl"
              >
                Simulate Pill Removal (-0.5g)
              </button>
              <button 
                onClick={() => simulateEvent({ isFalling: true })}
                className="w-full py-5 bg-rose-500/10 border border-rose-500/30 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500 hover:bg-rose-500 hover:text-white transition-all rounded-3xl"
              >
                Trigger MPU-6050 Fall Alert
              </button>
            </div>
          </div>

          <div className="immersive-card p-8 bg-amber-500/[0.02] border-amber-500/20 space-y-6">
             <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500 text-center">Refill Threshold Matrix</h4>
             <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed text-center italic">
                Forces weight to 1.8g to trigger Caregiver SMS/Push Refill alerts.
             </p>
             <button 
               onClick={() => simulateEvent({ lastWeight: 1.8 })}
               className="w-full py-5 bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold uppercase tracking-widest text-amber-500 hover:bg-amber-500 hover:text-white transition-all rounded-3xl"
             >
                PROMPT REFILL ACTION
             </button>
          </div>

          <button 
            onClick={seedMockData}
            className="w-full py-5 bg-white text-black text-[10px] font-bold uppercase tracking-[0.4em] rounded-3xl hover:scale-105 transition-all shadow-2xl"
          >
            Seeding Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryLogs({ logs }: { logs: IntakeLog[] }) {
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-light tracking-tight text-white italic font-serif text-white/50 underline decoration-white/10 underline-offset-8">Intake History</h3>
      
      {/* Mobile-Friendly View */}
      <div className="flex flex-col gap-4 lg:hidden">
        {logs.map((log) => (
          <div key={log.id} className="bg-slate-900/30 border border-white/5 p-5 rounded-[2rem] space-y-4">
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{log.medicineName}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-1">{format(parseISO(log.scheduledTime), 'MMM dd, HH:mm')}</p>
              </div>
              <div className={cn(
                "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0",
                log.status === 'taken' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
              )}>
                {log.status}
              </div>
            </div>
            {log.confirmedTime && (
              <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                <Clock size={10} className="text-slate-600" />
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                  ACK: {format(parseISO(log.confirmedTime), 'HH:mm:ss')}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block glass rounded-[2.5rem] overflow-hidden border border-white/5 bg-white/[0.01]">
        <div className="grid grid-cols-4 p-8 border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
           <div>Clinical Description</div>
           <div>Scheduled Interval</div>
           <div>Status Node</div>
           <div>Verification Hash</div>
        </div>
        <div className="divide-y divide-white/5">
          {logs.map(log => (
            <div key={log.id} className="grid grid-cols-4 p-8 text-sm items-center hover:bg-white/[0.02] transition-colors group">
               <div className="font-bold text-slate-200">{log.medicineName}</div>
               <div className="text-slate-500 text-[10px] font-mono">{format(parseISO(log.scheduledTime), 'MMM d, HH:mm')}</div>
               <div>
                  <span className={cn(
                    "text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border",
                    log.status === 'taken' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                  )}>
                    {log.status}
                  </span>
               </div>
               <div className="text-slate-600 text-[10px] font-mono group-hover:text-emerald-500 transition-colors">
                 {log.confirmedTime ? format(parseISO(log.confirmedTime), 'HH:mm:ss') : '--:--:--'}
               </div>
            </div>
          ))}
          {!logs.length && <div className="p-20 text-center text-slate-600 italic font-serif">Awaiting ingestion of medical records...</div>}
        </div>
      </div>
    </div>
  );
}
// Reusable icons/components not in imports
