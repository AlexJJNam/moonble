-- 문제지 미리보기용 대표 댓글. 014_community_edit_comment_likes.sql 이후 실행합니다.
-- 공유 링크로 열면 해당 활성 공유만, bank ID로 열면 본인 문제지의 활성 공유만 조회합니다.
begin;

create or replace function public.moonble_quiz_preview_comment(
  p_token_hash text default null,
  p_bank_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_bank_id text;
  target_share_id uuid;
  result jsonb;
begin
  if p_token_hash is not null then
    if p_token_hash !~ '^[0-9a-f]{64}$' then
      return null;
    end if;
    select share.bank_id, share.id into target_bank_id, target_share_id
    from public.quiz_shares as share
    join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
    where share.token_hash = p_token_hash and share.revoked_at is null and bank.deleted_at is null
    limit 1;
  elsif p_bank_id is not null and char_length(p_bank_id) between 1 and 160 and auth.uid() is not null then
    select bank.id into target_bank_id
    from public.quiz_banks as bank
    where bank.id = p_bank_id and bank.owner_id = auth.uid() and bank.deleted_at is null;
  end if;

  if target_bank_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', comment.id,
    'post_id', post.id,
    'body', comment.body,
    'gif', comment.gif,
    'author_name', coalesce(public.moonble_community_author_name(comment.author_id), '문블 사용자'),
    'author_avatar', public.moonble_community_author_avatar(comment.author_id),
    'like_count', comment.like_count,
    'created_at', comment.created_at
  ) into result
  from public.community_post_comments as comment
  join public.community_posts as post on post.id = comment.post_id
  join public.quiz_shares as share on share.id = post.share_id
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  where share.bank_id = target_bank_id
    and share.revoked_at is null and bank.deleted_at is null
    and (target_share_id is null or share.id = target_share_id)
    and post.deleted_at is null and comment.deleted_at is null
  order by comment.like_count desc, comment.created_at desc, comment.id desc
  limit 1;

  return result;
end;
$$;

revoke all on function public.moonble_quiz_preview_comment(text, text) from public;
grant execute on function public.moonble_quiz_preview_comment(text, text) to anon, authenticated;

commit;
