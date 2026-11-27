-- 知忆 · Supabase 建表 SQL（方案 B：本地优先 + 可选云同步）
-- 在 Supabase 控制台 → SQL Editor 中整段执行。
-- 前置：已开启 Email 登录（Authentication → Providers → Email）。

-- 1. 文档同步表：一行 = 某用户的一份资料快照
create table if not exists public.zhiyi_docs (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  doc_id     text        not null,
  payload    jsonb       not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, doc_id)
);

comment on table public.zhiyi_docs is '知忆资料快照；客户端按 updated_at 合并，较新者优先';

-- 2. 常用索引：按用户拉取最新的资料
create index if not exists zhiyi_docs_user_updated_idx
  on public.zhiyi_docs (user_id, updated_at desc);

-- 3. 行级安全：用户只能读写自己的数据
alter table public.zhiyi_docs enable row level security;

drop policy if exists "zhiyi_docs_select_own" on public.zhiyi_docs;
create policy "zhiyi_docs_select_own"
  on public.zhiyi_docs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "zhiyi_docs_insert_own" on public.zhiyi_docs;
create policy "zhiyi_docs_insert_own"
  on public.zhiyi_docs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "zhiyi_docs_update_own" on public.zhiyi_docs;
create policy "zhiyi_docs_update_own"
  on public.zhiyi_docs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "zhiyi_docs_delete_own" on public.zhiyi_docs;
create policy "zhiyi_docs_delete_own"
  on public.zhiyi_docs for delete
  to authenticated
  using (auth.uid() = user_id);

-- 4. 表级授权（Supabase 默认已授权，这里显式声明便于迁移到自建实例）
grant select, insert, update, delete on public.zhiyi_docs to authenticated;

-- 5. updated_at 自动维护（防止客户端漏传时间戳）
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists zhiyi_docs_touch_updated_at on public.zhiyi_docs;
create trigger zhiyi_docs_touch_updated_at
  before update on public.zhiyi_docs
  for each row execute function public.touch_updated_at();

-- 6. 可选：用户偏好同步（主题、翻译方向、AI 来源等非敏感设置）
create table if not exists public.zhiyi_settings (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  payload    jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.zhiyi_settings enable row level security;

drop policy if exists "zhiyi_settings_all_own" on public.zhiyi_settings;
create policy "zhiyi_settings_all_own"
  on public.zhiyi_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.zhiyi_settings to authenticated;

-- 7. 自检（执行后应返回 0 行）
-- select * from public.zhiyi_docs limit 1;
