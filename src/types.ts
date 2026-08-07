export type UserRole = 'admin' | 'supervisor' | 'accounts' | 'worker';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  status: 'active' | 'inactive';
  created_at?: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
}

export interface UserAccount {
  id: string;
  email_or_phone: string;
  password?: string;
  full_name: string;
  role: UserRole;
  worker_id?: string | null; // linked worker profile ID if role is worker
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Worker {
  id: string;
  worker_code: string;
  full_name: string;
  phone: string | null;
  email?: string | null;
  photo_url: string | null;
  section: string | null;
  line_no: string | null;
  joined_at: string | null;
  payment_method: 'cash' | 'bank' | 'mobile_wallet';
  payment_details: Record<string, any>;
  status: 'active' | 'inactive';
  pin_hash?: string | null;
  pay_type?: 'piece_rate' | 'monthly_salary';
  monthly_salary?: number;
  created_at?: string;
  // Computed / UI helper fields
  outstanding_advance?: number;
}

export interface GarmentStyle {
  id: string;
  style_code: string;
  name: string;
  buyer_name: string | null;
  image_url: string | null;
  order_qty: number;
  selling_price?: number | null;
  target_ship_date: string | null;
  start_date?: string | null;
  status: 'upcoming' | 'active' | 'completed' | 'delivered' | 'archived';
  completed_at?: string | null;
  notes: string | null;
  requires_cutting?: boolean;
  wage_model?: 'individual' | 'team';
  created_at?: string;
  // Computed
  completed_pieces?: number;
  delivered_pieces?: number;
  remaining_pieces?: number;
  total_labour_cost?: number;
}

export interface StyleFinancialRecord {
  style_id?: string;
  style_code?: string;
  style_name?: string;
  style?: string;
  buyer?: string | null;
  buyer_name?: string | null;
  order_qty: number;
  price?: number;
  selling_price?: number | null;
  garments_sewn: number;
  received_in_finishing?: number;
  ready_to_deliver: number;
  production_value: number;
  deliverable_value: number;
  labour_cost: number;
  gross_margin: number;
  margin_pct: number;
}

export interface StylePipelineRow {
  style_id?: string;
  style_code: string;
  style_name?: string;
  buyer_name?: string;
  image_url?: string | null;
  order_qty: number;
  requires_cutting?: boolean;
  qty_cut: number;
  qty_sewn: number;
  qty_in_finishing: number;
  qty_ready: number;
  pct_cut: number;
  pct_sewn: number;
  pct_finishing: number;
  pct_ready: number;
  bottleneck?: string | null;
}

export interface MgmtValueTodayRecord {
  production_value_today: number;
  deliverable_value_today: number;
  labour_cost_today: number;
  net_today: number;
}

export interface MgmtOrderOverviewRecord {
  style_id?: string;
  style_code: string;
  style_name?: string;
  buyer: string;
  order_qty: number;
  garments_sewn: number;
  target_ship_date?: string;
  days_to_ship?: number;
  status?: string;
}

export interface MgmtUserRecord {
  token: string;
  name: string;
  phone?: string;
}

export interface TodaySectionRow {
  section: string;
  style_code: string;
  style_name?: string;
  qty: number;
  detail?: string | null;
}

export interface FactorySummary {
  cut_pending: number;
  cut_today: number;
  sew_pending: number;
  sewn_today: number;
  fin_wip: number;
  fin_today: number;
  fin_ready: number;
  dispatched: number;
  workers_present: number;
  workers_total: number;
  styles_at_risk: number;
}

export interface FactoryStatusRow {
  style_id?: string;
  style_code: string;
  style_name?: string;
  buyer?: string | null;
  order_qty: number;
  requires_cutting?: boolean;
  days_to_ship: number;
  balance: number;
  status?: string;
  cut_total: number;
  cut_pending: number;
  sewn_total: number;
  sewn_today: number;
  fin_ready: number;
  fin_received: number;
  fin_wip: number;
  dispatched: number;
  pct_complete: number;
  bottleneck_stage?: string | null;
  bottleneck_qty?: number;
  sew_pending?: number;
}

export interface GarmentProcess {
  id: string;
  style_id: string;
  seq_no: number;
  name: string;
  machine_type: string | null;
  smv: number | null;
  rate: number;
  is_active: boolean;
  created_at?: string;
}

export interface ProcessRateHistory {
  id: string;
  process_id: string;
  old_rate: number | null;
  new_rate: number;
  effective_from: string;
  changed_by: string | null;
  reason: string | null;
}

export interface ProductionEntry {
  id: string;
  assignment_id?: string | null;
  entry_date: string;
  worker_id: string;
  style_id: string;
  process_id: string;
  qty_ok: number;
  qty_rework: number;
  qty_reject: number;
  rate_snapshot: number;
  amount: number;
  shift: 'day' | 'night';
  entered_by?: string | null;
  note?: string | null;
  created_at?: string;
  // Joined fields for UI
  worker_name?: string;
  worker_code?: string;
  worker_photo?: string;
  style_name?: string;
  process_name?: string;
}

export interface DailyAssignment {
  id: string;
  work_date: string;
  style_id: string;
  process_id: string;
  worker_id: string;
  target_qty: number | null;
  agreed_rate: number;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  assigned_by?: string | null;
  note?: string | null;
  created_at?: string;
  // Joined fields for UI
  worker_name?: string;
  worker_code?: string;
  worker_photo?: string;
  style_name?: string;
  style_code?: string;
  process_name?: string;
  standard_rate?: number;
}

export interface RateBid {
  id: string;
  process_id: string;
  worker_id: string;
  current_rate: number;
  proposed_rate: number;
  counter_rate: number | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'countered' | 'withdrawn';
  submitted_at?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  // Joined fields for UI
  worker_name?: string;
  worker_code?: string;
  worker_photo?: string;
  process_name?: string;
  style_code?: string;
  style_name?: string;
}

export interface AttendanceRecord {
  id: string;
  worker_id: string;
  date: string;
  status: 'present' | 'absent' | 'half_day' | 'leave' | 'holiday';
  in_time?: string | null;
  out_time?: string | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  is_on_break?: boolean;
  ot_hours: number;
  created_at?: string;
}

export interface FinishingStage {
  id: string;
  style_id: string;
  seq_no: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at?: string;
}

export interface FinishingEntry {
  id: string;
  entry_date: string;
  style_id: string;
  stage_id: string;
  worker_id?: string | null;
  qty_ok: number;
  qty_rework: number;
  qty_reject: number;
  shift: 'day' | 'night';
  entered_by?: string | null;
  note?: string | null;
  size?: string | null;
  created_at?: string;
  // Joined fields for UI
  worker_name?: string;
  worker_code?: string;
  stage_name?: string;
  stage_code?: string;
  style_code?: string;
  style_name?: string;
}

export interface DeliveryReport {
  id: string;
  delivery_date: string;
  style_id: string;
  delivered_qty: number;
  vehicle_no: string | null;
  driver_name: string | null;
  destination: string | null;
  notes: string | null;
  created_at?: string;
  // Joined fields for UI
  style_code?: string;
  style_name?: string;
  buyer_name?: string;
}

export interface Adjustment {
  id: string;
  worker_id: string;
  period_id?: string | null;
  date: string;
  type: 'advance' | 'advance_repay' | 'fine' | 'bonus' | 'overtime' | 'allowance' | 'other';
  amount: number;
  note?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface PayrollPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'locked' | 'paid';
  locked_at?: string | null;
  locked_by?: string | null;
  created_at?: string;
}

export interface PayrollLine {
  id: string;
  period_id: string;
  worker_id: string;
  pieces_total: number;
  piece_earnings: number;
  ot_amount: number;
  bonus_amount: number;
  allowance_amount: number;
  deductions: number;
  minimum_wage_topup: number;
  net_payable: number;
  paid_at?: string | null;
  payment_reference?: string | null;
  created_at?: string;
  // Joined fields for UI
  worker?: Worker;
}

export type CutType = 'bulk' | 'sample';

export interface CuttingEntry {
  id: string;
  entry_date: string;
  style_id: string;
  cut_type: CutType;
  pieces_cut: number;
  size?: string | null;
  tables_layers?: string | null;
  worker_id?: string | null;
  notes?: string | null;
  created_at?: string;
  // Joined / computed for UI
  style_code?: string;
  style_name?: string;
  worker_name?: string;
}

export interface StyleSize {
  id?: string;
  style_id: string;
  size: string;
  seq_no: number;
  order_qty: number;
}

export interface StyleSizeBreakdownRow {
  size: string;
  seq_no?: number;
  order_qty: number;
  cut_qty: number;
  ready_qty: number;
  cut_balance: number;
  ready_balance: number;
}

export type SampleType = 'Proto' | 'Fit' | 'Size Set' | 'PP' | 'Photo' | 'Salesman' | 'TOP' | 'Counter';
export type SampleStatus = 'Pending' | 'Cutting' | 'Sewing' | 'Submitted' | 'Approved' | 'Rejected' | 'Revision';

export interface GarmentSample {
  id: string;
  style_id: string;
  sample_type: SampleType;
  status: SampleStatus;
  qty: number;
  size?: string | null;
  colour?: string | null;
  requested_date: string;
  submitted_date?: string | null;
  buyer_feedback?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  created_at?: string;
  // Joined / computed for UI
  style_code?: string;
  style_name?: string;
  buyer_name?: string;
}

export interface FactorySettings {
  id: string;
  factory_name: string;
  logo_url: string | null;
  currency_code: string;
  currency_symbol: string;
  pay_cycle: 'weekly' | 'biweekly' | 'monthly';
  week_start_day: string;
  rework_pay_percent: number;
  reject_pay_percent: number;
  minimum_wage_per_day: number;
  enable_minimum_wage_topup: boolean;
}

export interface AvailableToReceiveRow {
  style_id: string;
  style_code: string;
  style_name?: string;
  received_stage_id: string;
  garments_sewn: number;
  already_received: number;
  available: number;
}

export interface StyleDailyOutput {
  id?: string;
  output_date: string;
  style_id: string;
  qty: number;
  auto_receive: boolean;
  note?: string | null;
  created_at?: string;
}

export interface WorkerNotification {
  id: string;
  title: string;
  body: string;
  type?: string | null;
  style_id?: string | null;
  style_code?: string | null;
  worker_id?: string | null;
  section?: string | null;
  created_at: string;
  is_read: boolean;
}

export interface EntryAudit {
  id: string;
  created_at: string;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  user_email?: string | null;
  changed_by?: string | null;
  summary?: string | null;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  record_id?: string | null;
}

export interface ProductionTeam {
  id: string;
  name: string;
  style_id?: string | null;
  created_at?: string;
  // Joined/UI helper fields
  members?: ProductionTeamMember[];
  member_count?: number;
  style_code?: string;
  style_name?: string;
}

export interface ProductionTeamMember {
  id: string;
  team_id: string;
  worker_id: string;
  share_percent?: number | null;
  created_at?: string;
  // Joined/UI helper fields
  worker_name?: string;
  worker_code?: string;
  worker_photo?: string;
}

