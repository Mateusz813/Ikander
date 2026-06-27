-- =====================================================================
--  IKANDER — wyzerowanie punktów (świeży start dla obojga)
--  Uruchom w: Supabase Dashboard -> SQL Editor -> New query -> Run
--
--  Punkty są wyliczane na bieżąco: zdobyte (z zaliczonych akcji + bonusów
--  za perfekcyjny dzień) MINUS wydane (na nagrody). Żeby saldo = 0,
--  czyścimy źródła. UWAGA: to kasuje też zaznaczenia na kalendarzu
--  oraz historię wykupionych nagród.
-- =====================================================================

delete from public.reward_redemptions;   -- kasuje "wydane" (i historię nagród)
delete from public.action_logs;          -- kasuje "zdobyte" (i zaliczenia w kalendarzu)

-- Definicje akcji i nagród zostają nietknięte. Po tym oboje macie 0 punktów.

-- Sprawdź:
--   select user_id, earned, spent, balance from public.user_points;
