alter table studio_settings add column if not exists xai_api_key text;
alter table studio_settings add column if not exists composio_api_key text;
alter table studio_settings add column if not exists composio_account_id text;
