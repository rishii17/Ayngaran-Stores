-- MANUAL IMPORT ONLY. Not a deployment migration. Run in Supabase SQL Editor.
-- Targets the normalized public.ayngaran_* tables in this repository.
-- SKUs start AFTER AYS-110: this bill uses AYS-111 through AYS-172.
-- Fill the configuration below. No live database was accessed to prepare this.
-- Prices are VAT-inclusive as printed. Selling prices default to printed MRP.
-- Supplier payment is UNKNOWN: enter the amount actually paid; never guess.
-- Printed rates ALREADY include 10% (chocolate) / 15% (cake) off MRP.
-- The further Rs 1795.05 discount has NO visible percentage/eligibility on the photos.
-- Owner chose proportional allocation across the chocolate/confectionery group.
-- This is a cost allocation, not a claimed supplier promotional percentage.
begin;
do $import$
declare
  v_owner uuid := NULL; -- Required: store owner's Supabase Auth user UUID.
  v_supplier_id text := NULL; -- Existing supplier id, or NULL to create one.
  v_supplier_name text := NULL; -- Required only when creating a supplier.
  v_paid numeric := NULL; -- 0 if entirely unpaid; 88315.95 if fully paid; actual amount otherwise.
  v_payment_method text := NULL; -- 'cash' or 'bank' for the historical invoice payment.
  v_discount_policy text := 'proportional_chocolate'; -- Owner-approved allocation; alternative: 'confirmed_percentage'.
  v_actual_percentage numeric := NULL; -- Required only for confirmed_percentage.
  v_discount_lines integer[] := NULL; -- Eligible bill line numbers for confirmed_percentage.

  v_key constant text := 'photo-cbl-2026-10-21-88315.95';
  v_reference constant text := 'PHOTO-CBL-20261021-88315.95'; -- Import alias, NOT a visible invoice number.
  v_bill_date constant timestamptz := '2026-10-21 17:04:00+05:30'; -- Receipt print time.
  v_discount constant numeric := 1795.05;
  v_net constant numeric := 88315.95;
  v_rows jsonb := '[
  {
    "line": 1,
    "name": "Choco-La Milk 20g SACMI",
    "mrp": "50",
    "billed_quantity": "24",
    "rate": "45",
    "gross": "1080",
    "group_name": "chocolate"
  },
  {
    "line": 2,
    "name": "Choco-La Milk Sweet 20g SACMI",
    "mrp": "50",
    "billed_quantity": "48",
    "rate": "45",
    "gross": "2160",
    "group_name": "chocolate"
  },
  {
    "line": 3,
    "name": "Choco-La Milk 45g",
    "mrp": "100",
    "billed_quantity": "12",
    "rate": "90",
    "gross": "1080",
    "group_name": "chocolate"
  },
  {
    "line": 4,
    "name": "Choco-La Crispies 45g",
    "mrp": "100",
    "billed_quantity": "12",
    "rate": "90",
    "gross": "1080",
    "group_name": "chocolate"
  },
  {
    "line": 5,
    "name": "Choco-La Milk 90g",
    "mrp": "200",
    "billed_quantity": "6",
    "rate": "180",
    "gross": "1080",
    "group_name": "chocolate"
  },
  {
    "line": 6,
    "name": "Chokybix Butter Scotch 17g SPS",
    "mrp": "50",
    "billed_quantity": "24",
    "rate": "45",
    "gross": "1080",
    "group_name": "chocolate"
  },
  {
    "line": 7,
    "name": "Chokybix Butter Scotch 43g SPS",
    "mrp": "120",
    "billed_quantity": "3",
    "rate": "108",
    "gross": "324",
    "group_name": "chocolate"
  },
  {
    "line": 8,
    "name": "Ritzbury Milk 45g PP",
    "mrp": "140",
    "billed_quantity": "6",
    "rate": "126",
    "gross": "756",
    "group_name": "chocolate"
  },
  {
    "line": 9,
    "name": "Ritzbury Crispy 45g PP",
    "mrp": "140",
    "billed_quantity": "6",
    "rate": "126",
    "gross": "756",
    "group_name": "chocolate"
  },
  {
    "line": 10,
    "name": "Ritzbury Cashew 45g PP",
    "mrp": "200",
    "billed_quantity": "6",
    "rate": "180",
    "gross": "1080",
    "group_name": "chocolate"
  },
  {
    "line": 11,
    "name": "Ritzbury Fruit and Nut 45g PP SPS",
    "mrp": "180",
    "billed_quantity": "6",
    "rate": "162",
    "gross": "972",
    "group_name": "chocolate"
  },
  {
    "line": 12,
    "name": "Ritzbury Peanut 45g PP",
    "mrp": "140",
    "billed_quantity": "6",
    "rate": "126",
    "gross": "756",
    "group_name": "chocolate"
  },
  {
    "line": 13,
    "name": "Ritzbury Milk Sweet 45g PP",
    "mrp": "120",
    "billed_quantity": "12",
    "rate": "108",
    "gross": "1296",
    "group_name": "chocolate"
  },
  {
    "line": 14,
    "name": "Ritzbury Milk Sweet 93g",
    "mrp": "230",
    "billed_quantity": "6",
    "rate": "207",
    "gross": "1242",
    "group_name": "chocolate"
  },
  {
    "line": 15,
    "name": "Ritzbury Milk 93g PP",
    "mrp": "270",
    "billed_quantity": "3",
    "rate": "243",
    "gross": "729",
    "group_name": "chocolate"
  },
  {
    "line": 16,
    "name": "Ritzbury Crispy 93g",
    "mrp": "270",
    "billed_quantity": "3",
    "rate": "243",
    "gross": "729",
    "group_name": "chocolate"
  },
  {
    "line": 17,
    "name": "Ritzbury Fruit and Nut 93g",
    "mrp": "350",
    "billed_quantity": "3",
    "rate": "315",
    "gross": "945",
    "group_name": "chocolate"
  },
  {
    "line": 18,
    "name": "Ritzbury Peanut Bar 50g",
    "mrp": "150",
    "billed_quantity": "6",
    "rate": "135",
    "gross": "810",
    "group_name": "chocolate"
  },
  {
    "line": 19,
    "name": "Ritzbury Cashew Bar 50g",
    "mrp": "200",
    "billed_quantity": "6",
    "rate": "180",
    "gross": "1080",
    "group_name": "chocolate"
  },
  {
    "line": 20,
    "name": "Bubbles 4.5g",
    "mrp": "10",
    "billed_quantity": "216",
    "rate": "9",
    "gross": "1944",
    "group_name": "chocolate"
  },
  {
    "line": 21,
    "name": "Bubbles 30g",
    "mrp": "100",
    "billed_quantity": "24",
    "rate": "90",
    "gross": "2160",
    "group_name": "chocolate"
  },
  {
    "line": 22,
    "name": "Bubbles 100g SPS",
    "mrp": "250",
    "billed_quantity": "3",
    "rate": "225",
    "gross": "675",
    "group_name": "chocolate"
  },
  {
    "line": 23,
    "name": "Bubbles 170g",
    "mrp": "450",
    "billed_quantity": "3",
    "rate": "405",
    "gross": "1215",
    "group_name": "chocolate"
  },
  {
    "line": 24,
    "name": "Chocolate Fingers 18g",
    "mrp": "40",
    "billed_quantity": "32",
    "rate": "36",
    "gross": "1152",
    "group_name": "chocolate"
  },
  {
    "line": 25,
    "name": "Chocolate Fingers 40g",
    "mrp": "100",
    "billed_quantity": "6",
    "rate": "90",
    "gross": "540",
    "group_name": "chocolate"
  },
  {
    "line": 26,
    "name": "Chocolate Fingers 80g A",
    "mrp": "160",
    "billed_quantity": "6",
    "rate": "144",
    "gross": "864",
    "group_name": "chocolate"
  },
  {
    "line": 27,
    "name": "Chocolate Fingers 110g A",
    "mrp": "250",
    "billed_quantity": "6",
    "rate": "225",
    "gross": "1350",
    "group_name": "chocolate"
  },
  {
    "line": 28,
    "name": "Chunky Choc 20g",
    "mrp": "40",
    "billed_quantity": "24",
    "rate": "36",
    "gross": "864",
    "group_name": "chocolate"
  },
  {
    "line": 29,
    "name": "Chunky Choc Trio 60g",
    "mrp": "120",
    "billed_quantity": "6",
    "rate": "108",
    "gross": "648",
    "group_name": "chocolate"
  },
  {
    "line": 30,
    "name": "Chunky Choc 120g A",
    "mrp": "250",
    "billed_quantity": "6",
    "rate": "225",
    "gross": "1350",
    "group_name": "chocolate"
  },
  {
    "line": 31,
    "name": "Choco-Mo 40g",
    "mrp": "120",
    "billed_quantity": "6",
    "rate": "108",
    "gross": "648",
    "group_name": "chocolate"
  },
  {
    "line": 32,
    "name": "Choco-Mo 2DZ Pack",
    "mrp": "250",
    "billed_quantity": "6",
    "rate": "225",
    "gross": "1350",
    "group_name": "chocolate"
  },
  {
    "line": 33,
    "name": "Choc-O-Fruit 7g",
    "mrp": "20",
    "billed_quantity": "24",
    "rate": "18",
    "gross": "432",
    "group_name": "chocolate"
  },
  {
    "line": 34,
    "name": "Pebbles Peanut 7g",
    "mrp": "20",
    "billed_quantity": "24",
    "rate": "18",
    "gross": "432",
    "group_name": "chocolate"
  },
  {
    "line": 35,
    "name": "Pebbles Original 8g",
    "mrp": "20",
    "billed_quantity": "24",
    "rate": "18",
    "gross": "432",
    "group_name": "chocolate"
  },
  {
    "line": 36,
    "name": "Pebbles 25g Tube",
    "mrp": "100",
    "billed_quantity": "12",
    "rate": "90",
    "gross": "1080",
    "group_name": "chocolate"
  },
  {
    "line": 37,
    "name": "Popit 9g",
    "mrp": "20",
    "billed_quantity": "72",
    "rate": "18",
    "gross": "1296",
    "group_name": "chocolate"
  },
  {
    "line": 38,
    "name": "Popit 20g Tube",
    "mrp": "80",
    "billed_quantity": "12",
    "rate": "72",
    "gross": "864",
    "group_name": "chocolate"
  },
  {
    "line": 39,
    "name": "Choc-A-Nut 30g BB",
    "mrp": "70",
    "billed_quantity": "6",
    "rate": "63",
    "gross": "378",
    "group_name": "chocolate"
  },
  {
    "line": 40,
    "name": "Choc-A-Nut 50g",
    "mrp": "120",
    "billed_quantity": "6",
    "rate": "108",
    "gross": "648",
    "group_name": "chocolate"
  },
  {
    "line": 41,
    "name": "Rave Bottle 13g",
    "mrp": "40",
    "billed_quantity": "36",
    "rate": "36",
    "gross": "1296",
    "group_name": "chocolate"
  },
  {
    "line": 42,
    "name": "Champ Bottle 13g",
    "mrp": "40",
    "billed_quantity": "36",
    "rate": "36",
    "gross": "1296",
    "group_name": "chocolate"
  },
  {
    "line": 43,
    "name": "Tropica Bottle 13g",
    "mrp": "40",
    "billed_quantity": "36",
    "rate": "36",
    "gross": "1296",
    "group_name": "chocolate"
  },
  {
    "line": 44,
    "name": "Rave 26g",
    "mrp": "70",
    "billed_quantity": "12",
    "rate": "63",
    "gross": "756",
    "group_name": "chocolate"
  },
  {
    "line": 45,
    "name": "Champ 26g",
    "mrp": "70",
    "billed_quantity": "12",
    "rate": "63",
    "gross": "756",
    "group_name": "chocolate"
  },
  {
    "line": 46,
    "name": "Tropica 26g",
    "mrp": "70",
    "billed_quantity": "12",
    "rate": "63",
    "gross": "756",
    "group_name": "chocolate"
  },
  {
    "line": 47,
    "name": "Duo Strawberry 20g",
    "mrp": "50",
    "billed_quantity": "24",
    "rate": "45",
    "gross": "1080",
    "group_name": "chocolate"
  },
  {
    "line": 48,
    "name": "Black Magic 20g",
    "mrp": "60",
    "billed_quantity": "24",
    "rate": "54",
    "gross": "1296",
    "group_name": "chocolate"
  },
  {
    "line": 49,
    "name": "Uno Bottle 10g",
    "mrp": "20",
    "billed_quantity": "48",
    "rate": "18",
    "gross": "864",
    "group_name": "chocolate"
  },
  {
    "line": 50,
    "name": "O-Kay Sponge Layer Cake Vanilla 18g",
    "mrp": "40",
    "billed_quantity": "24",
    "rate": "34",
    "gross": "816",
    "group_name": "cake"
  },
  {
    "line": 51,
    "name": "Rollo 30g",
    "mrp": "80",
    "billed_quantity": "18",
    "rate": "68",
    "gross": "1224",
    "group_name": "cake"
  },
  {
    "line": 52,
    "name": "Go Chok Vanilla 30g",
    "mrp": "80",
    "billed_quantity": "18",
    "rate": "68",
    "gross": "1224",
    "group_name": "cake"
  },
  {
    "line": 53,
    "name": "Swiss Roll Chocolate 200g",
    "mrp": "420",
    "billed_quantity": "12",
    "rate": "357",
    "gross": "4284",
    "group_name": "cake"
  },
  {
    "line": 54,
    "name": "Swiss Roll Vanilla 200g",
    "mrp": "380",
    "billed_quantity": "12",
    "rate": "323",
    "gross": "3876",
    "group_name": "cake"
  },
  {
    "line": 55,
    "name": "Swiss Roll Strawberry 200g",
    "mrp": "380",
    "billed_quantity": "12",
    "rate": "323",
    "gross": "3876",
    "group_name": "cake"
  },
  {
    "line": 56,
    "name": "Butter Sponge 240g",
    "mrp": "450",
    "billed_quantity": "6",
    "rate": "382.50",
    "gross": "2295",
    "group_name": "cake"
  },
  {
    "line": 57,
    "name": "Butter Raisin 250g",
    "mrp": "520",
    "billed_quantity": "6",
    "rate": "442",
    "gross": "2652",
    "group_name": "cake"
  },
  {
    "line": 58,
    "name": "Sponge Layer Chocolate 310g",
    "mrp": "600",
    "billed_quantity": "12",
    "rate": "510",
    "gross": "6120",
    "group_name": "cake"
  },
  {
    "line": 59,
    "name": "Sponge Layer Vanilla 310g",
    "mrp": "580",
    "billed_quantity": "12",
    "rate": "493",
    "gross": "5916",
    "group_name": "cake"
  },
  {
    "line": 60,
    "name": "Sponge Layer Strawberry 310g",
    "mrp": "580",
    "billed_quantity": "12",
    "rate": "493",
    "gross": "5916",
    "group_name": "cake"
  },
  {
    "line": 61,
    "name": "Sponge Layer Vanilla 480g",
    "mrp": "900",
    "billed_quantity": "3",
    "rate": "765",
    "gross": "2295",
    "group_name": "cake"
  },
  {
    "line": 62,
    "name": "4GB Nutra 10g",
    "mrp": "20",
    "billed_quantity": "48",
    "rate": "18",
    "gross": "864",
    "group_name": "chocolate"
  }
]'::jsonb;
  v_request uuid;
  v_purchase text;
  v_position bigint;
  v_product_position bigint;
  v_movement_position bigint;
  v_revision bigint;
  v_total_eligible numeric;
  v_effective_pct numeric;
  v_cents_left integer;
  r record;
