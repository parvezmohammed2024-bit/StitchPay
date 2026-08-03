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
  target_ship_date: string | null;
  start_date?: string | null;
  status: 'upcoming' | 'active' | 'completed' | 'archived';
  completed_at?: string | null;
  notes: string | null;
  created_at?: string;
  // Computed
  completed_pieces?: number;
  delivered_pieces?: number;
  remaining_pieces?: number;
  total_labour_cost?: number;
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
  tables_layers?: string | null;
  worker_id?: string | null;
  notes?: string | null;
  created_at?: string;
  // Joined / computed for UI
  style_code?: string;
  style_name?: string;
  worker_name?: string;
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
