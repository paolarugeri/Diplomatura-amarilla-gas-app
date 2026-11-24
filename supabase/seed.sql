-- =====================================================================
-- Datos de prueba para la demostración académica
-- Usuarios demo (contraseña de todos: Demo1234):
--   admin@amarillagas.com.ar   -> administrador
--   lucia.gomez@example.com    -> cliente
--   martin.perez@example.com   -> cliente
--   sofia.rios@example.com     -> cliente
-- =====================================================================

-- ---------- Productos ----------
insert into public.products (id, sku, name, category, capacity_kg, container_type, description, image_url, price, sort_order) values
  ('10000000-0000-0000-0000-000000000001', 'CARGA-10', 'Carga de GLP 10 kg', 'carga', 10, 'propio',
   'Recarga de gas licuado para tu garrafa de 10 kg. Entregamos una garrafa llena a cambio de tu envase vacío.',
   '/img/garrafa-chapa-10.png', 32000, 1),
  ('10000000-0000-0000-0000-000000000002', 'CARGA-45', 'Carga de GLP 45 kg', 'carga', 45, 'propio',
   'Recarga para tubo de 45 kg, ideal para hogares con alto consumo y comercios. Requiere envase propio.',
   '/img/garrafa-45.png', 114000, 2);

insert into public.products (id, sku, name, category, capacity_kg, container_type, description, image_url, price, refill_product_id, sort_order) values
  ('20000000-0000-0000-0000-000000000001', 'ENV-PLA-10', 'Garrafa plástica 10 kg', 'envase', 10, 'plastico',
   'Envase de material compuesto: más liviano, no se oxida y permite ver el nivel de gas. Ideal para el hogar.',
   '/img/garrafa-plastica-10.png', 180000, '10000000-0000-0000-0000-000000000001', 3),
  ('20000000-0000-0000-0000-000000000002', 'ENV-CHA-10', 'Garrafa de chapa 10 kg', 'envase', 10, 'chapa',
   'Envase tradicional de acero, resistente y certificado. La opción más económica para empezar.',
   '/img/garrafa-chapa-10.png', 92000, '10000000-0000-0000-0000-000000000001', 4),
  ('20000000-0000-0000-0000-000000000003', 'ENV-CHA-45', 'Tubo de 45 kg', 'envase', 45, 'chapa',
   'Cilindro de acero de 45 kg para instalaciones domiciliarias, comercios y uso intensivo.',
   '/img/garrafa-45.png', 368000, '10000000-0000-0000-0000-000000000002', 5);

-- ---------- Usuarios demo ----------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('a0000000-0000-0000-0000-000000000001'::uuid, 'admin@amarillagas.com.ar', 'Administración Amarilla Gas', '11 4000-0000'),
      ('c0000000-0000-0000-0000-000000000001'::uuid, 'lucia.gomez@example.com',  'Lucía Gómez',  '11 5555-1234'),
      ('c0000000-0000-0000-0000-000000000002'::uuid, 'martin.perez@example.com', 'Martín Pérez', '11 5555-9876'),
      ('c0000000-0000-0000-0000-000000000003'::uuid, 'sofia.rios@example.com',   'Sofía Ríos',   '221 444-3210')
    ) as t(id, email, full_name, phone)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Demo1234', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', u.full_name, 'phone', u.phone),
      now() - interval '30 days', now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
end;
$$;

update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';

-- ---------- Domicilios ----------
insert into public.addresses (id, user_id, label, street, number, city, province, postal_code, reference, lat, lng, is_default) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Casa', 'Calle 14', '4520', 'Berazategui', 'Buenos Aires', '1884', 'Portón negro, timbre 2', -34.7631, -58.2117, true),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Trabajo', 'Av. Mitre', '1200', 'Quilmes', 'Buenos Aires', '1878', 'Local comercial, preguntar por Lucía', -34.7242, -58.2526, false),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'Casa', 'Av. 14', '3100', 'Hudson', 'Buenos Aires', '1885', 'Casa con rejas verdes', -34.7915, -58.1520, true),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'Casa', 'Calle 7', '850', 'La Plata', 'Buenos Aires', '1900', null, -34.9135, -57.9500, true);

-- ---------- Pedidos históricos ----------
-- Se crean con la misma función que usa la app (create_order), simulando a cada cliente,
-- y luego se ajustan fecha y estado para tener un historial realista.
update public.store_settings set mp_enabled = true where id = 1;

