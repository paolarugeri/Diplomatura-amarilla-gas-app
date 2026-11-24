-- =====================================================================
-- Amarilla Gas · E-commerce de GLP
-- Esquema inicial: tablas, seguridad por filas (RLS), funciones y triggers
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Tablas de referencia (catálogos de estados y medios de pago)
-- ---------------------------------------------------------------------
create table public.order_statuses (
  code        text primary key,
  label       text not null,
  sort_order  int  not null,
  is_final    boolean not null default false
);
comment on table public.order_statuses is 'Estados del pedido / estados de entrega';

insert into public.order_statuses (code, label, sort_order, is_final) values
  ('recibido',        'Pedido recibido',   1, false),
  ('pendiente_pago',  'Pendiente de pago', 2, false),
  ('pago_confirmado', 'Pago confirmado',   3, false),
  ('en_preparacion',  'En preparación',    4, false),
  ('en_camino',       'En camino',         5, false),
  ('entregado',       'Entregado',         6, true),
  ('cancelado',       'Cancelado',         7, true);

create table public.payment_statuses (
  code   text primary key,
  label  text not null
);
insert into public.payment_statuses (code, label) values
  ('pendiente',   'Pendiente de pago'),
  ('pagado',      'Pagado'),
  ('rechazado',   'Rechazado'),
  ('reintegrado', 'Reintegrado');

create table public.payment_methods (
  code         text primary key,
  label        text not null,
  description  text not null,
  active       boolean not null default true,
  sort_order   int not null default 0
);
insert into public.payment_methods (code, label, description, sort_order) values
  ('mercadopago', 'Pago electrónico',
   'Pagá con tarjeta de débito, crédito o dinero en cuenta a través de Mercado Pago.', 1),
  ('efectivo', 'Efectivo contra entrega',
   'Abonás el importe al repartidor cuando recibís los productos.', 2);

-- ---------------------------------------------------------------------
-- 2. Configuración general de la tienda (una sola fila)
-- ---------------------------------------------------------------------
create table public.store_settings (
  id                      int primary key default 1 check (id = 1),
  delivery_eta_minutes    int  not null default 120 check (delivery_eta_minutes between 15 and 2880),
  delivery_eta_label      text not null default 'dentro de las próximas 2 horas',
  delivery_eta_confirmed  boolean not null default false,
  mp_enabled              boolean not null default false,
  support_phone           text not null default '0800-555-2642',
  support_email           text not null default 'pedidos@amarillagas.com.ar',
  updated_at              timestamptz not null default now()
);
comment on column public.store_settings.delivery_eta_confirmed is
  'Si es false, el plazo se muestra como estimado. Solo pasar a true con disponibilidad operativa confirmada.';
comment on column public.store_settings.mp_enabled is
  'Habilita el pago electrónico. Activar solo después de configurar las credenciales de Mercado Pago.';
insert into public.store_settings (id) values (1);

