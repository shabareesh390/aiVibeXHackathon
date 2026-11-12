-- ==============================================================================
-- SMART CANTEEN PRE-ORDER & QUEUE PLATFORM (DEQUEUE) - SUPABASE SCHEMA
-- Run this script in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. CANTEEN CONFIGURATION
create table if not exists public.canteen_config (
  id text primary key default 'default',
  slot_interval_min integer not null default 15,
  max_orders_per_slot integer not null default 15,
  opening_hour integer not null default 8,
  closing_hour integer not null default 21,
  walk_in_reserve integer not null default 2,
  blocked_slots jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed default config if empty
insert into public.canteen_config (id, slot_interval_min, max_orders_per_slot, opening_hour, closing_hour, walk_in_reserve)
values ('default', 15, 15, 8, 21, 2)
on conflict (id) do nothing;

-- 2. MENU ITEMS
create table if not exists public.menu_items (
  id text primary key,
  name text not null,
  price numeric not null,
  available boolean not null default true,
  category text not null,
  station text not null check (station in ('tawa', 'fryer', 'beverage', 'packing')),
  duration_min integer not null default 5,
  batch_size integer not null default 4,
  aliases text[] not null default '{}',
  family text,
  modifiers text[] not null default '{}',
  description text,
  image_url text,
  in_stock boolean not null default true,
  stock_count integer not null default 50,
  created_at timestamptz not null default now()
);

-- Seed initial menu items
insert into public.menu_items (id, name, price, available, category, station, duration_min, batch_size, aliases, family, modifiers, in_stock, stock_count)
values
  ('masala-dosa', 'Masala Dosa', 65, true, 'Dosa & Tiffin', 'tawa', 4, 3, array['masala dosa', 'dosa', 'masala dosai'], 'dosa', array['extra ghee', 'less oil', 'no onion'], true, 50),
  ('plain-dosa', 'Plain Dosa', 45, true, 'Dosa & Tiffin', 'tawa', 3, 3, array['plain dosa', 'sada dosa'], 'dosa', array['extra ghee', 'crispy'], true, 50),
  ('cheese-dosa', 'Cheese Dosa', 85, true, 'Dosa & Tiffin', 'tawa', 5, 2, array['cheese dosa', 'cheese roll dosa'], 'dosa', array['extra cheese'], true, 30),
  ('idli-vada', 'Idli Vada Combo', 50, true, 'Dosa & Tiffin', 'packing', 2, 6, array['idli', 'idlis', 'idly', 'vada', 'idli vada'], null, array['sambar dip', 'extra chutney'], true, 60),
  ('filter-coffee', 'South Indian Filter Coffee', 25, true, 'Beverages', 'beverage', 2, 8, array['filter coffee', 'coffee', 'kaapi'], null, array['strong', 'less sugar'], true, 100),
  ('tea', 'Masala Chai', 20, true, 'Beverages', 'beverage', 2, 10, array['tea', 'chai', 'masala tea'], null, array['less sugar', 'ginger extra'], true, 100),
  ('chicken-biryani', 'Chicken Dum Biryani', 160, true, 'Rice & Noodles', 'packing', 4, 8, array['chicken biryani', 'biryani', 'chicken rice'], null, array['extra raita'], true, 40),
  ('orange-juice', 'Fresh Orange Juice', 60, true, 'Beverages', 'beverage', 3, 4, array['orange juice', 'juice', 'fresh juice'], 'juice', array['no ice', 'less sugar'], true, 40),
  ('veg-sandwich', 'Veg Grilled Sandwich', 70, true, 'Snacks', 'tawa', 4, 4, array['sandwich', 'veg sandwich', 'grilled sandwich'], 'sandwich', array['extra cheese', 'grilled crispy'], true, 45)
on conflict (id) do nothing;

-- 3. ORDERS
create table if not exists public.orders (
  id text primary key,
  number integer not null,
  student_name text not null,
  items jsonb not null,
  total numeric not null,
  slot_time bigint not null,
  status text not null check (status in ('placed', 'scheduled', 'cooking', 'ready', 'collected', 'cancelled')),
  payment text not null check (payment in ('upi', 'counter')),
  instructions text,
  estimated_prep_min integer default 5,
  shelf integer,
  ready_at bigint,
  collected_at bigint,
  cancel_reason text,
  created_at timestamptz not null default now()
);

-- Index for real-time order queries
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_slot on public.orders (slot_time);

-- 4. STAFF ROSTER
create table if not exists public.staff (
  id text primary key,
  name text not null,
  role text not null check (role in ('head_chef', 'station_cook', 'packer')),
  station text check (station in ('tawa', 'fryer', 'beverage', 'packing')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.staff (id, name, role, station, active)
values
  ('staff-1', 'Ramesh Kumar', 'head_chef', 'tawa', true),
  ('staff-2', 'Priya Sharma', 'station_cook', 'beverage', true),
  ('staff-3', 'Anand Verma', 'packer', 'packing', true)
on conflict (id) do nothing;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
alter table public.canteen_config enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.staff enable row level security;

-- Allow public read/write access for demo (or restrict to auth users as needed)
create policy "Allow public read on canteen_config" on public.canteen_config for select using (true);
create policy "Allow public update on canteen_config" on public.canteen_config for all using (true);

create policy "Allow public read on menu_items" on public.menu_items for select using (true);
create policy "Allow public manage on menu_items" on public.menu_items for all using (true);

create policy "Allow public read on orders" on public.orders for select using (true);
create policy "Allow public insert on orders" on public.orders for insert with check (true);
create policy "Allow public update on orders" on public.orders for update using (true);

create policy "Allow public read on staff" on public.staff for select using (true);
create policy "Allow public manage on staff" on public.staff for all using (true);

-- Enable Supabase Realtime for live order status updates
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.menu_items;
