alter table public.profiles
  drop constraint if exists profiles_character_persona_check,
  add constraint profiles_character_persona_check
    check (
      character_persona is null
      or character_persona in (
        'tari', 'ibrahim', 'zainab', 'tunde', 'runo',
        'kemi', 'ese', 'ngozi', 'david', 'maya', 'burna', 'chidi'
      )
    );
