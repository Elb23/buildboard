# Deploy Buildboard on a VPS

The ZIP is a complete standalone edition of your engineering workspace. It
includes the complete curriculum and both PDFs. The private `.env` is already
configured with the login you supplied. It contains a salted password hash,
not your plaintext password. Keep the ZIP and `.env` private.

## 1. Start the application

Use Node.js **24 or later**. The standalone edition has no third-party runtime
dependencies, so an npm install is unnecessary.

```bash
unzip buildboard-vps-source.zip
cd buildboard
chmod 600 .env
node --version
node vps-server.mjs
```

The server listens on `127.0.0.1:3000` and creates
`storage/buildboard.sqlite`. For a local computer, visit
`http://127.0.0.1:3000`. On a VPS, put the application behind an HTTPS reverse
proxy before entering credentials remotely.

## 2. Set your HTTPS address

Point your domain's DNS at the VPS. Set these entries in `.env`, substituting
the exact domain you will visit:

```dotenv
PUBLIC_URL=https://board.your-domain.example
COOKIE_SECURE=1
```

Restart the application. It checks the configured host and request origin,
so the reverse proxy must preserve the original `Host` header. Do not publish
the project folder with a static file server. Only the Node application should
serve requests; it protects source assets, PDFs, progress and notes.

One option is Caddy. Install Caddy from its official distribution, replace
`your-domain.example` in `deploy/Caddyfile`, and use the resulting site block
in your Caddy configuration. Caddy handles HTTPS and proxies to port 3000.
Allow incoming ports 80 and 443 for that setup; keep port 3000 bound to loopback.
Keep the process running with your existing service manager, or use Docker below.

## 3. Optional Docker deployment

With Docker and Compose already installed:

```bash
docker compose up -d --build
docker compose logs --tail=30
```

The application is published only at `127.0.0.1:3000` on the host, ready for
your HTTPS proxy. The database is in the `buildboard-data` named volume.
The `.env` file is passed at runtime and is excluded from the container image.
The container runs as a non-root user.

## 4. Move your saved progress

The website source and the database are separate. To move progress from the
hosted board to your VPS:

1. Open **Backups & settings → Export** on the hosted board.
2. Sign in to the VPS board.
3. Choose **Backups & settings → Import**, review the confirmation and restore.

The import includes task status, completed blocks, notes, actual minutes, dates,
evidence links, custom tasks and weekly reading/review records. A Week 1 backup
from the original sample is also supported.

## Backups and maintenance

- Export progress from the UI regularly; keep exported files private.
- Back up the SQLite database using SQLite's backup facility, or stop the app
  before copying its database and associated WAL files.
- Never run `docker compose down -v` unless you intend to delete the database.
- Publishing new code does not replace the saved database. New migrations are
  applied at server startup and their filenames are recorded.
- To change the login, stop the server, move the existing `.env` to a private
  backup, run `npm run configure`, restore your deployment settings and restart.
  Revoke old sessions by stopping the app and removing session rows with an
  administrative SQLite tool if you need immediate revocation.
- Login sessions last eight hours. Five failed attempts trigger a temporary
  15-minute limit. Signing out revokes that session on the server.

## Edit or verify the source

```bash
node scripts/embed-assets.mjs
npm test
node vps-server.mjs
```

The committed `data/plan.json` is sufficient to run the site. To re-import a
revised original PDF, install Python's `pypdf` in your own development environment
and run `python scripts/import-plan.py /path/to/Engineering-Learning-Plan.pdf`.
That step is unnecessary for deployment.

The VPS edition uses its own private login and SQLite database. The hosted
ChatGPT account gate remains a feature of the hosted edition.
