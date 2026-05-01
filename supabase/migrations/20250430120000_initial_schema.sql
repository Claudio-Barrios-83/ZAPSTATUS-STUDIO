-- ZapStatus Studio: jobs de video y metadatos. RLS por usuario.

create extension if not exists "pgcrypto";

-- Plan comercial: free aplica marca de agua en el worker.
create type public.plan_tier as enum ('free', 'paid');

create table public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending_upload'
    check (status in ('pending_upload', 'queued', 'processing', 'completed', 'failed')),
  plan public.plan_tier not null default 'free',
  input_object_key text not null,
  output_prefix text not null,
  output_manifest jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_jobs_user_id_created_at_idx on public.video_jobs (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger video_jobs_set_updated_at
before update on public.video_jobs
for each row execute procedure public.set_updated_at();

alter table public.video_jobs enable row level security;

-- SELECT: solo filas del usuario autenticado
create policy "video_jobs_select_own"
on public.video_jobs
for select
to authenticated
using (auth.uid() = user_id);

-- INSERT: el usuario solo puede crear jobs para sí mismo
create policy "video_jobs_insert_own"
on public.video_jobs
for insert
to authenticated
with check (auth.uid() = user_id);

-- UPDATE: el cliente no actualiza estado directamente en el MVP (lo hace el worker con service_role).
-- Sin política de UPDATE para authenticated evita que el cliente manipule estado/manifest.

comment on table public.video_jobs is 'Trabajos de exportación 9:16; archivos pesados viven en R2/S3.';
