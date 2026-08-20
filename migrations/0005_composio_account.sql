-- After Instagram OAuth, the composio_account_id must be saved to studio_settings
-- so publishPost can find it. This migration seeds the known live account id.
-- Safe to re-run: ON CONFLICT is idempotent.
UPDATE studio_settings
SET composio_account_id = 'ca_HLbYaNnXX3ta'
WHERE user_id = 'tTGXM74ypX1QqgNwARk8xXvancm5hove'
  AND (composio_account_id IS NULL OR composio_account_id = '');
