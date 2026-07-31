export type UserRole = 'admin' | 'supervisor' | 'accounts';

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

export interface Worker {
  id: string;
  worker_code: string;
  full_name: string;
  phone: string | null;
  photo_url: string | null;
  section: string | null;
  line_no: string | null;
  joined_at: string | null;
  payment_method: 'cash' | 'bank' | 'mobile_wallet';
  payment_details: Record<string, any>;
  status: 'active' | 'inactive';
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
  status: 'active' | 'completed' | 'archived';
  notes: string | null;
  created_at?: string;
  // Computed
  completed_pieces?: number;
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

export interface AttendanceRecord {
  id: string;
  worker_id: string;
  date: string;
  status: 'present' | 'absent' | 'half_day' | 'leave' | 'holiday';
  in_time?: string | null;
  out_time?: string | null;
  ot_hours: number;
  created_at?: string;
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
