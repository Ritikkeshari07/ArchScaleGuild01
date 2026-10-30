-- Disposable local fixture data for the four-app pilot. Never use real data.
insert into public.contacts
  (id, organization_id, name, organization, city, product_id, product_name, order_id, order_ref)
values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'ABC Studio', 'ABC Studio', 'Mumbai', 'b0000000-0000-4000-8000-000000000001',
   'Marble Sample', 'd0000000-0000-4000-8000-000000000001', 'ORD-001')
on conflict (id) do nothing;

insert into public.tasks
  (id, organization_id, name, assigned_to, order_id, order_ref, contact_id, contact_name,
   product_id, product_name, status)
values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Confirm delivery', 'Operations', 'd0000000-0000-4000-8000-000000000001', 'ORD-001',
   'c0000000-0000-4000-8000-000000000001', 'ABC Studio',
   'b0000000-0000-4000-8000-000000000001', 'Marble Sample', 'Open')
on conflict (id) do nothing;

insert into public.products
  (id, organization_id, name, sku, category, unit, price, contact_id, contact_name,
   order_id, order_ref)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Marble Sample', 'MAR-001', 'Samples', 'each', 500,
   'c0000000-0000-4000-8000-000000000001', 'ABC Studio',
   'd0000000-0000-4000-8000-000000000001', 'ORD-001')
on conflict (id) do nothing;

insert into public.orders
  (id, organization_id, order_no, customer_id, customer_name, product_id,
   product_name, unit_price, quantity, status)
values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'ORD-001', 'c0000000-0000-4000-8000-000000000001', 'ABC Studio',
   'b0000000-0000-4000-8000-000000000001', 'Marble Sample', 500, 4, 'Confirmed')
on conflict (id) do nothing;

update public.contacts set task_id='e0000000-0000-4000-8000-000000000001', task_name='Confirm delivery'
where id='c0000000-0000-4000-8000-000000000001';
update public.products set task_id='e0000000-0000-4000-8000-000000000001', task_name='Confirm delivery'
where id='b0000000-0000-4000-8000-000000000001';
update public.orders set task_id='e0000000-0000-4000-8000-000000000001', task_name='Confirm delivery'
where id='d0000000-0000-4000-8000-000000000001';
