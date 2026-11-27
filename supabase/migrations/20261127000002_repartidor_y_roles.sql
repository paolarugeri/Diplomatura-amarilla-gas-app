-- =====================================================================
-- Amarilla Gas · Perfil de repartidor y gestión de permisos
-- - Nuevo rol 'repartidor' (además de 'cliente' y 'admin').
-- - Los pedidos se pueden asignar a un repartidor (orders.assigned_to).
-- - El repartidor solo ve los pedidos que tiene asignados y solo puede
--   marcarlos "En camino" y "Entregado" (función driver_update_order).
-- - Solo un administrador puede cambiar roles (admin_set_user_role) y
--   asignar pedidos (admin_assign_order). Desde la app nadie puede
--   escribir directamente la columna "role": solo a través de esa función.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- 1. Roles posibles ----------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('cliente', 'admin', 'repartidor'));
comment on table public.profiles is
  'Datos del usuario. El rol (cliente, admin o repartidor) solo lo cambia un administrador con admin_set_user_role.';

-- 2. Asignación de pedidos a un repartidor -----------------------------
alter table public.orders add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
alter table public.orders add column if not exists assigned_at timestamptz;
comment on column public.orders.assigned_to is 'Repartidor asignado al pedido (perfil con rol repartidor).';
create index if not exists orders_assigned_idx on public.orders (assigned_to, status);

-- 3. El historial registra también los cambios hechos por el repartidor
alter table public.order_status_history drop constraint if exists order_status_history_source_check;
alter table public.order_status_history
  add constraint order_status_history_source_check
  check (source in ('cliente', 'admin', 'pasarela', 'sistema', 'repartidor'));

-- 4. Funciones auxiliares ---------------------------------------------
create or replace function public.is_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'repartidor');
$$;

-- Pedido asignado al repartidor que está usando la app
create or replace function public.is_my_delivery(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
     where o.id = p_order_id and o.assigned_to = auth.uid() and public.is_driver()
  );
$$;

-- 5. Lectura: el repartidor ve solo sus pedidos asignados ---------------
drop policy if exists "pedidos asignados al repartidor" on public.orders;
create policy "pedidos asignados al repartidor" on public.orders for select to authenticated
  using (assigned_to = auth.uid() and public.is_driver());

drop policy if exists "detalle pedidos asignados" on public.order_items;
create policy "detalle pedidos asignados" on public.order_items for select to authenticated
  using (public.is_my_delivery(order_id));

drop policy if exists "historial pedidos asignados" on public.order_status_history;
create policy "historial pedidos asignados" on public.order_status_history for select to authenticated
  using (public.is_my_delivery(order_id));

drop policy if exists "pagos pedidos asignados" on public.payments;
create policy "pagos pedidos asignados" on public.payments for select to authenticated
  using (public.is_my_delivery(order_id));

