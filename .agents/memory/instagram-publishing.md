---
name: Instagram publishing
description: Constraints for publishing Curtis Image Studio output to Instagram through Composio.
---

Instagram publishing uses a server-side Composio connection for one Instagram Business or Creator account. A publication must follow a deliberate user confirmation, not happen after image generation automatically.

**Why:** Instagram rejects personal accounts and fetches the selected media itself from a public HTTPS URL. An external post is irreversible, so image generation, account authorization, and post confirmation must remain separate actions.

**How to apply:** Keep Composio credentials server-side, retain the temporary public image only long enough for publication, and require a deployed public app URL before enabling the final publish request.

Use Composio Connect Links for new Instagram authorization requests, with the post-authorization callback derived only from a validated server-controlled HTTPS origin.

**Why:** The older SDK authorization helper uses a retired connected-account endpoint, and client-supplied forwarding headers can turn an OAuth callback into an open redirect.

**How to apply:** Resolve the Instagram auth config server-side, call the SDK's connected-account link flow, and allow callback origins only from trusted deployment configuration such as `PUBLIC_APP_URL` or Replit's managed domains.