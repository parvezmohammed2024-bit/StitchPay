import React, { useState, useEffect } from 'react';
import { ShieldAlert, Filter, Calendar, RefreshCw, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { dataService } from '../lib/dataService';
import { EntryAudit, UserRole } from '../types';

interface AuditLogViewerProps {
  role: UserRole;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ role }) => {
  const [logs, setLogs] = useState<EntryAudit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTable, setSelectedTable] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'admin') {
      loadAuditLogs();
    }
  }, [selectedTable, fromDate, toDate, role]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await dataService.getAuditLogs({
        tableName: selectedTable,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setLogs(data);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // ADMIN ONLY GUARD
  if (role !== 'admin') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-900 font-bold">
        Access Denied. Audit Log Viewer is restricted to Admin users only.
      </div>
    );
  }

  const formatSummary = (log: EntryAudit): string => {
    if (log.summary) return log.summary;
    if (log.action === 'INSERT') {
      if (log.new_data?.qty_ok !== undefined) return `qty_ok ${log.new_data.qty_ok} recorded`;
      if (log.new_data?.qty_cut !== undefined) return `qty_cut ${log.new_data.qty_cut} recorded`;
      return 'New entry created';
    }
    if (log.action === 'DELETE') {
      const oldQty = log.old_data?.qty_ok ?? log.old_data?.qty_cut ?? log.old_data?.qty;
      return oldQty ? `Deleted record (${oldQty} pcs)` : 'Record deleted';
    }
    if (log.action === 'UPDATE' && log.old_data && log.new_data) {
      const changes: string[] = [];
      const keys = Array.from(new Set([...Object.keys(log.old_data), ...Object.keys(log.new_data)]));
      for (const k of keys) {
        if (['id', 'created_at', 'updated_at', 'user_id', 'entered_by'].includes(k)) continue;
        const oldVal = log.old_data[k];
        const newVal = log.new_data[k];
        if (oldVal !== newVal && newVal !== undefined) {
          changes.push(`${k} ${oldVal ?? 'none'} → ${newVal}`);
        }
      }
      if (changes.length > 0) return changes.join(', ');
    }
    return 'Record updated';
  };

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case 'INSERT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'UPDATE':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'DELETE':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-xs space-y-6">
      {/* SECTION HEADER & MANDATORY PERMANENT AUDIT NOTE */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
          <div>
            <h2 className="text-lg font-black text-stone-900 flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-indigo-700" />
              <span>Production Entry Audit Log</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Comprehensive tamper-proof audit trail for output, cutting, and finishing entries.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAuditLogs}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl border border-stone-200 transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Audit Logs</span>
          </button>
        </div>

        {/* MANDATORY AUDIT NOTE REQUIRED BY PROMPT */}
        <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 flex items-start space-x-3 text-indigo-950">
          <ShieldAlert className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
          <div className="text-xs font-semibold leading-relaxed">
            <span className="font-black uppercase tracking-wider block text-indigo-900 mb-0.5">
              Permanent Compliance Record
            </span>
            "Every change to production, cutting and finishing records is logged permanently and cannot be erased."
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5 text-stone-500" />
            <span>Filter by Table</span>
          </label>
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800"
          >
            <option value="all">All Audit Tables</option>
            <option value="production_entries">production_entries</option>
            <option value="cutting_entries">cutting_entries</option>
            <option value="finishing_entries">finishing_entries</option>
            <option value="style_daily_output">style_daily_output</option>
            <option value="daily_assignments">daily_assignments</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 text-stone-500" />
            <span>From Date</span>
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-800"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 text-stone-500" />
            <span>To Date</span>
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-800"
          />
        </div>
      </div>

      {/* AUDIT LOG TABLE / LIST */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-stone-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs font-medium">Fetching entry_audit records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl">
            <FileText className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-stone-600">No audit records found</p>
            <p className="text-xs text-stone-400 mt-1">Changes to production entries will automatically log here.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-200 border border-stone-200 rounded-2xl overflow-hidden bg-white">
            <div className="bg-stone-100 px-4 py-3 grid grid-cols-12 text-[11px] font-black uppercase tracking-wider text-stone-600">
              <span className="col-span-3 sm:col-span-2">When</span>
              <span className="col-span-3 sm:col-span-3">Who</span>
              <span className="col-span-2 sm:col-span-2">Table</span>
              <span className="col-span-2 sm:col-span-2 text-center">Action</span>
              <span className="col-span-2 sm:col-span-3">Summary of Changes</span>
            </div>

            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const whenStr = new Date(log.created_at).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });
              const whoStr = log.user_email || log.changed_by || 'Admin / System';
              const summaryText = formatSummary(log);

              return (
                <div key={log.id} className="hover:bg-stone-50 transition-colors">
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="px-4 py-3 grid grid-cols-12 text-xs items-center cursor-pointer gap-2"
                  >
                    <span className="col-span-3 sm:col-span-2 font-mono text-[11px] font-semibold text-stone-600 truncate">
                      {whenStr}
                    </span>

                    <span className="col-span-3 sm:col-span-3 font-medium text-stone-800 truncate" title={whoStr}>
                      {whoStr}
                    </span>

                    <span className="col-span-2 sm:col-span-2">
                      <span className="font-mono text-[10px] font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-200 truncate inline-block max-w-full">
                        {log.table_name}
                      </span>
                    </span>

                    <span className="col-span-2 sm:col-span-2 text-center">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider inline-block ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </span>

                    <span className="col-span-2 sm:col-span-3 font-semibold text-stone-900 flex items-center justify-between">
                      <span className="truncate">{summaryText}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-stone-400 shrink-0 ml-1" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-stone-400 shrink-0 ml-1" />
                      )}
                    </span>
                  </div>

                  {/* EXPANDED RAW DATA VIEW */}
                  {isExpanded && (log.old_data || log.new_data) && (
                    <div className="bg-stone-900 text-stone-200 p-4 font-mono text-[11px] border-t border-stone-800 space-y-2 animate-in fade-in duration-100">
                      <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                        Raw Audit Payload Details (Record ID: {log.record_id || log.id})
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {log.old_data && (
                          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                            <span className="text-rose-400 font-bold block mb-1">Old Data (Before Change):</span>
                            <pre className="overflow-x-auto text-[10px] text-stone-300">
                              {JSON.stringify(log.old_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_data && (
                          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                            <span className="text-emerald-400 font-bold block mb-1">New Data (After Change):</span>
                            <pre className="overflow-x-auto text-[10px] text-stone-300">
                              {JSON.stringify(log.new_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
