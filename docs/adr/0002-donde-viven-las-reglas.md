# ADR 0002: Dónde viven las reglas de reserva

**Estado:** Aceptado
**Fecha:** 2026-11-22

## Contexto
Hay dos reglas críticas: (1) no puede haber dos reservas no canceladas en la misma cancha, fecha y bloque; (2) el bloque empieza entre 10:00 y 22:00. Hay que decidir si se validan en Postgres (restricciones), en el servidor de Next (con Zod) o en ambos. Factores: dos personas pueden reservar el mismo bloque al mismo tiempo; el usuario necesita mensajes de error claros; y un agente IA (u otro cliente) podría escribir directamente en la base sin pasar por Next.

## Decisión
Validar en **ambos**, con roles distintos:
- **Postgres es la fuente de verdad:** índice único parcial sobre (cancha, fecha, bloque) para reservas no canceladas, y `CHECK` de hora de inicio entre 10 y 22. Ninguna escritura, venga de donde venga, puede violar las reglas.
- **Next + Zod es la primera línea:** valida forma y rango antes de tocar la base y devuelve mensajes claros. Usa las reglas puras de `lib/` (ej. `esHoraDeInicioValida`).
- El servidor traduce el error de choque de Postgres (violación de unicidad) a un mensaje amigable, p. ej. "Ese bloque acaba de ser reservado, elige otro".

## Consecuencias
- (+) La concurrencia la resuelve la base: de dos inserciones simultáneas, solo una gana. Un "consultar y luego insertar" en Next no lo garantizaría.
- (+) Un agente IA o un script con acceso a la base no puede crear choques ni horas inválidas.
- (+) El usuario ve errores comprensibles sin esperar ni leer mensajes de SQL.
- (−) La regla de horario vive en dos lugares (Zod/`lib/` y `CHECK`); si cambia el horario hay que actualizar ambos en el mismo cambio, con prueba que lo cubra.
- (−) Hay que mapear códigos de error de Postgres a mensajes, y probar ese mapeo.

## Alternativas consideradas
- **Solo Postgres:** seguro, pero los errores llegan crudos y la validación de formato ocurre tarde.
- **Solo Next/Zod:** buenos mensajes, pero no evita la condición de carrera y cualquier escritura directa (agente IA, consola, otro servicio) se salta las reglas.

## Condición de revisión
Revisar si: el horario pasa a ser configurable por cancha o por día (moverlo a una tabla en vez de un `CHECK` fijo); los bloques dejan de ser de 1 hora fija (cambiar el índice único por una restricción de exclusión por rangos); o se añade otro punto de escritura que no pueda usar `lib/`.
