import React, { useState, useEffect } from 'react';
import { CalendarCheck, Clock, AlertTriangle, CheckCircle, Save } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { dataService } from '../lib/dataService';
import { Worker, AttendanceRecord, UserRole } from '../types';

interface AttendanceScreenProps {
  role: UserRole;
}

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({ role }) => {
  const { t } = useTranslation();

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    const [wList, attList] = await Promise.all([
      dataService.getWorkers(),
      dataService.getAttendance(selectedDate),
    ]);
    setWorkers(wList);
    setAttendance(attList);
  };

  const getStatusForWorker = (wId: string) => {
    return attendance.find(a => a.worker_id === wId)?.status || 'present';
  };

  const getOtForWorker = (wId: string) => {
    return attendance.find(a => a.worker_id === wId)?.ot_hours || 0;
  };

  const handleStatusChange = async (workerId: string, status: AttendanceRecord['status']) => {
    try {
      const ot = getOtForWorker(workerId);
      await dataService.saveAttendance({
        worker_id: workerId,
        date: selectedDate,
        status,
        ot_hours: ot,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating attendance');
    }
  };

  const handleOtChange = async (workerId: string, otHours: number) => {
    try {
      const status = getStatusForWorker(workerId);
      await dataService.saveAttendance({
        worker_id: workerId,
        date: selectedDate,
        status,
        ot_hours: Math.max(0, otHours),
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating OT');
    }
  };

  const isLocked = dataService.isPeriodLocked(selectedDate);

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-indigo-400" />
            <span>Daily Attendance & Overtime Roster</span>
          </h1>
          <p className="text-xs text-slate-400">Track worker floor presence, leave, and overtime hours</p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl shadow-md">
          <label className="text-xs font-bold text-slate-400 px-2">{t('date')}:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white font-mono"
          />
        </div>
      </div>

      {/* Locked Period Warning */}
      {isLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-300 text-xs flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
          <span>
            This date falls inside a <strong>locked payroll period</strong>. Attendance records cannot be altered.
          </span>
        </div>
      )}

      {/* Roster Cards List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3">
        {workers.map(worker => {
          const curStatus = getStatusForWorker(worker.id);
          const curOt = getOtForWorker(worker.id);

          return (
            <div
              key={worker.id}
              className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              {/* Worker Info */}
              <div className="flex items-center space-x-3">
                <img
                  src={worker.photo_url || ''}
                  alt={worker.full_name}
                  className="w-11 h-11 rounded-xl object-cover border border-slate-600 shrink-0"
                />
                <div>
                  <div className="font-bold text-white text-base">{worker.full_name}</div>
                  <div className="text-xs text-slate-400 font-mono">
                    {worker.worker_code} • {worker.line_no}
                  </div>
                </div>
              </div>

              {/* Status Toggles */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'present', label: t('present'), color: 'bg-emerald-600 text-white' },
                  { id: 'absent', label: t('absent'), color: 'bg-rose-600 text-white' },
                  { id: 'half_day', label: t('halfDay'), color: 'bg-amber-500 text-slate-950 font-bold' },
                  { id: 'leave', label: t('leave'), color: 'bg-indigo-600 text-white' },
                  { id: 'holiday', label: t('holiday'), color: 'bg-purple-600 text-white' },
                ].map(st => (
                  <button
                    key={st.id}
                    disabled={isLocked}
                    onClick={() => handleStatusChange(worker.id, st.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      curStatus === st.id
                        ? `${st.color} shadow-md scale-105`
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* OT Hours Field */}
              <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 shrink-0">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-400 font-mono">OT:</span>
                <input
                  type="number"
                  min="0"
                  max="8"
                  disabled={isLocked}
                  value={curOt}
                  onChange={e => handleOtChange(worker.id, parseFloat(e.target.value) || 0)}
                  className="w-12 text-center bg-slate-800 border border-slate-700 rounded-lg py-0.5 text-xs text-white font-mono font-bold"
                />
                <span className="text-xs text-slate-400 font-mono">hrs</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
