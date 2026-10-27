-- Cash advances are separate from sales and increase customer receivables.
-- Existing owner policies and normalized state metadata remain unchanged.
begin;
create or replace view public.ayngaran_customer_balances with (security_invoker=true) as
select c.owner_id,c.id,c.name,c.opening_balance
 + coalesce((select sum((credit->>'amount')::numeric) from public.ayngaran_stores store cross join lateral jsonb_array_elements(coalesce(store.state_extras->'customerCredits','[]'::jsonb)) credit where store.owner_id=c.owner_id and credit->>'customerId'=c.id),0)
 + coalesce((select sum(s.total-s.paid) from public.ayngaran_sales s where s.owner_id=c.owner_id and s.customer_id=c.id and not coalesce(s.void,false)),0)
 - coalesce((select sum(p.amount) from public.ayngaran_payments p where p.owner_id=c.owner_id and p.customer_id=c.id),0) as balance
from public.ayngaran_customers c;
revoke all on public.ayngaran_customer_balances from public,anon;
grant select on public.ayngaran_customer_balances to authenticated;
notify pgrst, 'reload schema';
commit;
