import React, { useState } from 'react';
import { Pill, Trash2, Clock, AlertTriangle, Check, Plus, Minus, UserCheck } from 'lucide-react';
import { Medicine, UserProfile } from '../../types';
import { format, parseISO } from 'date-fns';
import { cn } from '../../lib/utils';

interface MedicineFormCardProps {
  medicine: Partial<Medicine> & { isUncertain?: boolean };
  onUpdate: (updated: Partial<Medicine>) => void;
  onRemove?: () => void;
  isNew?: boolean;
  currentUser?: UserProfile;
}

export const MedicineFormCard: React.FC<MedicineFormCardProps> = ({ medicine, onUpdate, onRemove, isNew, currentUser }) => {
  const [newTime, setNewTime] = useState('08:00');
  const isCaregiver = currentUser?.role === 'caregiver';

  const updateField = (field: keyof Medicine, value: any) => {
    onUpdate({ ...medicine, [field]: value });
  };

  const addTime = () => {
    const currentTimes = medicine.times || [];
    if (!currentTimes.includes(newTime)) {
      updateField('times', [...currentTimes, newTime].sort());
    }
  };

  const removeTime = (t: string) => {
    updateField('times', (medicine.times || []).filter(time => time !== t));
  };

  return (
    <div className={cn(
      "immersive-card p-8 space-y-6 relative border transition-all",
      medicine.isUncertain ? "border-amber-500/50 bg-amber-500/[0.02]" : "border-slate-800/50"
    )}>
      {medicine.isUncertain && (
        <div className="absolute top-4 right-8 flex items-center gap-2 bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-full border border-amber-500/20 text-[10px] font-bold uppercase tracking-widest">
          <AlertTriangle size={12} />
          Verify Extraction
        </div>
      )}

      {isCaregiver && (
        <div className="absolute top-4 left-8 flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-full border border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest">
          <UserCheck size={12} />
          Editing as Caregiver
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        {/* Name & Dosage */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Medicine Name</label>
            <input 
              type="text" 
              value={medicine.name || ''} 
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Atorvastatin"
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-white placeholder:text-slate-700 outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Dosage Strength</label>
            <input 
              type="text" 
              value={medicine.dosage || ''} 
              onChange={(e) => updateField('dosage', e.target.value)}
              placeholder="e.g. 20mg"
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-white placeholder:text-slate-700 outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Schedule & Timing */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Time Cycles</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {medicine.times?.map((t) => (
                <div key={t} className="bg-slate-800 text-white px-4 py-2 rounded-xl flex items-center gap-3 border border-slate-700 group transition-all hover:bg-rose-500/10 hover:border-rose-500/30">
                  <span className="text-sm font-mono">{t}</span>
                  <button type="button" onClick={() => removeTime(t)} className="text-slate-500 hover:text-rose-400 group-hover:text-rose-400">
                    <Minus size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="time" 
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-3 text-white outline-none focus:border-emerald-500/50 font-mono"
              />
              <button 
                type="button"
                onClick={addTime}
                className="w-14 h-14 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl flex items-center justify-center transition-all border border-slate-700"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Frequency</label>
          <select 
            value={medicine.frequency || ''} 
            onChange={(e) => updateField('frequency', e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-emerald-500/50 transition-colors"
          >
            <option value="once daily">Once Daily</option>
            <option value="twice daily">Twice Daily</option>
            <option value="three times daily">Three Times Daily</option>
            <option value="weekly">Weekly</option>
            <option value="as needed">As Needed</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Duration / Notes</label>
          <input 
            type="text" 
            value={medicine.notes || ''} 
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="e.g. Take after breakfast for 10 days"
            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-white placeholder:text-slate-700 outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
      </div>

      {onRemove && (
        <div className="flex justify-between items-center pt-4 border-t border-white/5">
          <div className="text-[10px] text-slate-600 uppercase tracking-widest font-medium">
            {medicine.lastUpdatedByName && (
              <>
                Last updated by <span className="text-slate-400">{medicine.lastUpdatedByName}</span>
                {medicine.lastUpdatedAt && ` • ${format(parseISO(medicine.lastUpdatedAt), 'MMM dd, hh:mm a')}`}
              </>
            )}
          </div>
          <button 
            type="button"
            onClick={onRemove}
            className="flex items-center gap-2 text-rose-500/40 hover:text-rose-500 text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <Trash2 size={14} /> Remove Medicine
          </button>
        </div>
      )}
    </div>
  );
};
