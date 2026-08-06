import { 
  Worker, GarmentStyle, GarmentProcess, ProductionEntry, 
  AttendanceRecord, Adjustment, PayrollPeriod, PayrollLine, 
  FactorySettings, UserRole, DailyAssignment, RateBid,
  UserAccount, DeliveryReport, FinishingStage, FinishingEntry,
  CuttingEntry, GarmentSample, StyleFinancialRecord, MgmtValueTodayRecord,
  MgmtOrderOverviewRecord, MgmtUserRecord, TodaySectionRow, StyleSize, StyleSizeBreakdownRow,
  AvailableToReceiveRow, StyleDailyOutput, WorkerNotification, StylePipelineRow, EntryAudit,
  ProductionTeam, ProductionTeamMember
} from '../types';

function formatLockedPeriodError(err: any): Error {
  const msg = typeof err === 'string' ? err : err?.message || String(err || '');
  if (msg.toLowerCase().includes('lock') || msg.toLowerCase().includes('payroll') || msg.toLowerCase().includes('closed')) {
    return new Error('This entry is in a locked payroll period and cannot be changed. Unlock the period first.');
  }
  return err instanceof Error ? err : new Error(msg);
}
import { 
  INITIAL_STYLES, INITIAL_WORKERS, INITIAL_CUTTING_ENTRIES, INITIAL_SAMPLES 
} from './store';
import { supabase, isSupabaseConfigured } from './supabase';
import { showErrorToast } from './toast';

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function cleanUuid(id?: string | null): string {
  if (!id) return '';
  let str = id.trim();
  // Strip leading 'w-', 'w', 's-', 's', 'p-', 'p' prefixes if followed by hexadecimal UUID
  str = str.replace(/^[wspWSP]-?/i, '');
  const uuidMatch = str.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuidMatch) {
    return uuidMatch[1];
  }
  return str;
}

/**
 * Sanitizes an insert/upsert payload object by removing keys whose values are null, undefined,
 * or empty strings (or string containing only whitespace).
 * This ensures columns with database defaults (like size, entered_by, count) are omitted
 * rather than sent as explicit NULLs, avoiding NOT NULL constraint violations.
 */
export function sanitizePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === null || val === undefined) {
      continue;
    }
    if (typeof val === 'string' && val.trim() === '') {
      continue;
    }
    clean[key] = val;
  }
  return clean;
}

class DataService {
  private settings: FactorySettings = {
    id: 'default-settings-01',
    factory_name: 'StitchPay Garments Ltd.',
    logo_url: null,
    currency_code: 'MYR',
    currency_symbol: 'MYR',
    pay_cycle: 'weekly',
    week_start_day: 'Saturday',
    rework_pay_percent: 50,
    reject_pay_percent: 0,
    minimum_wage_per_day: 500,
    enable_minimum_wage_topup: true,
  };

  private workers: Worker[] = [];
  private styles: GarmentStyle[] = INITIAL_STYLES;
  private processes: GarmentProcess[] = [];
  private productionEntries: ProductionEntry[] = [];
  private attendance: AttendanceRecord[] = [];
  private adjustments: Adjustment[] = [];
  private dailyAssignments: DailyAssignment[] = [];
  private rateBids: RateBid[] = [];
  private userAccounts: UserAccount[] = [];
  private deliveries: DeliveryReport[] = [];
  private finishingStages: FinishingStage[] = [];
  private finishingEntries: FinishingEntry[] = [];
  private cuttingEntries: CuttingEntry[] = [];
  private samples: GarmentSample[] = [];
  private styleSizes: StyleSize[] = [];
  private styleDailyOutputs: StyleDailyOutput[] = [];
  private teams: ProductionTeam[] = [];
  private teamMembers: ProductionTeamMember[] = [];
  private notifications: WorkerNotification[] = [
    {
      id: 'notif-1',
      title: 'New Style Pre-cut: LIZ-KAP01',
      body: 'Pre-cut fabric batch of 1,200 pcs is available in the sewing line.',
      type: 'section',
      section: 'Sewing',
      style_id: 'style-1',
      style_code: 'LIZ-KAP01',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      is_read: false,
    },
    {
      id: 'notif-2',
      title: 'Daily Line Target Updated',
      body: 'Today target for Line-01 is updated to 250 pcs per process.',
      type: 'everyone',
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      is_read: true,
    },
  ];
  private finishingListeners: Set<() => void> = new Set();
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

  public async fetchUserRole(userId: string): Promise<UserRole> {
    if (!isSupabaseConfigured) return 'admin';

    // 1. Check user_roles table directly
    try {
      const { data: roleRow, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && roleRow && roleRow.role) {
        return roleRow.role as UserRole;
      }
    } catch (err) {
      console.warn('Error fetching role from user_roles table:', err);
    }

    // 2. Check using RPC has_role(role) or has_role(_user_id, role)
    const candidateRoles: UserRole[] = ['admin', 'supervisor', 'accounts'];
    for (const r of candidateRoles) {
      try {
        const { data: hasRole1 } = await supabase.rpc('has_role', { role: r, _user_id: userId });
        if (hasRole1 === true) return r;

        const { data: hasRole2 } = await supabase.rpc('has_role', { role: r });
        if (hasRole2 === true) return r;
      } catch (e) {
        // Continue checking other candidates
      }
    }

    return 'admin';
  }

  public async initSupabaseAuthSession(): Promise<UserAccount | null> {
    if (!isSupabaseConfigured) {
      return this.getCurrentAuthUser();
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        this.currentAuthUser = null;
        try {
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.removeItem('stitchpay_auth_user');
          }
        } catch (e) {}
        return null;
      }

      const user = session.user;
      const role = await this.fetchUserRole(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const fullName = profile?.full_name || user.user_metadata?.full_name || user.email || 'User';

      const account: UserAccount = {
        id: user.id,
        email_or_phone: user.email || '',
        full_name: fullName,
        role: role,
        worker_id: null,
        status: 'active',
        created_at: user.created_at || new Date().toISOString(),
      };

      this.currentAuthUser = account;
      this.currentRole = account.role;

      try {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem('stitchpay_auth_user', JSON.stringify(account));
        }
      } catch (e) {}

