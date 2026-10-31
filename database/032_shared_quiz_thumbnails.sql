-- 공유된 문제지 응답에 커스텀 썸네일을 포함해 커뮤니티 첨부와 링크 미리보기에서 사용합니다.
-- 031_community_media_public_quiz_thumbnails.sql 적용 후 Supabase SQL Editor에서 한 번 실행합니다.
begin;

-- 문제 데이터는 유효한 공유 토큰으로만 조회되므로, 같은 응답에 해당 문제지 썸네일 메타데이터를 함께 반환합니다.
create or replace function public.moonble_get_quiz_share(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select share.snapshot || jsonb_build_object(
    'thumbnail_path', thumbnail.object_path,
    'thumbnail_media', case when thumbnail.provider = 'klipy' then thumbnail.media else null end
  )
  from public.quiz_shares as share
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  left join public.quiz_bank_thumbnails as thumbnail on thumbnail.bank_id = bank.id and thumbnail.owner_id = bank.owner_id
  where p_token_hash ~ '^[0-9a-f]{64}$'
    and share.token_hash = p_token_hash
    and share.revoked_at is null
    and bank.deleted_at is null
  limit 1;
$$;

-- 일부 공개(링크 공유) 문제도 유효한 공유 토큰으로 접근할 수 있으므로,
-- 활성 공유가 있는 문제지의 불투명한 Storage 경로에 한해 서명 URL 발급을 허용합니다.
create or replace function public.moonble_public_quiz_thumbnail_visible(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quiz_bank_thumbnails as thumbnail
    join public.quiz_banks as bank on bank.id = thumbnail.bank_id and bank.owner_id = thumbnail.owner_id
    join public.quiz_shares as share on share.bank_id = bank.id and share.owner_id = bank.owner_id
    where thumbnail.object_path = p_object_name
      and bank.deleted_at is null
      and share.revoked_at is null
  );
$$;

revoke all on function public.moonble_get_quiz_share(text) from public;
grant execute on function public.moonble_get_quiz_share(text) to anon, authenticated;
revoke all on function public.moonble_public_quiz_thumbnail_visible(text) from public;
grant execute on function public.moonble_public_quiz_thumbnail_visible(text) to anon, authenticated;

commit;
