# SpeakPen Sync

[English](README.md) · [简体中文](README.zh-CN.md)

Capture a passing thought with **SpeakPen**, then keep the original transcript and available
summary in your own Obsidian vault as ordinary Markdown. Your notes stay readable and
editable, ready for the AI tools you choose.

**New to SpeakPen? [Start with SpeakPen →](https://speakpen.app/?utm_source=github&utm_medium=readme&utm_campaign=speakpen_obsidian)**

[Get the iOS app](https://apps.apple.com/app/id6743360755) ·
[Get the Android app](https://play.google.com/store/apps/details?id=com.qumge.speakpen) ·
[Open SpeakPen web](https://speakpen.app/app?utm_source=github&utm_medium=readme&utm_campaign=speakpen_obsidian)

Record a thought → find it in SpeakPen → connect this plugin → read it in Obsidian.
The plugin syncs existing notes; it does not record or transcribe by itself.

Plugin settings and sync notices follow the Obsidian interface language: Chinese or English (other languages use English).

## What this plugin needs

- **A SpeakPen account.** The plugin is a client for [SpeakPen](https://speakpen.app), where
  your voice notes are recorded and transcribed. It does nothing on its own — without an
  account there is nothing for it to sync.
- **A paid plan for full use.** The free plan covers 3 recordings a month, up to 5 minutes
  each. Pro is $9.90/month for 60 recordings a month, up to 20 minutes each. The plugin
  itself is free and does not limit anything.
- **Network access to `speakpen.app`.** On each sync the plugin makes read-only `GET`
  requests to `https://speakpen.app/api/v1/me` to verify your account and
  `https://speakpen.app/api/v1/ideas`, authenticated with your API token, to
  fetch notes that changed since the last sync. That is the only host it contacts, and the
  only data it asks for. It never sends your vault anywhere, never writes back to SpeakPen,
  and collects no telemetry. See [Privacy Policy](https://speakpen.app/privacy).

## Features

- **Incremental Sync** — Asks SpeakPen only what changed since last time, so a routine sync
  uses one account check plus one or more pages of changed notes
- **Edits Flow Through** — Re-transcribe or edit a note in SpeakPen and the note in your
  vault is rewritten in place, instead of drifting out of sync forever. The file keeps the
  name it was created with, even if you rename the note in SpeakPen
- **Your Edits Win** — A note you have written in is never overwritten. The plugin notices
  and leaves it alone
- **Auto Sync** — Checks once after startup, checks when you return (at most once a minute), and polls at the configured interval while Obsidian is visible. Manual sync is available in settings, the ribbon and command palette. Obsidian must be open; closing the app stops syncing
- **Markdown Notes** — Each idea becomes a Markdown file with YAML frontmatter
- **Follows Your Folder** — Change the sync folder and existing notes move with it
- **Honest Status** — Only a fully successful pass updates the last success time. Partial failures and preserved local edits need attention; settings show the same status on mobile

## Setup

1. In Obsidian, go to **Settings → Community plugins → Browse**, search for "SpeakPen Sync", and install it
2. Enable it, then go to **Settings → SpeakPen Sync**
3. Paste your API token. Generate one in the SpeakPen web app at
   [speakpen.app/app](https://speakpen.app/app), under **Settings → Connections** (Obsidian card → **Generate token**)
4. Configure sync folder and interval as needed

Audio is never downloaded or linked by this plugin. Read-only API tokens do not receive
audio URLs. Use `speakpen_id` to find the recording back in SpeakPen. Native original
transcripts remain readable when a summary is waiting or fails; they are not labelled as
a completed summary.

## How syncing decides what to do

The plugin remembers where it put each note and what it wrote there.

- **New in SpeakPen** — written to your sync folder.
- **Changed in SpeakPen** — the note in your vault is updated in place.
- **Changed in SpeakPen, but you have edited it here** — left exactly as you have it. Your
  writing is not recoverable from anywhere else; the SpeakPen copy is. A notice tells you
  which notes were skipped so you can reconcile them yourself if you want to.
- **Deleted, moved, or renamed by you** — the plugin looks for a note where it put it, so
  any of these look the same to it: the note is gone. A fresh copy is written to your sync
  folder on that note's next change. If you moved it rather than deleted it, you end up
  with both.

Notes synced by versions before 0.3.0 are remembered so they are never duplicated, but they
cannot be updated or moved: those versions recorded only an id, so the plugin does not know
where those notes went or whether you have since rewritten them.

## Account switching and retries

The plugin verifies the stable account ID before reading notes. Rotating a token for the
same account preserves its cursor; switching accounts keeps separate tracking. Late
responses from an old token cannot begin new writes. A filesystem write already started
may finish, but its checkpoint belongs only to its original account. Existing notes are
never deleted when you switch accounts. On the first upgrade from an unbound legacy
state, one full check reconciles matching IDs without reusing an unverified cursor.

Failed writes and locally edited notes hold the inclusive cursor so they can be checked
again. A failed folder move is retried, while successful moves are remembered. Your own
edits are never overwritten automatically; review the affected note in SpeakPen and in
your vault. Syncing is one-way and does not propagate deletions.

## About your API token

The token is read-only — it can list and read your SpeakPen notes, and nothing else. It cannot
edit or delete them, share them, or change your account.

Like every Obsidian plugin setting, it is stored as plain text in
`<your vault>/.obsidian/plugins/speakpen-sync/data.json`. That file is part of your vault, so it
travels with it when you sync to cloud storage or commit the vault to a git repository. If you
keep your vault in git and would rather leave plugin credentials out of it, add this to your
`.gitignore`:

    .obsidian/plugins/*/data.json

You can revoke a token whenever you like — in the SpeakPen app under **Settings → Connections**,
or on the web at [speakpen.app/app](https://speakpen.app/app). Revoking takes effect immediately;
generate a new one and paste it back in to resume syncing.

### Manual installation

Only needed if you are installing a build that is not in the store yet.

1. Download `main.js`, `manifest.json` (and `styles.css` if present) from the [latest release](https://github.com/Qumge/speakpen-obsidian/releases).
2. Create a folder `<your vault>/.obsidian/plugins/speakpen-sync/` and copy those files into it.
3. Reload Obsidian and enable **SpeakPen Sync** under **Settings → Community plugins**.

## Note Format

Each synced idea is saved as a Markdown file in your configured folder (default: `SpeakPen/`):

    ---
    speakpen_id: "123"
    title: "Meeting Notes"
    category: "Meeting"
    created_at: 2026-03-28T10:00:00Z
    synced_at: 2026-03-28T10:05:00Z
    ---

    ## Summary

    (AI-generated summary)

    ## Transcript

    (Full transcript)

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| API Token | — | Your SpeakPen API token |
| Sync Folder | `SpeakPen` | Vault folder for synced notes |
| Auto Sync | On | Enable automatic sync |
| Sync Interval | 5 min | How often to check for new ideas |

## Commands

- **SpeakPen: Sync now** — Manually trigger a sync

## Development

```bash
git clone https://github.com/Qumge/speakpen-obsidian.git
cd speakpen-obsidian
npm install
npm run dev    # development build
npm run build  # production build
npm test       # run tests
```

### Changing sync behaviour

speakpen.app describes what this plugin does, in four languages. Those descriptions
are listed in `config/product_claims.json` in the [speakpen](https://github.com/xnjiang/speakpen)
repo, and each one names a test **in this repo** that proves it.
`tests/landing-claims.test.ts` checks that those tests still exist, so `npm test` fails
here if you delete or rename one — and the test itself fails if you change the behaviour
it proves.

This exists because the two repos drifted once: `faee134` corrected a claim in this
README that the site kept making for another week, with both test suites green. If you
add a claim to the site, write the test that proves it here first.

Check out the `speakpen` repo alongside this one, or set `SPEAKPEN_RAILS_REPO`. Without
it the check prints a warning and skips rather than failing.

## License

MIT
