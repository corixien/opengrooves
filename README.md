# Opengrooves

Create, share and play drum grooves. No login.

```bash
npm install
npm run dev     # http://localhost:5173
```

Production: `npm run build && DATABASE_URL=... npm start` (serves the built client and the API).
Samples: own recording, cut with `scripts/slice-samples.py`, replaceable via `public/samples/manifest.json`.
