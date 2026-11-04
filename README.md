# OpenCode V2 — ClinePass provider

An [OpenCode](https://opencode.ai) **V2** plugin that adds [ClinePass](https://cline.bot)
as a provider: the ClinePass subscription catalog **plus Cline's rotating
free-tier models** (including **Beam 1.0 (Free)**), served through Cline's
OpenAI-compatible API at `https://api.cline.bot/api/v1`.

No PHP, no editor plugin, no bundled credentials — this repo contains only the
provider files.

## What you get

The account's own catalog is read from Cline's recommended-models endpoint and
merged into OpenCode:

- **14 ClinePass subscription models** — Kimi K3.1 Pro / K3, GLM-5.3 / 5.3 Flash,
  DeepSeek V4 Pro / V4.1 Flash, MiMo V2.6 Pro / Flash, MiniMax M3 / M3.1 Flash,
  Muse Spark 1.3 Contributor, Qwen3.7 Max / Plus, Qwen3.8 Max.
- **4 free-tier models** — Beam 1.0 (Free), Nemotron 3.5 Super VL (Free),
  Nemotron 3.5 Lightning (Free), Solar Mini 4 (Free).

Free IDs are sent to Cline exactly as advertised (no `cline-pass/` prefix) and
requests carry Cline CLI identity headers, because free-tier models are only
admitted to Cline CLI / IDE clients.

If the live catalog is unreachable, a curated static list containing the same
free models is used, so the provider always loads.

## Requirements

- OpenCode **2.x** (`v2.2.5` was used during development).
  V2 plugins export `default { id, setup(ctx) }`; this repo is not compatible
  with the OpenCode V1 plugin API.
- A ClinePass subscription **or** just a Cline account for the free tier.

## Install

Copy the plugin into your OpenCode plugin directory:

```sh
mkdir -p ~/.config/opencode/plugins/lib
cp plugins/clinepass.ts   ~/.config/opencode/plugins/
cp plugins/lib/*.ts       ~/.config/opencode/plugins/lib/
```

Then restart OpenCode.

The plugin registers the provider and its sign-in methods on load, so no
`opencode.json` edits are required. A user-declared `clinepass` provider is
kept — only its model inventory is filled in.

## Sign in

Run `/connect` in OpenCode and pick **ClinePass**. Two methods are offered:

1. **Static API key** — create one at
   [app.cline.bot → Settings → API Keys](https://app.cline.bot/settings/api-keys).
2. **Cline CLI / ClinePass subscription (WorkOS)** — reuses an existing Cline CLI
   login. Install the CLI and run `cline auth` once:
   ```sh
   npm i -g cline
   cline auth
   ```
   WorkOS access tokens are refreshed automatically and rotated refresh tokens
   are cached in plugin storage.

Alternatively, set an environment variable and skip `/connect`:

```sh
export CLINE_API_KEY="your-cline-api-key"
```

Credential resolution order: `CLINE_API_KEY` → active `/connect` connection →
cached rotated OAuth token → legacy V1 `auth.json` → Cline CLI WorkOS login.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLINE_API_KEY` | — | Static ClinePass API key |
| `CLINE_API_BASE` | `https://api.cline.bot` | Override the Cline API base URL |

## How it works

- `ctx.provider.transform` — registers `clinepass` and its model list.
- `ctx.integration.transform` — registers the key / env / WorkOS sign-in methods.
- `ctx.aisdk.hook("sdk", …)` — swaps a placeholder key for the live credential
  per request and attaches Cline client headers.
- `ctx.storage` — caches rotated WorkOS refresh tokens.
- `ctx.event.subscribe` — re-reads the catalog on credential changes.

Model discovery is non-blocking: the provider activates immediately with the
curated list, then refreshes from the network in the background.

## Repository layout

```
plugins/
  clinepass.ts        # V2 plugin entry point (default { id, setup })
  lib/
    auth.ts           # key / OAuth credential resolution
    env.ts            # provider id, API base, Cline client headers
    errors.ts         # error helpers
    models.ts         # curated catalog + live discovery + merge
    utils.ts          # type guards and small helpers
    workos.ts         # WorkOS token refresh
```

## Security

This repository contains **no credentials and no secrets**. API keys, OAuth
tokens, `opencode.json`, `service.json`, and `cli.json` are intentionally
excluded. Keys are resolved at runtime from `/connect`, `CLINE_API_KEY`, or your
existing Cline CLI login.

## License

MIT
