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
- [ ] T1 Tests RED for startup/foreground single flight, hidden/unload, token late response, account isolation, partial status. Add GET /me and cancellation checks to existing pagination.
- [ ] T2 Tests RED for mid-read/mid-write/folder guards and protected checkpoints; implement optional sync guards, migration failure retry and safe original Markdown statuses.
- [ ] T3 Connect native settings, manual retry and accurate last-attempt/last-success statuses; test orchestration and full suite, tsc/build, isolated host rendering if available.
- [ ] T4 Fresh fixed-HEAD review, important fixes RED→GREEN, release metadata/docs, final full suite; authorized merge/push, keep actual store states distinct.

## Ledger
Baseline c403db6: 44 passed. Initial claims guard could not locate Rails in linked worktree; subsequent runs set SPEAKPEN_RAILS_REPO explicitly.
