-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Tenancy
create table if not exists tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  timezone text not null default 'America/Los_Angeles',
  created_at timestamptz not null default now()
);

-- Contacts deduplicated across sources
create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  external_id text not null,
  source text not null,
  display_name text,
  email text,
  handle text,
  importance_score numeric(5,4) default 0.2000,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source, external_id)
);

-- Conversations unify threads/channel topics
create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source text not null,
  external_id text not null,
  subject text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, source, external_id)
);

-- Canonical normalized messages
create table if not exists activities (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  activity_hash text not null,
  source text not null,
  source_message_id text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  subject text,
  preview text,
  body text not null,
  metadata jsonb not null,
  participants jsonb not null,
  attachments jsonb not null,
  raw_payload_ref text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, activity_hash),
  unique (tenant_id, source, source_message_id)
);

create index if not exists idx_activities_tenant_time
  on activities (tenant_id, received_at desc);

-- Message chunks ready for embeddings
create table if not exists activity_chunks (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_count int not null,
  embedding vector(1536),
  status text not null default 'pending',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, chunk_index)
);

create index if not exists idx_activity_chunks_embedding
  on activity_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_activity_chunks_status
  on activity_chunks (status)
  where embedding is null;

-- Escalation audit trail
create table if not exists escalations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  activity_id uuid references activities(id) on delete set null,
  reason text not null,
  priority numeric(5,4) not null,
  delivery_channel text not null,
  dispatched_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_escalations_tenant_time
  on escalations (tenant_id, dispatched_at desc);

-- Daily digests and action items
create table if not exists daily_digests (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  digest_date date not null,
  markdown text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, digest_date)
);

create table if not exists action_items (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  summary text not null,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_action_items_tenant_due
  on action_items (tenant_id, due_at nulls last);

