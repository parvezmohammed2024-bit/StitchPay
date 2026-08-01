import { 
  Worker, GarmentStyle, GarmentProcess, ProductionEntry, 
  AttendanceRecord, Adjustment, PayrollPeriod, PayrollLine, 
  FactorySettings, UserRole, DailyAssignment, RateBid,
  UserAccount, DeliveryReport
} from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { showErrorToast } from './toast';

class DataService {
  private settings: FactorySettings = {
    id: 'default-settings-01',
    factory_name: 'StitchPay Garments Ltd.',
    logo_url: null,
    currency_code: 'BDT',
    currency_symbol: '৳',
    pay_cycle: 'weekly',
    week_start_day: 'Saturday',
    rework_pay_percent: 50,
    reject_pay_percent: 0,
    minimum_wage_per_day: 500,
    enable_minimum_wage_topup: true,
  };

  private workers: Worker[] = [];
  private styles: GarmentStyle[] = [];
  private processes: GarmentProcess[] = [];
  private productionEntries: ProductionEntry[] = [];
  private attendance: AttendanceRecord[] = [];
  private adjustments: Adjustment[] = [];
  private dailyAssignments: DailyAssignment[] = [];
  private rateBids: RateBid[] = [];
  private userAccounts: UserAccount[] = [];
  private deliveries: DeliveryReport[] = [];
  private payrollPeriod: PayrollPeriod = {
    id: 'pp-2026-w31',
    name: 'Week 31 (Jul 26 - Aug 01, 2026)',
    start_date: '2026-07-26',
    end_date: '2026-08-01',
    status: 'open',
  };
  private payrollLines: PayrollLine[] = [];
  private currentRole: UserRole = 'admin';
  private activeWorkerId: string = '';
  private currentAuthUser: UserAccount | null = null;

  constructor() {
    this.initAuthUser();
  }

  private handleError(error: any, context?: string): boolean {
    if (error) {
      const message = error.message || String(error);
      showErrorToast(context ? `${context}: ${message}` : message);
      return true;
    }
    return false;
  }

