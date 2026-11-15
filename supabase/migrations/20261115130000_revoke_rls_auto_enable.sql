-- rls_auto_enable() es la función del event trigger ensure_rls (creada por la plataforma).
-- Ningún rol de la API necesita llamarla: el event trigger la ejecuta igual.
-- Quitar EXECUTE la saca de /rest/v1/rpc y resuelve los avisos 0028 y 0029.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
