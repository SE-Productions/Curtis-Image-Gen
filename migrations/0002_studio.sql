create table if not exists studio_faces (
  id text primary key,
  user_id text not null,
  data_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists studio_faces_user_id_idx on studio_faces (user_id);

create table if not exists studio_settings (
  user_id text primary key,
  instagram_user_id text,
  instagram_token text,
  instagram_username text,
  auto_publish boolean not null default true,
  post_hour integer not null default 10,
  post_minute integer not null default 0,
  timezone text not null default 'America/New_York',
  format text not null default 'feed',
  days integer not null default 7,
  updated_at timestamptz not null default now()
);

create table if not exists studio_posts (
  id text primary key,
  user_id text not null,
  plan_date date not null,
  title text not null,
  topic text not null,
  concept text not null,
  prompt text not null,
  caption text not null,
  format text not null,
  status text not null default 'idea',
  aspect_ratio text not null default '4:5',
  director text not null default 'grok',
  media_url text,
  media_data text,
  video_url text,
  scheduled_for timestamptz,
  published_at timestamptz,
  instagram_post_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_posts_user_id_idx on studio_posts (user_id);
create unique index if not exists studio_posts_user_date_unique on studio_posts (user_id, plan_date);
create index if not exists studio_posts_due_idx on studio_posts (status, scheduled_for);
