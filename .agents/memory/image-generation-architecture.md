---
name: Image-generation architecture
description: The durable hosting and credential boundary for Curtis Image Studio image generation.
---

Curtis Image Studio must call its own `/api` image-generation endpoints, which use Replit's managed OpenAI AI Integration. Do not reintroduce a browser-visible API key or dependency on the former external proxy deployment.

**Why:** The external proxy was unreachable and created an independently deployed, mismatched configuration path. Managed AI integration keeps credentials server-side and lets the frontend, API contract, and provider share one maintained workspace.

**How to apply:** New image features should extend the typed `/api` contract and use the server-side integration package. The browser should continue using generated API hooks and should only receive returned image data or stored asset URLs.