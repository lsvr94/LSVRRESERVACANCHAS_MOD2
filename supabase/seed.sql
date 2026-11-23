-- Datos de prueba para desarrollo local (se cargan con `supabase db reset`).
-- Las reservas usan la fecha de mañana para que siempre sean futuras.

insert into public.canchas (id, nombre) values
  (1, 'Cancha 1'),
  (2, 'Cancha 2'),
  (3, 'Cancha 3');

-- Día: 10:00–18:00 a S/ 80. Noche: 18:00–23:00 a S/ 120.
insert into public.tarifas (cancha_id, hora_desde, hora_hasta, precio_hora)
select c.id, f.desde, f.hasta, f.precio
from public.canchas c
cross join (values (10, 18, 80.00), (18, 23, 120.00)) as f (desde, hasta, precio);

insert into public.clientes (nombre, telefono) values
  ('Ana Torres',   '+51900000001'),
  ('Bruno Díaz',   '+51900000002'),
  ('Carla Ramos',  '+51900000003');

-- precio copia la tarifa que aplica a la hora de inicio, como hará la app al reservar.
insert into public.reservas (cliente_id, cancha_id, fecha, hora_inicio, estado, precio)
select cl.id, r.cancha_id, current_date + 1, r.hora_inicio, r.estado, t.precio_hora
from (values
  ('+51900000001', 1, 10, 'confirmada'),  -- día: S/ 80
  ('+51900000002', 1, 18, 'cancelada'),   -- cancelada: libera el bloque...
  ('+51900000003', 1, 18, 'confirmada'),  -- ...por eso esta no choca: S/ 120
  ('+51900000001', 2, 20, 'pendiente')    -- noche, aún sin pagar: S/ 120
) as r (telefono, cancha_id, hora_inicio, estado)
join public.clientes cl on cl.telefono = r.telefono
join public.tarifas t
  on t.cancha_id = r.cancha_id
 and r.hora_inicio >= t.hora_desde
 and r.hora_inicio <  t.hora_hasta;
-- Recaudado de mañana = 80 + 120 = S/ 200 (solo confirmadas).