do $$
declare
  o record;
  v_order public.orders;
  v_when timestamptz;
begin
  for o in
    select * from (values
      -- cliente, domicilio, medio, items, días atrás, hora, estado final, estado pago
      ('c0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000001'::uuid, 'efectivo',
       '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":2}]', 18, 10, 'entregado', 'pagado'),
      ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'mercadopago',
       '[{"product_id":"20000000-0000-0000-0000-000000000001","with_refill":true,"quantity":1}]', 15, 12, 'entregado', 'pagado'),
      ('c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'efectivo',
       '[{"product_id":"10000000-0000-0000-0000-000000000002","quantity":1}]', 12, 9, 'entregado', 'pagado'),
      ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'mercadopago',
       '[{"product_id":"20000000-0000-0000-0000-000000000002","with_refill":true,"quantity":2},{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]', 9, 17, 'entregado', 'pagado'),
      ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'efectivo',
       '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":3}]', 7, 11, 'cancelado', 'pendiente'),
      ('c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'efectivo',
       '[{"product_id":"20000000-0000-0000-0000-000000000003","with_refill":true,"quantity":1}]', 5, 15, 'entregado', 'pagado'),
      ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'efectivo',
       '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1},{"product_id":"20000000-0000-0000-0000-000000000002","with_refill":false,"quantity":1}]', 3, 10, 'entregado', 'pagado'),
      ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'mercadopago',
       '[{"product_id":"10000000-0000-0000-0000-000000000002","quantity":1}]', 1, 13, 'entregado', 'pagado'),
      ('c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'efectivo',
       '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":2}]', 0, 3, 'en_camino', 'pendiente'),
      ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'mercadopago',
       '[{"product_id":"20000000-0000-0000-0000-000000000001","with_refill":true,"quantity":1}]', 0, 2, 'en_preparacion', 'pagado'),
      ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'efectivo',
       '[{"product_id":"10000000-0000-0000-0000-000000000001","quantity":1}]', 0, 1, 'recibido', 'pendiente')
    ) as t(user_id, address_id, method, items, days_ago, hours_ago, final_status, final_payment)
  loop
    v_when := now() - make_interval(days => o.days_ago, hours => o.hours_ago);

    perform set_config('request.jwt.claims', json_build_object('sub', o.user_id, 'role', 'authenticated')::text, true);
    v_order := public.create_order(o.items::jsonb, o.address_id, o.method, gen_random_uuid(), null);
    perform set_config('request.jwt.claims', '', true);

    update public.orders
       set created_at = v_when,
           status = o.final_status,
           payment_status = o.final_payment,
           paid_at = case when o.final_payment = 'pagado' then v_when + interval '5 minutes' end,
           delivered_at = case when o.final_status = 'entregado' then v_when + interval '95 minutes' end,
           cancelled_at = case when o.final_status = 'cancelado' then v_when + interval '20 minutes' end
     where id = v_order.id;

    update public.order_status_history set created_at = v_when where order_id = v_order.id;
    update public.payments set created_at = v_when,
           status = case when provider = 'efectivo' and o.final_payment = 'pagado' then 'cobrado' else status end
     where order_id = v_order.id;

    if o.method = 'mercadopago' and o.final_payment = 'pagado' then
      insert into public.payments (order_id, provider, provider_payment_id, status, status_detail, amount, raw, created_at)
      values (v_order.id, 'mercadopago', 'DEMO-' || v_order.order_number, 'approved', 'accredited', v_order.total,
              '{"nota":"Registro de prueba generado por seed.sql, no corresponde a una operación real"}', v_when + interval '5 minutes');
    end if;

    insert into public.order_status_history (order_id, status, payment_status, note, source, created_at)
    select v_order.id, s.code, o.final_payment, 'Dato de prueba', 'admin', v_when + (s.sort_order * interval '15 minutes')
      from public.order_statuses s
     where o.final_status <> 'recibido'
       and ((o.final_status = 'cancelado' and s.code = 'cancelado')
         or (o.final_status <> 'cancelado' and s.code in ('en_preparacion', 'en_camino', 'entregado')
             and s.sort_order <= (select sort_order from public.order_statuses where code = o.final_status)));
  end loop;
end;
$$;

-- El pago electrónico queda deshabilitado hasta configurar Mercado Pago (ver docs/CONFIGURACION.md)
update public.store_settings set mp_enabled = false where id = 1;

-- Limpia la auditoría generada por la carga inicial
truncate public.audit_log;