-- ---------------------------------------------------------------------
-- 3. Usuarios / clientes
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(btrim(full_name)) between 3 and 120),
  email       text not null,
  phone       text not null check (phone ~ '^[0-9 +()-]{8,20}$'),
  role        text not null default 'cliente' check (role in ('cliente', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Datos del cliente / usuario. El rol solo se modifica desde la base (no desde la app).';
create index profiles_role_idx on public.profiles (role);

create table public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  label        text not null default 'Casa' check (char_length(label) between 1 and 40),
  street       text not null check (char_length(btrim(street)) between 2 and 120),
  number       text not null check (number ~ '^[0-9]{1,6}[A-Za-z]?$|^S/?N$'),
  apartment    text check (apartment is null or char_length(apartment) <= 30),
  city         text not null check (char_length(btrim(city)) between 2 and 80),
  province     text not null check (char_length(btrim(province)) between 2 and 80),
  postal_code  text not null check (postal_code ~ '^([A-Za-z][0-9]{4}[A-Za-z]{3}|[0-9]{4})$'),
  reference    text check (reference is null or char_length(reference) <= 250),
  lat          double precision check (lat is null or lat between -90 and 90),
  lng          double precision check (lng is null or lng between -180 and 180),
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;

-- ---------------------------------------------------------------------
-- 4. Productos y precios
-- ---------------------------------------------------------------------
create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  sku                text not null unique check (sku ~ '^[A-Z0-9-]{3,30}$'),
  name               text not null check (char_length(btrim(name)) between 3 and 80),
  category           text not null check (category in ('carga', 'envase')),
  capacity_kg        numeric(6,2) not null check (capacity_kg > 0),
  container_type     text not null check (container_type in ('chapa', 'plastico', 'propio')),
  description        text not null default '',
  image_url          text,
  price              numeric(12,2) not null check (price >= 0),
  refill_product_id  uuid references public.products (id),
  active             boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint products_refill_only_for_containers
    check (category = 'envase' or refill_product_id is null),
  constraint products_refill_not_self check (refill_product_id is distinct from id)
);
comment on column public.products.refill_product_id is
  'Para envases: carga de GLP correspondiente. El precio "con carga" se calcula como envase + carga.';

create table public.product_prices (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references public.products (id) on delete cascade,
  price       numeric(12,2) not null,
  valid_from  timestamptz not null default now(),
  changed_by  uuid references auth.users (id)
);
comment on table public.product_prices is 'Historial de precios de cada producto.';
create index product_prices_product_idx on public.product_prices (product_id, valid_from desc);

-- ---------------------------------------------------------------------
-- 5. Pedidos
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id                      uuid primary key default gen_random_uuid(),
  order_number            text not null unique
                            default ('AG-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  user_id                 uuid not null references public.profiles (id),
  address_id              uuid references public.addresses (id) on delete set null,
  delivery_address        jsonb not null,
  customer_name           text not null,
  customer_email          text not null,
  customer_phone          text not null,
  payment_method          text not null references public.payment_methods (code),
  payment_status          text not null default 'pendiente' references public.payment_statuses (code),
  status                  text not null references public.order_statuses (code),
  total                   numeric(12,2) not null check (total > 0),
  items_count             int not null check (items_count > 0),
  delivery_eta_label      text not null,
  delivery_eta_confirmed  boolean not null default false,
  notes                   text check (notes is null or char_length(notes) <= 300),
  idempotency_key         uuid not null,
  fingerprint             text not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  paid_at                 timestamptz,
  delivered_at            timestamptz,
  cancelled_at            timestamptz,
  constraint orders_idempotency_unique unique (user_id, idempotency_key)
);
create index orders_user_idx        on public.orders (user_id, created_at desc);
create index orders_status_idx      on public.orders (status);
create index orders_created_idx     on public.orders (created_at desc);
create index orders_fingerprint_idx on public.orders (user_id, fingerprint, created_at desc);

create table public.order_items (
  id                    bigint generated always as identity primary key,
  order_id              uuid not null references public.orders (id) on delete cascade,
  product_id            uuid not null references public.products (id),
  sku                   text not null,
  product_name          text not null,
  category              text not null,
  capacity_kg           numeric(6,2) not null,
  container_type        text not null,
  with_refill           boolean not null default false,
  refill_product_id     uuid references public.products (id),
  refill_name           text,
  unit_base_price       numeric(12,2) not null check (unit_base_price >= 0),
  unit_refill_price     numeric(12,2) not null default 0 check (unit_refill_price >= 0),
  unit_price            numeric(12,2) not null check (unit_price > 0),
  quantity              int not null check (quantity between 1 and 20),
  subtotal              numeric(12,2) not null,
  constraint order_items_price_consistency check (unit_price = unit_base_price + unit_refill_price),
  constraint order_items_subtotal_consistency check (subtotal = unit_price * quantity)
);
comment on table public.order_items is 'Detalle del pedido. Guarda el precio vigente al momento de la compra.';
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id              bigint generated always as identity primary key,
  order_id        uuid not null references public.orders (id) on delete cascade,
  status          text not null references public.order_statuses (code),
  payment_status  text not null references public.payment_statuses (code),
  note            text,
  changed_by      uuid references auth.users (id),
  source          text not null default 'sistema' check (source in ('cliente', 'admin', 'pasarela', 'sistema')),
  created_at      timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.payments (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders (id) on delete cascade,
  provider                text not null check (provider in ('mercadopago', 'efectivo')),
  provider_preference_id  text,
  provider_payment_id     text unique,
  status                  text not null,
  status_detail           text,
  amount                  numeric(12,2),
  raw                     jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
comment on table public.payments is 'Operaciones de pago registradas (pasarela o efectivo).';
create index payments_order_idx on public.payments (order_id);

create table public.email_notifications (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete cascade,
  to_email             text not null,
  kind                 text not null default 'confirmacion_pedido',
  status               text not null check (status in ('enviado', 'error', 'no_configurado')),
  provider_message_id  text,
  error                text,
  created_at           timestamptz not null default now()
);
create index email_notifications_order_idx on public.email_notifications (order_id);

-- ---------------------------------------------------------------------
-- 6. Historial de modificaciones (auditoría)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index audit_log_table_record_idx on public.audit_log (table_name, record_id, changed_at desc);

-- =====================================================================
-- Funciones auxiliares y triggers
-- =====================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch  before update on public.profiles  for each row execute function public.touch_updated_at();
create trigger addresses_touch before update on public.addresses for each row execute function public.touch_updated_at();
create trigger products_touch  before update on public.products  for each row execute function public.touch_updated_at();
create trigger orders_touch    before update on public.orders    for each row execute function public.touch_updated_at();
create trigger payments_touch  before update on public.payments  for each row execute function public.touch_updated_at();
create trigger settings_touch  before update on public.store_settings for each row execute function public.touch_updated_at();

-- Alta automática del perfil al registrarse (el rol siempre es 'cliente')
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''), '00000000'),
    'cliente'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantener el correo del perfil sincronizado con auth
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Un solo domicilio habitual por cliente; el primero queda como habitual
create or replace function public.addresses_default_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and not exists (select 1 from public.addresses where user_id = new.user_id) then
    new.is_default := true;
  end if;
  if new.is_default then
    update public.addresses
       set is_default = false
     where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;