begin
  if v_owner is null then raise exception 'Set v_owner to your store owner Auth UUID'; end if;
  if v_paid is null or v_paid < 0 or v_paid > v_net or round(v_paid,2) <> v_paid then
    raise exception 'Set v_paid to the actual paid amount, between 0 and 88315.95 (two decimals)';
  end if;
  if v_payment_method is null or v_payment_method not in ('cash','bank') then
    raise exception 'Set the historical payment method to cash or bank';
  end if;
  if not exists (select 1 from auth.users where id=v_owner) then raise exception 'Owner Auth user not found'; end if;
  select revision into v_revision from public.ayngaran_stores where owner_id=v_owner and schema_version=2 for update;
  if not found then raise exception 'Log in once and apply the existing normalized-storage migration before importing'; end if;
  v_request := md5(v_owner::text || ':' || v_key)::uuid;
  v_purchase := md5(v_owner::text || ':' || v_key || ':purchase');
  if exists (select 1 from public.ayngaran_requests where owner_id=v_owner and request_id=v_request) then
    raise notice 'This bill has already been imported. Nothing changed.';
    return;
  end if;
  if v_discount_policy is null or v_discount_policy not in ('proportional_chocolate','confirmed_percentage') then
    raise exception 'Confirm the extra discount allocation: proportional_chocolate, or confirmed_percentage with eligible lines and the actual percentage';
  end if;

  create temporary table cbl_bill_import on commit drop as
  select x.*, case when line=21 then 2 else 0 end::numeric as free_quantity,
    case when line=47 then 'box' when line=49 then 'bottle' else 'pack' end as unit,
    false as eligible, 0::numeric as allocated_discount,
    0::numeric as net_total, 0::numeric as unit_cost,
    md5(v_owner::text || ':' || v_key || ':product:' || line) as product_id,
    'AYS-' || lpad((110+line)::text,3,'0') as sku
  from jsonb_to_recordset(v_rows) as x(line integer,name text,mrp numeric,billed_quantity numeric,rate numeric,gross numeric,group_name text);
  if (select count(*) from cbl_bill_import) <> 62 or (select sum(gross) from cbl_bill_import) <> 90111
    or exists (select 1 from cbl_bill_import where round(rate*billed_quantity,2)<>gross or billed_quantity<=0 or rate<=0 or mrp<rate) then
    raise exception 'Source data failed invoice arithmetic checks';
  end if;
  if v_discount_policy='proportional_chocolate' then
    update cbl_bill_import set eligible=(group_name='chocolate');
  else
    if v_actual_percentage is null or v_actual_percentage<=0 or v_actual_percentage>100
      or v_discount_lines is null or cardinality(v_discount_lines)=0 then
      raise exception 'Provide the actual percentage and eligible bill line numbers';
    end if;
    if exists (select 1 from unnest(v_discount_lines) n where n is null or not exists(select 1 from cbl_bill_import where line=n)) then
      raise exception 'Eligible discount line numbers must refer to this bill';
    end if;
    update cbl_bill_import set eligible=(line=any(v_discount_lines));
  end if;
  select sum(gross) into v_total_eligible from cbl_bill_import where eligible;
  if v_total_eligible is null or v_total_eligible<v_discount then raise exception 'Invalid discount allocation base'; end if;
  if v_discount_policy='confirmed_percentage' and round(v_total_eligible*v_actual_percentage/100,2)<>v_discount then
    raise exception 'Actual percentage and eligible lines do not reproduce the printed discount of 1795.05';
  end if;
  v_effective_pct := v_discount*100/v_total_eligible;
  -- Largest-remainder allocation: line discounts add up to EXACTLY Rs 1795.05.
  update cbl_bill_import set allocated_discount=floor(v_discount*100*gross/v_total_eligible)/100 where eligible;
  select round((v_discount-sum(allocated_discount))*100)::integer into v_cents_left from cbl_bill_import;
  with ranked as (
    select line,row_number() over(order by (v_discount*100*gross/v_total_eligible-floor(v_discount*100*gross/v_total_eligible)) desc,line) as n
    from cbl_bill_import where eligible
  ) update cbl_bill_import b set allocated_discount=allocated_discount+0.01 from ranked alloc where b.line=alloc.line and alloc.n<=v_cents_left;
  update cbl_bill_import set net_total=gross-allocated_discount,
    unit_cost=round((gross-allocated_discount)/(billed_quantity+free_quantity),2);
  if (select sum(allocated_discount) from cbl_bill_import)<>v_discount or (select sum(net_total) from cbl_bill_import)<>v_net then
    raise exception 'Allocated net amounts do not match the photographed invoice';
  end if;

  if v_supplier_id is null then
    if v_supplier_name is null or btrim(v_supplier_name)='' then raise exception 'Enter the actual supplier company name, or select an existing v_supplier_id'; end if;
    if exists (select 1 from public.ayngaran_suppliers where owner_id=v_owner and lower(name)=lower(btrim(v_supplier_name))) then
      raise exception 'A supplier with this name already exists: set v_supplier_id instead of creating a duplicate';
    end if;
    v_supplier_id := md5(v_owner::text || ':supplier:' || lower(btrim(v_supplier_name)));
    select coalesce(max(position),-1)+1 into v_position from public.ayngaran_suppliers where owner_id=v_owner;
    insert into public.ayngaran_suppliers(owner_id,position,id,name,phone,address,village,code,opening_balance,extras)
    values(v_owner,v_position,v_supplier_id,btrim(v_supplier_name),'','','','SUP-CBL-IMPORT',0,jsonb_build_object('sourceImport',v_key));
  elsif not exists (select 1 from public.ayngaran_suppliers where owner_id=v_owner and id=v_supplier_id) then
    raise exception 'Supplier id does not belong to this store';
  end if;
  if exists (select 1 from public.ayngaran_purchases where owner_id=v_owner and
    (id=v_purchase or reference=v_reference or (supplier_id=v_supplier_id and total=v_net and (date at time zone 'Asia/Colombo')::date='2026-10-21'::date))) then
    raise exception 'A matching purchase already exists; reconcile the previous entry instead of importing twice';
  end if;
  if exists (select 1 from cbl_bill_import b join public.ayngaran_products p on p.owner_id=v_owner and
    (p.id=b.product_id or lower(p.sku)=lower(b.sku) or lower(p.name)=lower(b.name))) then
    raise exception 'An imported SKU or matching product name already exists. Review/map existing products before importing; no stock was overwritten';
  end if;

  select coalesce(max(position),-1)+1 into v_product_position from public.ayngaran_products where owner_id=v_owner;
  select coalesce(min(position),0)-62 into v_movement_position from public.ayngaran_stock_movements where owner_id=v_owner;
  select coalesce(min(position),0)-1 into v_position from public.ayngaran_purchases where owner_id=v_owner;
  insert into public.ayngaran_purchases(owner_id,position,id,supplier_id,reference,paid,date,total,number,extras)
  values(v_owner,v_position,v_purchase,v_supplier_id,v_reference,v_paid,v_bill_date,v_net,'IMP-CBL-20261021',
    jsonb_build_object('paymentMethod',v_payment_method,'sourceImport',v_key,'invoiceGross',90111,'invoiceDiscount',v_discount,
      'discountPolicy',v_discount_policy,'allocationEffectivePercentage',v_effective_pct,'confirmedSupplierPercentage',v_actual_percentage,
      'taxInclusive',true,'dateSource','Receipt print time; invoice header number not visible'));
  for r in select * from cbl_bill_import order by line loop
    insert into public.ayngaran_products(owner_id,position,id,name,tamil,category,sku,barcode,price,cost,unit,reorder,art,active,extras)
    values(v_owner,v_product_position+r.line-1,r.product_id,r.name,'','Snacks',r.sku,'',r.mrp,r.unit_cost,r.unit,0,'snack',true,
      jsonb_build_object('discountType','amount','discountValue',0,'sourceImport',v_key,'sourceLine',r.line,
        'invoiceRateBeforeExtraDiscount',r.rate,'basePurchaseDiscountPercent',case when r.group_name='chocolate' then 10 else 15 end,
        'sourceGroup',r.group_name,'packLabelNeedsReview',r.line=32));
    insert into public.ayngaran_product_images(owner_id,position,id,image) values(v_owner,v_product_position+r.line-1,r.product_id,'');
    insert into public.ayngaran_inventory(owner_id,position,id,stock) values(v_owner,v_product_position+r.line-1,r.product_id,r.billed_quantity+r.free_quantity);
    insert into public.ayngaran_purchase_items(owner_id,parent_id,line_no,position,product_id,name,sku,unit,quantity,cost,selling_price,total,extras)
    values(v_owner,v_purchase,r.line-1,r.line-1,r.product_id,r.name,r.sku,r.unit,r.billed_quantity+r.free_quantity,r.unit_cost,r.mrp,r.net_total,
      jsonb_build_object('sourceLine',r.line,'billedQuantity',r.billed_quantity,'freeQuantity',r.free_quantity,'invoiceRate',r.rate,
        'invoiceGrossLine',r.gross,'allocatedInvoiceDiscount',r.allocated_discount,'exactEffectiveUnitCost',r.net_total/(r.billed_quantity+r.free_quantity),
        'costRoundingAdjustment',r.net_total-round(r.unit_cost*(r.billed_quantity+r.free_quantity),2)));
    insert into public.ayngaran_stock_movements(owner_id,position,id,product_id,quantity,type,reference,date,extras)
    values(v_owner,v_movement_position+r.line-1,md5(v_owner::text || ':' || v_key || ':movement:' || r.line),r.product_id,r.billed_quantity+r.free_quantity,'Purchase','IMP-CBL-20261021',v_bill_date,jsonb_build_object('sourceImport',v_key));
  end loop;
  update public.ayngaran_stores set revision=revision+1,updated_at=now() where owner_id=v_owner;
  insert into public.ayngaran_requests(owner_id,request_id,result,action_type)
  values(v_owner,v_request,jsonb_build_object('importKey',v_key,'products',62,'freeUnits',2,'purchaseId',v_purchase,'total',v_net,'discountPolicy',v_discount_policy),'invoiceImport');
  raise notice 'Imported 62 products, including two free Bubbles 30g packs. Invoice total 88315.95; paid %; payable %.',v_paid,v_net-v_paid;
end;
$import$;
commit;
