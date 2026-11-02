# Obsidian Sync Reliability Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task, TDD and one fresh whole-branch review.

**Goal:** Startup and foreground checks, safe account switching, truthful Markdown and synchronization status.
**Architecture:** Existing main.ts orchestration plus small scheduling/session guards; retain sync.ts idempotency and API GET only. Stable owner from existing /me.
**Tech Stack:** TypeScript, Obsidian API, Vitest, esbuild.
**Spec:** ../specs/2026-11-02-sync-reliability.md

## Constraints and review focus
- No audio or vault upload; token stays in existing Obsidian settings, never logs.
- Token switch during API pagination, vault read/write, folder rename or save cannot publish into a new account.
- Partial folder migration must retry, partial writes cannot advance past failure, local edits remain visible unresolved.
- Focus plus visibility plus interval must coalesce, unload removes listeners/timers, hidden app must not poll.
- Original survives summary failure without a false Summary label; same timestamp page boundary remains inclusive.

## Tasks
- [x] T1 Tests RED for startup/foreground single flight, hidden/unload, token late response, account isolation, partial status. Add GET /me and cancellation checks to existing pagination.
- [x] T2 Tests RED for mid-read/mid-write/folder guards and protected checkpoints; implement optional sync guards, migration failure retry and safe original Markdown statuses.
- [x] T3 Connect native settings, manual retry and accurate last-attempt/last-success statuses; test orchestration and full suite, tsc/build, isolated host rendering if available.
- [x] T4 Fresh fixed-HEAD review, important fixes RED→GREEN, release metadata/docs, final full suite; authorized merge/push, keep actual store states distinct.

## Ledger
Baseline c403db6: 44 passed. Initial claims guard could not locate Rails in linked worktree; subsequent runs set SPEAKPEN_RAILS_REPO explicitly.

T1–T3: lifecycle first RED 5 failures; guards RED 8 failures (fixed an infinite collision in the fake, then re-ran finite RED); GREEN 65 tests, tsc/build.
Final: fixed hidden in-flight automatic pass — does not continue an automatic pass after Obsidian becomes hidden RED→GREEN.
Final: fixed loss of unbound legacy tracking — retains unbound legacy tracking if a token is replaced before owner verification and the app restarts RED→GREEN.
Final: fixed repeated nested folder move — does not move already migrated files again when retrying a partial move into a child folder RED→GREEN.
Final: fixed older-server original-as-summary — keeps legacy failure originals as Transcript when the older server omits summary_status RED→GREEN.
Final full suite 69/69; tsc/build pass. No deferred code minors. Native desktop host synthetic wire integration yields two ordinary Markdown notes, second sync no duplicates, no false summary. Real mobile host remains separate; simulated DOM events do not prove iOS Obsidian lifecycle.
Additional user steering: publish Chinese and English GitHub READMEs and clearer SpeakPen acquisition links; implement docs/metadata only, no tracking SDK or outreach.

User extension: Chinese/English settings and notices follow getLanguage, with moment fallback for the unchanged minimum Obsidian 1.5.7. Chinese lifecycle test RED→GREEN; final 70/70 tests and tsc/build pass.
Actual Obsidian 1.14.5 desktop: controlled native ingest API payloads -> two Markdown originals, no false Summary; repeat sync and plugin reload keep exactly two. Corrected QA-only missing manifest.dir before final acceptance; earlier unbound harness captures are discarded. No personal vault/token or live provider request used. Mobile host not physically checked.
