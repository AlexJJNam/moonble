-- 그룹별 기본 색상과 사용자 지정 HEX 색상을 계정에 저장합니다.
-- 004_quiz_group_colors.sql 이후 Supabase SQL Editor에서 실행합니다.
begin;

alter table public.quiz_groups
  drop constraint if exists quiz_groups_color_key_check;
alter table public.quiz_groups
  add constraint quiz_groups_color_key_check
  check (
    color_key is null
    or color_key in ('default', 'blue', 'cyan', 'green', 'lime', 'yellow', 'orange', 'pink', 'purple', 'slate')
    or color_key ~ '^#[0-9A-Fa-f]{6}$'
  );

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
  if p_color_key is null or not (
    p_color_key in ('default', 'blue', 'cyan', 'green', 'lime', 'yellow', 'orange', 'pink', 'purple', 'slate')
    or p_color_key ~ '^#[0-9A-Fa-f]{6}$'
  ) then
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
