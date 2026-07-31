-- ========================================================
-- Migration 04: Initial Seed Data
-- Paste this file into the Supabase SQL Editor
-- ========================================================

-- 1. SETTINGS SEED
INSERT INTO public.settings (id, factory_name, logo_url, currency_code, currency_symbol, pay_cycle, week_start_day, rework_pay_percent, reject_pay_percent, minimum_wage_per_day, enable_minimum_wage_topup)
VALUES ('stg-1', 'StitchPay Garments Ltd.', 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=150&auto=format&fit=crop&q=80', 'BDT', '৳', 'monthly', 'saturday', 10, 0, 350, true)
ON CONFLICT (id) DO UPDATE SET factory_name = EXCLUDED.factory_name;

-- 2. WORKERS SEED
INSERT INTO public.workers (id, worker_code, full_name, phone, photo_url, section, line_no, joined_at, payment_method, payment_details, status) VALUES
('b1111111-1111-1111-1111-111111111101', 'W-101', 'Rahim Uddin', '+8801711001122', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-01', '2025-08-01', 'mobile_wallet', '{"provider": "bKash", "account": "01711001122"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111102', 'W-102', 'Fatema Begum', '+8801811001123', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-01', '2025-11-15', 'cash', '{}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111103', 'W-103', 'Abdul Karim', '+8801911001124', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-01', '2025-03-10', 'bank', '{"bank_name": "DBBL", "account": "110.120.3456"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111104', 'W-104', 'Nusrat Jahan', '+8801611001125', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-02', '2025-12-01', 'mobile_wallet', '{"provider": "Nagad", "account": "01611001125"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111105', 'W-105', 'Tariqul Islam', '+8801511001126', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-02', '2024-10-01', 'cash', '{}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111106', 'W-106', 'Salma Akhter', '+8801711001127', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', 'Sewing', 'Line-02', '2026-02-01', 'mobile_wallet', '{"provider": "bKash", "account": "01711001127"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111107', 'W-107', 'Kamal Hossain', '+8801811001128', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80', 'Finishing', 'Line-03', '2025-06-01', 'cash', '{}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111108', 'W-108', 'Rashida Parvin', '+8801911001129', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', 'Finishing', 'Line-03', '2026-01-15', 'mobile_wallet', '{"provider": "bKash", "account": "01911001129"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111109', 'W-109', 'Jahangir Alam', '+8801611001130', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80', 'Cutting', 'Line-04', '2024-05-20', 'bank', '{"bank_name": "Islami Bank", "account": "205011"}'::jsonb, 'active'),
('b1111111-1111-1111-1111-111111111110', 'W-110', 'Momena Khatun', '+8801511001131', 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80', 'Cutting', 'Line-04', '2026-03-01', 'cash', '{}'::jsonb, 'active')
ON CONFLICT (worker_code) DO NOTHING;

-- 3. STYLES SEED
INSERT INTO public.styles (id, style_code, name, buyer_name, image_url, order_qty, target_ship_date, status, notes) VALUES
('a1111111-1111-1111-1111-111111111111', 'MS-2401', 'Men''s Formal Shirt', 'Apex Garments Global', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80', 25000, '2026-08-30', 'active', '100% Cotton 80s 2-ply pinpoint oxford fabric'),
('a2222222-2222-2222-2222-222222222222', 'JK-1090', 'Denim Utility Jacket', 'Nordic Outfitters', 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&auto=format&fit=crop&q=80', 12000, '2026-09-15', 'active', '12oz Heavyweight Indigo Ring Denim')
ON CONFLICT (style_code) DO NOTHING;

-- 4. PROCESSES SEED
INSERT INTO public.processes (id, style_id, seq_no, name, machine_type, smv, rate, is_active) VALUES
('c1111111-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 1, 'Collar Make & Topstitch', 'Single Needle Lockstitch', 1.8, 4.50, true),
('c1111111-0000-0000-0000-000000000002', 'a1111111-1111-1111-1111-111111111111', 2, 'Cuff Preparation & Fuse', 'Automated Fusing Press', 1.2, 3.20, true),
('c1111111-0000-0000-0000-000000000003', 'a1111111-1111-1111-1111-111111111111', 3, 'Front Placket Attach', 'Twin Needle Folder', 2.1, 5.00, true),
('c1111111-0000-0000-0000-000000000004', 'a1111111-1111-1111-1111-111111111111', 4, 'Pocket Attach', 'Pattern Sewer Auto', 1.5, 4.00, true),
('c1111111-0000-0000-0000-000000000005', 'a1111111-1111-1111-1111-111111111111', 5, 'Shoulder Seam Join', '4-Thread Overlock', 1.1, 2.80, true),
('c1111111-0000-0000-0000-000000000006', 'a1111111-1111-1111-1111-111111111111', 6, 'Collar Attach to Neck', 'Single Needle Lockstitch', 2.4, 6.00, true),
('c1111111-0000-0000-0000-000000000007', 'a1111111-1111-1111-1111-111111111111', 7, 'Sleeve Set & Overlock', '4-Thread Overlock', 2.2, 5.50, true),
('c1111111-0000-0000-0000-000000000008', 'a1111111-1111-1111-1111-111111111111', 8, 'Side Seam & Gusset', 'Feed off the Arm', 2.0, 5.20, true),
('c1111111-0000-0000-0000-000000000009', 'a1111111-1111-1111-1111-111111111111', 9, 'Cuff Attach to Sleeve', 'Single Needle Lockstitch', 1.9, 4.80, true),
('c1111111-0000-0000-0000-000000000010', 'a1111111-1111-1111-1111-111111111111', 10, 'Bottom Hemming', 'Single Needle Folder', 1.3, 3.00, true),
('c1111111-0000-0000-0000-000000000011', 'a1111111-1111-1111-1111-111111111111', 11, 'Buttonhole Auto', 'Automatic Buttonhole', 0.9, 2.20, true),
('c1111111-0000-0000-0000-000000000012', 'a1111111-1111-1111-1111-111111111111', 12, 'Button Attach & QC', 'Automatic Button Attacher', 1.0, 2.50, true)
ON CONFLICT (id) DO NOTHING;

-- 5. PAYROLL PERIOD SEED
INSERT INTO public.payroll_periods (id, name, start_date, end_date, status) VALUES
('c1111111-1111-1111-1111-111111111111', 'July 2026 Monthly Payroll', '2026-07-01', '2026-07-31', 'open')
ON CONFLICT (id) DO NOTHING;

-- Run calculation procedure on seeded data
SELECT public.calculate_payroll('c1111111-1111-1111-1111-111111111111');
