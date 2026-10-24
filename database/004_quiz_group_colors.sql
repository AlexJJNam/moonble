-- Supabase SQL Editor에서 003_quiz_banks_and_shares.sql 적용 후 실행합니다.
-- 그룹 색상 선택을 기존 문제지/그룹 DB 저장 구조에 추가합니다.
begin;

alter table public.quiz_groups
  add column if not exists color_key text;

alter table public.quiz_groups
  drop constraint if exists quiz_groups_color_key_check;
alter table public.quiz_groups
  add constraint quiz_groups_color_key_check
  check (color_key is null or color_key in ('blue', 'cyan', 'green', 'lime', 'orange', 'pink', 'purple', 'slate'));

create or replace function public.moonble_set_quiz_group_color(p_group_id text, p_color_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_color_key is null or p_color_key not in ('blue', 'cyan', 'green', 'lime', 'orange', 'pink', 'purple', 'slate') then
    raise exception 'Invalid group color' using errcode = '22023';
  end if;

  update public.quiz_groups
  set color_key = p_color_key, updated_at = now()
  where id = p_group_id and owner_id = requesting_user_id and deleted_at is null
    and color_key is distinct from p_color_key;

  if not found and not exists (
    select 1 from public.quiz_groups
    where id = p_group_id and owner_id = requesting_user_id and deleted_at is null
  ) then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.moonble_set_quiz_group_color(text, text) from public, anon;
grant execute on function public.moonble_set_quiz_group_color(text, text) to authenticated;

commit;
