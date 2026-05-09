
REVOKE EXECUTE ON FUNCTION public.daily_xp_total(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_xp_total(uuid) TO service_role;
