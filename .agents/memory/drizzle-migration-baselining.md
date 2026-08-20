---
name: Drizzle migration baselining
description: Safely applying new Drizzle migrations when a development database already has schema objects but an empty ledger.
---

When a development database already matches earlier migrations but its Drizzle ledger is empty, verify the tables, constraints, and indexes against those migration files before recording only the matching historical entries. Then use the normal migration command for new changes.

**Why:** Replaying a full migration history against a schema created through an earlier sync path can fail on objects that already exist, while forcing new DDL without a ledger leaves future migrations unreliable.

**How to apply:** Inspect the `drizzle.__drizzle_migrations` ledger and compare the live schema to each historical migration first. Baseline only confirmed-equivalent migrations, preserve their original hashes and timestamps, and let Drizzle apply subsequent migrations normally.