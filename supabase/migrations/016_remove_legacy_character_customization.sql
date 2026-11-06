alter table public.profiles
  drop column if exists character_style,
  drop column if exists character_skin,
  drop column if exists character_shirt,
  drop column if exists character_bottom,
  drop column if exists character_shoes;