  private generateId(prefix?: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        return crypto.randomUUID();
      } catch (e) {
        // fallback
      }
    }
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    return prefix ? `${prefix}-${id}` : id;
  }

  private initAuthUser() {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('stitchpay_auth_user');
        if (saved) {
          this.currentAuthUser = JSON.parse(saved);
          if (this.currentAuthUser?.role) {
            this.currentRole = this.currentAuthUser.role;
          }
          if (this.currentAuthUser?.worker_id) {
            this.activeWorkerId = this.currentAuthUser.worker_id;
          }
        }
      }
    } catch (e) {
      console.error('Error reading saved auth user', e);
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
    const cleanIdentifier = emailOrPhone.trim().toLowerCase();

    // Fetch accounts from profiles and user_roles
    const accounts = await this.getUserAccounts();
    let account = accounts.find(
      u => u.email_or_phone.trim().toLowerCase() === cleanIdentifier
    );

    if (!account) {
      const workersList = await this.getWorkers();
      const workerMatch = workersList.find(
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
        const defaultRole: UserRole = cleanIdentifier.includes('admin') ? 'admin' :
                                      cleanIdentifier.includes('super') ? 'supervisor' :
                                      cleanIdentifier.includes('account') ? 'accounts' : 'worker';
        let linkedWorkerId: string | null = null;
        if (defaultRole === 'worker' && workersList.length > 0) {
          linkedWorkerId = workersList[0].id;
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
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('stitchpay_auth_user', JSON.stringify(account));
      }
    } catch (e) {
      console.error('Failed to write auth session', e);
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
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('stitchpay_auth_user', JSON.stringify(account));
      }
    } catch (e) {
      console.error('Failed to write auth session', e);
    }

    return account;
  }

  public logoutUser(): void {
    this.currentAuthUser = null;
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem('stitchpay_auth_user');
      }
    } catch (e) {
      console.error('Failed to remove auth session', e);
    }
  }

  public async getUserAccounts(): Promise<UserAccount[]> {
    if (!isSupabaseConfigured) return this.userAccounts;

    const { data: profs, error: pErr } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    this.handleError(pErr, 'Error fetching user profiles');

    const { data: roles, error: rErr } = await supabase.from('user_roles').select('*');
    this.handleError(rErr, 'Error fetching user roles');

    if (profs) {
      const rolesMap = new Map((roles || []).map(r => [r.user_id, r.role]));
      this.userAccounts = profs.map(p => ({
        id: p.id,
        email_or_phone: p.email || p.id,
        full_name: p.full_name || 'User',
        role: (rolesMap.get(p.id) as UserRole) || 'worker',
        worker_id: null,
        status: p.status || 'active',
        created_at: p.created_at || new Date().toISOString(),
      }));
    }
    return this.userAccounts;
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

    if (isSupabaseConfigured) {
      const { error: pErr } = await supabase.from('profiles').upsert({
        id: newAccount.id,
        full_name: newAccount.full_name,
        email: newAccount.email_or_phone,
        status: newAccount.status,
      });
      this.handleError(pErr, 'Error saving profile');

      const { error: rErr } = await supabase.from('user_roles').upsert({
        user_id: newAccount.id,
        role: newAccount.role,
      });
      this.handleError(rErr, 'Error saving user role');

      await this.getUserAccounts();
    } else {
      const idx = this.userAccounts.findIndex(u => u.id === id);
      if (idx >= 0) this.userAccounts[idx] = newAccount;
      else this.userAccounts.push(newAccount);
    }

    return newAccount;
  }

  public async updateUserRole(accountId: string, newRole: UserRole, workerId?: string | null): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('user_roles').upsert({
        user_id: accountId,
        role: newRole,
      });
      this.handleError(error, 'Error updating user role');
      await this.getUserAccounts();
    }
  }

  // --- SETTINGS ---
  public async getSettings(): Promise<FactorySettings> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (!this.handleError(error, 'Error fetching settings') && data) {
        this.settings = { ...this.settings, ...data };
      }
    }
    return this.settings;
  }

  public async updateSettings(newSettings: Partial<FactorySettings>): Promise<FactorySettings> {
    this.settings = { ...this.settings, ...newSettings };
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('settings').upsert({
        id: this.settings.id,
        ...this.settings,
        ...newSettings,
      });
      this.handleError(error, 'Error updating settings');
      await this.getSettings();
    }
    return this.settings;
  }

  // --- WORKERS ---
  public async getWorkers(): Promise<Worker[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('workers').select('*').order('created_at', { ascending: true });
      if (!this.handleError(error, 'Error fetching workers') && data) {
        this.workers = data as Worker[];
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

    if (!this.activeWorkerId && this.workers.length > 0) {
      this.activeWorkerId = this.workers[0].id;
    }

    return this.workers.map(w => ({
      ...w,
      outstanding_advance: Math.max(0, advancesMap.get(w.id) || 0),
    }));
  }

  public async saveWorker(worker: Partial<Worker>): Promise<Worker> {
    const id = worker.id || crypto.randomUUID();
    const payload: Worker = {
      id,
      worker_code: worker.worker_code || `W-${Math.floor(100 + Math.random() * 900)}`,
      full_name: worker.full_name || 'New Worker',
      phone: worker.phone || null,
      photo_url: worker.photo_url || null,
      section: worker.section || 'Sewing',
      line_no: worker.line_no || 'Line-01',
      joined_at: worker.joined_at || new Date().toISOString().split('T')[0],
      payment_method: worker.payment_method || 'cash',
      payment_details: worker.payment_details || {},
      status: worker.status || 'active',
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('workers').upsert(payload);
      this.handleError(error, 'Error saving worker');
      const refreshed = await this.getWorkers();
      return refreshed.find(w => w.id === id) || payload;
    } else {
      const idx = this.workers.findIndex(w => w.id === id);
      if (idx >= 0) this.workers[idx] = payload;
      else this.workers.push(payload);
      return payload;
    }
  }

  // --- STYLES & PROCESSES ---
  public async getStyles(): Promise<GarmentStyle[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('styles').select('*').order('created_at', { ascending: true });
      if (!this.handleError(error, 'Error fetching styles') && data) {
        this.styles = data as GarmentStyle[];
      }
    }

    const procs = await this.getProcesses();
    const entries = await this.getProductionEntries();
    const deliveriesList = this.deliveries;

    return this.styles.map(st => {
      const styleProcs = procs.filter(p => p.style_id === st.id);
      const totalLabourCost = styleProcs.reduce((sum, p) => sum + Number(p.rate || 0), 0);
      
      const lastProc = [...styleProcs].sort((a, b) => b.seq_no - a.seq_no)[0];
      let completed_pieces = 0;
      if (lastProc) {
        completed_pieces = entries
          .filter(e => e.style_id === st.id && e.process_id === lastProc.id)
          .reduce((sum, e) => sum + Number(e.qty_ok || 0), 0);
      }

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
    const { total_labour_cost, completed_pieces, delivered_pieces, remaining_pieces, ...cleanStyle } = style as any;
    const existing = cleanStyle.id ? this.styles.find(s => s.id === cleanStyle.id) : null;
    const id = cleanStyle.id || crypto.randomUUID();

    const dbPayload = {
      id,
      style_code: cleanStyle.style_code ?? existing?.style_code ?? `ST-${Math.floor(1000 + Math.random() * 9000)}`,
      name: cleanStyle.name ?? existing?.name ?? 'New Style',
      buyer_name: cleanStyle.buyer_name ?? existing?.buyer_name ?? null,
      image_url: cleanStyle.image_url ?? existing?.image_url ?? null,
      order_qty: cleanStyle.order_qty ?? existing?.order_qty ?? 1000,
      target_ship_date: cleanStyle.target_ship_date ?? existing?.target_ship_date ?? null,
      start_date: cleanStyle.start_date ?? existing?.start_date ?? null,
      status: cleanStyle.status ?? existing?.status ?? 'upcoming',
      notes: cleanStyle.notes ?? existing?.notes ?? null,
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('styles').upsert(dbPayload);
      this.handleError(error, 'Error saving style');
      const refreshed = await this.getStyles();
      return refreshed.find(s => s.id === id) || (dbPayload as GarmentStyle);
    } else {
      const idx = this.styles.findIndex(s => s.id === id);
      if (idx >= 0) this.styles[idx] = dbPayload as GarmentStyle;
      else this.styles.unshift(dbPayload as GarmentStyle);
      return dbPayload as GarmentStyle;
    }
  }

  public async getProcesses(styleId?: string): Promise<GarmentProcess[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('processes').select('*').order('seq_no', { ascending: true });
      if (!this.handleError(error, 'Error fetching processes') && data) {
        this.processes = data as GarmentProcess[];
      }
    }

    if (styleId) {
      return this.processes.filter(p => p.style_id === styleId).sort((a, b) => a.seq_no - b.seq_no);
    }
    return [...this.processes].sort((a, b) => a.seq_no - b.seq_no);
  }

  public async saveProcess(proc: Partial<GarmentProcess>): Promise<GarmentProcess> {
    const id = proc.id || crypto.randomUUID();
    const payload: GarmentProcess = {
      id,
      style_id: proc.style_id!,
      seq_no: proc.seq_no || (this.processes.filter(p => p.style_id === proc.style_id).length + 1),
      name: proc.name || 'New Operation',
      machine_type: proc.machine_type || 'Single Needle Lockstitch',
      smv: proc.smv || 1.5,
      rate: proc.rate || 3.5,
      is_active: proc.is_active ?? true,
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('processes').upsert(payload);
      this.handleError(error, 'Error saving process');
      const refreshed = await this.getProcesses(proc.style_id);
      return refreshed.find(p => p.id === id) || payload;
    } else {
      const idx = this.processes.findIndex(p => p.id === id);
      if (idx >= 0) this.processes[idx] = payload;
      else this.processes.push(payload);
      return payload;
    }
  }

  public async canDeleteStyle(styleId: string): Promise<{ canDelete: boolean; reason?: string }> {
    let entriesCount = 0;
    let assignmentsCount = 0;

    if (isSupabaseConfigured) {
      const [entriesRes, assignRes] = await Promise.all([
        supabase.from('production_entries').select('id', { count: 'exact', head: true }).eq('style_id', styleId),
        supabase.from('daily_assignments').select('id', { count: 'exact', head: true }).eq('style_id', styleId)
      ]);
      entriesCount = entriesRes.count || 0;
      assignmentsCount = assignRes.count || 0;
    } else {
      entriesCount = this.productionEntries.filter(e => e.style_id === styleId).length;
      assignmentsCount = this.dailyAssignments.filter(a => a.style_id === styleId).length;
    }

    if (entriesCount > 0 || assignmentsCount > 0) {
      return {
        canDelete: false,
        reason: 'This style has production history and cannot be deleted. Mark it Completed instead.'
      };
    }
    return { canDelete: true };
  }

  public async deleteStyle(styleId: string): Promise<void> {
    const check = await this.canDeleteStyle(styleId);
    if (!check.canDelete) {
      throw new Error(check.reason);
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('styles').delete().eq('id', styleId);
      this.handleError(error, 'Error deleting style');
      await this.getStyles();
    } else {
      this.styles = this.styles.filter(s => s.id !== styleId);
    }
  }

  public async canDeleteProcess(processId: string): Promise<{ canDelete: boolean; reason?: string }> {
    let entriesCount = 0;
    let assignmentsCount = 0;

    if (isSupabaseConfigured) {
      const [entriesRes, assignRes] = await Promise.all([
        supabase.from('production_entries').select('id', { count: 'exact', head: true }).eq('process_id', processId),
        supabase.from('daily_assignments').select('id', { count: 'exact', head: true }).eq('process_id', processId)
      ]);
      entriesCount = entriesRes.count || 0;
      assignmentsCount = assignRes.count || 0;
    } else {
      entriesCount = this.productionEntries.filter(e => e.process_id === processId).length;
      assignmentsCount = this.dailyAssignments.filter(a => a.process_id === processId).length;
    }

    if (entriesCount > 0 || assignmentsCount > 0) {
      return {
        canDelete: false,
        reason: 'This operation has production history and cannot be deleted.'
      };
    }
    return { canDelete: true };
  }

  public async deleteProcess(processId: string): Promise<void> {
    const check = await this.canDeleteProcess(processId);
    if (!check.canDelete) {
      throw new Error(check.reason);
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('processes').delete().eq('id', processId);
      this.handleError(error, 'Error deleting process');
      await this.getProcesses();
    } else {
      this.processes = this.processes.filter(p => p.id !== processId);
    }
  }

  public async getStyle7DayAverageOutput(styleId: string): Promise<number> {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    const startDateStr = sevenDaysAgo.toISOString().split('T')[0];

    const allEntries = await this.getProductionEntries();
    const procs = await this.getProcesses(styleId);
    const lastProc = [...procs].sort((a, b) => b.seq_no - a.seq_no)[0];

    if (!lastProc) return 0;

    const styleEntries = allEntries.filter(
      e => e.style_id === styleId && 
           e.process_id === lastProc.id && 
           e.entry_date && e.entry_date >= startDateStr
    );

    const totalPieces7d = styleEntries.reduce((sum, e) => sum + Number(e.qty_ok || 0), 0);
    return Math.round(totalPieces7d / 7);
  }

  public async getStyleCompletionDetails(styleId: string) {
    const todayStr = new Date().toISOString().split('T')[0];
    let pendingAssignmentsCount = 0;

    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('daily_assignments')
        .select('id')
        .eq('style_id', styleId)
        .gte('work_date', todayStr)
        .in('status', ['planned', 'active']);
      pendingAssignmentsCount = data?.length || 0;
    } else {
      pendingAssignmentsCount = this.dailyAssignments.filter(
        a => a.style_id === styleId && a.work_date >= todayStr && (a.status === 'planned' || a.status === 'active')
      ).length;
    }

    const allEntries = await this.getProductionEntries();
    const styleEntries = allEntries.filter(e => e.style_id === styleId);
    const totalWagesPaid = styleEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const allStyles = await this.getStyles();
    const style = allStyles.find(s => s.id === styleId);
    const styleProcs = await this.getProcesses(styleId);

    const targetLabourCost = styleProcs.reduce((sum, p) => sum + Number(p.rate || 0), 0);
    const totalPiecesProduced = style?.completed_pieces || 0;
    const actualLabourCostPerGarment = totalPiecesProduced > 0 ? (totalWagesPaid / totalPiecesProduced) : 0;
    const variancePerGarment = actualLabourCostPerGarment - targetLabourCost;

    return {
      style,
      pendingAssignmentsCount,
      totalPiecesProduced,
      totalWagesPaid,
      targetLabourCost,
      actualLabourCostPerGarment,
      variancePerGarment,
    };
  }

  public async cloneStyleWithProcesses(
    sourceStyleId: string,
    newStyleCode: string,
    newStyleName: string,
    buyerName?: string,
    orderQty?: number
  ): Promise<GarmentStyle> {
    const newStyle = await this.saveStyle({
      style_code: newStyleCode,
      name: newStyleName,
      buyer_name: buyerName || null,
      order_qty: orderQty || 10000,
      status: 'active',
    });
    await this.cloneProcesses(newStyle.id, sourceStyleId);
    return newStyle;
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
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('production_entries')
        .select('*')
        .order('entry_date', { ascending: false });
      if (!this.handleError(error, 'Error fetching production entries') && data) {
        this.productionEntries = data.map(d => ({
          ...d,
          qty_ok: d.qty_ok ?? 0,
          qty_rework: d.qty_rework ?? 0,
          qty_reject: d.qty_reject ?? 0,
          rate_snapshot: d.rate_snapshot ?? 0,
          amount: d.amount ?? 0,
          shift: d.shift || 'day',
        }));
      }
    }

    const workersMap = new Map(this.workers.map(w => [w.id, w]));
    const stylesMap = new Map(this.styles.map(s => [s.id, s]));
    const procsMap = new Map(this.processes.map(p => [p.id, p]));

    return this.productionEntries.map(e => ({
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
      showErrorToast('Cannot save or edit production entries inside a locked or paid payroll period.');
      throw new Error('Cannot save or edit production entries inside a locked or paid payroll period.');
    }

    const entryId = entry.id || crypto.randomUUID();
    const qtyOk = entry.qty_ok ?? 0;

    // CRITICAL: When inserting/updating in Supabase, do NOT write rate_snapshot or amount.
    // The database trigger computes both automatically from assignment agreed_rate!
    // Exact schema columns: id, entry_date, worker_id, style_id, process_id, assignment_id, qty_ok, qty_rework, qty_reject, shift, entered_by, note, created_at
    if (isSupabaseConfigured) {
      const payload: Record<string, any> = {
        id: entryId,
        assignment_id: entry.assignment_id || null,
        worker_id: entry.worker_id,
        style_id: entry.style_id,
        process_id: entry.process_id,
        entry_date: entryDate,
        qty_ok: qtyOk,
        qty_rework: entry.qty_rework || 0,
        qty_reject: entry.qty_reject || 0,
        shift: entry.shift || 'day',
        note: entry.note || null,
      };

      if (entry.entered_by) {
        payload.entered_by = entry.entered_by;
      }

      const { error } = await supabase.from('production_entries').upsert(payload);
      if (error) {
        console.error('Error saving production entry to Supabase:', error);
        this.handleError(error, 'Error saving production entry');
        throw error;
      }

      const refreshed = await this.getProductionEntries();
      const saved = refreshed.find(e => e.id === entryId);
      if (saved) return saved;
    }

    const newEntry: ProductionEntry = {
      id: entryId,
      assignment_id: entry.assignment_id || null,
      entry_date: entryDate,
      worker_id: entry.worker_id!,
      style_id: entry.style_id!,
      process_id: entry.process_id!,
      qty_ok: qtyOk,
      qty_rework: entry.qty_rework || 0,
      qty_reject: entry.qty_reject || 0,
      rate_snapshot: entry.rate_snapshot || 0,
      amount: entry.amount || 0,
      shift: entry.shift || 'day',
      note: entry.note || null,
    };

    const idx = this.productionEntries.findIndex(e => e.id === entryId);
    if (idx >= 0) this.productionEntries[idx] = newEntry;
    else this.productionEntries.unshift(newEntry);

    return newEntry;
  }

  // --- DELIVERIES / DISPATCH REPORTS ---
  public async getDeliveries(styleId?: string): Promise<DeliveryReport[]> {
    const stylesMap = new Map(this.styles.map(s => [s.id, s]));

    const result = this.deliveries.map(d => {
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

    return newDelivery;
  }

  public async deleteDelivery(id: string): Promise<void> {
    this.deliveries = this.deliveries.filter(d => d.id !== id);
  }

  // --- ATTENDANCE & PUNCH CLOCK ---
  public async getAttendance(dateStr?: string): Promise<AttendanceRecord[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('attendance').select('*').order('date', { ascending: false });
      if (!this.handleError(error, 'Error fetching attendance') && data) {
        this.attendance = data as AttendanceRecord[];
      }
    }

    if (dateStr) {
      return this.attendance.filter(a => a.date === dateStr);
    }
    return this.attendance;
  }

  public async verifyWorkerPin(workerCode: string, pin: string): Promise<Worker | null> {
    const cleanCode = workerCode.trim().toUpperCase();
    const cleanPin = pin.trim();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('verify_worker_pin', {
          p_worker_code: cleanCode,
          p_pin: cleanPin,
        });

        if (error) {
          console.error('RPC verify_worker_pin error:', error);
          this.handleError(error, 'Error verifying worker PIN');
          return null;
        }

        if (data && Array.isArray(data) && data.length > 0) {
          return data[0] as Worker;
        }
        if (data && typeof data === 'object' && !Array.isArray(data) && (data as any).id) {
          return data as Worker;
        }
        return null;
      } catch (err) {
        console.error('Failed to invoke verify_worker_pin:', err);
        return null;
      }
    } else {
      const workers = await this.getWorkers();
      const w = workers.find(w => w.worker_code.toUpperCase() === cleanCode);
      if (!w) return null;
      // Demo PIN verification for mock mode
      if ((w.worker_code === 'W-001' && cleanPin === '1111') || 
          (w.worker_code === 'W-002' && cleanPin === '2222') || 
          cleanPin === '1111') {
        return w;
      }
      return null;
    }
  }

  public async clockInWorker(workerId: string): Promise<AttendanceRecord> {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let record = this.attendance.find(a => a.worker_id === workerId && a.date === todayStr);

    const recordData: Partial<AttendanceRecord> = {
      id: record?.id || crypto.randomUUID(),
      worker_id: workerId,
      date: todayStr,
      status: 'present',
      in_time: nowTimeStr,
      out_time: null,
      is_on_break: false,
      ot_hours: record?.ot_hours || 0,
    };

    return await this.saveAttendance(recordData);
  }

  public async toggleWorkerBreak(workerId: string): Promise<AttendanceRecord> {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let record = this.attendance.find(a => a.worker_id === workerId && a.date === todayStr);
    if (!record) {
      record = await this.clockInWorker(workerId);
    }

    const updates: Partial<AttendanceRecord> = {
      ...record,
      is_on_break: !record.is_on_break,
      ...(record.is_on_break ? { break_end_time: nowTimeStr } : { break_start_time: nowTimeStr }),
    };

    return await this.saveAttendance(updates);
  }

  public async clockOutWorker(workerId: string): Promise<AttendanceRecord> {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let record = this.attendance.find(a => a.worker_id === workerId && a.date === todayStr);
    if (!record) {
      record = await this.clockInWorker(workerId);
    }

    const updates: Partial<AttendanceRecord> = {
      ...record,
      out_time: nowTimeStr,
      is_on_break: false,
    };

    return await this.saveAttendance(updates);
  }

  public async saveAttendance(record: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const date = record.date || new Date().toISOString().split('T')[0];
    if (this.isPeriodLocked(date)) {
      showErrorToast('Cannot edit attendance inside a locked payroll period.');
      throw new Error('Cannot edit attendance inside a locked payroll period.');
    }

    const id = record.id || crypto.randomUUID();
    const payload: AttendanceRecord = {
      id,
      worker_id: record.worker_id!,
      date,
      status: record.status || 'present',
      in_time: record.in_time || null,
      out_time: record.out_time || null,
      is_on_break: record.is_on_break || false,
      break_start_time: record.break_start_time || null,
      break_end_time: record.break_end_time || null,
      ot_hours: record.ot_hours || 0,
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('attendance').upsert(payload);
      this.handleError(error, 'Error saving attendance');
      const refreshed = await this.getAttendance(date);
      return refreshed.find(a => a.id === id) || payload;
    } else {
      const idx = this.attendance.findIndex(a => a.id === id);
      if (idx >= 0) this.attendance[idx] = payload;
      else this.attendance.push(payload);
      return payload;
    }
  }

  // --- ADJUSTMENTS ---
  public async getAdjustments(): Promise<Adjustment[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('adjustments').select('*').order('date', { ascending: false });
      if (!this.handleError(error, 'Error fetching adjustments') && data) {
        this.adjustments = data as Adjustment[];
      }
    }
    return this.adjustments;
  }

  public async saveAdjustment(adj: Partial<Adjustment>): Promise<Adjustment> {
    const id = adj.id || crypto.randomUUID();
    const newAdj: Adjustment = {
      id,
      worker_id: adj.worker_id!,
      period_id: adj.period_id || null,
      date: adj.date || new Date().toISOString().split('T')[0],
      type: adj.type || 'other',
      amount: Number(adj.amount || 0),
      note: adj.note || null,
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('adjustments').upsert(newAdj);
      this.handleError(error, 'Error saving adjustment');
      const refreshed = await this.getAdjustments();
      return refreshed.find(a => a.id === id) || newAdj;
    } else {
      this.adjustments.push(newAdj);
      return newAdj;
    }
  }

  // --- DAILY ASSIGNMENTS ---
  public async getDailyAssignments(workDate?: string): Promise<DailyAssignment[]> {
    const dateToFetch = workDate || new Date().toISOString().split('T')[0];

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('daily_assignments')
        .select('*')
        .eq('work_date', dateToFetch);
      if (!this.handleError(error, 'Error fetching daily assignments') && data) {
        this.dailyAssignments = data as DailyAssignment[];
      }
    }

    const workersMap = new Map((await this.getWorkers()).map(w => [w.id, w]));
    const stylesMap = new Map((await this.getStyles()).map(s => [s.id, s]));
    const processesMap = new Map((await this.getProcesses()).map(p => [p.id, p]));

    return this.dailyAssignments.map(a => {
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

    let defaultRate = assignment.agreed_rate;
    if (defaultRate === undefined) {
      const bids = await this.getRateBids();
      const approvedBid = bids.find(b => b.worker_id === assignment.worker_id && b.process_id === assignment.process_id && b.status === 'approved');
      if (approvedBid) {
        defaultRate = approvedBid.counter_rate || approvedBid.proposed_rate;
      } else {
        const procs = await this.getProcesses(assignment.style_id);
        const proc = procs.find(p => p.id === assignment.process_id);
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

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('daily_assignments').upsert({
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
      this.handleError(error, 'Error saving daily assignment');

      const fullList = await this.getDailyAssignments(workDate);
      return fullList.find(a => a.id === id) || record;
    } else {
      const idx = this.dailyAssignments.findIndex(a => a.id === id);
      if (idx >= 0) this.dailyAssignments[idx] = record;
      else this.dailyAssignments.push(record);
      return record;
    }
  }

  public async deleteDailyAssignment(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('daily_assignments').delete().eq('id', id);
      this.handleError(error, 'Error deleting daily assignment');
      await this.getDailyAssignments();
    } else {
      this.dailyAssignments = this.dailyAssignments.filter(a => a.id !== id);
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

    const entries = await this.getProductionEntries();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const recentEntries = entries.filter(e => e.entry_date >= thirtyDaysAgo);

    const draftAssignments: DailyAssignment[] = [];
    const skippedWorkers: string[] = workers.filter(w => absentWorkerIds.has(w.id)).map(w => `${w.full_name} (${w.worker_code})`);
    const unassignedProcesses: string[] = [];

    const allProcesses = await this.getProcesses();
    const targetProcesses = allProcesses.filter(p => styleIds.includes(p.style_id) && p.is_active);
    const bids = await this.getRateBids();

    for (const proc of targetProcesses) {
      const candidates = recentEntries.filter(e => e.process_id === proc.id && availableWorkerIds.has(e.worker_id));
      
      const scoreMap = new Map<string, { count: number; totalQty: number }>();
      for (const entry of candidates) {
        const cur = scoreMap.get(entry.worker_id) || { count: 0, totalQty: 0 };
        scoreMap.set(entry.worker_id, {
          count: cur.count + 1,
          totalQty: cur.totalQty + (entry.qty_ok || 0),
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

      if (!bestWorkerId && availableWorkers.length > 0) {
        const index = draftAssignments.length % availableWorkers.length;
        bestWorkerId = availableWorkers[index]?.id || null;
      }

      if (bestWorkerId) {
        const approvedBid = bids.find(b => b.worker_id === bestWorkerId && b.process_id === proc.id && b.status === 'approved');
        const rateToUse = approvedBid ? (approvedBid.counter_rate || approvedBid.proposed_rate) : proc.rate;

        draftAssignments.push({
          id: `draft-${proc.id}-${bestWorkerId}`,
          work_date: targetDate,
          style_id: proc.style_id,
          process_id: proc.id,
          worker_id: bestWorkerId,
          target_qty: 250,
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
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('rate_bids').select('*').order('created_at', { ascending: false });
      if (!this.handleError(error, 'Error fetching rate bids') && data) {
        this.rateBids = data as RateBid[];
      }
    }

    const workersMap = new Map((await this.getWorkers()).map(w => [w.id, w]));
    const processesMap = new Map((await this.getProcesses()).map(p => [p.id, p]));
    const stylesMap = new Map((await this.getStyles()).map(s => [s.id, s]));

    return this.rateBids.map(b => {
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
    const procs = await this.getProcesses();
    const proc = procs.find(p => p.id === bidData.process_id);
    const currentRate = bidData.current_rate ?? (proc ? proc.rate : 0);

    const id = crypto.randomUUID();
    const newBid: RateBid = {
      id,
      process_id: bidData.process_id!,
      worker_id: bidData.worker_id!,
      current_rate: currentRate,
      proposed_rate: Number(bidData.proposed_rate || currentRate),
      counter_rate: bidData.counter_rate ? Number(bidData.counter_rate) : null,
      reason: bidData.reason || null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('rate_bids').insert({
        id: newBid.id,
        process_id: newBid.process_id,
        worker_id: newBid.worker_id,
        current_rate: newBid.current_rate,
        proposed_rate: newBid.proposed_rate,
        counter_rate: newBid.counter_rate,
        status: newBid.status,
      });
      this.handleError(error, 'Error creating rate bid');
      const refreshed = await this.getRateBids();
      return refreshed.find(b => b.id === id) || newBid;
    } else {
      this.rateBids.unshift(newBid);
      return newBid;
    }
  }

  public async reviewRateBid(bidId: string, status: 'approved' | 'rejected' | 'countered', reviewNote?: string, counterRate?: number): Promise<void> {
    const bids = await this.getRateBids();
    const bid = bids.find(b => b.id === bidId);
    if (!bid) return;

    const finalCounterRate = counterRate !== undefined ? counterRate : bid.counter_rate;

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('rate_bids').update({
        status,
        counter_rate: finalCounterRate,
      }).eq('id', bidId);
      this.handleError(error, 'Error reviewing rate bid');

      if (status === 'approved') {
        const finalRate = finalCounterRate || bid.proposed_rate;
        const todayStr = new Date().toISOString().split('T')[0];

        const { error: daErr } = await supabase.from('daily_assignments')
          .update({ agreed_rate: finalRate })
          .eq('worker_id', bid.worker_id)
          .eq('process_id', bid.process_id)
          .gte('work_date', todayStr);
        this.handleError(daErr, 'Error updating assignment rates on bid approval');
      }

      await this.getRateBids();
    }
  }

  public async acceptCounterBid(bidId: string): Promise<void> {
    await this.reviewRateBid(bidId, 'approved', 'Counter offer accepted by worker/supervisor');
  }

  // --- PAYROLL RUN & RPC ---
  public async getPayrollPeriod(): Promise<PayrollPeriod> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('payroll_periods').select('*').limit(1).maybeSingle();
      if (!this.handleError(error, 'Error fetching payroll period') && data) {
        this.payrollPeriod = data;
      }
    }
    return this.payrollPeriod;
  }

  public async updatePayrollPeriodStatus(status: 'open' | 'locked' | 'paid'): Promise<PayrollPeriod> {
    this.payrollPeriod.status = status;
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('payroll_periods').update({ status }).eq('id', this.payrollPeriod.id);
      this.handleError(error, 'Error updating payroll period status');
      await this.getPayrollPeriod();
    }
    return this.payrollPeriod;
  }

  public async calculatePayrollRPC(): Promise<PayrollLine[]> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('calculate_payroll', { p_period_id: this.payrollPeriod.id });
        if (!error) {
          const { data, error: fetchErr } = await supabase.from('payroll_lines').select('*').eq('period_id', this.payrollPeriod.id);
          if (!this.handleError(fetchErr, 'Error fetching calculated payroll lines') && data && data.length > 0) {
            this.payrollLines = data;
            return this.getPayrollLines();
          }
        }
      } catch (e) {
        // Fallback to calculation
      }
    }

    await this.recalculatePayrollLinesInMemory();
    return this.getPayrollLines();
  }

  private async recalculatePayrollLinesInMemory(): Promise<void> {
    const period = await this.getPayrollPeriod();
    const settings = await this.getSettings();
    const workers = await this.getWorkers();
    const entries = await this.getProductionEntries();
    const attendance = await this.getAttendance();
    const adjustments = await this.getAdjustments();

    const minWagePerDay = settings.minimum_wage_per_day;
    const enableTopup = settings.enable_minimum_wage_topup;

    const lines: PayrollLine[] = workers.map(worker => {
      const workerEntries = entries.filter(e => 
        e.worker_id === worker.id && 
        e.entry_date >= period.start_date && 
        e.entry_date <= period.end_date
      );
      const piecesTotal = workerEntries.reduce((sum, e) => sum + (e.qty_ok || 0), 0);
      const pieceEarnings = workerEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const workerAtt = attendance.filter(a => 
        a.worker_id === worker.id && 
        a.date >= period.start_date && 
        a.date <= period.end_date
      );
      const presentDays = workerAtt.filter(a => a.status === 'present').length;
      const halfDays = workerAtt.filter(a => a.status === 'half_day').length;
      const otHrs = workerAtt.reduce((sum, a) => sum + (a.ot_hours || 0), 0);
      const otAmount = otHrs * 50;

      const workerAdj = adjustments.filter(a => 
        a.worker_id === worker.id && 
        a.date >= period.start_date && 
        a.date <= period.end_date
      );
      const bonusAmount = workerAdj.filter(a => a.type === 'bonus').reduce((sum, a) => sum + Number(a.amount), 0);
      const allowanceAmount = workerAdj.filter(a => a.type === 'allowance').reduce((sum, a) => sum + Number(a.amount), 0);
      const fines = workerAdj.filter(a => a.type === 'fine').reduce((sum, a) => sum + Number(a.amount), 0);
      const advRepay = workerAdj.filter(a => a.type === 'advance_repay').reduce((sum, a) => sum + Number(a.amount), 0);
      const deductions = fines + advRepay;

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
    if (this.payrollLines.length === 0) {
      await this.recalculatePayrollLinesInMemory();
    }
    const workersMap = new Map((await this.getWorkers()).map(w => [w.id, w]));
    return this.payrollLines.map(l => ({
      ...l,
      worker: workersMap.get(l.worker_id),
    }));
  }
}

export const dataService = new DataService();