create trigger addresses_default_guard
  before insert or update of is_default on public.addresses
  for each row execute function public.addresses_default_guard();

-- Si se borra el domicilio habitual, el más reciente pasa a ser habitual
create or replace function public.addresses_reassign_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default then
    update public.addresses
       set is_default = true
     where id = (select id from public.addresses where user_id = old.user_id order by created_at desc limit 1);
  end if;
  return old;
end;
$$;

create trigger addresses_reassign_default
  after delete on public.addresses
  for each row execute function public.addresses_reassign_default();

-- Historial de precios
create or replace function public.track_product_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.product_prices (product_id, price, changed_by)
    values (new.id, new.price, auth.uid());
  end if;
  return new;
end;
$$;

create trigger products_price_history
  after insert or update of price on public.products
  for each row execute function public.track_product_price();

-- Auditoría genérica
create or replace function public.audit_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec_id text;
begin
  rec_id := coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', '?');
  insert into public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  values (
    tg_table_name,
    rec_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.audit_changes();
create trigger audit_orders after update or delete on public.orders
  for each row execute function public.audit_changes();
create trigger audit_settings after update on public.store_settings
  for each row execute function public.audit_changes();
create trigger audit_profiles after update or delete on public.profiles
  for each row execute function public.audit_changes();

-- =====================================================================
-- Operaciones de negocio (se ejecutan en el servidor, nunca en el navegador)
-- =====================================================================

-- Crear pedido: calcula precios desde la base, valida y evita duplicados.
create or replace function public.create_order(
  p_items            jsonb,
  p_address_id       uuid,
  p_payment_method   text,
  p_idempotency_key  uuid,
  p_notes            text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_profile    public.profiles;
  v_address    public.addresses;
  v_settings   public.store_settings;
  v_order      public.orders;
  v_item       record;
  v_product    public.products;
  v_refill     public.products;
  v_total      numeric(12,2) := 0;
  v_count      int := 0;
  v_lines      jsonb := '[]'::jsonb;
  v_fp         text;
  v_status     text;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión para comprar.' using errcode = '28000';
  end if;

  -- Serializa los pedidos de un mismo cliente (evita carreras por doble clic)
  perform pg_advisory_xact_lock(hashtext('order:' || v_uid::text));

  -- Idempotencia: si ya se procesó esta misma solicitud, devolver el pedido existente
  select * into v_order from public.orders
   where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    return v_order;
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'No encontramos tu perfil de cliente.';
  end if;

  select * into v_address from public.addresses where id = p_address_id and user_id = v_uid;
  if not found then
    raise exception 'Seleccioná un domicilio de entrega válido.';
  end if;

  select * into v_settings from public.store_settings where id = 1;

  if not exists (select 1 from public.payment_methods where code = p_payment_method and active) then
    raise exception 'El medio de pago seleccionado no está disponible.';
  end if;
  if p_payment_method = 'mercadopago' and not v_settings.mp_enabled then
    raise exception 'El pago electrónico todavía no está habilitado. Elegí efectivo contra entrega.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.';
  end if;
  if jsonb_array_length(p_items) > 20 then
    raise exception 'El pedido tiene demasiados productos distintos.';
  end if;

  -- Agrupa líneas repetidas (mismo producto y misma opción de carga)
  for v_item in
    select (e ->> 'product_id')::uuid as product_id,
           coalesce((e ->> 'with_refill')::boolean, false) as with_refill,
           sum((e ->> 'quantity')::int) as quantity
      from jsonb_array_elements(p_items) e
     group by 1, 2
     order by 1, 2
  loop
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 20 then
      raise exception 'La cantidad de cada producto debe estar entre 1 y 20.';
    end if;

    select * into v_product from public.products where id = v_item.product_id and active;
    if not found then
      raise exception 'Uno de los productos ya no está disponible. Revisá tu carrito.';
    end if;

    v_refill := null;
    if v_item.with_refill then
      if v_product.category <> 'envase' or v_product.refill_product_id is null then
        raise exception 'El producto % no admite la opción con carga.', v_product.name;
      end if;
      select * into v_refill from public.products where id = v_product.refill_product_id and active;
      if not found then
        raise exception 'La carga para % no está disponible en este momento.', v_product.name;
      end if;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'product_id',        v_product.id,
      'sku',               v_product.sku,
      'product_name',      v_product.name,
      'category',          v_product.category,
      'capacity_kg',       v_product.capacity_kg,
      'container_type',    v_product.container_type,
      'with_refill',       v_item.with_refill,
      'refill_product_id', v_refill.id,
      'refill_name',       v_refill.name,
      'unit_base_price',   v_product.price,
      'unit_refill_price', coalesce(v_refill.price, 0),
      'quantity',          v_item.quantity
    );
    v_total := v_total + (v_product.price + coalesce(v_refill.price, 0)) * v_item.quantity;
    v_count := v_count + v_item.quantity;
  end loop;

  -- Prevención de duplicados: mismo contenido y domicilio en los últimos 2 minutos
  v_fp := md5(v_lines::text || p_address_id::text || p_payment_method);
  if exists (
    select 1 from public.orders
     where user_id = v_uid and fingerprint = v_fp
       and status <> 'cancelado'
       and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'Ya registramos un pedido idéntico hace instantes. Revisá "Mis pedidos" antes de repetirlo.'
      using errcode = 'P0002';
  end if;

  v_status := case when p_payment_method = 'mercadopago' then 'pendiente_pago' else 'recibido' end;

  insert into public.orders (
    user_id, address_id, delivery_address, customer_name, customer_email, customer_phone,
    payment_method, payment_status, status, total, items_count,
    delivery_eta_label, delivery_eta_confirmed, notes, idempotency_key, fingerprint
  ) values (
    v_uid, v_address.id,
    jsonb_build_object(
      'label', v_address.label, 'street', v_address.street, 'number', v_address.number,
      'apartment', v_address.apartment, 'city', v_address.city, 'province', v_address.province,
      'postal_code', v_address.postal_code, 'reference', v_address.reference,
      'lat', v_address.lat, 'lng', v_address.lng
    ),
    v_profile.full_name, v_profile.email, v_profile.phone,
    p_payment_method, 'pendiente', v_status, v_total, v_count,
    v_settings.delivery_eta_label, v_settings.delivery_eta_confirmed,
    nullif(btrim(p_notes), ''), p_idempotency_key, v_fp
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, product_id, sku, product_name, category, capacity_kg, container_type,
    with_refill, refill_product_id, refill_name,
    unit_base_price, unit_refill_price, unit_price, quantity, subtotal
  )
  select v_order.id,
         (l ->> 'product_id')::uuid, l ->> 'sku', l ->> 'product_name', l ->> 'category',
         (l ->> 'capacity_kg')::numeric, l ->> 'container_type',
         (l ->> 'with_refill')::boolean, nullif(l ->> 'refill_product_id', '')::uuid, l ->> 'refill_name',
         (l ->> 'unit_base_price')::numeric, (l ->> 'unit_refill_price')::numeric,
         (l ->> 'unit_base_price')::numeric + (l ->> 'unit_refill_price')::numeric,
         (l ->> 'quantity')::int,
         ((l ->> 'unit_base_price')::numeric + (l ->> 'unit_refill_price')::numeric) * (l ->> 'quantity')::int
    from jsonb_array_elements(v_lines) l;

  insert into public.order_status_history (order_id, status, payment_status, note, changed_by, source)
  values (v_order.id, v_status, 'pendiente',
          case when p_payment_method = 'efectivo'
               then 'Pedido registrado. Se abona en efectivo al repartidor.'
               else 'Pedido registrado. Esperando confirmación de Mercado Pago.' end,
          v_uid, 'cliente');

  if p_payment_method = 'efectivo' then
    insert into public.payments (order_id, provider, status, amount)
    values (v_order.id, 'efectivo', 'pendiente', v_total);
  end if;

  return v_order;
end;
$$;

-- Cambio de estado por parte de la empresa
create or replace function public.admin_update_order(
  p_order_id        uuid,
  p_status          text,
  p_payment_status  text default null,
  p_note            text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders;
  v_pay    text;
begin
  if not public.is_admin() then
    raise exception 'No tenés permisos para realizar esta acción.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente.';
  end if;

  if not exists (select 1 from public.order_statuses where code = p_status) then
    raise exception 'Estado inválido.';
  end if;

  v_pay := coalesce(p_payment_status, v_order.payment_status);
  if not exists (select 1 from public.payment_statuses where code = v_pay) then
    raise exception 'Estado de pago inválido.';
  end if;

  if v_order.status in ('entregado', 'cancelado') and p_status <> v_order.status then
    raise exception 'El pedido ya está % y no puede cambiar de estado.', lower((select label from public.order_statuses where code = v_order.status));
  end if;

  -- Los pagos electrónicos solo los confirma la pasarela
  if v_order.payment_method = 'mercadopago' and v_pay is distinct from v_order.payment_status
     and v_pay = 'pagado' then
    raise exception 'Los pagos electrónicos solo se confirman con la respuesta de Mercado Pago.';
  end if;

  if p_status = 'pago_confirmado' and v_pay <> 'pagado' then
    raise exception 'No se puede marcar "Pago confirmado" si el pago no está registrado como pagado.';
  end if;

  if v_order.payment_method = 'mercadopago' and v_order.payment_status <> 'pagado'
     and p_status in ('en_preparacion', 'en_camino', 'entregado') then
    raise exception 'El pedido tiene un pago electrónico pendiente. Esperá la confirmación de Mercado Pago o cancelalo.';
  end if;

  if p_status = v_order.status and v_pay = v_order.payment_status then
    return v_order;
  end if;

  update public.orders
     set status         = p_status,
         payment_status = v_pay,
         paid_at        = case when v_pay = 'pagado' and paid_at is null then now() else paid_at end,
         delivered_at   = case when p_status = 'entregado' then now() else delivered_at end,
         cancelled_at   = case when p_status = 'cancelado' then now() else cancelled_at end
   where id = p_order_id
   returning * into v_order;

  if v_order.payment_method = 'efectivo' and v_pay = 'pagado' then
    update public.payments set status = 'cobrado', updated_at = now()
     where order_id = p_order_id and provider = 'efectivo' and status <> 'cobrado';
  end if;

  insert into public.order_status_history (order_id, status, payment_status, note, changed_by, source)
  values (p_order_id, p_status, v_pay, nullif(btrim(p_note), ''), auth.uid(), 'admin');

  return v_order;
end;
$$;

-- Resultado de pago informado por Mercado Pago (solo lo invoca el servidor con service_role)
create or replace function public.apply_mp_payment(
  p_order_id       uuid,
  p_payment_id     text,
  p_status         text,
  p_status_detail  text,
  p_amount         numeric,
  p_raw            jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders;
  v_pay    text;
  v_status text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente.';
  end if;

  insert into public.payments (order_id, provider, provider_payment_id, status, status_detail, amount, raw)
  values (p_order_id, 'mercadopago', p_payment_id, p_status, p_status_detail, p_amount, p_raw)
  on conflict (provider_payment_id) do update
     set status = excluded.status, status_detail = excluded.status_detail,
         amount = excluded.amount, raw = excluded.raw, updated_at = now();

  if v_order.payment_method <> 'mercadopago' or v_order.status in ('entregado', 'cancelado') then
    return v_order;
  end if;

  if p_status = 'approved' then
    if p_amount is null or p_amount < v_order.total then
      raise exception 'El importe informado por la pasarela no coincide con el pedido.';
    end if;
    v_pay := 'pagado';
    v_status := case when v_order.status in ('recibido', 'pendiente_pago') then 'pago_confirmado' else v_order.status end;
  elsif p_status in ('rejected', 'cancelled') then
    v_pay := 'rechazado';
    v_status := v_order.status;
  elsif p_status in ('refunded', 'charged_back') then
    v_pay := 'reintegrado';
    v_status := v_order.status;
  else
    v_pay := 'pendiente';
    v_status := v_order.status;
  end if;

  if v_pay is distinct from v_order.payment_status or v_status is distinct from v_order.status then
    update public.orders
       set payment_status = v_pay,
           status = v_status,
           paid_at = case when v_pay = 'pagado' then coalesce(paid_at, now()) else paid_at end
     where id = p_order_id
     returning * into v_order;

    insert into public.order_status_history (order_id, status, payment_status, note, source)
    values (p_order_id, v_status, v_pay, 'Mercado Pago informó: ' || p_status || coalesce(' (' || p_status_detail || ')', ''), 'pasarela');
  end if;

  return v_order;
end;
$$;

-- Indicadores del panel administrativo (zona horaria de Argentina)
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz     text := 'America/Argentina/Buenos_Aires';
  v_today  date := (now() at time zone v_tz)::date;
  v_month  date := date_trunc('month', now() at time zone v_tz)::date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'No tenés permisos para ver los indicadores.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'orders_today',    (select count(*) from orders where (created_at at time zone v_tz)::date = v_today),
    'orders_pending',  (select count(*) from orders where status not in ('entregado', 'cancelado')),
    'orders_delivered',(select count(*) from orders where status = 'entregado'),
    'delivered_today', (select count(*) from orders where status = 'entregado' and (delivered_at at time zone v_tz)::date = v_today),
    'sales_today',     (select coalesce(sum(total), 0) from orders where status <> 'cancelado' and (created_at at time zone v_tz)::date = v_today),
    'sales_month',     (select coalesce(sum(total), 0) from orders where status <> 'cancelado' and (created_at at time zone v_tz)::date >= v_month),
    'customers',       (select count(*) from profiles where role = 'cliente'),
    'top_products', coalesce((
        select jsonb_agg(t order by t.units desc, t.revenue desc)
          from (
            select oi.product_name || case when oi.with_refill then ' + carga' else '' end as name,
                   sum(oi.quantity)::int as units,
                   sum(oi.subtotal) as revenue
              from order_items oi join orders o on o.id = oi.order_id
             where o.status <> 'cancelado'
             group by 1
             order by 2 desc, 3 desc
             limit 5
          ) t), '[]'::jsonb),
    'by_status', coalesce((
        select jsonb_agg(jsonb_build_object('code', s.code, 'label', s.label, 'count', coalesce(c.n, 0)) order by s.sort_order)
          from order_statuses s
          left join (select status, count(*) n from orders group by status) c on c.status = s.code), '[]'::jsonb),
    'by_payment', coalesce((
        select jsonb_agg(jsonb_build_object('code', m.code, 'label', m.label, 'count', coalesce(c.n, 0), 'total', coalesce(c.t, 0)) order by m.sort_order)
          from payment_methods m
          left join (select payment_method, count(*) n, sum(total) t from orders where status <> 'cancelado' group by payment_method) c
            on c.payment_method = m.code), '[]'::jsonb),
    'last_days', coalesce((
        select jsonb_agg(jsonb_build_object('day', d::date, 'orders', coalesce(x.n, 0), 'total', coalesce(x.t, 0)) order by d)
          from generate_series(v_today - 13, v_today, interval '1 day') d
          left join (
            select (created_at at time zone v_tz)::date as day, count(*) n, sum(total) t
              from orders where status <> 'cancelado' group by 1
          ) x on x.day = d::date), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- =====================================================================
-- Seguridad: permisos y políticas RLS
-- =====================================================================

alter table public.order_statuses       enable row level security;
alter table public.payment_statuses     enable row level security;
alter table public.payment_methods      enable row level security;
alter table public.store_settings       enable row level security;
alter table public.profiles             enable row level security;
alter table public.addresses            enable row level security;
alter table public.products             enable row level security;
alter table public.product_prices       enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments             enable row level security;
alter table public.email_notifications  enable row level security;
alter table public.audit_log            enable row level security;

-- Catálogos públicos
create policy "estados visibles" on public.order_statuses   for select using (true);
create policy "estados pago visibles" on public.payment_statuses for select using (true);
create policy "medios de pago visibles" on public.payment_methods for select using (true);
create policy "medios de pago admin" on public.payment_methods for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Configuración
create policy "configuracion visible" on public.store_settings for select using (true);
create policy "configuracion admin" on public.store_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Perfiles
create policy "perfil propio o admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "editar perfil propio" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Domicilios
create policy "domicilios propios" on public.addresses for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "alta domicilio propio" on public.addresses for insert to authenticated
  with check (user_id = auth.uid());
create policy "editar domicilio propio" on public.addresses for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "borrar domicilio propio" on public.addresses for delete to authenticated
  using (user_id = auth.uid());

-- Productos
create policy "productos activos visibles" on public.products for select
  using (active or public.is_admin());
create policy "alta productos admin" on public.products for insert to authenticated
  with check (public.is_admin());
create policy "editar productos admin" on public.products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke delete on public.products from anon, authenticated;

create policy "historial precios admin" on public.product_prices for select to authenticated
  using (public.is_admin());

-- Pedidos: solo lectura desde la app; la escritura pasa por funciones del servidor
create policy "pedidos propios o admin" on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.orders from anon, authenticated;

create policy "detalle pedidos propios o admin" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
revoke insert, update, delete on public.order_items from anon, authenticated;

create policy "historial pedidos propios o admin" on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
revoke insert, update, delete on public.order_status_history from anon, authenticated;

create policy "pagos propios o admin" on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
revoke insert, update, delete on public.payments from anon, authenticated;

create policy "correos propios o admin" on public.email_notifications for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
revoke insert, update, delete on public.email_notifications from anon, authenticated;

create policy "auditoria admin" on public.audit_log for select to authenticated
  using (public.is_admin());
revoke insert, update, delete on public.audit_log from anon, authenticated;

revoke insert, update, delete on public.product_prices, public.order_statuses, public.payment_statuses
  from anon, authenticated;
revoke insert, delete on public.store_settings, public.payment_methods from anon, authenticated;

-- Funciones: quién puede ejecutarlas
revoke execute on function public.create_order(jsonb, uuid, text, uuid, text) from public, anon;
grant  execute on function public.create_order(jsonb, uuid, text, uuid, text) to authenticated;

revoke execute on function public.admin_update_order(uuid, text, text, text) from public, anon;
grant  execute on function public.admin_update_order(uuid, text, text, text) to authenticated;

revoke execute on function public.admin_dashboard() from public, anon;
grant  execute on function public.admin_dashboard() to authenticated;

revoke execute on function public.apply_mp_payment(uuid, text, text, text, numeric, jsonb) from public, anon, authenticated;
grant  execute on function public.apply_mp_payment(uuid, text, text, text, numeric, jsonb) to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

-- =====================================================================
-- Almacenamiento de imágenes de productos
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "imagenes productos publicas" on storage.objects for select
  using (bucket_id = 'productos');
create policy "subir imagenes admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public.is_admin());
create policy "editar imagenes admin" on storage.objects for update to authenticated
  using (bucket_id = 'productos' and public.is_admin());
create policy "borrar imagenes admin" on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public.is_admin());
