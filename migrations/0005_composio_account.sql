-- After Instagram OAuth, the composio_account_id must be saved to studio_settings
-- so publishPost can find it. Ensures the studio_settings row exists for the operator
-- user and seeds the known live account id. Idempotent — safe to re-run.
INSERT INTO studio_settings (user_id, composio_account_id)
VALUES ('tTGXM74ypX1QqgNwARk8xXvancm5hove', 'ca_HLbYaNnXX3ta')
ON CONFLICT (user_id) DO UPDATE SET composio_account_id = 'ca_HLbYaNnXX3ta'
WHERE studio_settings.composio_account_id IS NULL OR studio_settings.composio_account_id = '';
