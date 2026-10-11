-- Dummy reference data only. No real customer or owner data belongs here.
create table if not exists public.ayngaran_seed_templates (
 name text primary key,
 state jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.ayngaran_seed_templates enable row level security;
revoke all on public.ayngaran_seed_templates from anon,authenticated;
grant select on public.ayngaran_seed_templates to authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='ayngaran_seed_templates' and policyname='Signed-in users read dummy templates') then
 create policy "Signed-in users read dummy templates" on public.ayngaran_seed_templates for select to authenticated using (true);
 end if;
end $$;