      return account;
    } catch (err) {
      console.error('Error verifying Supabase auth session:', err);
      this.currentAuthUser = null;
      return null;
    }
  }

  public async loginUser(emailOrPhone: string, password?: string): Promise<UserAccount> {
    const cleanEmail = emailOrPhone.trim().toLowerCase();

    if (isSupabaseConfigured) {
      if (!password) {
        throw new Error('Password is required to sign in');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password.trim(),
      });

      if (error) {
        throw new Error(error.message || 'Authentication failed. Invalid credentials.');
      }

      if (!data.user) {
        throw new Error('Sign in failed: No user returned');
      }

      const userId = data.user.id;
      const role = await this.fetchUserRole(userId);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();

      const fullName = profile?.full_name || data.user.user_metadata?.full_name || data.user.email || 'User';

      const account: UserAccount = {
        id: userId,
        email_or_phone: data.user.email || cleanEmail,
        full_name: fullName,
        role: role,
        worker_id: null,
        status: 'active',
        created_at: data.user.created_at || new Date().toISOString(),
      };

      this.currentAuthUser = account;
      this.currentRole = account.role;

      try {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem('stitchpay_auth_user', JSON.stringify(account));
        }
      } catch (e) {}

      return account;
    } else {
      throw new Error('Supabase project credentials not configured.');
    }
  }

  public async logoutUser(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error('Error during Supabase signOut:', e);
      }
    }
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
      pay_type: worker.pay_type || 'piece_rate',
      monthly_salary: Number(worker.monthly_salary || 0),
      payment_method: worker.payment_method || 'cash',
      payment_details: worker.payment_details || {},
      status: worker.status || 'active',
    };

    if (isSupabaseConfigured) {
      const cleanPayload = sanitizePayload(payload);
      const { error } = await supabase.from('workers').upsert(cleanPayload);
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

  public async getEntryStyles(section: 'cutting' | 'sewing' | 'finishing' | null = null): Promise<GarmentStyle[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('fn_entry_styles', { p_section: section });
        if (!error && data && Array.isArray(data)) {
          return data as GarmentStyle[];
        }
        if (error) {
          console.warn('RPC fn_entry_styles returned error, using fallback:', error);
        }
      } catch (err) {
        console.warn('RPC fn_entry_styles exception:', err);
      }
    }

    const allStyles = await this.getStyles();
    return allStyles.filter(s => {
      if (s.status === 'completed' || s.status === 'delivered' || s.status === 'archived') return false;
      if (section === 'cutting' && s.requires_cutting === false) return false;
      return true;
    });
  }

  public async getWorkerPortalEntryStyles(pToken?: string, section: 'cutting' | 'sewing' | 'finishing' | null = null): Promise<GarmentStyle[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('wp_entry_styles', { p_token: pToken || '', p_section: section });
        if (!error && data && Array.isArray(data)) {
          return data as GarmentStyle[];
        }
        if (error) {
          console.warn('RPC wp_entry_styles returned error, using fallback:', error);
        }
      } catch (err) {
        console.warn('RPC wp_entry_styles exception:', err);
      }
    }

    const allStyles = await this.getStyles();
    return allStyles.filter(s => {
      if (s.status === 'completed' || s.status === 'delivered' || s.status === 'archived') return false;
      if (section === 'cutting' && s.requires_cutting === false) return false;
      return true;
    });
  }

  // --- PRODUCTION TEAMS & TEAM OUTPUT ---
  public async getTeams(styleId?: string | null): Promise<ProductionTeam[]> {
    let rawTeams: any[] = [];
    let rawMembers: any[] = [];

    if (isSupabaseConfigured) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('fn_style_teams', { p_style_id: styleId || null });
        if (!rpcErr && rpcData && Array.isArray(rpcData)) {
          return rpcData as ProductionTeam[];
        }
      } catch (e) {
        console.warn('fn_style_teams RPC not available, querying tables directly:', e);
      }

      try {
        let q = supabase.from('production_teams').select('*');
        if (styleId) {
          q = q.or(`style_id.eq.${styleId},style_id.is.null`);
        }
        const { data: tData } = await q;
        if (tData) rawTeams = tData;

        const teamIds = rawTeams.map(t => t.id);
        if (teamIds.length > 0) {
          const { data: mData } = await supabase.from('production_team_members').select('*').in('team_id', teamIds);
          if (mData) rawMembers = mData;
        }
      } catch (err) {
        console.warn('Error fetching production teams from Supabase:', err);
      }
    } else {
      rawTeams = styleId 
        ? this.teams.filter(t => !t.style_id || t.style_id === styleId)
        : [...this.teams];
      rawMembers = [...this.teamMembers];
    }

    const workersList = await this.getWorkers();
    const stylesList = await this.getStyles();

    return rawTeams.map(t => {
      const style = stylesList.find(s => s.id === t.style_id);
      const members = rawMembers
        .filter(m => m.team_id === t.id)
        .map(m => {
          const w = workersList.find(w => w.id === m.worker_id);
          return {
            ...m,
            worker_name: w ? w.full_name : 'Unknown Worker',
            worker_code: w ? w.worker_code : '',
            worker_photo: w ? w.photo_url || undefined : undefined,
          };
        });

      return {
        ...t,
        style_code: style?.style_code,
        style_name: style?.name,
        member_count: members.length,
        members,
      };
    });
  }

  public async saveTeam(
    teamData: { id?: string; name: string; style_id?: string | null },
    membersList: { worker_id: string; share_percent?: number | null }[]
  ): Promise<ProductionTeam> {
    const id = teamData.id || crypto.randomUUID();
    const teamPayload = {
      id,
      name: teamData.name,
      style_id: teamData.style_id || null,
    };

    if (isSupabaseConfigured) {
      const cleanTeam = sanitizePayload(teamPayload);
      const { error: teamErr } = await supabase.from('production_teams').upsert(cleanTeam);
      this.handleError(teamErr, 'Error saving production team');

      // Delete existing members then insert new ones
      await supabase.from('production_team_members').delete().eq('team_id', id);

      if (membersList.length > 0) {
        const membersPayload = membersList.map(m => ({
          id: crypto.randomUUID(),
          team_id: id,
          worker_id: m.worker_id,
          share_percent: m.share_percent != null && !isNaN(m.share_percent) ? Number(m.share_percent) : null,
        }));
        await supabase.from('production_team_members').insert(membersPayload);
      }
    } else {
      const existingIdx = this.teams.findIndex(t => t.id === id);
      if (existingIdx >= 0) {
        this.teams[existingIdx] = { ...this.teams[existingIdx], ...teamPayload };
      } else {
        this.teams.push(teamPayload);
      }

      this.teamMembers = this.teamMembers.filter(m => m.team_id !== id);
      membersList.forEach(m => {
        this.teamMembers.push({
          id: crypto.randomUUID(),
          team_id: id,
          worker_id: m.worker_id,
          share_percent: m.share_percent != null && !isNaN(m.share_percent) ? Number(m.share_percent) : null,
        });
      });
    }

    const refreshed = await this.getTeams();
    return refreshed.find(t => t.id === id) || { ...teamPayload, members: [] };
  }

  public async deleteTeam(teamId: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      await supabase.from('production_team_members').delete().eq('team_id', teamId);
      const { error } = await supabase.from('production_teams').delete().eq('id', teamId);
      this.handleError(error, 'Error deleting production team');
    } else {
      this.teams = this.teams.filter(t => t.id !== teamId);
      this.teamMembers = this.teamMembers.filter(m => m.team_id !== teamId);
    }
    return true;
  }

  public async previewTeamSplit(params: {
    team_id: string;
    style_id: string;
    process_id: string;
    qty_ok: number;
    split: 'equal' | 'share';
  }): Promise<{
    splits: { worker_id: string; worker_name: string; qty_ok: number; amount: number }[];
    summaryMessage: string;
  }> {
    const teams = await this.getTeams(params.style_id);
    const team = teams.find(t => t.id === params.team_id);
    if (!team || !team.members || team.members.length === 0) {
      throw new Error('Selected team has no members assigned.');
    }

    const members = team.members;
    const numMembers = members.length;
    const totalQty = Math.max(0, Math.round(params.qty_ok));

    let processRate = 0;
    const styleProcs = await this.getProcesses(params.style_id);
    if (params.process_id === 'ALL' || params.process_id === 'all_operations') {
      processRate = styleProcs.reduce((sum, p) => sum + Number(p.rate || 0), 0);
    } else {
      const proc = styleProcs.find(p => p.id === params.process_id);
      processRate = Number(proc?.rate || 0);
    }

    const memberQtys: { worker_id: string; worker_name: string; qty: number }[] = [];

    const hasShares = members.some(m => m.share_percent != null && m.share_percent > 0);
    if (params.split === 'share' && hasShares) {
      let allocated = 0;
      members.forEach((m) => {
        const pct = Number(m.share_percent || 0);
        const qty = Math.floor((totalQty * pct) / 100);
        allocated += qty;
        memberQtys.push({
          worker_id: m.worker_id,
          worker_name: m.worker_name || 'Worker',
          qty,
        });
      });
      let remainder = totalQty - allocated;
      for (let i = 0; i < memberQtys.length && remainder > 0; i++) {
        memberQtys[i].qty += 1;
        remainder -= 1;
      }
    } else {
      // Equal split: distribute integer base + remainder piece by piece
      const baseQty = Math.floor(totalQty / numMembers);
      let remainder = totalQty - (baseQty * numMembers);

      members.forEach((m, idx) => {
        const extra = idx < remainder ? 1 : 0;
        memberQtys.push({
          worker_id: m.worker_id,
          worker_name: m.worker_name || 'Worker',
          qty: baseQty + extra,
        });
      });
    }

    const splits = memberQtys.map(m => ({
      worker_id: m.worker_id,
      worker_name: m.worker_name,
      qty_ok: m.qty,
      amount: m.qty * processRate,
    }));

    const splitParts = splits.map(s => `${s.worker_name} ${s.qty_ok}`);
    const summaryMessage = `${totalQty} pcs split: ${splitParts.join(', ')}`;

    return { splits, summaryMessage };
  }

  public async logTeamOutput(params: {
    team_id: string;
    style_id: string;
    process_id: string;
    qty_ok: number;
    work_date: string;
    split: 'equal' | 'share';
    shift?: 'day' | 'night';
    entered_by?: string;
    note?: string;
  }): Promise<{
    success: boolean;
    summaryMessage: string;
    splits: { worker_id: string; worker_name: string; qty_ok: number; amount: number }[];
  }> {
    const preview = await this.previewTeamSplit({
      team_id: params.team_id,
      style_id: params.style_id,
      process_id: params.process_id,
      qty_ok: params.qty_ok,
      split: params.split,
    });

    const teams = await this.getTeams(params.style_id);
    const team = teams.find(t => t.id === params.team_id);
    const teamName = team ? team.name : 'Team';

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('log_team_output', {
          p_team_id: params.team_id,
          p_style_id: params.style_id,
          p_process_id: params.process_id,
          p_qty_ok: params.qty_ok,
          p_work_date: params.work_date,
          p_split: params.split,
          p_shift: params.shift || 'day',
        });

        if (!error) {
          return { success: true, summaryMessage: preview.summaryMessage, splits: preview.splits };
        } else {
          console.warn('RPC log_team_output returned error, inserting production entries directly:', error);
        }
      } catch (err) {
        console.warn('RPC log_team_output exception, fallback:', err);
      }
    }

    // Fallback or Supabase direct insertion: insert production entry for each member
    const styleProcs = await this.getProcesses(params.style_id);
    const isAllOps = params.process_id === 'ALL' || params.process_id === 'all_operations';

    for (const splitItem of preview.splits) {
      if (splitItem.qty_ok <= 0) continue;

      if (isAllOps && styleProcs.length > 0) {
        // Option: write entry per process or write single entry
        for (const proc of styleProcs) {
          await this.saveProductionEntry({
            entry_date: params.work_date,
            worker_id: splitItem.worker_id,
            style_id: params.style_id,
            process_id: proc.id,
            qty_ok: splitItem.qty_ok,
            qty_rework: 0,
            qty_reject: 0,
            rate_snapshot: proc.rate,
            shift: params.shift || 'day',
            entered_by: params.entered_by || null,
            note: `Team output (${teamName})`,
          });
        }
      } else {
        const proc = styleProcs.find(p => p.id === params.process_id);
        await this.saveProductionEntry({
          entry_date: params.work_date,
          worker_id: splitItem.worker_id,
          style_id: params.style_id,
          process_id: proc ? proc.id : params.process_id,
          qty_ok: splitItem.qty_ok,
          qty_rework: 0,
          qty_reject: 0,
          rate_snapshot: proc ? proc.rate : 0,
          shift: params.shift || 'day',
          entered_by: params.entered_by || null,
          note: `Team output (${teamName})`,
        });
      }
    }

    return {
      success: true,
      summaryMessage: preview.summaryMessage,
      splits: preview.splits,
    };
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
      selling_price: cleanStyle.selling_price !== undefined ? cleanStyle.selling_price : (existing?.selling_price ?? null),
      target_ship_date: cleanStyle.target_ship_date ?? existing?.target_ship_date ?? null,
      start_date: cleanStyle.start_date ?? existing?.start_date ?? null,
      status: cleanStyle.status ?? existing?.status ?? 'upcoming',
      requires_cutting: cleanStyle.requires_cutting ?? existing?.requires_cutting ?? true,
      wage_model: cleanStyle.wage_model ?? existing?.wage_model ?? 'individual',
      notes: cleanStyle.notes ?? existing?.notes ?? null,
    };

    if (isSupabaseConfigured) {
      const cleanPayload = sanitizePayload(dbPayload);
      const { error } = await supabase.from('styles').upsert(cleanPayload);
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

  // --- STYLE SIZES & BREAKDOWN ---
  public async getStyleSizes(styleId: string): Promise<StyleSize[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('style_sizes')
          .select('*')
          .eq('style_id', styleId)
          .order('seq_no', { ascending: true });
        if (!error && data) {
          return data as StyleSize[];
        }
      } catch (err) {
        console.warn('Error fetching style_sizes:', err);
      }
    }
    return (this.styleSizes || []).filter(s => s.style_id === styleId).sort((a, b) => a.seq_no - b.seq_no);
  }

  public async saveStyleSizes(styleId: string, sizes: { size: string; order_qty: number; seq_no?: number }[]): Promise<StyleSize[]> {
    const prepared: StyleSize[] = sizes
      .filter(s => s.size && s.size.trim().length > 0)
      .map((s, index) => ({
        id: crypto.randomUUID(),
        style_id: styleId,
        size: s.size.trim(),
        order_qty: Number(s.order_qty) || 0,
        seq_no: s.seq_no ?? (index + 1),
      }));

    if (isSupabaseConfigured) {
      try {
        await supabase.from('style_sizes').delete().eq('style_id', styleId);
        if (prepared.length > 0) {
          const insertPayload = prepared.map(p => sanitizePayload({
            style_id: p.style_id,
            size: p.size,
            seq_no: p.seq_no,
            order_qty: p.order_qty,
          }));
          await supabase.from('style_sizes').insert(insertPayload);
        }
      } catch (err) {
        console.warn('Error saving style_sizes to Supabase:', err);
      }
    }

    this.styleSizes = (this.styleSizes || []).filter(s => s.style_id !== styleId).concat(prepared);
    return prepared;
  }

  public async getStyleDailyOutputs(date?: string): Promise<StyleDailyOutput[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('style_daily_output').select('*');
        if (date) {
          query = query.eq('output_date', date);
        }
        const { data, error } = await query;
        if (!error && data) {
          const fetched: StyleDailyOutput[] = data.map((d: any) => ({
            id: d.id,
            output_date: d.output_date,
            style_id: d.style_id,
            qty: Number(d.qty || 0),
            auto_receive: d.auto_receive !== false,
            note: d.note || null,
            created_at: d.created_at,
          }));
          if (date) {
            this.styleDailyOutputs = this.styleDailyOutputs
              .filter(o => o.output_date !== date)
              .concat(fetched);
          } else {
            this.styleDailyOutputs = fetched;
          }
          return fetched;
        }
      } catch (e) {
        console.warn('Error fetching style_daily_output from Supabase:', e);
      }
    }
    if (date) {
      return this.styleDailyOutputs.filter(o => o.output_date === date);
    }
    return this.styleDailyOutputs;
  }

  public async saveStyleDailyOutput(payload: {
    output_date: string;
    style_id: string;
    qty: number;
    auto_receive?: boolean;
    note?: string | null;
  }): Promise<StyleDailyOutput> {
    const autoReceive = payload.auto_receive !== false;
    const cleanPayload = sanitizePayload({
      output_date: payload.output_date,
      style_id: payload.style_id,
      qty: Number(payload.qty || 0),
      auto_receive: autoReceive,
      note: payload.note || undefined,
    });

    const outputRecord: StyleDailyOutput = {
      output_date: payload.output_date,
      style_id: payload.style_id,
      qty: Number(payload.qty || 0),
      auto_receive: autoReceive,
      note: payload.note || null,
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('style_daily_output')
          .upsert(cleanPayload, { onConflict: 'output_date,style_id' })
          .select();

        if (error) {
          console.error('Error saving style_daily_output to Supabase:', error);
          showErrorToast(`Database Error (style_daily_output): ${error.message}`);
        } else if (data && data.length > 0) {
          outputRecord.id = data[0].id;
        }
      } catch (err) {
        console.warn('Failed to save style_daily_output to Supabase:', err);
      }
    }

    this.styleDailyOutputs = this.styleDailyOutputs
      .filter(o => !(o.output_date === payload.output_date && o.style_id === payload.style_id))
      .concat([outputRecord]);

    return outputRecord;
  }

  public async getWpNotifications(pToken?: string): Promise<WorkerNotification[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('wp_notifications', { p_token: pToken || '' });
        if (!error && data && Array.isArray(data)) {
          const fetched: WorkerNotification[] = data.map((d: any) => ({
            id: String(d.id),
            title: String(d.title || 'Notification'),
            body: String(d.body || ''),
            type: d.type || null,
            style_id: d.style_id || null,
            style_code: d.style_code || null,
            worker_id: d.worker_id || null,
            section: d.section || null,
            created_at: d.created_at || new Date().toISOString(),
            is_read: Boolean(d.is_read),
          }));
          this.notifications = fetched;
          return fetched;
        } else {
          // Fallback table query
          const { data: tblData, error: tblErr } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });
          if (!tblErr && tblData) {
            const fetched: WorkerNotification[] = tblData.map((d: any) => ({
              id: String(d.id),
              title: String(d.title || 'Notification'),
              body: String(d.body || ''),
              type: d.type || null,
              style_id: d.style_id || null,
              style_code: d.style_code || null,
              worker_id: d.worker_id || null,
              section: d.section || null,
              created_at: d.created_at || new Date().toISOString(),
              is_read: Boolean(d.is_read),
            }));
            this.notifications = fetched;
            return fetched;
          }
        }
      } catch (e) {
        console.warn('Error fetching notifications from Supabase:', e);
      }
    }
    return this.notifications;
  }

  public async markWpNotificationRead(id: string, pToken?: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        try { await supabase.rpc('wp_mark_read', { p_token: pToken || '', p_notification_id: id }); } catch {}
        try { await supabase.from('notifications').update({ is_read: true }).eq('id', id); } catch {}
      } catch (e) {
        console.warn('Error marking notification read in Supabase:', e);
      }
    }
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
    return true;
  }

  public async markAllWpNotificationsRead(pToken?: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        const unread = this.notifications.filter(n => !n.is_read);
        for (const n of unread) {
          try { await supabase.rpc('wp_mark_read', { p_token: pToken || '', p_notification_id: n.id }); } catch {}
        }
        try { await supabase.from('notifications').update({ is_read: true }).neq('id', '00000000-0000-0000-0000-000000000000'); } catch {}
      } catch (e) {
        console.warn('Error marking all notifications read in Supabase:', e);
      }
    }
    this.notifications = this.notifications.map(n => ({ ...n, is_read: true }));
    return true;
  }

  public async sendNotification(payload: {
    title: string;
    body: string;
    target: 'everyone' | 'section' | 'worker';
    section?: string | null;
    worker_id?: string | null;
    style_id?: string | null;
    style_code?: string | null;
  }): Promise<WorkerNotification> {
    const newNotif: WorkerNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: payload.title,
      body: payload.body,
      type: payload.target,
      section: payload.section || null,
      worker_id: payload.worker_id || null,
      style_id: payload.style_id || null,
      style_code: payload.style_code || null,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    if (isSupabaseConfigured) {
      try {
        const cleanPayload = sanitizePayload({
          title: payload.title,
          body: payload.body,
          type: payload.target,
          section: payload.section || undefined,
          worker_id: payload.worker_id || undefined,
          style_id: payload.style_id || undefined,
          style_code: payload.style_code || undefined,
          is_read: false,
        });

        const { data, error } = await supabase
          .from('notifications')
          .insert([cleanPayload])
          .select();

        if (error) {
          console.error('Error inserting notification to Supabase:', error);
          showErrorToast(`Database Error (notifications): ${error.message}`);
        } else if (data && data.length > 0) {
          newNotif.id = String(data[0].id);
        }
      } catch (err) {
        console.warn('Failed to insert notification to Supabase:', err);
      }
    }

    this.notifications = [newNotif, ...this.notifications];
    return newNotif;
  }


  public async getStyleSizeBreakdown(styleId: string): Promise<StyleSizeBreakdownRow[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpt_size_breakdown', { p_style_id: styleId });
        if (!error && data) {
          const arr = Array.isArray(data) ? data : [data];
          return arr.map((item: any, idx: number) => {
            const orderQty = Number(item.order_qty || item.ordered || 0);
            const cutQty = Number(item.cut_qty || item.cut || 0);
            const readyQty = Number(item.ready_qty || item.ready || 0);
            return {
              size: item.size || 'N/A',
              seq_no: item.seq_no !== undefined ? Number(item.seq_no) : (idx + 1),
              order_qty: orderQty,
              cut_qty: cutQty,
              ready_qty: readyQty,
              cut_balance: item.cut_balance !== undefined ? Number(item.cut_balance) : (orderQty - cutQty),
              ready_balance: item.ready_balance !== undefined ? Number(item.ready_balance) : (orderQty - readyQty),
            };
          });
        }
      } catch (err) {
        console.warn('RPC rpt_size_breakdown failed or unavailable, using fallback:', err);
      }
    }

    const sizes = await this.getStyleSizes(styleId);
    if (sizes.length === 0) return [];

    const cuttingEntries = await this.getCuttingEntries(styleId);
    const finishingEntries = await this.getFinishingEntries({ styleId });

    const stages = await this.getFinishingStages(styleId);
    const readyStages = stages.filter(s => s.code === 'ready');
    const readyStageIds = new Set(readyStages.map(s => s.id));

    const cutMap = new Map<string, number>();
    cuttingEntries.forEach(c => {
      if (c.size) {
        const szKey = c.size.trim().toLowerCase();
        cutMap.set(szKey, (cutMap.get(szKey) || 0) + Number(c.pieces_cut || 0));
      }
    });

    const readyMap = new Map<string, number>();
    finishingEntries.forEach(f => {
      if (f.size && f.stage_id && readyStageIds.has(f.stage_id)) {
        const szKey = f.size.trim().toLowerCase();
        readyMap.set(szKey, (readyMap.get(szKey) || 0) + Number(f.qty_ok || 0));
      }
    });

    return sizes.map(s => {
      const szKey = s.size.trim().toLowerCase();
      const cutQty = cutMap.get(szKey) || 0;
      const readyQty = readyMap.get(szKey) || 0;
      const orderQty = s.order_qty || 0;
      return {
        size: s.size,
        seq_no: s.seq_no,
        order_qty: orderQty,
        cut_qty: cutQty,
        ready_qty: readyQty,
        cut_balance: orderQty - cutQty,
        ready_balance: orderQty - readyQty,
      };
    });
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
      const cleanPayload = sanitizePayload(payload);
      const { error } = await supabase.from('processes').upsert(cleanPayload);
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

    const isValidUUID = (id?: string) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const entryId = entry.id && isValidUUID(entry.id) ? entry.id : crypto.randomUUID();
    const qtyOk = Number(entry.qty_ok ?? 0);

    // CRITICAL: Verify assignment_id is a real assignment ID and not worker_id or a non-existent ID
    let validAssignmentId: string | null = null;
    if (entry.assignment_id && entry.assignment_id !== entry.worker_id && isValidUUID(entry.assignment_id)) {
      const assignments = await this.getDailyAssignments();
      if (assignments.some(a => a.id === entry.assignment_id)) {
        validAssignmentId = entry.assignment_id;
      }
    }

    // CRITICAL: When inserting/updating in Supabase, do NOT write rate_snapshot or amount.
    // The database trigger computes both automatically from assignment agreed_rate!
    // Exact schema columns: id, entry_date, worker_id, style_id, process_id, assignment_id, qty_ok, qty_rework, qty_reject, shift, entered_by, note, created_at
    if (isSupabaseConfigured) {
      const rawPayload: Record<string, any> = {
        id: entryId,
        worker_id: entry.worker_id,
        style_id: entry.style_id,
        process_id: entry.process_id,
        entry_date: entryDate,
        qty_ok: qtyOk,
        qty_rework: Number(entry.qty_rework || 0),
        qty_reject: Number(entry.qty_reject || 0),
        shift: entry.shift || 'day',
      };

      if (validAssignmentId) rawPayload.assignment_id = validAssignmentId;
      if (isValidUUID(entry.entered_by)) rawPayload.entered_by = entry.entered_by;
      if (entry.note) rawPayload.note = entry.note;

      const payload = sanitizePayload(rawPayload);

      console.log('[SUPABASE PRODUCTION INSERT PAYLOAD]:', JSON.stringify(payload, null, 2));

      const { error } = await supabase.from('production_entries').upsert(payload).select();
      if (error) {
        console.error('Error saving production entry to Supabase:', error);
        showErrorToast(`Database Error (production_entries): ${error.message}`);
        throw new Error(error.message);
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
      qty_rework: Number(entry.qty_rework || 0),
      qty_reject: Number(entry.qty_reject || 0),
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

  // --- CUTTING ENTRIES ---
  public async getCuttingEntries(styleId?: string): Promise<CuttingEntry[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('cutting_entries').select('*').order('entry_date', { ascending: false });
        if (!error && Array.isArray(data)) {
          const stylesMap = new Map(this.styles.map(s => [s.id, s]));
          const workersMap = new Map(this.workers.map(w => [w.id, w]));

          const mapped: CuttingEntry[] = data.map((d: any) => ({
            id: d.id,
            entry_date: d.entry_date,
            style_id: d.style_id,
            cut_type: d.cut_type || 'bulk',
            pieces_cut: Number(d.qty_cut ?? d.pieces_cut ?? 0),
            size: d.size || null,
            tables_layers: d.lay_id || d.tables_layers || null,
            worker_id: d.worker_id || null,
            notes: d.note || d.notes || null,
            created_at: d.created_at,
            style_code: stylesMap.get(d.style_id)?.style_code || '',
            style_name: stylesMap.get(d.style_id)?.name || '',
            worker_name: d.worker_id ? workersMap.get(d.worker_id)?.full_name || '' : '',
          }));

          this.cuttingEntries = mapped;
          if (styleId) {
            return mapped.filter(c => c.style_id === styleId);
          }
          return mapped;
        }
      } catch (e) {
        console.warn('Supabase cutting_entries query failed, using local store:', e);
      }
    }

    const stylesMap = new Map(this.styles.map(s => [s.id, s]));
    const workersMap = new Map(this.workers.map(w => [w.id, w]));

    const result = this.cuttingEntries.map(c => {
      const s = stylesMap.get(c.style_id);
      const w = c.worker_id ? workersMap.get(c.worker_id) : undefined;
      return {
        ...c,
        style_code: s?.style_code || '',
        style_name: s?.name || '',
        worker_name: w?.full_name || '',
      };
    });

    if (styleId) {
      return result.filter(c => c.style_id === styleId);
    }
    return result;
  }

  public async saveCuttingEntry(entry: Partial<CuttingEntry>): Promise<CuttingEntry> {
    const isValidUUID = (id?: string) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const entryId = entry.id && isValidUUID(entry.id) ? entry.id : crypto.randomUUID();
    const entryDate = entry.entry_date || getLocalDateString();
    const qtyCut = Number(entry.pieces_cut || (entry as any).qty_cut || 0);
    const qtyReject = Number((entry as any).qty_reject || 0);
    const notesText = entry.notes || (entry as any).note || null;
    const cutTypeVal = entry.cut_type || 'bulk';

    if (isSupabaseConfigured) {
      // Exact schema columns:
      // cutting_entries: id, entry_date, style_id, lay_id, size, color, qty_cut, qty_reject, worker_id, shift, note, entered_by, cut_type, created_at
      const rawPayload: Record<string, any> = {
        id: entryId,
        entry_date: entryDate,
        style_id: entry.style_id,
        qty_cut: qtyCut,
        qty_reject: qtyReject,
        shift: (entry as any).shift || 'day',
        cut_type: cutTypeVal,
      };

      if ((entry as any).lay_id) rawPayload.lay_id = (entry as any).lay_id;

      // When a style has no size breakdown, OMIT the size field entirely rather than sending an explicit null
      const rawSize = entry.size || (entry as any).size;
      if (typeof rawSize === 'string' && rawSize.trim().length > 0 && rawSize.trim().toUpperCase() !== 'ALL') {
        rawPayload.size = rawSize.trim();
      }

      if ((entry as any).color) rawPayload.color = (entry as any).color;
      if (entry.worker_id && isValidUUID(entry.worker_id)) rawPayload.worker_id = entry.worker_id;
      if (notesText) rawPayload.note = notesText;

      const rawEnteredBy = (entry as any).entered_by;
      if (isValidUUID(rawEnteredBy)) {
        rawPayload.entered_by = rawEnteredBy;
      }

      const payload = sanitizePayload(rawPayload);

      console.log('[SUPABASE CUTTING INSERT PAYLOAD]:', JSON.stringify(payload, null, 2));

      const { data, error } = await supabase.from('cutting_entries').upsert(payload).select();
      if (error) {
        console.error('Error saving cutting_entries to Supabase:', error);
        showErrorToast(`Database Error (cutting_entries): ${error.message}`);
        throw new Error(error.message);
      }

      const refreshed = await this.getCuttingEntries();
      const saved = refreshed.find(c => c.id === entryId);
      if (saved) return saved;
    }

    const newEntry: CuttingEntry = {
      id: entryId,
      entry_date: entryDate,
      style_id: entry.style_id!,
      cut_type: cutTypeVal,
      pieces_cut: qtyCut,
      size: entry.size || (entry as any).size || null,
      tables_layers: entry.tables_layers || null,
      worker_id: entry.worker_id || null,
      notes: notesText,
      created_at: entry.created_at || new Date().toISOString(),
    };

    const idx = this.cuttingEntries.findIndex(c => c.id === entryId);
    if (idx >= 0) {
      this.cuttingEntries[idx] = newEntry;
    } else {
      this.cuttingEntries.unshift(newEntry);
    }

    return newEntry;
  }

  public async clearCuttingData(): Promise<void> {

    this.cuttingEntries = [];
    this.samples = [];
    if (isSupabaseConfigured) {
      try {
        await supabase.from('cutting_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('samples').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.warn('Error clearing cutting data from Supabase:', e);
      }
    }
  }

  // --- SAMPLES ---
  public async getSamples(styleId?: string): Promise<GarmentSample[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('samples').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          const dbMap = new Map((data as GarmentSample[]).map(d => [d.id, d]));
          const localOnly = this.samples.filter(s => !dbMap.has(s.id));
          this.samples = [...localOnly, ...(data as GarmentSample[])];
        }
      } catch (e) {
        console.warn('Supabase samples query failed, using local store:', e);
      }
    }

    const stylesMap = new Map(this.styles.map(s => [s.id, s]));

    const result = this.samples.map(s => {
      const st = stylesMap.get(s.style_id);
      return {
        ...s,
        style_code: st?.style_code || '',
        style_name: st?.name || '',
        buyer_name: st?.buyer_name || '',
      };
    });

    if (styleId) {
      return result.filter(s => s.style_id === styleId);
    }
    return result;
  }

  public async saveSample(sample: Partial<GarmentSample>): Promise<GarmentSample> {
    const id = sample.id || crypto.randomUUID();
    const newSample: GarmentSample = {
      id,
      style_id: sample.style_id!,
      sample_type: sample.sample_type || 'PP',
      status: sample.status || 'Pending',
      qty: Number(sample.qty || 1),
      size: sample.size || null,
      colour: sample.colour || null,
      requested_date: sample.requested_date || getLocalDateString(),
      submitted_date: sample.submitted_date || null,
      buyer_feedback: sample.buyer_feedback || null,
      photo_url: sample.photo_url || null,
      notes: sample.notes || null,
      created_at: sample.created_at || new Date().toISOString(),
    };

    const idx = this.samples.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.samples[idx] = newSample;
    } else {
      this.samples.unshift(newSample);
    }

    if (isSupabaseConfigured) {
      try {
        const payload = sanitizePayload({
          id: newSample.id,
          style_id: newSample.style_id,
          sample_type: newSample.sample_type,
          status: newSample.status,
          qty: newSample.qty,
          size: newSample.size,
          colour: newSample.colour,
          requested_date: newSample.requested_date,
          submitted_date: newSample.submitted_date,
          buyer_feedback: newSample.buyer_feedback,
          photo_url: newSample.photo_url,
          notes: newSample.notes,
        });
        await supabase.from('samples').upsert([payload]);
      } catch (e) {
        console.warn('Error saving sample to Supabase:', e);
      }
    }

    return newSample;
  }

  public async deleteSample(id: string): Promise<void> {
    this.samples = this.samples.filter(s => s.id !== id);
    if (isSupabaseConfigured) {
      try {
        await supabase.from('samples').delete().eq('id', id);
      } catch (e) {
        console.warn('Error deleting sample from Supabase:', e);
      }
    }
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

  public async verifyWorkerPinByPhone(phone: string, pin: string): Promise<Worker | null> {
    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('verify_worker_pin_phone', {
          p_phone: cleanPhone,
          p_pin: cleanPin,
        });

        if (error) {
          console.error('RPC verify_worker_pin_phone error:', error);
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
        console.error('Failed to invoke verify_worker_pin_phone:', err);
        return null;
      }
    } else {
      const workers = await this.getWorkers();
      const normalize = (p: string) => p.replace(/\D/g, '');
      const normInput = normalize(cleanPhone);
      const w = workers.find(w => w.phone && normalize(w.phone) === normInput);
      if (!w) return null;
      if (cleanPin === '1111' || cleanPin === '1234') {
        return w;
      }
      return null;
    }
  }

  public async setWorkerPinByPhone(phone: string, pin: string): Promise<boolean> {
    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();

    if (!cleanPhone || !cleanPin) {
      throw new Error('Mobile number and PIN are required');
    }
    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      throw new Error('PIN must be a 4-digit number');
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('set_worker_pin_by_phone', {
        p_phone: cleanPhone,
        p_pin: cleanPin,
      });

      if (error) {
        console.error('RPC set_worker_pin_by_phone error:', error);
        throw new Error(error.message || 'Failed to set worker PIN');
      }
      return true;
    } else {
      const workers = await this.getWorkers();
      const normalize = (p: string) => p.replace(/\D/g, '');
      const normInput = normalize(cleanPhone);
      const idx = this.workers.findIndex(w => w.phone && normalize(w.phone) === normInput);
      if (idx >= 0) {
        this.workers[idx] = {
          ...this.workers[idx],
          pin_hash: 'mock_pin_hash',
        };
      }
      return true;
    }
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
      if ((w.worker_code === 'W-001' && cleanPin === '1111') || 
          (w.worker_code === 'W-002' && cleanPin === '2222') || 
          cleanPin === '1111') {
        return w;
      }
      return null;
    }
  }

  public async setWorkerPin(workerCode: string, pin: string): Promise<boolean> {
    const cleanCode = workerCode.trim().toUpperCase();
    const cleanPin = pin.trim();

    if (!cleanCode || !cleanPin) {
      throw new Error('Worker code and PIN are required');
    }
    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      throw new Error('PIN must be a 4-digit number');
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('set_worker_pin', {
        p_worker_code: cleanCode,
        p_pin: cleanPin,
      });

      if (error) {
        console.error('RPC set_worker_pin error:', error);
        throw new Error(error.message || 'Failed to set worker PIN');
      }
      return true;
    } else {
      const idx = this.workers.findIndex(w => w.worker_code.toUpperCase() === cleanCode);
      if (idx >= 0) {
        this.workers[idx] = {
          ...this.workers[idx],
          pin_hash: 'mock_pin_hash',
        };
      }
      return true;
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
      const cleanPayload = sanitizePayload(payload);
      const { error } = await supabase.from('attendance').upsert(cleanPayload);
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
      const cleanPayload = sanitizePayload(newAdj);
      const { error } = await supabase.from('adjustments').upsert(cleanPayload);
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

  public async updateDailyAssignment(id: string, updates: Partial<DailyAssignment>): Promise<DailyAssignment | null> {
    const cleanId = cleanUuid(id);
    if (!cleanId) return null;

    const payload: Record<string, any> = {};
    if (updates.target_qty !== undefined) payload.target_qty = updates.target_qty !== null ? Number(updates.target_qty) : null;
    if (updates.agreed_rate !== undefined) payload.agreed_rate = Number(updates.agreed_rate);
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.note !== undefined) payload.note = updates.note;
    if (updates.work_date !== undefined) payload.work_date = updates.work_date;

    console.log('Sending daily_assignments UPDATE payload:', JSON.stringify(payload, null, 2), 'for ID:', cleanId);

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('daily_assignments').update(payload).eq('id', cleanId);
      if (this.handleError(error, 'Error updating daily assignment')) {
        throw new Error(error?.message || 'Error updating daily assignment');
      }
    } else {
      const idx = this.dailyAssignments.findIndex(a => a.id === cleanId);
      if (idx >= 0) {
        this.dailyAssignments[idx] = { ...this.dailyAssignments[idx], ...payload };
      }
    }

    return null;
  }

  public async saveDailyAssignment(assignment: Partial<DailyAssignment>): Promise<DailyAssignment> {
    const cleanId = cleanUuid(assignment.id);
    const hasCoreInsertFields = Boolean(assignment.work_date && assignment.style_id && assignment.process_id && assignment.worker_id);

    // If an existing assignment ID is passed without all required INSERT fields, handle as UPDATE
    if (cleanId && !assignment.id?.startsWith('draft-') && !hasCoreInsertFields) {
      await this.updateDailyAssignment(cleanId, assignment);
      const workDateToFetch = assignment.work_date || getLocalDateString();
      const fullList = await this.getDailyAssignments(workDateToFetch);
      return fullList.find(a => a.id === cleanId) || (assignment as DailyAssignment);
    }

    const results = await this.saveDailyAssignmentsBulk([assignment]);
    return results[0];
  }

  public async saveDailyAssignmentsBulk(assignments: Partial<DailyAssignment>[]): Promise<DailyAssignment[]> {
    if (!assignments || assignments.length === 0) return [];

    const allProcesses = await this.getProcesses();
    const processesMap = new Map(allProcesses.map(p => [p.id, p]));

    // 1. Collect target work dates to fetch existing assignments
    const workDates = Array.from(new Set(assignments.map(a => a.work_date || getLocalDateString())));

    // 2. Fetch existing assignments from Supabase or memory for these work dates
    let existingAssignments: DailyAssignment[] = [];
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('daily_assignments')
        .select('*')
        .in('work_date', workDates);
      if (data) {
        existingAssignments = data as DailyAssignment[];
      }
    } else {
      existingAssignments = this.dailyAssignments.filter(a => workDates.includes(a.work_date));
    }

    const existingById = new Map<string, DailyAssignment>();
    const existingByKey = new Map<string, DailyAssignment>();

    for (const existing of existingAssignments) {
      if (existing.id) existingById.set(existing.id, existing);
      const key = `${existing.work_date}_${existing.style_id}_${existing.process_id}_${existing.worker_id}`;
      existingByKey.set(key, existing);
    }

    const updatesToPerform: { id: string; payload: Record<string, any> }[] = [];
    const insertsToUpsert: Record<string, any>[] = [];
    const seenBatchKeys = new Set<string>();

    for (let i = 0; i < assignments.length; i++) {
      const item = assignments[i];
      const workDate = item.work_date || getLocalDateString();
      const processId = cleanUuid(item.process_id);
      const workerId = cleanUuid(item.worker_id);

      let styleId = cleanUuid(item.style_id);
      if ((!styleId || styleId === 'null') && processId) {
        const proc = processesMap.get(processId);
        if (proc && proc.style_id) {
          styleId = cleanUuid(proc.style_id);
        }
      }

      // MANDATORY FIELD VALIDATION FOR INSERT/UPSERT
      const missingFields: string[] = [];
      if (!workDate) missingFields.push('work_date');
      if (!styleId) missingFields.push('style_id');
      if (!processId) missingFields.push('process_id');
      if (!workerId) missingFields.push('worker_id');

      if (missingFields.length > 0) {
        const errMsg = `Daily assignment save BLOCKED: Missing required field(s) [${missingFields.join(', ')}] on assignment item #${i + 1}.`;
        console.error(errMsg);
        showErrorToast(`Save blocked: Missing required field(s): ${missingFields.join(', ')}`);
        throw new Error(errMsg);
      }

      const key = `${workDate}_${styleId}_${processId}_${workerId}`;
      if (seenBatchKeys.has(key)) {
        continue;
      }
      seenBatchKeys.add(key);

      const cleanId = item.id && !item.id.startsWith('draft-') ? cleanUuid(item.id) : null;
      const existing = (cleanId ? existingById.get(cleanId) : null) || existingByKey.get(key);

      if (existing) {
        // Existing assignment found!
        const newTargetQty = item.target_qty !== undefined ? (item.target_qty !== null ? Number(item.target_qty) : null) : existing.target_qty;
        const newStatus = item.status || existing.status;
        const newNote = item.note !== undefined ? item.note : existing.note;

        const targetQtyChanged = newTargetQty !== existing.target_qty;
        const statusChanged = newStatus !== existing.status;
        const noteChanged = newNote !== existing.note;

        if (!targetQtyChanged && !statusChanged && !noteChanged) {
          // Rule 1: Skip unchanged rows completely
          console.log(`Skipping unchanged daily assignment for key ${key}`);
          continue;
        }

        // Rule 2: When editing on existing assignment, send UPDATE matched on daily_assignments.id with only changed fields
        const updatePayload: Record<string, any> = {};
        if (targetQtyChanged) updatePayload.target_qty = newTargetQty;
        if (statusChanged) updatePayload.status = newStatus;
        if (noteChanged) updatePayload.note = newNote;

        updatesToPerform.push({ id: existing.id, payload: updatePayload });
      } else {
        // Rule 3: Do NOT send agreed_rate on insert - database trigger fills it from process rate!
        const rawPayload: Record<string, any> = {
          work_date: workDate,
          style_id: styleId,
          process_id: processId,
          worker_id: workerId,
          target_qty: item.target_qty !== undefined ? (item.target_qty !== null ? Number(item.target_qty) : null) : null,
          status: item.status || 'active',
        };

        if (item.note) rawPayload.note = item.note;

        insertsToUpsert.push(sanitizePayload(rawPayload));
      }
    }

    if (isSupabaseConfigured) {
      // Execute updates matched on daily_assignments.id
      for (const updateOp of updatesToPerform) {
        console.log('Sending daily_assignments UPDATE payload:', JSON.stringify(updateOp.payload, null, 2), 'for ID:', updateOp.id);
        const { error } = await supabase
          .from('daily_assignments')
          .update(updateOp.payload)
          .eq('id', updateOp.id);
        if (this.handleError(error, 'Error updating daily assignment')) {
          throw new Error(error?.message || 'Error updating daily assignment');
        }
      }

      // Execute upsert for new assignments on conflict work_date,style_id,process_id,worker_id
      if (insertsToUpsert.length > 0) {
        console.log('Sending daily_assignments bulk UPSERT payload:', JSON.stringify(insertsToUpsert, null, 2));
        const { error } = await supabase
          .from('daily_assignments')
          .upsert(insertsToUpsert, {
            onConflict: 'work_date,style_id,process_id,worker_id'
          });
        if (this.handleError(error, 'Error saving daily assignment(s)')) {
          throw new Error(error?.message || 'Error saving daily assignment');
        }
      }

      const workDateToFetch = workDates[0] || getLocalDateString();
      return await this.getDailyAssignments(workDateToFetch);
    } else {
      // In-memory fallback
      for (const updateOp of updatesToPerform) {
        const idx = this.dailyAssignments.findIndex(a => a.id === updateOp.id);
        if (idx >= 0) {
          this.dailyAssignments[idx] = { ...this.dailyAssignments[idx], ...updateOp.payload };
        }
      }
      for (const raw of insertsToUpsert) {
        const record: DailyAssignment = {
          id: crypto.randomUUID(),
          work_date: raw.work_date,
          style_id: raw.style_id,
          process_id: raw.process_id,
          worker_id: raw.worker_id,
          target_qty: raw.target_qty,
          agreed_rate: 0,
          status: raw.status || 'active',
          note: raw.note || null,
          created_at: new Date().toISOString(),
        };
        const key = `${record.work_date}_${record.style_id}_${record.process_id}_${record.worker_id}`;
        const idx = this.dailyAssignments.findIndex(a => `${a.work_date}_${a.style_id}_${a.process_id}_${a.worker_id}` === key);
        if (idx >= 0) this.dailyAssignments[idx] = record;
        else this.dailyAssignments.push(record);
      }
      const workDateToFetch = workDates[0] || getLocalDateString();
      return this.dailyAssignments.filter(a => a.work_date === workDateToFetch);
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

    const newAssignments: Partial<DailyAssignment>[] = sourceAssignments.map(src => ({
      work_date: targetDate,
      style_id: src.style_id,
      process_id: src.process_id,
      worker_id: src.worker_id,
      target_qty: src.target_qty,
      agreed_rate: src.agreed_rate,
      status: 'planned',
      note: `Cloned from ${fromDate}`,
    }));

    return this.saveDailyAssignmentsBulk(newAssignments);
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
      const payload = sanitizePayload({
        id: newBid.id,
        process_id: newBid.process_id,
        worker_id: newBid.worker_id,
        current_rate: newBid.current_rate,
        proposed_rate: newBid.proposed_rate,
        counter_rate: newBid.counter_rate,
        reason: newBid.reason,
        status: newBid.status,
      });
      const { error } = await supabase.from('rate_bids').insert(payload);
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

    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);
    const totalDaysInPeriod = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const lines: PayrollLine[] = workers.map(worker => {
      const workerEntries = entries.filter(e => 
        e.worker_id === worker.id && 
        e.entry_date >= period.start_date && 
        e.entry_date <= period.end_date
      );
      const piecesTotal = workerEntries.reduce((sum, e) => sum + (e.qty_ok || 0), 0);
      const pieceEarningsRaw = workerEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const workerAtt = attendance.filter(a => 
        a.worker_id === worker.id && 
        a.date >= period.start_date && 
        a.date <= period.end_date
      );
      const presentDays = workerAtt.filter(a => a.status === 'present').length;
      const halfDays = workerAtt.filter(a => a.status === 'half_day').length;
      const leaveDays = workerAtt.filter(a => a.status === 'leave' || a.status === 'holiday').length;
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

      let pieceEarnings = pieceEarningsRaw;
      let minimumWageTopup = 0;

      if (worker.pay_type === 'monthly_salary') {
        const attendedDays = workerAtt.length > 0 
          ? (presentDays + 0.5 * halfDays + leaveDays)
          : totalDaysInPeriod;
        pieceEarnings = Math.round(((worker.monthly_salary || 0) / totalDaysInPeriod) * Math.min(totalDaysInPeriod, attendedDays) * 100) / 100;
        minimumWageTopup = 0; // Skip minimum wage top-up for salaried workers
      } else {
        if (enableTopup && (presentDays + halfDays > 0)) {
          const requiredWage = (presentDays + 0.5 * halfDays) * minWagePerDay;
          if (pieceEarnings < requiredWage) {
            minimumWageTopup = requiredWage - pieceEarnings;
          }
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

  // --- FINISHING SECTION METHODS ---

  public async getFinishingStages(styleId?: string): Promise<FinishingStage[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('finishing_stages').select('*').order('seq_no', { ascending: true });
        if (styleId) {
          query = query.eq('style_id', styleId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as FinishingStage[];
        }
      } catch (err) {
        console.warn('Error fetching finishing_stages from Supabase:', err);
      }
    }

    if (styleId) {
      return this.finishingStages
        .filter(s => s.style_id === styleId && s.is_active !== false)
        .sort((a, b) => a.seq_no - b.seq_no);
    }
    return [...this.finishingStages].sort((a, b) => a.seq_no - b.seq_no);
  }

  public async applyDefaultFinishingStages(styleId: string, hasButtons: boolean): Promise<FinishingStage[]> {
    if (isSupabaseConfigured) {
      try {
        // Cleanly remove existing stages for this style to avoid unique constraint violations on (style_id, name)
        await supabase.from('finishing_stages').delete().eq('style_id', styleId);
      } catch (err) {
        console.warn('Error deleting existing finishing_stages before applying defaults:', err);
      }
    }

    // Standard fallback definitions
    const defaultDefs = [
      { code: 'received', name: 'Received from Sewing', seq: 1 },
      { code: 'thread_cut', name: 'Thread Cutting', seq: 2 },
      ...(hasButtons
        ? [
            { code: 'buttonhole', name: 'Buttonhole', seq: 3 },
            { code: 'button_attach', name: 'Button Attach', seq: 4 },
          ]
        : []),
      { code: 'ironing', name: 'Ironing & Pressing', seq: 5 },
      { code: 'qc', name: 'Quality Control (QC)', seq: 6 },
      { code: 'packing', name: 'Folding & Packing', seq: 7 },
      { code: 'ready', name: 'Ready to Deliver', seq: 8 },
    ];

    // Replace existing stages for this style in local memory
    this.finishingStages = this.finishingStages.filter(s => s.style_id !== styleId);

    const newStages: FinishingStage[] = defaultDefs.map((def, idx) => ({
      id: this.generateId('fs'),
      style_id: styleId,
      seq_no: idx + 1,
      name: def.name,
      code: def.code,
      is_active: true,
      created_at: new Date().toISOString(),
    }));

    this.finishingStages.push(...newStages);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('finishing_stages').upsert(newStages);
      } catch (err) {
        console.error('Error upserting default stages:', err);
      }
    }

    return newStages;
  }

  public async saveFinishingStage(stage: Partial<FinishingStage>): Promise<FinishingStage> {
    const existingIdx = this.finishingStages.findIndex(s => s.id === stage.id);
    let updated: FinishingStage;

    if (existingIdx >= 0) {
      updated = { ...this.finishingStages[existingIdx], ...stage };
      this.finishingStages[existingIdx] = updated;
    } else {
      updated = {
        id: stage.id || this.generateId('fs'),
        style_id: stage.style_id || '',
        seq_no: stage.seq_no || (this.finishingStages.length + 1),
        name: stage.name || 'New Stage',
        code: stage.code || (stage.name ? stage.name.toLowerCase().replace(/\s+/g, '_') : 'custom'),
        is_active: stage.is_active !== undefined ? stage.is_active : true,
        created_at: new Date().toISOString(),
      };
      this.finishingStages.push(updated);
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('finishing_stages').upsert([updated]);
      } catch (err) {
        console.error('Error saving finishing stage to Supabase:', err);
      }
    }

    return updated;
  }

  public async updateFinishingStagesOrder(stages: FinishingStage[]): Promise<void> {
    stages.forEach((stg, idx) => {
      stg.seq_no = idx + 1;
      const localIdx = this.finishingStages.findIndex(s => s.id === stg.id);
      if (localIdx >= 0) {
        this.finishingStages[localIdx].seq_no = idx + 1;
      }
    });

    if (isSupabaseConfigured) {
      try {
        await supabase.from('finishing_stages').upsert(stages);
      } catch (err) {
        console.error('Error reordering finishing stages:', err);
      }
    }
  }

  public async getFinishingEntries(filters?: { styleId?: string; date?: string; workerId?: string }): Promise<FinishingEntry[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('finishing_entries').select('*');
        if (filters?.styleId) query = query.eq('style_id', filters.styleId);
        if (filters?.date) query = query.eq('entry_date', filters.date);
        if (filters?.workerId) query = query.eq('worker_id', filters.workerId);

        const { data, error } = await query;
        if (!error && data) {
          const workers = await this.getWorkers();
          const styles = await this.getStyles();
          const stages = await this.getFinishingStages();
          const workerMap = new Map(workers.map(w => [w.id, w]));
          const styleMap = new Map(styles.map(s => [s.id, s]));
          const stageMap = new Map(stages.map(st => [st.id, st]));

          return (data as FinishingEntry[]).map(e => {
            const w = e.worker_id ? workerMap.get(e.worker_id) : undefined;
            const stg = stageMap.get(e.stage_id);
            const stl = styleMap.get(e.style_id);
            return {
              ...e,
              worker_name: w?.full_name,
              worker_code: w?.worker_code,
              stage_name: stg?.name,
              stage_code: stg?.code,
              style_code: stl?.style_code,
              style_name: stl?.name,
            };
          });
        }
      } catch (err) {
        console.warn('Error fetching finishing_entries from Supabase:', err);
      }
    }

    let result = [...this.finishingEntries];
    if (filters?.styleId) result = result.filter(e => e.style_id === filters.styleId);
    if (filters?.date) result = result.filter(e => e.entry_date === filters.date);
    if (filters?.workerId) result = result.filter(e => e.worker_id === filters.workerId);

    const workersMap = new Map((this.workers || []).map(w => [w.id, w]));
    const styleMap = new Map((this.styles || []).map(s => [s.id, s]));
    const stageMap = new Map((this.finishingStages || []).map(st => [st.id, st]));

    return result.map(e => {
      const w = e.worker_id ? workersMap.get(e.worker_id) : undefined;
      const stg = stageMap.get(e.stage_id);
      const stl = styleMap.get(e.style_id);
      return {
        ...e,
        worker_name: w?.full_name,
        worker_code: w?.worker_code,
        stage_name: stg?.name,
        stage_code: stg?.code,
        style_code: stl?.style_code,
        style_name: stl?.name,
      };
    });
  }

  public async saveFinishingEntries(entries: Partial<FinishingEntry>[]): Promise<FinishingEntry[]> {
    const isValidUUID = (id?: string) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const payloads: Record<string, any>[] = [];

    for (const entry of entries) {
      const entryId = entry.id && isValidUUID(entry.id) ? entry.id : crypto.randomUUID();
      const rawPayload: Record<string, any> = {
        id: entryId,
        entry_date: entry.entry_date || getLocalDateString(),
        qty_ok: Number(entry.qty_ok || 0),
        qty_rework: Number(entry.qty_rework || 0),
        qty_reject: Number(entry.qty_reject || 0),
        shift: entry.shift || 'day',
      };

      if (entry.style_id) rawPayload.style_id = entry.style_id;
      if (entry.stage_id) rawPayload.stage_id = entry.stage_id;
      if (entry.worker_id && isValidUUID(entry.worker_id)) rawPayload.worker_id = entry.worker_id;
      if (isValidUUID(entry.entered_by)) rawPayload.entered_by = entry.entered_by;
      if (entry.note) rawPayload.note = entry.note;

      const rawSize = entry.size;
      if (typeof rawSize === 'string' && rawSize.trim().length > 0 && rawSize.trim().toUpperCase() !== 'ALL') {
        rawPayload.size = rawSize.trim();
      }

      payloads.push(sanitizePayload(rawPayload));
    }

    if (isSupabaseConfigured && payloads.length > 0) {
      console.log('[SUPABASE FINISHING INSERT PAYLOAD]:', JSON.stringify(payloads, null, 2));

      const { data, error } = await supabase.from('finishing_entries').insert(payloads).select();
      if (error) {
        console.error('Error saving finishing_entries to Supabase:', error);
        showErrorToast(`Database Error (finishing_entries): ${error.message}`);
        throw new Error(error.message);
      }

      // Refetch from Supabase rather than trusting local state
      this.finishingListeners.forEach(fn => fn());
      return await this.getFinishingEntries();
    }

    const savedList: FinishingEntry[] = [];
    for (const p of payloads) {
      const newEntry: FinishingEntry = {
        id: p.id,
        entry_date: p.entry_date,
        style_id: p.style_id || '',
        stage_id: p.stage_id || '',
        worker_id: p.worker_id || null,
        qty_ok: p.qty_ok,
        qty_rework: p.qty_rework,
        qty_reject: p.qty_reject,
        shift: p.shift,
        entered_by: p.entered_by,
        note: p.note,
        size: p.size || null,
        created_at: new Date().toISOString(),
      };
      this.finishingEntries.push(newEntry);
      savedList.push(newEntry);
    }

    // Trigger local realtime listeners
    this.finishingListeners.forEach(fn => fn());

    return savedList;
  }

  public subscribeToWorkerFinishingEntries(workerId: string, callback: () => void): () => void {
    if (isSupabaseConfigured) {
      try {
        const channel = supabase
          .channel(`finishing_entries_worker_${workerId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'finishing_entries',
              filter: `worker_id=eq.${workerId}`,
            },
            () => {
              callback();
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (err) {
        console.warn('Realtime subscription failed, using local listener:', err);
      }
    }

    this.finishingListeners.add(callback);
    return () => {
      this.finishingListeners.delete(callback);
    };
  }

  // --- GARMENTS SEWN RPC & FALLBACK ---
  public async getGarmentsSewn(styleId: string, pFrom?: string | null, pTo?: string | null): Promise<number> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('fn_garments_sewn', {
          p_style_id: styleId,
          p_from: pFrom || null,
          p_to: pTo || null,
        });
        if (!error && data !== null && data !== undefined) {
          return Number(data) || 0;
        }
      } catch (err) {
        console.warn('RPC fn_garments_sewn call failed, using fallback:', err);
      }
    }

    return this.getFallbackGarmentsSewn(styleId, pFrom, pTo);
  }

  public getFallbackGarmentsSewn(styleId: string, pFrom?: string | null, pTo?: string | null): number {
    const styleOutputs = this.styleDailyOutputs.filter(o => {
      if (o.style_id !== styleId) return false;
      if (pFrom && o.output_date < pFrom) return false;
      if (pTo && o.output_date > pTo) return false;
      return true;
    });

    const styleEntries = this.productionEntries.filter(e => {
      if (e.style_id !== styleId) return false;
      if (pFrom && e.entry_date < pFrom) return false;
      if (pTo && e.entry_date > pTo) return false;
      return true;
    });

    const fullGarmentEntries = styleEntries.filter(e => e.process_id === 'ALL' || !e.process_id);
    const fullGarmentQty = fullGarmentEntries.reduce((sum, e) => sum + Number(e.qty_ok || 0), 0);
    const declaredQty = styleOutputs.reduce((sum, o) => sum + Number(o.qty || 0), 0);

    // If declared output exists or full garment output exists, that takes precedence
    if (declaredQty > 0 || fullGarmentQty > 0) {
      return Math.max(declaredQty, fullGarmentQty);
    }

    // Otherwise fallback to minimum across operations plus full garment output
    const styleProcs = this.processes.filter(p => p.style_id === styleId);
    if (styleProcs.length === 0) {
      return styleEntries.reduce((sum, e) => sum + Number(e.qty_ok || 0), 0);
    }

    const procQtyMap = new Map<string, number>();
    styleProcs.forEach(p => procQtyMap.set(p.id, 0));
    let hasEntries = false;
    styleEntries.forEach(e => {
      if (procQtyMap.has(e.process_id)) {
        hasEntries = true;
        procQtyMap.set(e.process_id, (procQtyMap.get(e.process_id) || 0) + Number(e.qty_ok || 0));
      }
    });

    if (!hasEntries) return 0;
    return Math.min(...Array.from(procQtyMap.values()));
  }

  // --- FINANCIALS & MANAGEMENT PORTAL RPCs ---
  public async getStyleFinancials(
    styleId?: string | null,
    pFrom?: string | null,
    pTo?: string | null
  ): Promise<StyleFinancialRecord[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpt_style_financials', {
          p_style_id: styleId || null,
          p_from: pFrom || null,
          p_to: pTo || null,
        });
        if (!error && data) {
          const arr = Array.isArray(data) ? data : [data];
          return arr.map((item: any) => {
            const isArr = Array.isArray(item);
            const style_code = item.style_code || (isArr ? item[0] : '');
            const style_name = item.style_name || item.name || (isArr ? item[1] : '');
            const buyer = item.buyer || item.buyer_name || (isArr ? item[2] : 'N/A');
            const order_qty = Number((item.order_qty ?? (isArr ? item[3] : 0)) || 0);
            const price = Number((item.price ?? item.selling_price ?? (isArr ? item[4] : 0)) || 0);
            const garments_sewn = Number((item.garments_sewn ?? (isArr ? item[5] : 0)) || 0);
            const received_in_finishing = Number((item.received_in_finishing ?? item.received_finishing ?? item.already_received ?? item.qty_received ?? (isArr ? item[6] : 0)) || 0);
            const ready_to_deliver = Number((item.ready_to_deliver ?? (isArr ? item[7] : 0)) || 0);
            const production_value = Number((item.production_value ?? (isArr ? item[8] : 0)) || 0);
            const deliverable_value = Number((item.deliverable_value ?? (isArr ? item[9] : 0)) || 0);
            const labour_cost = Number((item.labour_cost ?? (isArr ? item[10] : 0)) || 0);
            const gross_margin = Number((item.gross_margin ?? (isArr ? item[11] : 0)) || 0);
            const margin_pct = Number((item.margin_pct ?? item.margin_percent ?? (isArr ? item[12] : 0)) || 0);

            return {
              style_id: item.style_id || item.id || style_code,
              style_code,
              style_name,
              style: item.style || (style_code ? `${style_code} - ${style_name}` : (style_name || 'Style')),
              buyer,
              order_qty,
              price,
              garments_sewn,
              received_in_finishing,
              ready_to_deliver,
              production_value,
              deliverable_value,
              labour_cost,
              gross_margin,
              margin_pct,
            };
          });
        }
      } catch (err) {
        console.warn('RPC rpt_style_financials call failed, using fallback:', err);
      }
    }

    // Fallback client-side calculation
    const allStyles = await this.getStyles();
    const allProcs = await this.getProcesses();
    const allEntries = await this.getProductionEntries();
    const allFinishingEntries = await this.getFinishingEntries();
    const allFinishingStages = await this.getFinishingStages();
    const allDeliveries = this.deliveries;

    const filteredStyles = styleId ? allStyles.filter(s => s.id === styleId) : allStyles;

    return filteredStyles.map(st => {
      const price = Number(st.selling_price || 0);
      const styleProcs = allProcs.filter(p => p.style_id === st.id);

      // Filter entries by style and optional date range
      const styleEntries = allEntries.filter(e => {
        if (e.style_id !== st.id) return false;
        if (pFrom && e.entry_date < pFrom) return false;
        if (pTo && e.entry_date > pTo) return false;
        return true;
      });

      // Garments sewn: call fn_garments_sewn or fallback rule
      const garments_sewn = this.getFallbackGarmentsSewn(st.id, pFrom, pTo);

      // Received in Finishing = stage_id === receivedStageId (or first finishing stage)
      const styleStages = allFinishingStages.filter(stg => stg.style_id === st.id);
      let receivedStage = styleStages.find(stg => (stg.code || '').toLowerCase() === 'received' || stg.seq_no === 1);
      if (!receivedStage && styleStages.length > 0) {
        receivedStage = styleStages[0];
      }
      const receivedStageId = receivedStage ? receivedStage.id : `received-${st.id}`;

      const styleFinishing = allFinishingEntries.filter(f => {
        if (f.style_id !== st.id) return false;
        if (pFrom && f.entry_date < pFrom) return false;
        if (pTo && f.entry_date > pTo) return false;
        return true;
      });

      const received_in_finishing = styleFinishing
        .filter(f => !receivedStageId || f.stage_id === receivedStageId)
        .reduce((sum, f) => sum + Number(f.qty_ok || 0), 0);

      // Deliveries
      const styleDeliveries = allDeliveries.filter(d => {
        if (d.style_id !== st.id) return false;
        if (pFrom && d.delivery_date < pFrom) return false;
        if (pTo && d.delivery_date > pTo) return false;
        return true;
      });
      const delivered_qty = styleDeliveries.reduce((sum, d) => sum + Number(d.delivered_qty || 0), 0);
      const ready_to_deliver = Math.max(0, garments_sewn - delivered_qty);

      const production_value = garments_sewn * price;
      const deliverable_value = ready_to_deliver * price;
      const labour_cost = styleEntries.reduce((sum, e) => sum + Number(e.amount || (e.qty_ok * e.rate_snapshot) || 0), 0);
      const gross_margin = deliverable_value - labour_cost;
      const margin_pct = deliverable_value > 0 ? (gross_margin / deliverable_value) * 100 : 0;

      return {
        style_id: st.id,
        style_code: st.style_code,
        style_name: st.name,
        style: `${st.style_code} - ${st.name}`,
        buyer: st.buyer_name || 'N/A',
        order_qty: st.order_qty,
        price,
        selling_price: st.selling_price,
        garments_sewn,
        received_in_finishing,
        ready_to_deliver,
        production_value,
        deliverable_value,
        labour_cost,
        gross_margin,
        margin_pct,
      };
    });
  }

  public async getMgmtValueToday(
    pToken: string,
    pDate?: string | null
  ): Promise<MgmtValueTodayRecord> {
    const targetDate = pDate || new Date().toISOString().split('T')[0];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('mgmt_value_today', {
          p_token: pToken,
          p_date: targetDate,
        });
        if (!error && data) {
          const rec = Array.isArray(data) ? data[0] : data;
          if (rec) {
            return {
              production_value_today: Number(rec.production_value_today ?? rec.production_value ?? 0),
              deliverable_value_today: Number(rec.deliverable_value_today ?? rec.deliverable_value ?? 0),
              labour_cost_today: Number(rec.labour_cost_today ?? rec.labour_cost ?? 0),
              net_today: Number(rec.net_today ?? rec.net ?? 0),
            };
          }
        }
      } catch (err) {
        console.warn('RPC mgmt_value_today call failed, using fallback:', err);
      }
    }

    // Fallback calculation for targetDate
    const financialsToday = await this.getStyleFinancials(null, targetDate, targetDate);
    const production_value_today = financialsToday.reduce((sum, f) => sum + f.production_value, 0);
    const deliverable_value_today = financialsToday.reduce((sum, f) => sum + f.deliverable_value, 0);
    const labour_cost_today = financialsToday.reduce((sum, f) => sum + f.labour_cost, 0);
    const net_today = deliverable_value_today - labour_cost_today;

    return {
      production_value_today,
      deliverable_value_today,
      labour_cost_today,
      net_today,
    };
  }

  public async getMgmtFinancials(
    pToken: string,
    pFrom?: string | null,
    pTo?: string | null
  ): Promise<StyleFinancialRecord[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('mgmt_financials', {
          p_token: pToken,
          p_from: pFrom || null,
          p_to: pTo || null,
        });
        if (!error && data) {
          const arr = Array.isArray(data) ? data : [data];
          return arr.map((item: any) => {
            const isArr = Array.isArray(item);
            const style_code = item.style_code || (isArr ? item[0] : '');
            const style_name = item.style_name || item.name || (isArr ? item[1] : '');
            const buyer = item.buyer || item.buyer_name || (isArr ? item[2] : 'N/A');
            const order_qty = Number((item.order_qty ?? (isArr ? item[3] : 0)) || 0);
            const price = Number((item.price ?? item.selling_price ?? (isArr ? item[4] : 0)) || 0);
            const garments_sewn = Number((item.garments_sewn ?? (isArr ? item[5] : 0)) || 0);
            const received_in_finishing = Number((item.received_in_finishing ?? item.received_finishing ?? item.already_received ?? item.qty_received ?? (isArr ? item[6] : 0)) || 0);
            const ready_to_deliver = Number((item.ready_to_deliver ?? (isArr ? item[7] : 0)) || 0);
            const production_value = Number((item.production_value ?? (isArr ? item[8] : 0)) || 0);
            const deliverable_value = Number((item.deliverable_value ?? (isArr ? item[9] : 0)) || 0);
            const labour_cost = Number((item.labour_cost ?? (isArr ? item[10] : 0)) || 0);
            const gross_margin = Number((item.gross_margin ?? (isArr ? item[11] : 0)) || 0);
            const margin_pct = Number((item.margin_pct ?? item.margin_percent ?? (isArr ? item[12] : 0)) || 0);

            return {
              style_id: item.style_id || item.id || style_code,
              style_code,
              style_name,
              style: item.style || (style_code ? `${style_code} - ${style_name}` : (style_name || 'Style')),
              buyer,
              order_qty,
              price,
              garments_sewn,
              received_in_finishing,
              ready_to_deliver,
              production_value,
              deliverable_value,
              labour_cost,
              gross_margin,
              margin_pct,
            };
          });
        }
      } catch (err) {
        console.warn('RPC mgmt_financials call failed, using fallback:', err);
      }
    }

    return this.getStyleFinancials(null, pFrom, pTo);
  }

  public async mgmtLogin(pPhone: string, pPin: string): Promise<MgmtUserRecord> {
    const cleanPhone = pPhone.trim();
    const cleanPin = pPin.trim();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('mgmt_login', {
          p_phone: cleanPhone,
          p_pin: cleanPin,
        });

        if (!error && data) {
          const rec = Array.isArray(data) ? data[0] : data;
          if (rec && (rec.token || rec.p_token)) {
            return {
              token: rec.token || rec.p_token || 'mgmt-token',
              name: rec.name || rec.full_name || rec.owner_name || 'Management Owner',
              phone: cleanPhone,
            };
          }
        }
        if (error) {
          console.warn('RPC mgmt_login returned error:', error);
        }
      } catch (err) {
        console.warn('RPC mgmt_login call failed, checking fallback:', err);
      }
    }

    // Fallback if local or if RPC not created yet
    if (cleanPhone && cleanPin.length >= 4) {
      const fallbackToken = `mgmt-token-${cleanPhone}`;
      return {
        token: fallbackToken,
        name: 'Executive Owner',
        phone: cleanPhone,
      };
    }

    throw new Error('Invalid mobile number or 6-digit PIN.');
  }

  public async getMgmtOverview(pToken: string): Promise<MgmtOrderOverviewRecord[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('mgmt_overview', {
          p_token: pToken,
        });
        if (!error && data) {
          const arr = Array.isArray(data) ? data : [data];
          return arr.map((item: any) => ({
            style_id: item.style_id || item.id,
            style_code: item.style_code || item.code || 'Style',
            style_name: item.style_name || item.name || '',
            buyer: item.buyer || item.buyer_name || 'N/A',
            order_qty: Number(item.order_qty || 0),
            garments_sewn: Number(item.garments_sewn || item.sewn_qty || 0),
            target_ship_date: item.target_ship_date || item.ship_date || '',
            days_to_ship: item.days_to_ship !== undefined && item.days_to_ship !== null ? Number(item.days_to_ship) : undefined,
            status: item.status || 'active',
          }));
        }
      } catch (err) {
        console.warn('RPC mgmt_overview call failed, using fallback:', err);
      }
    }

    const styles = await this.getStyles();
    const activeStyles = styles.filter(s => s.status !== 'completed' && s.status !== 'archived');
    const targetStyles = activeStyles.length > 0 ? activeStyles : styles;

    const todayMs = new Date().setHours(0,0,0,0);

    const results: MgmtOrderOverviewRecord[] = [];
    for (const st of targetStyles) {
      const fin = await this.getStyleFinancials(st.id);
      const sewn = fin.length > 0 ? fin[0].garments_sewn : 0;

      let daysToShip: number | undefined = undefined;
      if (st.target_ship_date) {
        const shipMs = new Date(st.target_ship_date).setHours(0,0,0,0);
        daysToShip = Math.ceil((shipMs - todayMs) / (1000 * 60 * 60 * 24));
      }

      results.push({
        style_id: st.id,
        style_code: st.style_code,
        style_name: st.name,
        buyer: st.buyer_name || 'N/A',
        order_qty: st.order_qty,
        garments_sewn: sewn,
        target_ship_date: st.target_ship_date || '',
        days_to_ship: daysToShip,
        status: st.status || 'active',
      });
    }

    return results;
  }

  public async getMgmtTodaySections(
    pToken: string,
    pDate?: string | null
  ): Promise<TodaySectionRow[]> {
    const targetDate = pDate || getLocalDateString();
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('mgmt_today_sections', {
          p_token: pToken,
          p_date: targetDate,
        });
        if (!error && data && Array.isArray(data) && data.length > 0) {
          const arr = Array.isArray(data) ? data : [data];
          return arr.map((item: any) => ({
            section: item.section || 'Cutting',
            style_code: item.style_code || item.code || 'Style',
            style_name: item.style_name || item.name || '',
            qty: Number(item.qty || item.pieces || 0),
            detail: item.detail || null,
          }));
        }
      } catch (err) {
        console.warn('RPC mgmt_today_sections call failed, using fallback:', err);
      }
    }

    return this.getRptTodaySections(targetDate);
  }

  public async getRptTodaySections(pDate?: string | null): Promise<TodaySectionRow[]> {
    const targetDate = pDate || getLocalDateString();
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpt_today_sections', {
          p_date: targetDate,
        });
        if (!error && data) {
          const arr = Array.isArray(data) ? data : [data];
          return arr.map((item: any) => ({
            section: item.section || 'Cutting',
            style_code: item.style_code || item.code || 'Style',
            style_name: item.style_name || item.name || '',
            qty: Number(item.qty || item.pieces || 0),
            detail: item.detail || null,
          }));
        }
      } catch (err) {
        console.warn('RPC rpt_today_sections call failed, using fallback:', err);
      }
    }

    return this.getFallbackTodaySections(targetDate);
  }

  public async getRptStylePipeline(): Promise<StylePipelineRow[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpt_style_pipeline');
        if (!error && data) {
          const arr = Array.isArray(data) ? data : [data];
          return arr.map((item: any) => this.mapStylePipelineRow(item));
        }
        if (error) {
          console.warn('RPC rpt_style_pipeline error:', error);
        }
      } catch (err) {
        console.warn('RPC rpt_style_pipeline call failed, using fallback:', err);
      }
    }
    return this.getFallbackStylePipeline();
  }

  public async getMgmtStylePipeline(pToken: string): Promise<StylePipelineRow[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('mgmt_style_pipeline', {
          p_token: pToken,
        });
        if (!error && data) {
          const arr = Array.isArray(data) ? data : [data];
          return arr.map((item: any) => this.mapStylePipelineRow(item));
        }
        if (error) {
          console.warn('RPC mgmt_style_pipeline error:', error);
        }
      } catch (err) {
        console.warn('RPC mgmt_style_pipeline call failed, using fallback:', err);
      }
    }
    return this.getFallbackStylePipeline();
  }

  private mapStylePipelineRow(item: any): StylePipelineRow {
    const orderQty = Number(item.order_qty || 0);
    const qtyCut = Number(item.qty_cut || 0);
    const qtySewn = Number(item.qty_sewn || 0);
    const qtyFinishing = Number(item.qty_in_finishing || item.qty_finishing || 0);
    const qtyReady = Number(item.qty_ready || 0);

    const calcPct = (qty: number) => orderQty > 0 ? Math.min(100, Math.round((qty / orderQty) * 100)) : 0;

    return {
      style_id: item.style_id || item.id || '',
      style_code: item.style_code || item.code || 'Style',
      style_name: item.style_name || item.name || '',
      buyer_name: item.buyer_name || item.buyer || 'N/A',
      image_url: item.image_url || null,
      order_qty: orderQty,
      requires_cutting: item.requires_cutting !== undefined ? Boolean(item.requires_cutting) : true,
      qty_cut: qtyCut,
      qty_sewn: qtySewn,
      qty_in_finishing: qtyFinishing,
      qty_ready: qtyReady,
      pct_cut: item.pct_cut !== undefined && item.pct_cut !== null ? Number(item.pct_cut) : calcPct(qtyCut),
      pct_sewn: item.pct_sewn !== undefined && item.pct_sewn !== null ? Number(item.pct_sewn) : calcPct(qtySewn),
      pct_finishing: item.pct_finishing !== undefined && item.pct_finishing !== null ? Number(item.pct_finishing) : calcPct(qtyFinishing),
      pct_ready: item.pct_ready !== undefined && item.pct_ready !== null ? Number(item.pct_ready) : calcPct(qtyReady),
      bottleneck: item.bottleneck || null,
    };
  }

  private async getFallbackStylePipeline(): Promise<StylePipelineRow[]> {
    const styles = await this.getStyles();
    const activeStyles = styles.filter(s => s.status !== 'archived');
    const targetStyles = activeStyles.length > 0 ? activeStyles : styles;

    const results: StylePipelineRow[] = [];

    for (const st of targetStyles) {
      const orderQty = st.order_qty || 1;
      const requiresCutting = st.requires_cutting !== false;

      let qtyCut = 0;
      if (requiresCutting) {
        const cutEntries = (await this.getCuttingEntries()).filter(c => c.style_id === st.id);
        qtyCut = cutEntries.reduce((sum, c) => sum + Number(c.pieces_cut || 0), 0);
      }

      const financials = await this.getStyleFinancials(st.id);
      const fin = financials.length > 0 ? financials[0] : null;

      const qtySewn = fin ? fin.garments_sewn : 0;
      const qtyFinishing = fin ? (fin.received_in_finishing || 0) : 0;
      const qtyReady = fin ? fin.ready_to_deliver : (st.completed_pieces || 0);

      const pctCut = requiresCutting ? Math.min(100, Math.round((qtyCut / orderQty) * 100)) : 100;
      const pctSewn = Math.min(100, Math.round((qtySewn / orderQty) * 100));
      const pctFinishing = Math.min(100, Math.round((qtyFinishing / orderQty) * 100));
      const pctReady = Math.min(100, Math.round((qtyReady / orderQty) * 100));

      let bottleneck: string | null = null;
      let maxBacklog = 0;

      const cutBacklog = requiresCutting ? Math.max(0, orderQty - qtyCut) : 0;
      const sewBacklog = Math.max(0, (requiresCutting ? qtyCut : orderQty) - qtySewn);
      const finBacklog = Math.max(0, qtySewn - qtyFinishing);
      const readyBacklog = Math.max(0, qtyFinishing - qtyReady);

      if (cutBacklog > maxBacklog) { maxBacklog = cutBacklog; bottleneck = 'CUTTING'; }
      if (sewBacklog > maxBacklog) { maxBacklog = sewBacklog; bottleneck = 'SEWING'; }
      if (finBacklog > maxBacklog) { maxBacklog = finBacklog; bottleneck = 'FINISHING'; }
      if (readyBacklog > maxBacklog) { maxBacklog = readyBacklog; bottleneck = 'READY'; }

      results.push({
        style_id: st.id,
        style_code: st.style_code,
        style_name: st.name,
        buyer_name: st.buyer_name || 'N/A',
        image_url: st.image_url,
        order_qty: orderQty,
        requires_cutting: requiresCutting,
        qty_cut: qtyCut,
        qty_sewn: qtySewn,
        qty_in_finishing: qtyFinishing,
        qty_ready: qtyReady,
        pct_cut: pctCut,
        pct_sewn: pctSewn,
        pct_finishing: pctFinishing,
        pct_ready: pctReady,
        bottleneck: bottleneck,
      });
    }

    return results;
  }

  private async getFallbackTodaySections(targetDate: string): Promise<TodaySectionRow[]> {
    const results: TodaySectionRow[] = [];
    const styles = await this.getStyles();
    const styleMap = new Map(styles.map(s => [s.id, s]));

    // 1. Cutting
    const allCutEntries = await this.getCuttingEntries();
    const cutEntries = allCutEntries.filter(c => c.entry_date === targetDate);
    const cutByStyle = new Map<string, { qty: number; sizes: Set<string> }>();
    cutEntries.forEach(c => {
      const cur = cutByStyle.get(c.style_id) || { qty: 0, sizes: new Set() };
      cur.qty += Number(c.pieces_cut || 0);
      if (c.size) cur.sizes.add(c.size);
      cutByStyle.set(c.style_id, cur);
    });

    cutByStyle.forEach((val, styleId) => {
      const st = styleMap.get(styleId);
      const sizesStr = Array.from(val.sizes).join(', ');
      results.push({
        section: 'Cutting',
        style_code: st?.style_code || 'Style',
        style_name: st?.name || '',
        qty: val.qty,
        detail: sizesStr ? `Sizes: ${sizesStr}` : null,
      });
    });

    // 2. Production (sewing entries)
    const prodEntries = (await this.getProductionEntries()).filter(e => e.entry_date === targetDate);
    const prodByStyle = new Map<string, { qty: number; workers: Set<string> }>();
    prodEntries.forEach(p => {
      const cur = prodByStyle.get(p.style_id) || { qty: 0, workers: new Set() };
      cur.qty += Number(p.qty_ok || 0);
      if (p.worker_id) cur.workers.add(p.worker_id);
      prodByStyle.set(p.style_id, cur);
    });

    prodByStyle.forEach((val, styleId) => {
      const st = styleMap.get(styleId);
      const workerCount = val.workers.size;
      results.push({
        section: 'Production',
        style_code: st?.style_code || 'Style',
        style_name: st?.name || '',
        qty: val.qty,
        detail: `${workerCount} ${workerCount === 1 ? 'worker' : 'workers'}`,
      });
    });

    // 3. Finishing
    const finEntries = await this.getFinishingEntries({ date: targetDate });
    const finByStyle = new Map<string, { qty: number; stages: Set<string> }>();
    finEntries.forEach(f => {
      const cur = finByStyle.get(f.style_id) || { qty: 0, stages: new Set() };
      cur.qty += Number(f.qty_ok || 0);
      if (f.stage_name) cur.stages.add(f.stage_name);
      finByStyle.set(f.style_id, cur);
    });

    finByStyle.forEach((val, styleId) => {
      const st = styleMap.get(styleId);
      const stagesStr = Array.from(val.stages).join(', ');
      results.push({
        section: 'Finishing',
        style_code: st?.style_code || 'Style',
        style_name: st?.name || '',
        qty: val.qty,
        detail: stagesStr ? `Stages: ${stagesStr}` : null,
      });
    });

    return results;
  }

  // ==================== RECEIVE FROM SEWING METHODS ====================
  public async getRptAvailableToReceive(): Promise<AvailableToReceiveRow[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpt_available_to_receive');
        if (error) {
          console.error('RPC rpt_available_to_receive error:', error);
          return this.fallbackAvailableToReceive();
        }
        if (data && Array.isArray(data)) {
          return data.map((item: any) => ({
            style_id: item.style_id,
            style_code: item.style_code,
            style_name: item.style_name || item.name || '',
            received_stage_id: item.received_stage_id,
            garments_sewn: Number(item.garments_sewn || 0),
            already_received: Number(item.already_received || 0),
            available: Number(item.available || 0),
          }));
        }
        return this.fallbackAvailableToReceive();
      } catch (err) {
        console.error('Failed to call rpt_available_to_receive:', err);
        return this.fallbackAvailableToReceive();
      }
    }
    return this.fallbackAvailableToReceive();
  }

  public async getWpAvailableToReceive(pToken: string): Promise<AvailableToReceiveRow[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('wp_available_to_receive', { p_token: pToken });
        if (error) {
          console.error('RPC wp_available_to_receive error:', error);
          return this.fallbackAvailableToReceive();
        }
        if (data && Array.isArray(data)) {
          return data.map((item: any) => ({
            style_id: item.style_id,
            style_code: item.style_code,
            style_name: item.style_name || item.name || '',
            received_stage_id: item.received_stage_id,
            garments_sewn: Number(item.garments_sewn || 0),
            already_received: Number(item.already_received || 0),
            available: Number(item.available || 0),
          }));
        }
        return this.fallbackAvailableToReceive();
      } catch (err) {
        console.error('Failed to call wp_available_to_receive:', err);
        return this.fallbackAvailableToReceive();
      }
    }
    return this.fallbackAvailableToReceive();
  }

  public async wpLogFinishing(pToken: string, pStageId: string, pQtyOk: number, pNote?: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('wp_log_finishing', {
          p_token: pToken,
          p_stage_id: pStageId,
          p_qty_ok: pQtyOk,
          p_note: pNote || null,
        });
        if (error) {
          // If RPC doesn't support p_note, fallback to calling without p_note
          const { error: retryError } = await supabase.rpc('wp_log_finishing', {
            p_token: pToken,
            p_stage_id: pStageId,
            p_qty_ok: pQtyOk,
          });
          if (retryError) {
            console.error('RPC wp_log_finishing error:', retryError);
            throw new Error(retryError.message || 'Failed to log finishing entry via worker RPC');
          }
        }
        return true;
      } catch (err: any) {
        console.error('Failed to invoke wp_log_finishing:', err);
        throw err;
      }
    }
    return true;
  }

  private async fallbackAvailableToReceive(): Promise<AvailableToReceiveRow[]> {
    const styles = await this.getStyles();
    const activeStyles = styles.filter(s => !s.status || s.status.toLowerCase() === 'active');
    const processes = await this.getProcesses();
    const prodEntries = await this.getProductionEntries();
    const finishingStages = await this.getFinishingStages();
    const finishingEntries = await this.getFinishingEntries();

    const rows: AvailableToReceiveRow[] = [];

    for (const style of activeStyles) {
      const styleStages = finishingStages.filter(st => st.style_id === style.id);
      let receivedStage = styleStages.find(st => (st.code || '').toLowerCase() === 'received' || st.seq_no === 1);
      if (!receivedStage && styleStages.length > 0) {
        receivedStage = styleStages[0];
      }
      const receivedStageId = receivedStage ? receivedStage.id : `received-${style.id}`;

      const garmentsSewn = await this.getGarmentsSewn(style.id);

      const alreadyReceived = finishingEntries
        .filter(f => f.style_id === style.id && f.stage_id === receivedStageId)
        .reduce((sum, f) => sum + (Number(f.qty_ok) || 0), 0);

      const available = Math.max(0, garmentsSewn - alreadyReceived);

      rows.push({
        style_id: style.id,
        style_code: style.style_code,
        style_name: style.name,
        received_stage_id: receivedStageId,
        garments_sewn: garmentsSewn,
        already_received: alreadyReceived,
        available: available,
      });
    }

    return rows;
  }

  // --- REPORTING, EDIT & DELETE FOR OUTPUT ENTRIES (ADMIN ONLY) ---
  public async getFinishingEntriesReport(styleId: string, date?: string): Promise<any[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpt_finishing_entries', {
          p_style_id: styleId,
          p_date: date || null,
        });
        if (!error && data) {
          const workers = await this.getWorkers();
          const workerMap = new Map(workers.map(w => [w.id, w]));
          const stages = await this.getFinishingStages();
          const stageMap = new Map(stages.map(s => [s.id, s]));

          return data.map((e: any) => ({
            ...e,
            id: e.id || e.entry_id,
            entry_date: e.entry_date || e.date,
            stage_id: e.stage_id,
            stage_name: e.stage_name || (e.stage_id ? stageMap.get(e.stage_id)?.name : null) || 'Finishing Stage',
            worker_id: e.worker_id,
            worker_name: e.worker_name || (e.worker_id ? workerMap.get(e.worker_id)?.full_name : null) || 'Worker',
            qty_ok: e.qty_ok ?? e.qty ?? 0,
            qty_rework: e.qty_rework ?? 0,
            qty_reject: e.qty_reject ?? 0,
            note: e.note || null,
            created_at: e.created_at || e.entry_date,
          }));
        }
      } catch (e) {
        console.warn('rpt_finishing_entries RPC failed, falling back to table query:', e);
      }
    }

    return this.getFinishingEntries({ styleId, date });
  }

  public async getCuttingEntriesReport(styleId: string): Promise<any[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('cutting_entries')
          .select('*')
          .eq('style_id', styleId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          const workers = await this.getWorkers();
          const workerMap = new Map(workers.map(w => [w.id, w]));

          return data.map((e: any) => ({
            ...e,
            worker_name: e.worker_id ? workerMap.get(e.worker_id)?.full_name || 'Worker' : 'N/A',
          }));
        }
      } catch (e) {
        console.warn('Error fetching cutting entries:', e);
      }
    }

    const workers = await this.getWorkers();
    const workerMap = new Map(workers.map(w => [w.id, w]));
    const list = this.cuttingEntries.filter(e => e.style_id === styleId);
    return list.map(e => ({
      ...e,
      worker_name: e.worker_id ? workerMap.get(e.worker_id)?.full_name || 'Worker' : 'N/A',
    }));
  }

  public async getProductionEntriesReport(styleId: string): Promise<any[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('production_entries')
          .select('*')
          .eq('style_id', styleId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          const workers = await this.getWorkers();
          const processes = await this.getProcesses();
          const workerMap = new Map(workers.map(w => [w.id, w]));
          const processMap = new Map(processes.map(p => [p.id, p]));

          return data.map((e: any) => ({
            ...e,
            worker_name: e.worker_id ? workerMap.get(e.worker_id)?.full_name || 'Worker' : 'N/A',
            process_name: e.process_id ? processMap.get(e.process_id)?.name || 'Operation' : 'N/A',
          }));
        }
      } catch (e) {
        console.warn('Error fetching production entries:', e);
      }
    }

    const workers = await this.getWorkers();
    const processes = await this.getProcesses();
    const workerMap = new Map(workers.map(w => [w.id, w]));
    const processMap = new Map(processes.map(p => [p.id, p]));

    const list = this.productionEntries.filter(e => e.style_id === styleId);
    return list.map(e => ({
      ...e,
      worker_name: e.worker_id ? workerMap.get(e.worker_id)?.full_name || 'Worker' : 'N/A',
      process_name: e.process_id ? processMap.get(e.process_id)?.name || 'Operation' : 'N/A',
    }));
  }

  public async updateProductionEntry(id: string, updates: Partial<ProductionEntry>, entryDate?: string): Promise<void> {
    const dateToCheck = entryDate || updates.entry_date;
    if (dateToCheck && this.isPeriodLocked(dateToCheck)) {
      const err = new Error('This entry is in a locked payroll period and cannot be changed. Unlock the period first.');
      showErrorToast(err.message);
      throw err;
    }

    // CRITICAL: For production_entries, do NOT touch rate_snapshot or amount.
    // The database trigger recalculates them from qty_ok automatically!
    const payload: Record<string, any> = {};
    if (updates.qty_ok !== undefined) payload.qty_ok = Number(updates.qty_ok);
    if (updates.qty_rework !== undefined) payload.qty_rework = Number(updates.qty_rework);
    if (updates.qty_reject !== undefined) payload.qty_reject = Number(updates.qty_reject);
    if (updates.shift !== undefined) payload.shift = updates.shift;
    if (updates.note !== undefined) payload.note = updates.note;
    if (updates.worker_id !== undefined) payload.worker_id = updates.worker_id;

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('production_entries').update(payload).eq('id', id);
      if (error) {
        console.error('Error updating production_entries:', error);
        const formatted = formatLockedPeriodError(error);
        showErrorToast(formatted.message);
        throw formatted;
      }
    }

    const idx = this.productionEntries.findIndex(e => e.id === id);
    if (idx >= 0) {
      this.productionEntries[idx] = { ...this.productionEntries[idx], ...payload };
    }
  }

  public async deleteProductionEntry(id: string, entryDate?: string): Promise<void> {
    if (entryDate && this.isPeriodLocked(entryDate)) {
      const err = new Error('This entry is in a locked payroll period and cannot be changed. Unlock the period first.');
      showErrorToast(err.message);
      throw err;
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('production_entries').delete().eq('id', id);
      if (error) {
        console.error('Error deleting production_entries:', error);
        const formatted = formatLockedPeriodError(error);
        showErrorToast(formatted.message);
        throw formatted;
      }
    }

    this.productionEntries = this.productionEntries.filter(e => e.id !== id);
  }

  public async updateFinishingEntry(id: string, updates: Partial<FinishingEntry>, entryDate?: string): Promise<void> {
    const dateToCheck = entryDate || updates.entry_date;
    if (dateToCheck && this.isPeriodLocked(dateToCheck)) {
      const err = new Error('This entry is in a locked payroll period and cannot be changed. Unlock the period first.');
      showErrorToast(err.message);
      throw err;
    }

    const payload: Record<string, any> = {};
    if (updates.qty_ok !== undefined) payload.qty_ok = Number(updates.qty_ok);
    if (updates.qty_rework !== undefined) payload.qty_rework = Number(updates.qty_rework);
    if (updates.qty_reject !== undefined) payload.qty_reject = Number(updates.qty_reject);
    if (updates.note !== undefined) payload.note = updates.note;
    if (updates.shift !== undefined) payload.shift = updates.shift;
    if (updates.size !== undefined) payload.size = updates.size;

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('finishing_entries').update(payload).eq('id', id);
      if (error) {
        console.error('Error updating finishing_entries:', error);
        const formatted = formatLockedPeriodError(error);
        showErrorToast(formatted.message);
        throw formatted;
      }
    }

    const idx = this.finishingEntries.findIndex(e => e.id === id);
    if (idx >= 0) {
      this.finishingEntries[idx] = { ...this.finishingEntries[idx], ...payload };
    }
  }

  public async deleteFinishingEntry(id: string, entryDate?: string): Promise<void> {
    if (entryDate && this.isPeriodLocked(entryDate)) {
      const err = new Error('This entry is in a locked payroll period and cannot be changed. Unlock the period first.');
      showErrorToast(err.message);
      throw err;
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('finishing_entries').delete().eq('id', id);
      if (error) {
        console.error('Error deleting finishing_entries:', error);
        const formatted = formatLockedPeriodError(error);
        showErrorToast(formatted.message);
        throw formatted;
      }
    }

    this.finishingEntries = this.finishingEntries.filter(e => e.id !== id);
  }

  public async updateCuttingEntry(id: string, updates: Partial<CuttingEntry>, entryDate?: string): Promise<void> {
    const dateToCheck = entryDate || updates.entry_date;
    if (dateToCheck && this.isPeriodLocked(dateToCheck)) {
      const err = new Error('This entry is in a locked payroll period and cannot be changed. Unlock the period first.');
      showErrorToast(err.message);
      throw err;
    }

    const payload: Record<string, any> = {};
    if (updates.pieces_cut !== undefined) payload.pieces_cut = Number(updates.pieces_cut);
    if (updates.size !== undefined) payload.size = updates.size;
    if (updates.tables_layers !== undefined) payload.tables_layers = updates.tables_layers;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.worker_id !== undefined) payload.worker_id = updates.worker_id;


    if (isSupabaseConfigured) {
      const { error } = await supabase.from('cutting_entries').update(payload).eq('id', id);
      if (error) {
        console.error('Error updating cutting_entries:', error);
        const formatted = formatLockedPeriodError(error);
        showErrorToast(formatted.message);
        throw formatted;
      }
    }

    const idx = this.cuttingEntries.findIndex(e => e.id === id);
    if (idx >= 0) {
      this.cuttingEntries[idx] = { ...this.cuttingEntries[idx], ...payload };
    }
  }

  public async deleteCuttingEntry(id: string, entryDate?: string): Promise<void> {
    if (entryDate && this.isPeriodLocked(entryDate)) {
      const err = new Error('This entry is in a locked payroll period and cannot be changed. Unlock the period first.');
      showErrorToast(err.message);
      throw err;
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('cutting_entries').delete().eq('id', id);
      if (error) {
        console.error('Error deleting cutting_entries:', error);
        const formatted = formatLockedPeriodError(error);
        showErrorToast(formatted.message);
        throw formatted;
      }
    }

    this.cuttingEntries = this.cuttingEntries.filter(e => e.id !== id);
  }

  public async getAuditLogs(filters?: { tableName?: string; fromDate?: string; toDate?: string }): Promise<EntryAudit[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('entry_audit').select('*').order('created_at', { ascending: false });
        if (filters?.tableName && filters.tableName !== 'all') {
          query = query.eq('table_name', filters.tableName);
        }
        if (filters?.fromDate) {
          query = query.gte('created_at', filters.fromDate);
        }
        if (filters?.toDate) {
          query = query.lte('created_at', filters.toDate + 'T23:59:59');
        }

        const { data, error } = await query;
        if (!error && data) {
          return data as EntryAudit[];
        }
      } catch (err) {
        console.warn('Error fetching entry_audit from Supabase:', err);
      }
    }

    let logs: EntryAudit[] = [
      {
        id: 'aud-1',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        table_name: 'production_entries',
        action: 'UPDATE',
        user_email: 'admin@factory.com',
        changed_by: 'Admin User',
        summary: 'qty_ok: 275 → 150',
        old_data: { qty_ok: 275 },
        new_data: { qty_ok: 150 },
      },
      {
        id: 'aud-2',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        table_name: 'finishing_entries',
        action: 'INSERT',
        user_email: 'admin@factory.com',
        changed_by: 'Admin User',
        summary: 'qty_ok: 120 at Ready to Deliver',
        old_data: null,
        new_data: { qty_ok: 120 },
      },
      {
        id: 'aud-3',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        table_name: 'cutting_entries',
        action: 'DELETE',
        user_email: 'admin@factory.com',
        changed_by: 'Admin User',
        summary: 'Deleted 200 pcs (Size M, Navy)',
        old_data: { qty_cut: 200, size: 'M' },
        new_data: null,
      }
    ];

    if (filters?.tableName && filters.tableName !== 'all') {
      logs = logs.filter(l => l.table_name === filters.tableName);
    }
    if (filters?.fromDate) {
      logs = logs.filter(l => l.created_at.substring(0, 10) >= filters.fromDate!);
    }
    if (filters?.toDate) {
      logs = logs.filter(l => l.created_at.substring(0, 10) <= filters.toDate!);
    }
    return logs;
  }
}


export const dataService = new DataService();
