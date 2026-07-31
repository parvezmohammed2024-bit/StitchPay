import { 
  Worker, GarmentStyle, GarmentProcess, ProductionEntry, 
  AttendanceRecord, Adjustment, PayrollPeriod, PayrollLine, 
  FactorySettings, UserRole, ProcessRateHistory, DailyAssignment, RateBid,
  UserAccount, DeliveryReport
} from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  INITIAL_SETTINGS, INITIAL_WORKERS, INITIAL_STYLES, 
  INITIAL_PROCESSES, INITIAL_PAYROLL_PERIOD, 
  INITIAL_PRODUCTION_ENTRIES, INITIAL_ADJUSTMENTS, INITIAL_ATTENDANCE,
  INITIAL_DAILY_ASSIGNMENTS, INITIAL_RATE_BIDS,
  INITIAL_USER_ACCOUNTS, INITIAL_DELIVERIES
} from './store';

class DataService {
  private settings: FactorySettings = { ...INITIAL_SETTINGS };
  private workers: Worker[] = [...INITIAL_WORKERS];
  private styles: GarmentStyle[] = [...INITIAL_STYLES];
  private processes: GarmentProcess[] = [...INITIAL_PROCESSES];
  private productionEntries: ProductionEntry[] = [...INITIAL_PRODUCTION_ENTRIES];
  private attendance: AttendanceRecord[] = [...INITIAL_ATTENDANCE];
  private adjustments: Adjustment[] = [...INITIAL_ADJUSTMENTS];
  private dailyAssignments: DailyAssignment[] = [...INITIAL_DAILY_ASSIGNMENTS];
  private rateBids: RateBid[] = [...INITIAL_RATE_BIDS];
  private userAccounts: UserAccount[] = [...INITIAL_USER_ACCOUNTS];
  private deliveries: DeliveryReport[] = [...INITIAL_DELIVERIES];
  private payrollPeriod: PayrollPeriod = { ...INITIAL_PAYROLL_PERIOD };
  private payrollLines: PayrollLine[] = [];
  private currentRole: UserRole = 'admin';
  private activeWorkerId: string = 'b1111111-1111-1111-1111-111111111101'; // Default worker for worker portal view
  private currentAuthUser: UserAccount | null = null;
  private initializedSupabase: boolean = false;

  constructor() {
    this.recalculatePayrollLinesInMemory();
    this.initAuthUser();
  }

