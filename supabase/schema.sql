-- Separate names preserve the project's existing pos_* tables.
create table if not exists public.ayngaran_stores (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0,
 state jsonb not null check (jsonb_typeof(state) = 'object'),
 updated_at timestamptz not null default now()
);
create table if not exists public.ayngaran_requests (
 owner_id uuid not null references public.ayngaran_stores(owner_id) on delete cascade,
 request_id uuid not null,
 result jsonb,
 created_at timestamptz not null default now(),
 primary key (owner_id, request_id)
);
alter table public.ayngaran_stores enable row level security;
alter table public.ayngaran_requests enable row level security;
create policy "Owner reads store" on public.ayngaran_stores for select to authenticated using ((select auth.uid())=owner_id);
create policy "Owner creates store" on public.ayngaran_stores for insert to authenticated with check ((select auth.uid())=owner_id);
create policy "Owner updates store" on public.ayngaran_stores for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy "Owner reads requests" on public.ayngaran_requests for select to authenticated using ((select auth.uid())=owner_id);
create policy "Owner creates requests" on public.ayngaran_requests for insert to authenticated with check ((select auth.uid())=owner_id);
revoke all on public.ayngaran_stores, public.ayngaran_requests from anon;
grant select,insert,update on public.ayngaran_stores to authenticated;
grant select,insert on public.ayngaran_requests to authenticated;
create or replace function public.ayngaran_commit(p_revision bigint,p_request_id uuid,p_state jsonb,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_store public.ayngaran_stores; prior jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into current_store from public.ayngaran_stores where owner_id=auth.uid() for update;
 if not found then raise exception 'Store is not initialized'; end if;
 select result into prior from public.ayngaran_requests where owner_id=auth.uid() and request_id=p_request_id;
 if found then return jsonb_build_object('state',current_store.state,'revision',current_store.revision,'result',prior); end if;
 if current_store.revision<>p_revision then return jsonb_build_object('conflict',true); end if;
 update public.ayngaran_stores set state=p_state,revision=revision+1,updated_at=now() where owner_id=auth.uid();
 insert into public.ayngaran_requests(owner_id,request_id,result) values(auth.uid(),p_request_id,p_result);
 return jsonb_build_object('state',p_state,'revision',p_revision+1,'result',p_result);
end; $$;
revoke all on function public.ayngaran_commit(bigint,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.ayngaran_commit(bigint,uuid,jsonb,jsonb) to authenticated;
