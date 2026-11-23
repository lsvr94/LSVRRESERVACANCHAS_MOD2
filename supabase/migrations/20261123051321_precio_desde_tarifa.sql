-- El precio de una reserva lo fija la base desde tarifas (ADR-0002: la base es la fuente de verdad).
-- Así, ni la app ni un agente IA ni un script pueden guardar un precio distinto al de la tarifa.

create function public.reservas_precio_desde_tarifa()
returns trigger
language plpgsql
-- security definer: tarifas tiene RLS sin políticas; el trigger debe leerla con cualquier rol.
security definer
set search_path = ''
as $$
begin
  -- En un UPDATE que no cambia cancha ni hora, el precio es inmutable: se conserva el original
  -- (también si cambió la tarifa después de reservar).
  if tg_op = 'UPDATE'
     and new.cancha_id = old.cancha_id
     and new.hora_inicio = old.hora_inicio then
    new.precio := old.precio;
    return new;
  end if;

  -- INSERT, o UPDATE que mueve la reserva de cancha u hora: se copia la tarifa vigente.
  select t.precio_hora
    into new.precio
    from public.tarifas t
   where t.cancha_id = new.cancha_id
     and new.hora_inicio >= t.hora_desde
     and new.hora_inicio < t.hora_hasta;

  if not found then
    -- check_violation (23514): lib/reservas/errores-db.ts lo responde como 422.
    raise exception using
      errcode = 'check_violation',
      message = format('No hay tarifa para la cancha %s a las %s:00', new.cancha_id, new.hora_inicio);
  end if;

  return new;
end;
$$;

create trigger reservas_precio_insert
  before insert on public.reservas
  for each row execute function public.reservas_precio_desde_tarifa();

create trigger reservas_precio_update
  before update of precio, cancha_id, hora_inicio on public.reservas
  for each row execute function public.reservas_precio_desde_tarifa();

-- Nombre del índice anti-choque: lib/reservas/errores-db.ts lo busca en el mensaje de error
-- para responder 409 BLOQUE_OCUPADO. Si se renombra, hay que actualizar ese archivo.
comment on index public.reservas_bloque_ocupado_unico is
  'lib/reservas/errores-db.ts depende de este nombre para responder 409 BLOQUE_OCUPADO. No renombrar sin actualizarlo.';
