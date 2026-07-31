import React, { useState, useEffect } from 'react';
import { X, MapPin, Clock, Briefcase, Calendar, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Worker, AttendanceRecord } from '../types';

interface TimeClockModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: Worker | null;
  attendance: AttendanceRecord | null;
  geoLoc?: { lat: number; lng: number; accuracy: number } | null;
  onConfirmClockIn: () => Promise<void>;
  onConfirmClockOut: () => Promise<void>;
}

export const TimeClockModal: React.FC<TimeClockModalProps> = ({
  isOpen,
  onClose,
  worker,
  attendance,
  geoLoc,
  onConfirmClockIn,
  onConfirmClockOut,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const isClockedIn = Boolean(attendance && attendance.status === 'present' && !attendance.out_time);

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const handleAction = async () => {
    setSubmitting(true);
    try {
      if (isClockedIn) {
        await onConfirmClockOut();
      } else {
        await onConfirmClockIn();
      }
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Attendance action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {/* Mobile-styled device card frame */}
      <div className="bg-white text-slate-900 rounded-[2.5rem] max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col font-sans relative">
        
        {/* Top iOS/Mobile Header Bar */}
        <div className="pt-5 px-6 pb-3 flex items-center justify-between border-b border-slate-100 bg-white">
          <button
            onClick={onClose}
            className="text-purple-600 font-bold text-sm hover:opacity-80 transition-opacity"
          >
            Cancel
          </button>
          <span className="font-extrabold text-slate-900 text-base tracking-tight">Time Clock</span>
          <div className="w-12"></div> {/* Spacer for symmetry */}
        </div>

        {/* Info Rows Section */}
        <div className="px-6 py-4 space-y-4 bg-white">
          {/* Clocking In / Digital Clock Display */}
          <div className="border-b border-slate-100 pb-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              {isClockedIn ? 'Clocked In At' : 'Clocking In'}
            </div>
            <div className="text-4xl font-black text-slate-900 tracking-tight mt-0.5">
              {formattedTime}
            </div>
          </div>

          {/* Location */}
          <div className="border-b border-slate-100 pb-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Location
            </div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
              <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                {geoLoc
                  ? `Factory Floor (${geoLoc.lat.toFixed(3)}, ${geoLoc.lng.toFixed(3)})`
                  : 'Factory District (Dhaka Zone)'}
              </span>
            </div>
          </div>

          {/* Shift Hours */}
          <div className="border-b border-slate-100 pb-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Shift
            </div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
              <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
              <span>9:00 AM - 4:00 PM (Standard Shift)</span>
            </div>
          </div>

          {/* Role */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Role
            </div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
              <Briefcase className="w-4 h-4 text-purple-600 shrink-0" />
              <span>{worker?.full_name ? `${worker.full_name} (${worker.worker_code})` : 'Sewing Operator / Barista'}</span>
            </div>
          </div>
        </div>

        {/* Visual Map Area with Pin */}
        <div className="relative h-44 bg-slate-100 overflow-hidden border-t border-slate-100">
          {/* Map Grid graphic mockup styled like standard maps */}
          <svg className="w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#CBD5E1" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {/* Roads */}
            <path d="M -10 30 Q 100 80 300 20 T 500 120" fill="none" stroke="#E2E8F0" strokeWidth="16" />
            <path d="M 120 -10 L 140 200" fill="none" stroke="#E2E8F0" strokeWidth="12" />
            <path d="M 220 -10 L 200 200" fill="none" stroke="#E2E8F0" strokeWidth="10" />
            {/* Map labels */}
            <text x="30" y="40" fill="#94A3B8" fontSize="10" fontWeight="bold">HYDE PARK</text>
            <text x="210" y="160" fill="#94A3B8" fontSize="10" fontWeight="bold">MONTROSE</text>
            <text x="140" y="90" fill="#94A3B8" fontSize="9" fontWeight="bold">FACTORY ZONE</text>
          </svg>

          {/* Pin Marker with Pulsing Circle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full animate-ping absolute"></div>
              <div className="w-10 h-10 bg-purple-600/30 rounded-full flex items-center justify-center relative">
                <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <MapPin className="w-5 h-5 fill-white text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Confirm Action Button Overlay */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <button
              onClick={handleAction}
              disabled={submitting}
              className={`w-full py-3.5 px-6 rounded-2xl font-black text-white text-sm shadow-xl transition-all duration-200 active:scale-95 flex items-center justify-center space-x-2 ${
                isClockedIn
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/40'
                  : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/40'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{submitting ? 'Processing...' : isClockedIn ? 'Confirm Clock Out' : 'Confirm Clock In'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Mobile Tab Bar Mockup */}
        <div className="bg-white border-t border-slate-100 py-2 px-6 flex justify-between text-slate-400 text-[10px] font-semibold">
          <div className="flex flex-col items-center text-purple-600">
            <Clock className="w-4 h-4" />
            <span className="mt-0.5">Timeclock</span>
          </div>
          <div className="flex flex-col items-center">
            <Briefcase className="w-4 h-4" />
            <span className="mt-0.5">Schedule</span>
          </div>
          <div className="flex flex-col items-center">
            <ShieldCheck className="w-4 h-4" />
            <span className="mt-0.5">Verified</span>
          </div>
        </div>

      </div>
    </div>
  );
};
