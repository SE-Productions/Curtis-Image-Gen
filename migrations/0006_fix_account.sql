-- Force-set composio_account_id to the live connected Instagram account.
-- ca_rgXRo0lgfpNV is invalid (no longer exists for nova-luis).
-- ca_HLbYaNnXX3ta is slade.productions / MEDIA_CREATOR / owned by nova-luis.
UPDATE studio_settings
SET composio_account_id = 'ca_HLbYaNnXX3ta'
WHERE user_id = 'tTGXM74ypX1QqgNwARk8xXvancm5hove';
