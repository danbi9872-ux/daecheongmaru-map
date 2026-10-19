-- 대청마루 기업지도. Supabase SQL Editor에서 한 번 실행하세요.
-- 실제 관리자 사용자는 Auth > Users에서 만든 뒤 아래 주석의 INSERT를 별도로 실행합니다.
create table if not exists public.map_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.map_admins enable row level security;
grant select on public.map_admins to authenticated;
create policy "admins can identify themselves" on public.map_admins
  for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.map_companies (
  id text primary key,
  data jsonb not null,
  brief_png text,
  brief_pdf text,
  updated_at timestamptz not null default now()
);
alter table public.map_companies enable row level security;
grant select on public.map_companies to anon, authenticated;
grant insert, update on public.map_companies to authenticated;
create policy "anyone may read companies" on public.map_companies
  for select to anon, authenticated using (true);
create policy "only admins may insert companies" on public.map_companies
  for insert to authenticated with check (
    exists (select 1 from public.map_admins where user_id = (select auth.uid()))
  );
create policy "only admins may update companies" on public.map_companies
  for update to authenticated using (
    exists (select 1 from public.map_admins where user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.map_admins where user_id = (select auth.uid()))
  );

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('company-briefs','company-briefs',true,10000000,array['image/png','application/pdf'])
on conflict (id) do nothing;
create policy "only admins may upload briefs" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'company-briefs'
    and exists (select 1 from public.map_admins where user_id = (select auth.uid()))
  );

-- 관리자 계정 생성 후, 이메일을 바꿔 별도로 실행하세요.
-- insert into public.map_admins(user_id)
-- select id from auth.users where email = 'ADMIN_EMAIL@example.com';