  private initAuthUser() {
    try {
      const saved = localStorage.getItem('stitchpay_auth_user');
      if (saved) {
        this.currentAuthUser = JSON.parse(saved);
        if (this.currentAuthUser?.role) {
          this.currentRole = this.currentAuthUser.role;
        }
        if (this.currentAuthUser?.worker_id) {
          this.activeWorkerId = this.currentAuthUser.worker_id;
        }
      } else {
        const masterAdmin = this.userAccounts.find(u => u.email_or_phone === 'parvezmohammed2024@gmail.com') || {
          id: 'master-admin-01',
          email_or_phone: 'parvezmohammed2024@gmail.com',
          full_name: 'Parvez Mohammed (Master Admin)',
          role: 'admin' as UserRole,
          status: 'active' as const,
          created_at: new Date().toISOString(),
        };
        this.currentAuthUser = masterAdmin;
      }
    } catch (e) {
      console.error('Error reading saved auth user', e);
    }
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

  // --- ROLE & ACCOUNT MANAGEMENT ---
  public setRole(role: UserRole) {
    this.currentRole = role;
  }

  public getRole(): UserRole {
    return this.currentRole;
  }

  public setActiveWorkerId(workerId: string) {
    this.activeWorkerId = workerId;
  }

  public getActiveWorkerId(): string {
    return this.activeWorkerId;
  }

  public getCurrentAuthUser(): UserAccount | null {
    if (!this.currentAuthUser) {
      this.initAuthUser();
    }
    return this.currentAuthUser;
  }

  public async loginUser(emailOrPhone: string, password?: string): Promise<UserAccount> {
    await this.ensureSupabaseSeeded();
    const cleanIdentifier = emailOrPhone.trim().toLowerCase();

    // Check existing user accounts
    let account = this.userAccounts.find(
      u => u.email_or_phone.trim().toLowerCase() === cleanIdentifier
    );

    if (!account) {
      // Check workers list to match phone or email
      const workerMatch = this.workers.find(
        w => (w.email && w.email.trim().toLowerCase() === cleanIdentifier) ||
             (w.phone && w.phone.trim().toLowerCase() === cleanIdentifier)
      );

      if (workerMatch) {
        account = await this.saveUserAccount({
          email_or_phone: cleanIdentifier,
          password: password || '123456',
          full_name: workerMatch.full_name,
          role: 'worker',
          worker_id: workerMatch.id,
          status: 'active',
        });
      } else {
        // Create account on the fly for login
        const defaultRole: UserRole = cleanIdentifier.includes('admin') ? 'admin' :
                                      cleanIdentifier.includes('super') ? 'supervisor' :
                                      cleanIdentifier.includes('account') ? 'accounts' : 'worker';
        let linkedWorkerId: string | null = null;
        if (defaultRole === 'worker') {
          linkedWorkerId = this.workers[0]?.id || null;
        }

        account = await this.saveUserAccount({
          email_or_phone: cleanIdentifier,
          password: password || '123456',
          full_name: cleanIdentifier.split('@')[0] || 'User',
          role: defaultRole,
          worker_id: linkedWorkerId,
          status: 'active',
        });
      }
    }

    this.currentAuthUser = account;
    this.currentRole = account.role;
    if (account.worker_id) {
      this.activeWorkerId = account.worker_id;
    }

    try {
      localStorage.setItem('stitchpay_auth_user', JSON.stringify(account));
    } catch (e) {
      console.error('Failed to write auth to localStorage', e);
    }

    return account;
  }

  public async signupUser(accountData: {
    email_or_phone: string;
    password?: string;
    full_name: string;
    role: UserRole;
    worker_id?: string | null;
  }): Promise<UserAccount> {
    await this.ensureSupabaseSeeded();

    let linkedWorkerId = accountData.worker_id || null;

    if (accountData.role === 'worker' && !linkedWorkerId) {
      const newWorker = await this.saveWorker({
        full_name: accountData.full_name,
        phone: accountData.email_or_phone.includes('@') ? null : accountData.email_or_phone,
        email: accountData.email_or_phone.includes('@') ? accountData.email_or_phone : null,
        worker_code: `W-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'active',
        payment_method: 'cash',
        payment_details: {},
      });
      linkedWorkerId = newWorker.id;
    }

    const account = await this.saveUserAccount({
      email_or_phone: accountData.email_or_phone.trim().toLowerCase(),
      password: accountData.password || '123456',
      full_name: accountData.full_name,
      role: accountData.role,
      worker_id: linkedWorkerId,
      status: 'active',
    });

    this.currentAuthUser = account;
    this.currentRole = account.role;
    if (account.worker_id) {
      this.activeWorkerId = account.worker_id;
    }

    try {
      localStorage.setItem('stitchpay_auth_user', JSON.stringify(account));
    } catch (e) {
      console.error('Failed to write auth to localStorage', e);
    }

    return account;
  }

  public logoutUser(): void {
    this.currentAuthUser = null;
    try {
      localStorage.removeItem('stitchpay_auth_user');
    } catch (e) {
      console.error('Failed to remove auth from localStorage', e);
    }
  }

  public async getUserAccounts(): Promise<UserAccount[]> {
    await this.ensureSupabaseSeeded();
    let result = [...this.userAccounts];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('user_accounts').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          const map = new Map<string, UserAccount>();
          for (const d of data) map.set(d.id, d);
          for (const localU of this.userAccounts) {
            if (!map.has(localU.id)) map.set(localU.id, localU);
          }
          result = Array.from(map.values());
          this.userAccounts = result;
        }
      } catch (err) {
        console.error('getUserAccounts error:', err);
      }
    }
    return result;
  }

  public async saveUserAccount(account: Partial<UserAccount>): Promise<UserAccount> {
    const id = account.id || crypto.randomUUID();
    const newAccount: UserAccount = {
      id,
      email_or_phone: account.email_or_phone!,
      full_name: account.full_name || 'User',
      role: account.role || 'worker',
      worker_id: account.worker_id || null,
      status: account.status || 'active',
      created_at: account.created_at || new Date().toISOString(),
    };

    const idx = this.userAccounts.findIndex(u => u.id === id || u.email_or_phone === account.email_or_phone);
    if (idx >= 0) {
      this.userAccounts[idx] = { ...this.userAccounts[idx], ...newAccount };
    } else {
      this.userAccounts.push(newAccount);
    }

    if (isSupabaseConfigured) {
      await supabase.from('user_accounts').upsert(newAccount);
    }

    return newAccount;
  }

  public async updateUserRole(accountId: string, newRole: UserRole, workerId?: string | null): Promise<void> {
    const idx = this.userAccounts.findIndex(u => u.id === accountId);
    if (idx >= 0) {
      this.userAccounts[idx].role = newRole;
      if (workerId !== undefined) {
        this.userAccounts[idx].worker_id = workerId;
      }
      if (isSupabaseConfigured) {
        await supabase.from('user_accounts').update({
          role: newRole,
          worker_id: workerId !== undefined ? workerId : this.userAccounts[idx].worker_id,
        }).eq('id', accountId);
      }
    }
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
      try {
        const { data, error } = await supabase.from('workers').select('*');
        if (!error && data && data.length > 0) {
          const map = new Map<string, Worker>();
          for (const d of data) map.set(d.id, d);
          for (const localW of this.workers) {
            if (!map.has(localW.id)) {
              map.set(localW.id, localW);
            }
          }
          result = Array.from(map.values());
          this.workers = result;
        }
      } catch (err) {
        console.error('getWorkers error:', err);
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
        try {
          await supabase.from('workers').update(worker).eq('id', worker.id);
        } catch (err) {
          console.error('saveWorker update error:', err);
        }
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
        try {
          await supabase.from('workers').insert(newWorker);
        } catch (err) {
          console.error('saveWorker insert error:', err);
        }
      }
      return newWorker;
    }
  }

  // --- STYLES & PROCESSES ---
  public async getStyles(): Promise<GarmentStyle[]> {
    await this.ensureSupabaseSeeded();
    let result = [...this.styles];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('styles').select('*');
        if (!error && data && data.length > 0) {
          const map = new Map<string, GarmentStyle>();
          for (const d of data) map.set(d.id, d);
          for (const localSt of this.styles) {
            if (!map.has(localSt.id)) {
              map.set(localSt.id, localSt);
            }
          }
          result = Array.from(map.values());
          this.styles = result;
        }
      } catch (err) {
        console.error('getStyles error:', err);
      }
    }

    // Attach completed pieces, delivered pieces, remaining pieces, and total labour cost
    const procs = await this.getProcesses();
    const entries = await this.getProductionEntries();
    const deliveriesList = await this.getDeliveries();

    return result.map(st => {
      const styleProcs = procs.filter(p => p.style_id === st.id);
      const totalLabourCost = styleProcs.reduce((sum, p) => sum + Number(p.rate || 0), 0);
      
      // Completed pieces based on final process in sequence
      const lastProc = styleProcs.sort((a, b) => b.seq_no - a.seq_no)[0];
      let completed_pieces = 0;
      if (lastProc) {
        completed_pieces = entries
          .filter(e => e.style_id === st.id && e.process_id === lastProc.id)
          .reduce((sum, e) => sum + Number(e.qty_ok || 0), 0);
      }

      // Delivered pieces from delivery reports
      const delivered_pieces = deliveriesList
        .filter(d => d.style_id === st.id)
        .reduce((sum, d) => sum + Number(d.delivered_qty || 0), 0);

      const remaining_pieces = Math.max(0, (st.order_qty || 0) - delivered_pieces);

      return {
        ...st,
        total_labour_cost: totalLabourCost,
        completed_pieces,
        delivered_pieces,
        remaining_pieces,
      };
    });
  }

  public async saveStyle(style: Partial<GarmentStyle>): Promise<GarmentStyle> {
    if (style.id) {
      const idx = this.styles.findIndex(s => s.id === style.id);
      if (idx >= 0) this.styles[idx] = { ...this.styles[idx], ...style };
      if (isSupabaseConfigured) {
        try {
          await supabase.from('styles').update(style).eq('id', style.id);
        } catch (err) {
          console.error('saveStyle update error:', err);
        }
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
      this.styles.unshift(newStyle);
      if (isSupabaseConfigured) {
        try {
          await supabase.from('styles').insert(newStyle);
        } catch (err) {
          console.error('saveStyle insert error:', err);
        }
      }
      return newStyle;
    }
  }

  public async getProcesses(styleId?: string): Promise<GarmentProcess[]> {
    await this.ensureSupabaseSeeded();
    let procs = [...this.processes];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('processes').select('*');
        if (!error && data && data.length > 0) {
          const map = new Map<string, GarmentProcess>();
          for (const d of data) map.set(d.id, d);
          for (const localP of this.processes) {
            if (!map.has(localP.id)) {
              map.set(localP.id, localP);
            }
          }
          procs = Array.from(map.values());
          this.processes = procs;
        }
      } catch (err) {
        console.error('getProcesses error:', err);
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
        try {
          await supabase.from('processes').update(proc).eq('id', proc.id);
        } catch (err) {
          console.error('saveProcess update error:', err);
        }
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
        try {
          await supabase.from('processes').insert(newProc);
        } catch (err) {
          console.error('saveProcess insert error:', err);
        }
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
      try {
        const { data, error } = await supabase
          .from('production_entries')
          .select('*')
          .order('entry_date', { ascending: false });
        if (!error && data) {
          const map = new Map<string, ProductionEntry>();
          for (const d of data) map.set(d.id, d);
          for (const localE of this.productionEntries) {
            if (!map.has(localE.id)) map.set(localE.id, localE);
          }
          entries = Array.from(map.values());
          this.productionEntries = entries;
        }
      } catch (err) {
        console.error('getProductionEntries error:', err);
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

    let rateSnapshot = entry.rate_snapshot;
    let assignmentId = entry.assignment_id || null;

    if (rateSnapshot === undefined) {
      const assignment = this.dailyAssignments.find(a => 
        a.worker_id === entry.worker_id && 
        a.process_id === entry.process_id && 
        a.work_date === entryDate
      );
      if (assignment) {
        rateSnapshot = assignment.agreed_rate;
        assignmentId = assignment.id;
      } else {
        const proc = this.processes.find(p => p.id === entry.process_id);
        rateSnapshot = proc?.rate ?? 3.5;
      }
    }

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
          assignment_id: assignmentId,
          rate_snapshot: rateSnapshot,
          amount,
        };
      }
      if (isSupabaseConfigured) {
        await supabase.from('production_entries').update({
          ...entry,
          assignment_id: assignmentId,
          rate_snapshot: rateSnapshot,
          amount,
        }).eq('id', entry.id);
      }
      this.recalculatePayrollLinesInMemory();
      return this.productionEntries[idx] || entry as ProductionEntry;
    } else {
      const newEntry: ProductionEntry = {
        id: crypto.randomUUID(),
        assignment_id: assignmentId,
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
          assignment_id: newEntry.assignment_id,
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

  // --- DELIVERIES / DISPATCH REPORTS ---
  public async getDeliveries(styleId?: string): Promise<DeliveryReport[]> {
    await this.ensureSupabaseSeeded();
    let list = [...this.deliveries];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('delivery_reports').select('*').order('delivery_date', { ascending: false });
        if (!error && data) {
          const map = new Map<string, DeliveryReport>();
          for (const d of data) map.set(d.id, d);
          for (const localD of this.deliveries) {
            if (!map.has(localD.id)) map.set(localD.id, localD);
          }
          list = Array.from(map.values());
          this.deliveries = list;
        }
      } catch (err) {
        console.error('getDeliveries error:', err);
      }
    }

    const stylesMap = new Map((await this.getStyles()).map(s => [s.id, s]));

    const result = list.map(d => {
      const s = stylesMap.get(d.style_id);
      return {
        ...d,
        style_code: s?.style_code || '',
        style_name: s?.name || '',
        buyer_name: s?.buyer_name || '',
      };
    });

    if (styleId) {
      return result.filter(d => d.style_id === styleId);
    }
    return result;
  }

  public async saveDelivery(delivery: Partial<DeliveryReport>): Promise<DeliveryReport> {
    const id = delivery.id || crypto.randomUUID();
    const newDelivery: DeliveryReport = {
      id,
      delivery_date: delivery.delivery_date || new Date().toISOString().split('T')[0],
      style_id: delivery.style_id!,
      delivered_qty: Number(delivery.delivered_qty || 0),
      vehicle_no: delivery.vehicle_no || null,
      driver_name: delivery.driver_name || null,
      destination: delivery.destination || null,
      notes: delivery.notes || null,
      created_at: delivery.created_at || new Date().toISOString(),
    };

    const idx = this.deliveries.findIndex(d => d.id === id);
    if (idx >= 0) {
      this.deliveries[idx] = newDelivery;
    } else {
      this.deliveries.unshift(newDelivery);
    }

    if (isSupabaseConfigured) {
      await supabase.from('delivery_reports').upsert(newDelivery);
    }

    return newDelivery;
  }

  public async deleteDelivery(id: string): Promise<void> {
    this.deliveries = this.deliveries.filter(d => d.id !== id);
    if (isSupabaseConfigured) {
      await supabase.from('delivery_reports').delete().eq('id', id);
    }
  }

  // --- ATTENDANCE & PUNCH CLOCK ---
  public async getAttendance(dateStr?: string): Promise<AttendanceRecord[]> {
    await this.ensureSupabaseSeeded();
    let records = [...this.attendance];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('attendance').select('*');
        if (!error && data && data.length > 0) {
          const map = new Map<string, AttendanceRecord>();
          for (const d of data) map.set(d.id, d);
          for (const localRec of this.attendance) {
            if (!map.has(localRec.id)) {
              map.set(localRec.id, localRec);
            }
          }
          records = Array.from(map.values());
          this.attendance = records;
        }
      } catch (err) {
        console.error('getAttendance error:', err);
      }
    }
    if (dateStr) {
      return records.filter(a => a.date === dateStr);
    }
    return records;
  }

  public async clockInWorker(workerId: string, location?: { lat: number; lng: number; address?: string }): Promise<AttendanceRecord> {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let record = this.attendance.find(a => a.worker_id === workerId && a.date === todayStr);

    if (record) {
      record.status = 'present';
      record.in_time = nowTimeStr;
      record.out_time = null; // Clear out_time so worker is marked clocked in
      record.is_on_break = false;
      if (location) {
        record.clock_in_lat = location.lat;
        record.clock_in_lng = location.lng;
        record.clock_in_address = location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
      }
    } else {
      record = {
        id: crypto.randomUUID(),
        worker_id: workerId,
        date: todayStr,
        status: 'present',
        in_time: nowTimeStr,
        out_time: null,
        is_on_break: false,
        ot_hours: 0,
        clock_in_lat: location?.lat || null,
        clock_in_lng: location?.lng || null,
        clock_in_address: location?.address || (location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : null),
      };
      this.attendance.push(record);
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('attendance').upsert(record);
      } catch (err) {
        console.error('Supabase attendance clock-in error:', err);
      }
    }

    this.recalculatePayrollLinesInMemory();
    return { ...record };
  }

  public async toggleWorkerBreak(workerId: string): Promise<AttendanceRecord> {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let record = this.attendance.find(a => a.worker_id === workerId && a.date === todayStr);
    if (!record) {
      record = await this.clockInWorker(workerId);
    }

    if (record.is_on_break) {
      record.is_on_break = false;
      record.break_end_time = nowTimeStr;
    } else {
      record.is_on_break = true;
      record.break_start_time = nowTimeStr;
    }

    if (isSupabaseConfigured) {
      await supabase.from('attendance').upsert(record);
    }

    return record;
  }

  public async clockOutWorker(workerId: string, location?: { lat: number; lng: number; address?: string }): Promise<AttendanceRecord> {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let record = this.attendance.find(a => a.worker_id === workerId && a.date === todayStr);
    if (!record) {
      record = await this.clockInWorker(workerId, location);
    }

    record.out_time = nowTimeStr;
    record.is_on_break = false;

    if (location) {
      record.clock_out_lat = location.lat;
      record.clock_out_lng = location.lng;
      record.clock_out_address = location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    }

    if (isSupabaseConfigured) {
      await supabase.from('attendance').upsert(record);
    }

    this.recalculatePayrollLinesInMemory();
    return record;
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
      try {
        const { data, error } = await supabase.from('adjustments').select('*');
        if (!error && data) {
          const map = new Map<string, Adjustment>();
          for (const d of data) map.set(d.id, d);
          for (const localA of this.adjustments) {
            if (!map.has(localA.id)) map.set(localA.id, localA);
          }
          adjusts = Array.from(map.values());
          this.adjustments = adjusts;
        }
      } catch (err) {
        console.error('getAdjustments error:', err);
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

  // --- DAILY ASSIGNMENTS ---
  public async getDailyAssignments(workDate?: string): Promise<DailyAssignment[]> {
    await this.ensureSupabaseSeeded();
    const dateToFetch = workDate || new Date().toISOString().split('T')[0];
    let rawList = [...this.dailyAssignments];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('daily_assignments')
          .select('*')
          .eq('work_date', dateToFetch);
        if (!error && data) {
          const map = new Map<string, DailyAssignment>();
          for (const d of data) map.set(d.id, d);
          for (const localA of this.dailyAssignments.filter(a => a.work_date === dateToFetch)) {
            if (!map.has(localA.id)) map.set(localA.id, localA);
          }
          rawList = Array.from(map.values());
        }
      } catch (err) {
        console.error('getDailyAssignments error:', err);
      }
    } else {
      rawList = this.dailyAssignments.filter(a => a.work_date === dateToFetch);
    }

    // Join display fields
    const workersMap = new Map((await this.getWorkers()).map(w => [w.id, w]));
    const stylesMap = new Map((await this.getStyles()).map(s => [s.id, s]));
    const processesMap = new Map((await this.getProcesses()).map(p => [p.id, p]));

    return rawList.map(a => {
      const w = workersMap.get(a.worker_id);
      const s = stylesMap.get(a.style_id);
      const p = processesMap.get(a.process_id);
      return {
        ...a,
        worker_name: w?.full_name || 'Worker',
        worker_code: w?.worker_code || '',
        worker_photo: w?.photo_url || undefined,
        style_name: s?.name || '',
        style_code: s?.style_code || '',
        process_name: p?.name || '',
        standard_rate: p?.rate || a.agreed_rate,
      };
    });
  }

  public async saveDailyAssignment(assignment: Partial<DailyAssignment>): Promise<DailyAssignment> {
    const id = assignment.id || crypto.randomUUID();
    const workDate = assignment.work_date || new Date().toISOString().split('T')[0];

    // Check if worker has an approved bid for this process to set default agreed_rate if not explicitly set
    let defaultRate = assignment.agreed_rate;
    if (defaultRate === undefined) {
      const approvedBid = this.rateBids.find(b => b.worker_id === assignment.worker_id && b.process_id === assignment.process_id && b.status === 'approved');
      if (approvedBid) {
        defaultRate = approvedBid.counter_rate || approvedBid.proposed_rate;
      } else {
        const proc = this.processes.find(p => p.id === assignment.process_id);
        defaultRate = proc ? proc.rate : 0;
      }
    }

    const record: DailyAssignment = {
      id,
      work_date: workDate,
      style_id: assignment.style_id!,
      process_id: assignment.process_id!,
      worker_id: assignment.worker_id!,
      target_qty: assignment.target_qty ?? null,
      agreed_rate: Number(defaultRate || 0),
      status: assignment.status || 'active',
      note: assignment.note || null,
      created_at: assignment.created_at || new Date().toISOString(),
    };

    const existingIdx = this.dailyAssignments.findIndex(a => a.id === id);
    if (existingIdx >= 0) {
      this.dailyAssignments[existingIdx] = record;
    } else {
      this.dailyAssignments.push(record);
    }

    if (isSupabaseConfigured) {
      await supabase.from('daily_assignments').upsert({
        id: record.id,
        work_date: record.work_date,
        style_id: record.style_id,
        process_id: record.process_id,
        worker_id: record.worker_id,
        target_qty: record.target_qty,
        agreed_rate: record.agreed_rate,
        status: record.status,
        note: record.note,
      });
    }

    const fullList = await this.getDailyAssignments(workDate);
    return fullList.find(a => a.id === id) || record;
  }

  public async deleteDailyAssignment(id: string): Promise<void> {
    this.dailyAssignments = this.dailyAssignments.filter(a => a.id !== id);
    if (isSupabaseConfigured) {
      await supabase.from('daily_assignments').delete().eq('id', id);
    }
  }

  public async copyAssignmentsFromDate(fromDate: string, targetDate: string): Promise<DailyAssignment[]> {
    const sourceAssignments = await this.getDailyAssignments(fromDate);
    if (sourceAssignments.length === 0) return [];

    const newAssignments: DailyAssignment[] = [];
    for (const src of sourceAssignments) {
      const cloned = await this.saveDailyAssignment({
        work_date: targetDate,
        style_id: src.style_id,
        process_id: src.process_id,
        worker_id: src.worker_id,
        target_qty: src.target_qty,
        agreed_rate: src.agreed_rate,
        status: 'planned',
        note: `Cloned from ${fromDate}`,
      });
      newAssignments.push(cloned);
    }
    return newAssignments;
  }

  public async autoAssignFromHistory(styleIds: string[], targetDate: string): Promise<{ draft: DailyAssignment[]; skippedWorkers: string[]; unassignedProcesses: string[] }> {
    const workers = await this.getWorkers();
    const attendanceToday = await this.getAttendance(targetDate);
    const absentWorkerIds = new Set(attendanceToday.filter(a => a.status === 'absent').map(a => a.worker_id));
    
    const availableWorkers = workers.filter(w => w.status === 'active' && !absentWorkerIds.has(w.id));
    const availableWorkerIds = new Set(availableWorkers.map(w => w.id));

    // Calculate worker output history on each process over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const recentEntries = this.productionEntries.filter(e => e.entry_date >= thirtyDaysAgo);

    const draftAssignments: DailyAssignment[] = [];
    const skippedWorkers: string[] = workers.filter(w => absentWorkerIds.has(w.id)).map(w => `${w.full_name} (${w.worker_code})`);
    const unassignedProcesses: string[] = [];

    const allProcesses = await this.getProcesses();
    const targetProcesses = allProcesses.filter(p => styleIds.includes(p.style_id) && p.is_active);

    for (const proc of targetProcesses) {
      // Find worker who ran this process most frequently and with highest output in last 30 days
      const candidates = recentEntries.filter(e => e.process_id === proc.id && availableWorkerIds.has(e.worker_id));
      
      const scoreMap = new Map<string, { count: number; totalQty: number }>();
      for (const entry of candidates) {
        const cur = scoreMap.get(entry.worker_id) || { count: 0, totalQty: 0 };
        scoreMap.set(entry.worker_id, {
          count: cur.count + 1,
          totalQty: cur.totalQty + entry.qty_ok,
        });
      }

      let bestWorkerId: string | null = null;
      let highestQty = -1;

      for (const [wId, stats] of scoreMap.entries()) {
        if (stats.totalQty > highestQty) {
          highestQty = stats.totalQty;
          bestWorkerId = wId;
        }
      }

      // If no history found, assign next available worker in line
      if (!bestWorkerId && availableWorkers.length > 0) {
        const index = draftAssignments.length % availableWorkers.length;
        bestWorkerId = availableWorkers[index]?.id || null;
      }

      if (bestWorkerId) {
        // Check for worker rate bid
        const approvedBid = this.rateBids.find(b => b.worker_id === bestWorkerId && b.process_id === proc.id && b.status === 'approved');
        const rateToUse = approvedBid ? (approvedBid.counter_rate || approvedBid.proposed_rate) : proc.rate;

        draftAssignments.push({
          id: `draft-${proc.id}-${bestWorkerId}`,
          work_date: targetDate,
          style_id: proc.style_id,
          process_id: proc.id,
          worker_id: bestWorkerId,
          target_qty: 250, // default line target
          agreed_rate: rateToUse,
          status: 'planned',
          note: 'Auto-assigned from 30-day production history',
        });
      } else {
        unassignedProcesses.push(proc.name);
      }
    }

    return { draft: draftAssignments, skippedWorkers, unassignedProcesses };
  }

  // --- RATE BIDS ---
  public async getRateBids(): Promise<RateBid[]> {
    await this.ensureSupabaseSeeded();
    let rawList = [...this.rateBids];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('rate_bids').select('*').order('submitted_at', { ascending: false });
        if (!error && data) {
          const map = new Map<string, RateBid>();
          for (const d of data) map.set(d.id, d);
          for (const localB of this.rateBids) {
            if (!map.has(localB.id)) map.set(localB.id, localB);
          }
          rawList = Array.from(map.values());
          this.rateBids = rawList;
        }
      } catch (err) {
        console.error('getRateBids error:', err);
      }
    }

    const workersMap = new Map((await this.getWorkers()).map(w => [w.id, w]));
    const processesMap = new Map((await this.getProcesses()).map(p => [p.id, p]));
    const stylesMap = new Map((await this.getStyles()).map(s => [s.id, s]));

    return rawList.map(b => {
      const w = workersMap.get(b.worker_id);
      const p = processesMap.get(b.process_id);
      const s = p ? stylesMap.get(p.style_id) : undefined;

      return {
        ...b,
        worker_name: w?.full_name || 'Worker',
        worker_code: w?.worker_code || '',
        worker_photo: w?.photo_url || undefined,
        process_name: p?.name || '',
        style_code: s?.style_code || '',
        style_name: s?.name || '',
      };
    });
  }

  public async createRateBid(bidData: Partial<RateBid>): Promise<RateBid> {
    const proc = this.processes.find(p => p.id === bidData.process_id);
    const currentRate = bidData.current_rate ?? (proc ? proc.rate : 0);

    const newBid: RateBid = {
      id: crypto.randomUUID(),
      process_id: bidData.process_id!,
      worker_id: bidData.worker_id!,
      current_rate: currentRate,
      proposed_rate: Number(bidData.proposed_rate || currentRate),
      counter_rate: bidData.counter_rate ? Number(bidData.counter_rate) : null,
      reason: bidData.reason || null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    };

    this.rateBids.unshift(newBid);

    if (isSupabaseConfigured) {
      await supabase.from('rate_bids').insert({
        id: newBid.id,
        process_id: newBid.process_id,
        worker_id: newBid.worker_id,
        current_rate: newBid.current_rate,
        proposed_rate: newBid.proposed_rate,
        counter_rate: newBid.counter_rate,
        reason: newBid.reason,
        status: newBid.status,
        submitted_at: newBid.submitted_at,
      });
    }

    return newBid;
  }

  public async reviewRateBid(bidId: string, status: 'approved' | 'rejected' | 'countered', reviewNote?: string, counterRate?: number): Promise<void> {
    const bidIndex = this.rateBids.findIndex(b => b.id === bidId);
    if (bidIndex === -1) return;

    const bid = this.rateBids[bidIndex];
    const reviewedAt = new Date().toISOString();

    bid.status = status;
    bid.reviewed_at = reviewedAt;
    bid.review_note = reviewNote || null;
    if (counterRate !== undefined) {
      bid.counter_rate = counterRate;
    }

    if (isSupabaseConfigured) {
      await supabase.from('rate_bids').update({
        status,
        reviewed_at: reviewedAt,
        review_note: reviewNote || null,
        counter_rate: bid.counter_rate,
      }).eq('id', bidId);
    }

    // ON APPROVAL: Update agreed_rate on that worker's CURRENT and FUTURE assignments for that process
    if (status === 'approved') {
      const finalRate = bid.counter_rate || bid.proposed_rate;
      const todayStr = new Date().toISOString().split('T')[0];

      // Update in-memory
      for (const assign of this.dailyAssignments) {
        if (assign.worker_id === bid.worker_id && assign.process_id === bid.process_id && assign.work_date >= todayStr) {
          assign.agreed_rate = finalRate;
        }
      }

      if (isSupabaseConfigured) {
        await supabase.from('daily_assignments')
          .update({ agreed_rate: finalRate })
          .eq('worker_id', bid.worker_id)
          .eq('process_id', bid.process_id)
          .gte('work_date', todayStr);
      }
    }
  }

  public async acceptCounterBid(bidId: string): Promise<void> {
    const bid = this.rateBids.find(b => b.id === bidId);
    if (!bid || bid.status !== 'countered') return;
    await this.reviewRateBid(bidId, 'approved', 'Counter offer accepted by worker/supervisor');
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