-- 6. Cambio de rol: solo un administrador ------------------------------
create or replace function public.admin_set_user_role(
  p_user_id  uuid,
  p_role     text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'No tenés permisos para realizar esta acción.' using errcode = '42501';
  end if;

  if p_role not in ('cliente', 'admin', 'repartidor') then
    raise exception 'Perfil inválido.';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No podés cambiar tu propio perfil. Pedile a otro administrador que lo haga.';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Usuario inexistente.';
  end if;

  if v_profile.role = p_role then
    return v_profile;
  end if;

  -- Si deja de ser repartidor, sus pedidos sin entregar quedan sin asignar
  if v_profile.role = 'repartidor' then
    update public.orders
       set assigned_to = null, assigned_at = null
     where assigned_to = p_user_id and status not in ('entregado', 'cancelado');
  end if;

  update public.profiles set role = p_role where id = p_user_id returning * into v_profile;
  return v_profile;  -- el cambio queda registrado en audit_log (trigger audit_profiles)
end;
$$;

-- 7. Asignar (o quitar) el repartidor de un pedido: solo administrador ----
create or replace function public.admin_assign_order(
  p_order_id   uuid,
  p_driver_id  uuid  -- null = quitar la asignación
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'No tenés permisos para realizar esta acción.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente.';
  end if;

  if v_order.status in ('entregado', 'cancelado') then
    raise exception 'El pedido ya está % y no se puede reasignar.', lower((select label from public.order_statuses where code = v_order.status));
  end if;

  if p_driver_id is not null
     and not exists (select 1 from public.profiles where id = p_driver_id and role = 'repartidor') then
    raise exception 'La persona elegida no tiene perfil de repartidor.';
  end if;

  if v_order.assigned_to is not distinct from p_driver_id then
    return v_order;
  end if;

  update public.orders
     set assigned_to = p_driver_id,
         assigned_at = case when p_driver_id is null then null else now() end
   where id = p_order_id
   returning * into v_order;

  return v_order;  -- el cambio queda registrado en audit_log (trigger audit_orders)
end;
$$;

-- 8. El repartidor actualiza sus pedidos: "En camino" y "Entregado" ------
create or replace function public.driver_update_order(
  p_order_id  uuid,
  p_status    text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    public.orders;
  v_collect  boolean := false;
begin
  if not public.is_driver() then
    raise exception 'No tenés permisos para realizar esta acción.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.assigned_to is distinct from auth.uid() then
    raise exception 'Este pedido no está asignado a vos.';
  end if;

  if p_status not in ('en_camino', 'entregado') then
    raise exception 'El repartidor solo puede marcar los pedidos "En camino" o "Entregado".';
  end if;

  if v_order.status = p_status then
    return v_order;
  end if;

  if v_order.status in ('entregado', 'cancelado') then
    raise exception 'El pedido ya está % y no puede cambiar de estado.', lower((select label from public.order_statuses where code = v_order.status));
  end if;

  if v_order.payment_method = 'mercadopago' and v_order.payment_status <> 'pagado' then
    raise exception 'El pedido tiene un pago electrónico pendiente. Consultá con la administración antes de salir.';
  end if;

  if p_status = 'entregado' and v_order.status <> 'en_camino' then
    raise exception 'Primero marcá el pedido "En camino".';
  end if;

  -- Efectivo contra entrega: al entregar, el repartidor cobra el importe
  v_collect := p_status = 'entregado' and v_order.payment_method = 'efectivo' and v_order.payment_status <> 'pagado';

  update public.orders
     set status         = p_status,
         payment_status = case when v_collect then 'pagado' else payment_status end,
         paid_at        = case when v_collect then now() else paid_at end,
         delivered_at   = case when p_status = 'entregado' then now() else delivered_at end
   where id = p_order_id
   returning * into v_order;

  if v_collect then
    update public.payments set status = 'cobrado', updated_at = now()
     where order_id = p_order_id and provider = 'efectivo' and status <> 'cobrado';
  end if;

  insert into public.order_status_history (order_id, status, payment_status, note, changed_by, source)
  values (
    p_order_id, p_status, v_order.payment_status,
    case when v_collect then 'Entregado y cobrado en efectivo por el repartidor' end,
    auth.uid(), 'repartidor'
  );

  return v_order;
end;
$$;

-- 9. Quién puede ejecutar cada función ---------------------------------
revoke execute on function public.is_driver() from public, anon;
grant  execute on function public.is_driver() to authenticated;
revoke execute on function public.is_my_delivery(uuid) from public, anon;
grant  execute on function public.is_my_delivery(uuid) to authenticated;

revoke execute on function public.admin_set_user_role(uuid, text) from public, anon;
grant  execute on function public.admin_set_user_role(uuid, text) to authenticated;

revoke execute on function public.admin_assign_order(uuid, uuid) from public, anon;
grant  execute on function public.admin_assign_order(uuid, uuid) to authenticated;

revoke execute on function public.driver_update_order(uuid, text) from public, anon;
grant  execute on function public.driver_update_order(uuid, text) to authenticated;

-- Recordatorio de seguridad: la app no puede escribir "role" directamente.
-- (Desde el esquema inicial solo se permite actualizar full_name y phone.)
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
