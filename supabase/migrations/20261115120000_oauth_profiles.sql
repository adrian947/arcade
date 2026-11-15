-- El perfil solo se crea automáticamente si el alta trae username (registro con correo).
-- Las altas OAuth no lo traen: el jugador lo elige en /login/usuario.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  name text := upper(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));
begin
  if name is not null then
    insert into public.profiles (id, username) values (new.id, name);
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Cada usuario autenticado puede crear solo su propio perfil.
-- El CHECK de formato y el UNIQUE de username existentes siguen validando.
create policy "profiles: insertar el propio" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
