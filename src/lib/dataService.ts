import { 
  Worker, GarmentStyle, GarmentProcess, ProductionEntry, 
  AttendanceRecord, Adjustment, PayrollPeriod, PayrollLine, 
  FactorySettings, UserRole, ProcessRateHistory 
} from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  INITIAL_SETTINGS, INITIAL_WORKERS, INITIAL_STYLES, 
  INITIAL_PROCESSES, INITIAL_PAYROLL_PERIOD, 
  INITIAL_PRODUCTION_ENTRIES, INITIAL_ADJUSTMENTS, INITIAL_ATTENDANCE 
} from './store';

class DataService {
  private settings: FactorySettings = { ...INITIAL_SETTINGS };
  private workers: Worker[] = [...INITIAL_WORKERS];
  private styles: GarmentStyle[] = [...INITIAL_STYLES];
  private processes: GarmentProcess[] = [...INITIAL_PROCESSES];
  private productionEntries: ProductionEntry[] = [...INITIAL_PRODUCTION_ENTRIES];
  private attendance: AttendanceRecord[] = [...INITIAL_ATTENDANCE];
  private adjustments: Adjustment[] = [...INITIAL_ADJUSTMENTS];
  private payrollPeriod: PayrollPeriod = { ...INITIAL_PAYROLL_PERIOD };
  private payrollLines: PayrollLine[] = [];
  private currentRole: UserRole = 'admin';
  private initializedSupabase: boolean = false;

  constructor() {
    this.recalculatePayrollLinesInMemory();
  }

  /**
   * Automatically seed live Supabase tables if they are empty
   */
  private async ensureSupabaseSeeded(): Promise<void> {
    if (!isSupabaseConfigured || this.initializedSupabase) return;
    this.initializedSupabase = true;

    try {
      // Check if workers exist
      const { data: existingWorkers } = await supabase.from('workers').select('id').limit(1);
      if (!existingWorkers || existingWorkers.length === 0) {
        console.log('Seeding initial data to Supabase database...');
        // 1. Seed Settings
        await supabase.from('settings').upsert({
          id: INITIAL_SETTINGS.id,
          factory_name: INITIAL_SETTINGS.factory_name,
          logo_url: INITIAL_SETTINGS.logo_url,
          currency_code: INITIAL_SETTINGS.currency_code,
          currency_symbol: INITIAL_SETTINGS.currency_symbol,
          pay_cycle: INITIAL_SETTINGS.pay_cycle,
          week_start_day: INITIAL_SETTINGS.week_start_day,
          rework_pay_percent: INITIAL_SETTINGS.rework_pay_percent,
          reject_pay_percent: INITIAL_SETTINGS.reject_pay_percent,
          minimum_wage_per_day: INITIAL_SETTINGS.minimum_wage_per_day,
          enable_minimum_wage_topup: INITIAL_SETTINGS.enable_minimum_wage_topup,
        });

        // 2. Seed Workers
        for (const w of INITIAL_WORKERS) {
          await supabase.from('workers').upsert(w);
        }

        // 3. Seed Styles
        for (const s of INITIAL_STYLES) {
          await supabase.from('styles').upsert(s);
        }

        // 4. Seed Processes
        for (const p of INITIAL_PROCESSES) {
          await supabase.from('processes').upsert(p);
        }

        // 5. Seed Payroll Period
        await supabase.from('payroll_periods').upsert(INITIAL_PAYROLL_PERIOD);

        // 6. Seed Entries
        for (const e of INITIAL_PRODUCTION_ENTRIES) {
          await supabase.from('production_entries').upsert(e);
        }

        // 7. Seed Attendance
        for (const a of INITIAL_ATTENDANCE) {
          await supabase.from('attendance').upsert(a);
        }

        // 8. Seed Adjustments
        for (const adj of INITIAL_ADJUSTMENTS) {
          await supabase.from('adjustments').upsert(adj);
        }
      }
    } catch (err) {
      console.warn('Supabase auto-seed notice:', err);
    }
  }

