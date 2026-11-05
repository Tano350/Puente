-- Gastos: nueva categoría "alojamiento" (Airbnb, hotel, hostal), que antes quedaba en "otro".
-- El check de la columna se creó dentro de create table, así que Postgres le puso gastos_categoria_check.
-- Se reemplaza en un solo paso; los gastos que ya están siguen cumpliéndolo.
-- Para publicarlo: aplicar esta migración antes de desplegar la app (la app de antes no la usa, así que funciona igual).

alter table public.gastos
  drop constraint gastos_categoria_check,
  add constraint gastos_categoria_check
    check (categoria in ('auto', 'tren', 'bici', 'comida', 'cafe', 'super', 'entrada', 'alojamiento', 'otro'));
