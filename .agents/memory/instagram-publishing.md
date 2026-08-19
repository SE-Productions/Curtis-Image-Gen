---
name: Instagram publishing
description: Constraints for publishing Curtis Image Studio output to Instagram through Composio.
---

Instagram publishing uses a server-side Composio connection for one Instagram Business or Creator account. A publication must follow a deliberate user confirmation, not happen after image generation automatically.

**Why:** Instagram rejects personal accounts and fetches the selected media itself from a public HTTPS URL. An external post is irreversible, so image generation, account authorization, and post confirmation must remain separate actions.

**How to apply:** Keep Composio credentials server-side, retain the temporary public image only long enough for publication, and require a deployed public app URL before enabling the final publish request.