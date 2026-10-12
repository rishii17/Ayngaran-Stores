-- Read-only post-migration checks. No customer names, keys or bill contents.
select schema_version, count(*) as stores from public.ayngaran_stores group by schema_version;
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname like 'ayngaran_%' order by c.relname;
select n.nspname, p.proname, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('ayngaran_load_v2','ayngaran_commit_v2')) or n.nspname='ayngaran_private';
select 'products' as entity,count(*) as records from public.ayngaran_products
union all select 'sales',count(*) from public.ayngaran_sales
union all select 'sale_items',count(*) from public.ayngaran_sale_items
union all select 'purchases',count(*) from public.ayngaran_purchases
union all select 'purchase_items',count(*) from public.ayngaran_purchase_items
union all select 'customers',count(*) from public.ayngaran_customers
union all select 'suppliers',count(*) from public.ayngaran_suppliers;
select count(*) as missing_inventory_rows from public.ayngaran_products p
left join public.ayngaran_inventory i on i.owner_id=p.owner_id and i.id=p.id where i.id is null;
