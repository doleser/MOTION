create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('expire-check-ins', '* * * * *', 'select public.expire_check_ins()');