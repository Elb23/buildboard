# Buildboard · Engineering workspace

Complete standalone VPS source: 24 weeks, 144 sessions, daily focus, weekly Kanban, roadmap, notes, private login and server-side SQLite storage.

Requires Node.js 24+. No npm dependency installation is needed.

```bash
node vps-server.mjs
```

The `.env` is preconfigured with your supplied login; it stores a salted password hash. Keep the ZIP and `.env` private.

Read **VPS-DEPLOYMENT.md** before exposing the server on the Internet. Configure an HTTPS reverse proxy and the exact PUBLIC_URL.

To move existing progress, export it from the hosted board and import it on your VPS. Source files do not contain a copy of your hosted database.

After editing client files, run `node scripts/embed-assets.mjs`. Run `npm test` to verify curriculum integrity, access control and the standalone server.
