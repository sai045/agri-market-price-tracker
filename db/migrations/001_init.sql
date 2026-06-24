create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_te text not null,
  region text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_te text not null,
  abbreviation text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_te text not null,
  default_unit_id uuid not null references units(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists item_seasons (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references items(id) on delete cascade,
  start_month int not null check (start_month between 1 and 12),
  end_month int not null check (end_month between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists market_holidays (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references cities(id) on delete cascade,
  name text not null,
  name_te text not null,
  recurrence_type text not null check (recurrence_type in ('weekly', 'annual', 'none')),
  day_of_week int check (day_of_week between 0 and 6),
  month int check (month between 1 and 12),
  day int check (day between 1 and 31),
  holiday_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists price_entries (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references cities(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  unit_id uuid not null references units(id),
  entry_date date not null,
  max_price numeric(12, 2) not null check (max_price > 0),
  notes text,
  entered_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, item_id, entry_date)
);

create index if not exists idx_price_city_date on price_entries(city_id, entry_date);
create index if not exists idx_price_item_date on price_entries(item_id, entry_date);
create index if not exists idx_holidays_city_rec on market_holidays(city_id, recurrence_type);