  // --- ROLE MANAGEMENT ---
  public setRole(role: UserRole) {
    this.currentRole = role;
  }

  public getRole(): UserRole {
    return this.currentRole;
  }

  // --- SETTINGS ---
  public async getSettings(): Promise<FactorySettings> {
    await this.ensureSupabaseSeeded();
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (!error && data) {
        this.settings = { ...this.settings, ...data };
      }
    }
    return this.settings;
  }

  public async updateSettings(newSettings: Partial<FactorySettings>): Promise<FactorySettings> {
    this.settings = { ...this.settings, ...newSettings };
    if (isSupabaseConfigured) {
      await supabase.from('settings').update(newSettings).eq('id', this.settings.id);
    }
    return this.settings;
  }

  // --- WORKERS ---
  public async getWorkers(): Promise<Worker[]> {
    await this.ensureSupabaseSeeded();
    let result = [...this.workers];
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('workers').select('*').order('worker_code');
      if (!error && data && data.length > 0) {
        result = data;
        this.workers = data;
      }
    }

    // Attach outstanding advance balance
    const advancesMap = new Map<string, number>();
    const adjusts = await this.getAdjustments();
    adjusts.forEach(adj => {
      const current = advancesMap.get(adj.worker_id) || 0;
      if (adj.type === 'advance') {
        advancesMap.set(adj.worker_id, current + Number(adj.amount));
      } else if (adj.type === 'advance_repay') {
        advancesMap.set(adj.worker_id, current - Number(adj.amount));
      }
    });

    return result.map(w => ({
      ...w,
      outstanding_advance: Math.max(0, advancesMap.get(w.id) || 0),
    }));
  }

  public async saveWorker(worker: Partial<Worker>): Promise<Worker> {
    if (worker.id) {
      const index = this.workers.findIndex(w => w.id === worker.id);
      if (index >= 0) {
        this.workers[index] = { ...this.workers[index], ...worker };
      }
      if (isSupabaseConfigured) {
        await supabase.from('workers').update(worker).eq('id', worker.id);
      }
      return this.workers[index] || worker as Worker;
    } else {
      const newWorker: Worker = {
        id: crypto.randomUUID(),
        worker_code: worker.worker_code || `W-${Math.floor(100 + Math.random() * 900)}`,
        full_name: worker.full_name || 'New Worker',
        phone: worker.phone || null,
        photo_url: worker.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        section: worker.section || 'Sewing',
        line_no: worker.line_no || 'Line-01',
        joined_at: worker.joined_at || new Date().toISOString().split('T')[0],
        payment_method: worker.payment_method || 'cash',
        payment_details: worker.payment_details || {},
        status: worker.status || 'active',
      };
      this.workers.push(newWorker);
      if (isSupabaseConfigured) {
        await supabase.from('workers').insert(newWorker);
      }
      return newWorker;
    }
  }

  // --- STYLES & PROCESSES ---
  public async getStyles(): Promise<GarmentStyle[]> {
    await this.ensureSupabaseSeeded();
    let result = [...this.styles];
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('styles').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        result = data;
        this.styles = data;
      }
    }

    // Attach completed pieces and total labour cost
    const procs = await this.getProcesses();
    const entries = await this.getProductionEntries();

    return result.map(st => {
      const styleProcs = procs.filter(p => p.style_id === st.id);
      const totalLabourCost = styleProcs.reduce((sum, p) => sum + Number(p.rate), 0);
      
      // Completed pieces based on final process in sequence
      const lastProc = styleProcs.sort((a, b) => b.seq_no - a.seq_no)[0];
      let completed_pieces = 0;
      if (lastProc) {
        completed_pieces = entries
          .filter(e => e.style_id === st.id && e.process_id === lastProc.id)
          .reduce((sum, e) => sum + Number(e.qty_ok), 0);
      }

      return {
        ...st,
        total_labour_cost: totalLabourCost,
        completed_pieces,
      };
    });
  }

  public async saveStyle(style: Partial<GarmentStyle>): Promise<GarmentStyle> {
    if (style.id) {
      const idx = this.styles.findIndex(s => s.id === style.id);
      if (idx >= 0) this.styles[idx] = { ...this.styles[idx], ...style };
      if (isSupabaseConfigured) {
        await supabase.from('styles').update(style).eq('id', style.id);
      }
      return this.styles[idx] || style as GarmentStyle;
    } else {
      const newStyle: GarmentStyle = {
        id: crypto.randomUUID(),
        style_code: style.style_code || `ST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: style.name || 'New Garment Style',
        buyer_name: style.buyer_name || 'Unassigned',
        image_url: style.image_url || 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
        order_qty: style.order_qty || 1000,
        target_ship_date: style.target_ship_date || new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
        status: style.status || 'active',
        notes: style.notes || null,
      };
      this.styles.push(newStyle);
      if (isSupabaseConfigured) {
        await supabase.from('styles').insert(newStyle);
      }
      return newStyle;
    }
  }

  public async getProcesses(styleId?: string): Promise<GarmentProcess[]> {
    await this.ensureSupabaseSeeded();
    let procs = [...this.processes];
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('processes').select('*').order('seq_no');
      if (!error && data && data.length > 0) {
        procs = data;
        this.processes = data;
      }
    }
    if (styleId) {
      return procs.filter(p => p.style_id === styleId).sort((a, b) => a.seq_no - b.seq_no);
    }
    return procs.sort((a, b) => a.seq_no - b.seq_no);
  }

  public async saveProcess(proc: Partial<GarmentProcess>): Promise<GarmentProcess> {
    if (proc.id) {
      const idx = this.processes.findIndex(p => p.id === proc.id);
      if (idx >= 0) this.processes[idx] = { ...this.processes[idx], ...proc };
      if (isSupabaseConfigured) {
        await supabase.from('processes').update(proc).eq('id', proc.id);
      }
      return this.processes[idx] || proc as GarmentProcess;
    } else {
      const newProc: GarmentProcess = {
        id: crypto.randomUUID(),
        style_id: proc.style_id!,
        seq_no: proc.seq_no || (this.processes.filter(p => p.style_id === proc.style_id).length + 1),
        name: proc.name || 'New Operation',
        machine_type: proc.machine_type || 'Single Needle Lockstitch',
        smv: proc.smv || 1.5,
        rate: proc.rate || 3.5,
        is_active: proc.is_active ?? true,
      };
      this.processes.push(newProc);
      if (isSupabaseConfigured) {
        await supabase.from('processes').insert(newProc);
      }
      return newProc;
    }
  }

  public async deleteProcess(processId: string): Promise<void> {
    this.processes = this.processes.filter(p => p.id !== processId);
    if (isSupabaseConfigured) {
      await supabase.from('processes').delete().eq('id', processId);
    }
  }

  public async cloneProcesses(targetStyleId: string, sourceStyleId: string): Promise<GarmentProcess[]> {
    const sourceProcs = await this.getProcesses(sourceStyleId);
    const clonedList: GarmentProcess[] = [];

    for (const p of sourceProcs) {
      const cloned = await this.saveProcess({
        style_id: targetStyleId,
        seq_no: p.seq_no,
        name: p.name,
        machine_type: p.machine_type,
        smv: p.smv,
        rate: p.rate,
        is_active: true,
      });
      clonedList.push(cloned);
    }
    return clonedList;
  }

  // --- PRODUCTION ENTRIES ---
  public async getProductionEntries(): Promise<ProductionEntry[]> {
    await this.ensureSupabaseSeeded();
    let entries = [...this.productionEntries];
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('production_entries')
        .select('*')
        .order('entry_date', { ascending: false });
      if (!error && data && data.length > 0) {
        entries = data;
        this.productionEntries = data;
      }
    }

    // Attach joined display metadata
    const workersMap = new Map(this.workers.map(w => [w.id, w]));
    const stylesMap = new Map(this.styles.map(s => [s.id, s]));
    const procsMap = new Map(this.processes.map(p => [p.id, p]));

    return entries.map(e => ({
      ...e,
      worker_name: workersMap.get(e.worker_id)?.full_name || 'Worker',
      worker_code: workersMap.get(e.worker_id)?.worker_code || 'W-00',
      worker_photo: workersMap.get(e.worker_id)?.photo_url || undefined,
      style_name: stylesMap.get(e.style_id)?.name || 'Style',
      process_name: procsMap.get(e.process_id)?.name || 'Operation',
    }));
  }

  public checkDuplicateEntry(workerId: string, processId: string, date: string, shift: 'day' | 'night'): ProductionEntry | undefined {
    return this.productionEntries.find(e => 
      e.worker_id === workerId && 
      e.process_id === processId && 
      e.entry_date === date && 
      e.shift === shift
    );
  }

  public isPeriodLocked(dateStr: string): boolean {
    if (!this.payrollPeriod) return false;
    if (this.payrollPeriod.status === 'locked' || this.payrollPeriod.status === 'paid') {
      return dateStr >= this.payrollPeriod.start_date && dateStr <= this.payrollPeriod.end_date;
    }
    return false;
  }

  public async saveProductionEntry(entry: Partial<ProductionEntry>): Promise<ProductionEntry> {
    const entryDate = entry.entry_date || new Date().toISOString().split('T')[0];
    if (this.isPeriodLocked(entryDate)) {
      throw new Error('Cannot save or edit production entries inside a locked or paid payroll period.');
    }

    const proc = this.processes.find(p => p.id === entry.process_id);
    const rateSnapshot = entry.rate_snapshot ?? proc?.rate ?? 3.5;
    const qtyOk = entry.qty_ok || 0;
    const qtyRework = entry.qty_rework || 0;
    const qtyReject = entry.qty_reject || 0;

    const reworkPct = this.settings.rework_pay_percent;
    const rejectPct = this.settings.reject_pay_percent;

    // BUSINESS RULE FORMULA: amount = (qty_ok * rate) + (qty_rework * rate * rework_pct/100) + (qty_reject * rate * reject_pct/100)
    const amount = (qtyOk * rateSnapshot) 
                 + (qtyRework * rateSnapshot * (reworkPct / 100))
                 + (qtyReject * rateSnapshot * (rejectPct / 100));

    if (entry.id) {
      const idx = this.productionEntries.findIndex(e => e.id === entry.id);
      if (idx >= 0) {
        this.productionEntries[idx] = {
          ...this.productionEntries[idx],
          ...entry,
          rate_snapshot: rateSnapshot,
          amount,
        };
      }
      if (isSupabaseConfigured) {
        await supabase.from('production_entries').update({
          ...entry,
          rate_snapshot: rateSnapshot,
          amount,
        }).eq('id', entry.id);
      }
      this.recalculatePayrollLinesInMemory();
      return this.productionEntries[idx] || entry as ProductionEntry;
    } else {
      const newEntry: ProductionEntry = {
        id: crypto.randomUUID(),
        entry_date: entryDate,
        worker_id: entry.worker_id!,
        style_id: entry.style_id!,
        process_id: entry.process_id!,
        qty_ok: qtyOk,
        qty_rework: qtyRework,
        qty_reject: qtyReject,
        rate_snapshot: rateSnapshot,
        amount,
        shift: entry.shift || 'day',
        note: entry.note || null,
      };
      this.productionEntries.unshift(newEntry);
      if (isSupabaseConfigured) {
        await supabase.from('production_entries').insert({
          id: newEntry.id,
          entry_date: newEntry.entry_date,
          worker_id: newEntry.worker_id,
          style_id: newEntry.style_id,
          process_id: newEntry.process_id,
          qty_ok: newEntry.qty_ok,
          qty_rework: newEntry.qty_rework,
          qty_reject: newEntry.qty_reject,
          rate_snapshot: newEntry.rate_snapshot,
          amount: newEntry.amount,
          shift: newEntry.shift,
          note: newEntry.note,
        });
      }
      this.recalculatePayrollLinesInMemory();
      return newEntry;
    }
  }

  // --- ATTENDANCE ---
  public async getAttendance(dateStr?: string): Promise<AttendanceRecord[]> {
    await this.ensureSupabaseSeeded();
    let records = [...this.attendance];
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('attendance').select('*');
      if (!error && data && data.length > 0) {
        records = data;
        this.attendance = data;
      }
    }
    if (dateStr) {
      return records.filter(a => a.date === dateStr);
    }
    return records;
  }

  public async saveAttendance(record: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    if (this.isPeriodLocked(record.date || new Date().toISOString().split('T')[0])) {
      throw new Error('Cannot edit attendance inside a locked payroll period.');
    }

    const existingIdx = this.attendance.findIndex(a => a.worker_id === record.worker_id && a.date === record.date);
    if (existingIdx >= 0) {
      this.attendance[existingIdx] = { ...this.attendance[existingIdx], ...record };
      if (isSupabaseConfigured) {
        await supabase.from('attendance').update(record).eq('id', this.attendance[existingIdx].id);
      }
      this.recalculatePayrollLinesInMemory();
      return this.attendance[existingIdx];
    } else {
      const newAtt: AttendanceRecord = {
        id: crypto.randomUUID(),
        worker_id: record.worker_id!,
        date: record.date || new Date().toISOString().split('T')[0],
        status: record.status || 'present',
        ot_hours: record.ot_hours || 0,
      };
      this.attendance.push(newAtt);
      if (isSupabaseConfigured) {
        await supabase.from('attendance').insert(newAtt);
      }
      this.recalculatePayrollLinesInMemory();
      return newAtt;
    }
  }

  // --- ADJUSTMENTS ---
  public async getAdjustments(): Promise<Adjustment[]> {
    await this.ensureSupabaseSeeded();
    let adjusts = [...this.adjustments];
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('adjustments').select('*');
      if (!error && data && data.length > 0) {
        adjusts = data;
        this.adjustments = data;
      }
    }
    return adjusts;
  }

  public async saveAdjustment(adj: Partial<Adjustment>): Promise<Adjustment> {
    const newAdj: Adjustment = {
      id: crypto.randomUUID(),
      worker_id: adj.worker_id!,
      date: adj.date || new Date().toISOString().split('T')[0],
      type: adj.type || 'other',
      amount: adj.amount || 0,
      note: adj.note || null,
    };
    this.adjustments.push(newAdj);
    if (isSupabaseConfigured) {
      await supabase.from('adjustments').insert(newAdj);
    }
    this.recalculatePayrollLinesInMemory();
    return newAdj;
  }

  // --- PAYROLL RUN & RPC ---
  public async getPayrollPeriod(): Promise<PayrollPeriod> {
    await this.ensureSupabaseSeeded();
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('payroll_periods').select('*').limit(1).maybeSingle();
      if (!error && data) {
        this.payrollPeriod = data;
      }
    }
    return this.payrollPeriod;
  }

  public async updatePayrollPeriodStatus(status: 'open' | 'locked' | 'paid'): Promise<PayrollPeriod> {
    this.payrollPeriod.status = status;
    if (isSupabaseConfigured) {
      await supabase.from('payroll_periods').update({ status, locked_at: status !== 'open' ? new Date().toISOString() : null }).eq('id', this.payrollPeriod.id);
    }
    return this.payrollPeriod;
  }

  public async calculatePayrollRPC(): Promise<PayrollLine[]> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('calculate_payroll', { p_period_id: this.payrollPeriod.id });
      if (!error) {
        const { data } = await supabase.from('payroll_lines').select('*').eq('period_id', this.payrollPeriod.id);
        if (data && data.length > 0) {
          this.payrollLines = data;
        }
      }
    }
    this.recalculatePayrollLinesInMemory();
    return this.getPayrollLines();
  }

  public recalculatePayrollLinesInMemory(): void {
    const period = this.payrollPeriod;
    const minWagePerDay = this.settings.minimum_wage_per_day;
    const enableTopup = this.settings.enable_minimum_wage_topup;

    const lines: PayrollLine[] = this.workers.map(worker => {
      // Piece earnings
      const workerEntries = this.productionEntries.filter(e => 
        e.worker_id === worker.id && 
        e.entry_date >= period.start_date && 
        e.entry_date <= period.end_date
      );
      const piecesTotal = workerEntries.reduce((sum, e) => sum + e.qty_ok, 0);
      const pieceEarnings = workerEntries.reduce((sum, e) => sum + e.amount, 0);

      // Attendance
      const workerAtt = this.attendance.filter(a => 
        a.worker_id === worker.id && 
        a.date >= period.start_date && 
        a.date <= period.end_date
      );
      const presentDays = workerAtt.filter(a => a.status === 'present').length;
      const halfDays = workerAtt.filter(a => a.status === 'half_day').length;
      const otHrs = workerAtt.reduce((sum, a) => sum + (a.ot_hours || 0), 0);
      const otAmount = otHrs * 50;

      // Adjustments
      const workerAdj = this.adjustments.filter(a => 
        a.worker_id === worker.id && 
        a.date >= period.start_date && 
        a.date <= period.end_date
      );
      const bonusAmount = workerAdj.filter(a => a.type === 'bonus').reduce((sum, a) => sum + Number(a.amount), 0);
      const allowanceAmount = workerAdj.filter(a => a.type === 'allowance').reduce((sum, a) => sum + Number(a.amount), 0);
      const fines = workerAdj.filter(a => a.type === 'fine').reduce((sum, a) => sum + Number(a.amount), 0);
      const advRepay = workerAdj.filter(a => a.type === 'advance_repay').reduce((sum, a) => sum + Number(a.amount), 0);
      const deductions = fines + advRepay;

      // MINIMUM WAGE TOP-UP FORMULA: compare piece_earnings against (present_days + 0.5 * half_days) * min_wage_per_day
      let minimumWageTopup = 0;
      if (enableTopup && (presentDays + halfDays > 0)) {
        const requiredWage = (presentDays + 0.5 * halfDays) * minWagePerDay;
        if (pieceEarnings < requiredWage) {
          minimumWageTopup = requiredWage - pieceEarnings;
        }
      }

      const netPayable = Math.max(0, (pieceEarnings + minimumWageTopup + otAmount + bonusAmount + allowanceAmount) - deductions);

      return {
        id: `pl-${worker.id}`,
        period_id: period.id,
        worker_id: worker.id,
        pieces_total: piecesTotal,
        piece_earnings: Math.round(pieceEarnings * 100) / 100,
        ot_amount: otAmount,
        bonus_amount: bonusAmount,
        allowance_amount: allowanceAmount,
        deductions,
        minimum_wage_topup: Math.round(minimumWageTopup * 100) / 100,
        net_payable: Math.round(netPayable * 100) / 100,
        worker,
      };
    });

    this.payrollLines = lines;
  }

  public async getPayrollLines(): Promise<PayrollLine[]> {
    const workersMap = new Map((await this.getWorkers()).map(w => [w.id, w]));
    return this.payrollLines.map(l => ({
      ...l,
      worker: workersMap.get(l.worker_id),
    }));
  }
}

export const dataService = new DataService();
