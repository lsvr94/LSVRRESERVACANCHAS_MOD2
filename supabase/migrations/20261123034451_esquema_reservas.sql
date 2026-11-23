-- Esquema inicial de reservas de canchas.
-- Reglas: ver AGENTS.md (glosario) y docs/adr/0002-donde-viven-las-reglas.md.

-- Necesaria para la restricción de exclusión de tarifas (igualdad de cancha_id en un índice GiST).
create extension if not exists btree_gist with schema extensions;

-- Canchas: filas, no un CHECK fijo, para poder agregar una cuarta sin migrar.
create table public.canchas (
  id     smallint primary key,
  nombre text not null unique check (length(trim(nombre)) > 0)
);

-- Tarifas por cancha y franja horaria [hora_desde, hora_hasta).
create table public.tarifas (
  id          bigint generated always as identity primary key,
  cancha_id   smallint not null references public.canchas (id) on delete restrict,
  hora_desde  smallint not null,
  hora_hasta  smallint not null,
  precio_hora numeric(10, 2) not null check (precio_hora > 0),
  constraint tarifas_rango_valido
    check (hora_desde >= 10 and hora_hasta <= 23 and hora_desde < hora_hasta),
  -- Dos franjas de la misma cancha no pueden solaparse: así a cada hora le aplica una sola tarifa.
  constraint tarifas_sin_solape
    exclude using gist (cancha_id with =, int4range(hora_desde, hora_hasta) with &&)
);

-- Clientes: el teléfono identifica al cliente (text para conservar ceros y "+").
create table public.clientes (
  id       bigint generated always as identity primary key,
  nombre   text not null check (length(trim(nombre)) > 0),
  telefono text not null unique check (length(trim(telefono)) > 0)
);

-- Reservas: un cliente + una cancha + una fecha + un bloque de 1 hora.
create table public.reservas (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references public.clientes (id) on delete restrict,
  cancha_id   smallint not null references public.canchas (id) on delete restrict,
  fecha       date not null,
  hora_inicio smallint not null check (hora_inicio between 10 and 22),
  estado      text not null default 'pendiente'
              check (estado in ('pendiente', 'confirmada', 'cancelada')),
  -- Copia de la tarifa vigente al reservar; cambiar tarifas no altera lo recaudado.
  precio      numeric(10, 2) not null check (precio >= 0),
  creada_en   timestamptz not null default now()
);

-- Regla anti-choque: una sola reserva no cancelada por cancha, fecha y bloque.
-- Empieza por fecha para servir también a disponibilidad, agenda y recaudación del día.
create unique index reservas_bloque_ocupado_unico
  on public.reservas (fecha, cancha_id, hora_inicio)
  where estado <> 'cancelada';

-- RLS activado. Sin políticas: anon/authenticated no ven nada; el servidor
-- usa una clave de servidor (que omite RLS) hasta que haya login (ADR-0001).
alter table public.canchas  enable row level security;
alter table public.tarifas  enable row level security;
alter table public.clientes enable row level security;
alter table public.reservas enable row level security;
