-- BellaOS - esquema base para Supabase/PostgreSQL
-- Execute no SQL Editor do Supabase antes de ligar o frontend ao backend real.

create extension if not exists "uuid-ossp";

create table if not exists salons (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  logo_url text,
  whatsapp text,
  address text,
  opening_start time default '09:00',
  opening_end time default '19:00',
  min_advance_minutes integer default 120,
  buffer_minutes integer default 10,
  allow_same_day boolean default true,
  allow_any_professional boolean default true,
  show_prices boolean default true,
  booking_enabled boolean default true,
  color text default '#C89B7B',
  status text default 'ativo' check (status in ('ativo','teste','bloqueado','cancelado','inadimplente')),
  plan text default 'Essencial',
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key,
  salon_id uuid references salons(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'owner' check (role in ('super_admin','owner','reception','professional')),
  must_change_password boolean default true,
  is_demo boolean default false,
  created_at timestamptz default now()
);

create table if not exists service_categories (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  name text not null,
  category text,
  unit text default 'un',
  qty numeric default 0,
  min_qty numeric default 0,
  cost numeric default 0,
  supplier text,
  created_at timestamptz default now()
);

create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  category_id uuid references service_categories(id) on delete set null,
  name text not null,
  price numeric not null default 0,
  duration_minutes integer not null default 30,
  min_advance_minutes integer default 0,
  buffer_minutes integer default 0,
  description text,
  active boolean default true,
  commission_type text default 'percent' check (commission_type in ('percent','fixed','none')),
  commission_value numeric default 0,
  created_at timestamptz default now()
);

create table if not exists service_products (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  service_id uuid references services(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  qty numeric not null default 1
);

create table if not exists professionals (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  phone text,
  specialty text,
  work_days integer[] default array[1,2,3,4,5,6],
  start_time time default '09:00',
  end_time time default '18:00',
  lunch_start time,
  lunch_end time,
  commission_default numeric default 0,
  color text default '#C89B7B',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists professional_services (
  professional_id uuid references professionals(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  primary key (professional_id, service_id)
);


create table if not exists professional_weekly_schedules (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid references professionals(id) on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  active boolean default true,
  start_time time default '09:00',
  end_time time default '18:00',
  break_start time,
  break_end time,
  unique (professional_id, day_of_week)
);

create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  name text not null,
  phone text not null,
  email text,
  preferred_professional_id uuid references professionals(id) on delete set null,
  notes text,
  formula text,
  visits integer default 0,
  total_spent numeric default 0,
  created_at timestamptz default now()
);

create table if not exists client_hair_history (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  professional_id uuid references professionals(id) on delete set null,
  date date not null default current_date,
  service text,
  formula text,
  products text,
  notes text,
  before_photo_url text,
  after_photo_url text,
  created_at timestamptz default now()
);

create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid,
  group_index integer default 1,
  group_total integer default 1,
  salon_id uuid references salons(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  professional_id uuid references professionals(id) on delete set null,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text default 'agendado' check (status in ('agendado','confirmado','atendimento','concluido','cancelado','falta')),
  total_price numeric default 0,
  total_duration integer default 0,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists appointment_services (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid references appointments(id) on delete cascade not null,
  service_id uuid references services(id) on delete restrict not null,
  price numeric not null default 0,
  duration_minutes integer not null default 0
);

create table if not exists financial_transactions (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  appointment_id uuid references appointments(id) on delete set null,
  type text not null check (type in ('receita','despesa')),
  date date not null default current_date,
  description text not null,
  amount numeric not null default 0,
  payment text,
  created_at timestamptz default now()
);

create table if not exists stock_movements (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  type text not null check (type in ('entrada','saida','ajuste')),
  qty numeric not null,
  reason text,
  appointment_id uuid references appointments(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists blocked_times (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  professional_id uuid references professionals(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  created_at timestamptz default now()
);

create table if not exists commissions (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade not null,
  professional_id uuid references professionals(id) on delete cascade not null,
  appointment_id uuid references appointments(id) on delete cascade,
  gross_amount numeric default 0,
  commission_amount numeric default 0,
  status text default 'pendente' check (status in ('pendente','pago')),
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists admin_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id) on delete set null,
  salon_id uuid references salons(id) on delete set null,
  action text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);


-- Tabela de sincronização rápida da versão estática.
-- Ela mantém o estado do app em JSON para permitir uso imediato no Vercel.
-- Para produção robusta, migre gradualmente para as tabelas relacionais acima com Supabase Auth e RLS por salão.
create table if not exists bellaos_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table bellaos_state enable row level security;

drop policy if exists bellaos_state_select on bellaos_state;
drop policy if exists bellaos_state_insert on bellaos_state;
drop policy if exists bellaos_state_update on bellaos_state;

create policy bellaos_state_select on bellaos_state
  for select using (true);

create policy bellaos_state_insert on bellaos_state
  for insert with check (true);

create policy bellaos_state_update on bellaos_state
  for update using (true) with check (true);

-- RLS sugerido
alter table salons enable row level security;
alter table profiles enable row level security;
alter table service_categories enable row level security;
alter table services enable row level security;
alter table service_products enable row level security;
alter table professionals enable row level security;
alter table professional_services enable row level security;
alter table professional_weekly_schedules enable row level security;
alter table schedule_exceptions enable row level security;
alter table clients enable row level security;
alter table client_hair_history enable row level security;
alter table appointments enable row level security;
alter table appointment_services enable row level security;
alter table products enable row level security;
alter table financial_transactions enable row level security;
alter table stock_movements enable row level security;
alter table blocked_times enable row level security;
alter table commissions enable row level security;
alter table admin_logs enable row level security;

-- Políticas devem ser ajustadas conforme seu auth real. A regra base é:
-- usuários acessam apenas registros do próprio salon_id, e super_admin acessa todos.
