-- Los cambios de estado de una reserva los garantiza la base (ADR-0002), aunque escriba
-- un agente IA o un script directo, sin pasar por la API.
-- Regla (AGENTS.md y lib/reservas/estados.ts; si cambia una, hay que cambiar la otra):
--   pendiente → confirmada; pendiente o confirmada → cancelada; una cancelada no vuelve atrás.

create function public.reservas_validar_transicion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Un UPDATE que no cambia el estado no es una transición.
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  if (old.estado, new.estado) in (
    ('pendiente', 'confirmada'),
    ('pendiente', 'cancelada'),
    ('confirmada', 'cancelada')
  ) then
    return new;
  end if;

  -- SQLSTATE propio: lib/reservas/errores-db.ts lo responde como 409 TRANSICION_NO_PERMITIDA.
  raise exception using
    errcode = 'RS001',
    message = format('Transición no permitida: %s → %s', old.estado, new.estado);
end;
$$;

create trigger reservas_transicion_estado
  before update of estado on public.reservas
  for each row execute function public.reservas_validar_transicion();
