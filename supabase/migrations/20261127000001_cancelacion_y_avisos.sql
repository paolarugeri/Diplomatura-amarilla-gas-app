-- =====================================================================
-- Amarilla Gas · Cancelación por parte del cliente y avisos por correo
-- - El cliente puede cancelar su pedido mientras todavía no se empezó a preparar.
-- - Los avisos de cambio de estado se registran en email_notifications con
--   kind = 'estado_<código del estado>' (por ejemplo 'estado_en_camino').
-- =====================================================================

-- Estados en los que el cliente todavía puede cancelar
create or replace function public.customer_can_cancel(p_status text, p_payment_status text)
returns boolean
language sql
immutable
as $$
  select p_status in ('recibido', 'pendiente_pago') and p_payment_status <> 'pagado'
$$;

-- Cancelación del pedido por parte del cliente
create or replace function public.cancel_my_order(
  p_order_id  uuid,
  p_reason    text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para cancelar el pedido.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.user_id <> auth.uid() then
    raise exception 'Pedido inexistente.';
  end if;

  if v_order.status = 'cancelado' then
    return v_order;
  end if;

  if v_order.payment_status = 'pagado' then
    raise exception 'El pedido ya está pagado. Para cancelarlo comunicate con nosotros y gestionamos el reintegro.';
  end if;

  if not public.customer_can_cancel(v_order.status, v_order.payment_status) then
    raise exception 'El pedido ya se está preparando y no se puede cancelar desde la app. Comunicate con nosotros.';
  end if;

  if v_reason is not null and char_length(v_reason) > 300 then
    raise exception 'El motivo puede tener hasta 300 caracteres.';
  end if;

  update public.orders
     set status = 'cancelado',
         cancelled_at = now()
   where id = p_order_id
   returning * into v_order;

  update public.payments set status = 'anulado', updated_at = now()
   where order_id = p_order_id and provider = 'efectivo' and status = 'pendiente';

  insert into public.order_status_history (order_id, status, payment_status, note, changed_by, source)
  values (p_order_id, 'cancelado', v_order.payment_status,
          'Cancelado por el cliente' || coalesce(': ' || v_reason, ''), auth.uid(), 'cliente');

  return v_order;
end;
$$;

revoke execute on function public.cancel_my_order(uuid, text) from public, anon;
grant  execute on function public.cancel_my_order(uuid, text) to authenticated;

-- Búsqueda rápida de avisos ya enviados por pedido y tipo
create index if not exists email_notifications_order_kind_idx
  on public.email_notifications (order_id, kind, created_at desc);
