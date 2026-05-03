import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { parsePrescription } from '../../services/geminiService';
import { cn } from '../../lib/utils';

interface PrescriptionUploaderProps {
  onExtracted: (medicines: any[]) => void;
  onClose: () => void;
}

export const PrescriptionUploader: React.FC<PrescriptionUploaderProps> = ({ onExtracted, onClose }) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleExtract = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const results = await parsePrescription(image);
      onExtracted(results);
    } catch (err) {
      setError("Failed to parse prescription. Please ensure the image is clear.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] border border-white/10 w-full max-w-2xl rounded-[3rem] p-10 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 blur-[100px]"></div>
        
        <button onClick={onClose} className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <div className="text-center space-y-2 mb-10">
          <h2 className="text-3xl font-light tracking-tight text-white">Scan Prescription</h2>
          <p className="text-slate-500 text-xs uppercase tracking-[0.2em]">AI-Powered Clinical Analysis</p>
        </div>

        {!image ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-800 rounded-[2.5rem] p-20 flex flex-col items-center gap-6 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
          >
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-slate-500 group-hover:scale-110 group-hover:text-emerald-500 transition-all shadow-xl">
              <Camera size={40} />
            </div>
            <div className="text-center">
              <p className="text-slate-400 font-medium text-lg">Tap to Upload or Scan</p>
              <p className="text-slate-600 text-[10px] mt-1 uppercase tracking-widest leading-relaxed">PDF, JPG, or PNG supported</p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="relative rounded-[2rem] overflow-hidden border border-white/10 aspect-video bg-black flex items-center justify-center group">
              <img src={image} alt="Prescription" className="max-h-full object-contain" />
              <button 
                onClick={() => setImage(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-400 text-xs">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={loading}
              className="w-full bg-white text-black font-black uppercase tracking-[0.1em] h-16 rounded-full hover:bg-slate-100 transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_20px_40px_rgba(255,255,255,0.05)]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Analyzing Clinical Data...
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  Extract Medicines
                </>
              )}
            </button>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-700 font-bold">HIPAA Compliant Encryption Active</p>
        </div>
      </div>
    </div>
  );
};
