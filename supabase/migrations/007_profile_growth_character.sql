alter table public.profiles
  add column if not exists character_style text not null default 'feminine',
  add column if not exists character_skin text not null default 'cocoa',
  add column if not exists character_shirt text not null default 'sunset',
  add column if not exists character_bottom text not null default 'trousers-denim',
  add column if not exists character_shoes text not null default 'sneakers-cream';

alter table public.profiles
  drop constraint if exists profiles_character_style_check,
  add constraint profiles_character_style_check
    check (character_style in ('feminine', 'masculine')),
  drop constraint if exists profiles_character_skin_check,
  add constraint profiles_character_skin_check
    check (character_skin in ('deep', 'cocoa', 'warm', 'golden', 'peach', 'fair')),
  drop constraint if exists profiles_character_shirt_check,
  add constraint profiles_character_shirt_check
    check (character_shirt in ('sunset', 'lagoon', 'sky', 'violet', 'midnight')),
  drop constraint if exists profiles_character_bottom_check,
  add constraint profiles_character_bottom_check
    check (character_bottom in ('trousers-denim', 'trousers-sand', 'skirt-coral', 'skirt-lilac')),
  drop constraint if exists profiles_character_shoes_check,
  add constraint profiles_character_shoes_check
    check (character_shoes in ('sneakers-cream', 'sneakers-coral'));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    )
  then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end
$$;
