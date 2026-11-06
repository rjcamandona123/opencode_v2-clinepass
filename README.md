<div align="center">

# OpenCode V2 — ClinePass Provider (full body)

**A complete OpenCode V2 configuration body** that adds [ClinePass](https://cline.bot)
as a provider: the ClinePass subscription catalog **plus Cline's rotating
free-tier models** (including **Beam 1.0 (Free)**), served through Cline's
OpenAI-compatible API at `https://api.cline.bot/api/v1`.

<br>

<p align="center">
  <a href="https://github.com/rjcamandona123/acode-opencode_v2-clinepass"><img src="https://img.shields.io/badge/GitHub-acode--opencode__v2--clinepass-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub repo"></a>
  <a href="https://opencode.ai"><img src="https://img.shields.io/badge/OpenCode-2.x-000000?style=for-the-badge" alt="OpenCode 2.x"></a>
  <a href="https://cline.bot"><img src="https://img.shields.io/badge/ClinePass-cline.bot-6C47FF?style=for-the-badge" alt="ClinePass"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-000000?style=for-the-badge" alt="License MIT"></a>
</p>

<br>

> This repository ships the **whole OpenCode body** (config files, package
> manifest, CLI settings, and plugins) — not just the provider plugin — so you
> can drop it straight into `~/.config/opencode` and run.
>
> No bundled credentials. OpenCode **V2** only (`v2.2.5` used during
> development); V1 plugins are not compatible.

</div>

<br>

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
- Node.js + npm (to install the plugin dependency).
- A ClinePass subscription **or** just a Cline account for the free tier.

## Install (whole body)

The OpenCode V2 binary (linux-arm64) is also published as a **Release asset**
(`v2.2.5`) in this repo, so a single command gets you running:

```sh
git clone https://github.com/rjcamandona123/acode-opencode_v2-clinepass.git
cd acode-opencode_v2-clinepass
./setup.sh
```

`setup.sh` downloads the bundled binary, copies the body into `~/.config/opencode`,
and runs `npm install`. After it finishes, just run `opencode`.

Manual install (if you already have OpenCode V2):

```sh
# Back up your existing config first
cp -r ~/.config/opencode ~/.config/opencode.bak 2>/dev/null || true

# Clone into a temp dir, then copy the body over
git clone https://github.com/rjcamandona123/acode-opencode_v2-clinepass.git /tmp/oc-body
mkdir -p ~/.config/opencode/plugins/lib ~/.config/opencode/plugins/background-work
cp /tmp/oc-body/opencode.jsonc   ~/.config/opencode/
cp /tmp/oc-body/cli.json         ~/.config/opencode/
cp /tmp/oc-body/package.json     ~/.config/opencode/
cp /tmp/oc-body/package-lock.json ~/.config/opencode/
cp /tmp/oc-body/plugins/clinepass.ts            ~/.config/opencode/plugins/
cp /tmp/oc-body/plugins/clinepass.v1.ts.bak     ~/.config/opencode/plugins/
cp /tmp/oc-body/plugins/lib/*.ts                ~/.config/opencode/plugins/lib/
cp /tmp/oc-body/plugins/background-work/*.ts     ~/.config/opencode/plugins/background-work/

# Install the plugin dependency
cd ~/.config/opencode && npm install
```

Then restart OpenCode.

The plugin registers the provider and its sign-in methods on load, so no
`opencode.json` edits are required beyond the shipped body. A user-declared
`clinepass` provider is kept — only its model inventory is filled in.

## Sign in

Run `/connect` in OpenCode and pick **ClinePass**. The simplest method:

1. **Static API key** — create one at
   [app.cline.bot → Settings → API Keys](https://app.cline.bot/settings/api-keys).

Alternatively, set an environment variable and skip `/connect`:

```sh
export CLINE_API_KEY="your-cline-api-key"
```

Credential resolution order: `CLINE_API_KEY` → active `/connect` connection →
cached rotated OAuth token → legacy V1 `auth.json`.

> Note: a WorkOS/OAuth path that reuses an existing Cline CLI login also
> exists in the code (`lib/auth.ts`), but it is optional and only relevant if
> you already use Cline separately. No Cline CLI is required for this repo.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLINE_API_KEY` | — | Static ClinePass API key |
| `CLINE_API_BASE` | `https://api.cline.bot` | Override the Cline API base URL |

`opencode.jsonc` ships with the provider/agent skeleton and an **empty**
`openrouter.apiKey` placeholder — fill it in (or remove the `openrouter`
provider block) if you want OpenRouter models. `service.json` (the OpenCode
server password) is intentionally **not** shipped; create it locally if needed.

## How it works

- `ctx.provider.transform` — registers `clinepass` and its model list.
- `ctx.integration.transform` — registers the key / env sign-in methods.
- `ctx.aisdk.hook("sdk", …)` — swaps a placeholder key for the live credential
  per request and attaches Cline client headers.
- `ctx.storage` — caches rotated WorkOS refresh tokens.
- `ctx.event.subscribe` — re-reads the catalog on credential changes.

Model discovery is non-blocking: the provider activates immediately with the
curated list, then refreshes from the network in the background.

## Repository layout

```
.gitignore
README.md
package.json              # @opencode-ai/plugin dependency
package-lock.json
cli.json                  # OpenCode V2 CLI settings (keybinds, UI)
opencode.jsonc            # OpenCode V2 config body (sanitized, no secrets)
plugins/
  clinepass.ts            # V2 plugin entry point (default { id, setup })
  clinepass.v1.ts.bak     # previous V1 implementation (reference)
  lib/
    auth.ts               # key / OAuth credential resolution
    env.ts                # provider id, API base, Cline client headers
    errors.ts             # error helpers
    models.ts             # curated catalog + live discovery + merge
    utils.ts              # type guards and small helpers
    workos.ts             # WorkOS token refresh
  background-work/
    index.ts              # background-work plugin (V2)
    tui.ts                # /background + /bg slash command + keybind
```

## Security

This repository contains **no credentials and no secrets**:

- `opencode.jsonc` ships with an empty `openrouter.apiKey` placeholder.
- `service.json`, `auth.json`, `.env*`, `*.key`, `*.pem`, and `credentials*`
  are gitignored and are never committed.
- API keys, OAuth tokens, and the OpenCode server password are resolved at
  runtime from `/connect`, `CLINE_API_KEY`, or your existing Cline CLI login.

Do **not** commit real keys or `service.json` to this (or any) repository.

## License

MIT
