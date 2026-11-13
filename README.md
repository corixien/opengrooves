# Opengrooves

Create, share and play drum grooves. No login.

```bash
npm install
npm run dev     # http://localhost:5173
```

Production: `npm run build && DATABASE_URL=... npm start` (serves the built client and the API).
Samples: own recording, cut with `scripts/slice-samples.py`, replaceable via `public/samples/manifest.json`.

## Moderation (admin via Neon)
- Owners (same browser, token in localStorage) can edit and delete their grooves. Everyone else gets "Request deletion".
- Requests land in table `delete_requests` (groove_id, groove_title, groove_url, client_id, reason, created_at). Open `groove_url`, check the groove, then delete it in table `grooves` - its requests vanish with it (cascade). To dismiss a request, delete the row in `delete_requests`.
- Set `PUBLIC_URL` (e.g. https://opengrooves.onrender.com) so `groove_url` is a full link.
- Editing a groove does not change grooves forked from it earlier, and deleting the original keeps its forks.
