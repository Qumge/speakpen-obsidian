import { Plugin, Notice } from "obsidian";
import { SpeakPenSettings, DEFAULT_SETTINGS, SyncState, DEFAULT_SYNC_STATE, PluginData } from "./types";
import { SpeakPenAPI } from "./api";
import { syncIdeasToVault, migrateSyncFolder } from "./sync";
import { SpeakPenSettingTab } from "./settings";
import { translate as t } from "./i18n";

export default class SpeakPenPlugin extends Plugin {
  settings: SpeakPenSettings = { ...DEFAULT_SETTINGS };
  syncState: SyncState = migrateSyncState(null);
  private accounts: Record<string, SyncState> = {};
  private legacyState: SyncState | null = null;
  private autoSyncIntervalId: number | null = null;
  private credentialTimer: ReturnType<typeof setTimeout> | null = null;
  private settingTab: SpeakPenSettingTab | null = null;
  private statusBarEl: HTMLElement | null = null;
  private activeSync: Promise<void> | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private generation = 0;
  private visibilityGeneration = 0;
  private stopped = false;
  private ready = false;
  private lastAutomaticAttempt: number | null = null;

  async onload() {
    await this.loadPluginData();
    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar();
    this.addRibbonIcon("refresh-cw", t("syncNow"), () => { void this.runSync(); });
    this.addCommand({id: "sync-now", name: t("syncNow"), callback: () => { void this.runSync(); }});
    this.settingTab = new SpeakPenSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    this.registerDomEvent(window, "focus", () => this.requestAutomaticSync());
    this.registerDomEvent(document, "visibilitychange", () => {
      if (document.visibilityState === "hidden") this.visibilityGeneration++;
      this.requestAutomaticSync();
    });
    this.app.workspace.onLayoutReady(() => {
      if (this.stopped) return;
      this.ready = true;
      this.requestAutomaticSync();
    });
    this.resetAutoSync();
  }

  onunload() {
    this.stopped = true;
    this.generation++;
    this.clearAutoSync();
    if (this.credentialTimer !== null) clearTimeout(this.credentialTimer);
  }

  async loadPluginData() {
    const data = (await this.loadData()) as Partial<PluginData> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...data?.settings };
    this.syncState = migrateSyncState(data?.syncState);
    this.accounts = Object.fromEntries(Object.entries(data?.accounts ?? {}).map(([id, state]) => [id, migrateSyncState(state)]));
    if (this.syncState.ownerId) this.accounts[this.syncState.ownerId] = this.syncState;
    this.legacyState = data?.legacyState ? migrateSyncState(data.legacyState) : (!this.syncState.ownerId ? this.syncState : null);
  }

  async savePluginData() {
    // Capture together, then serialize writes so a slower old save cannot win.
    const data = JSON.parse(JSON.stringify({settings: this.settings, syncState: this.syncState, accounts: this.accounts, legacyState: this.legacyState})) as PluginData;
    const operation = this.saveQueue.catch(() => {}).then(() => this.saveData(data));
    this.saveQueue = operation;
    await operation;
  }

  async setApiToken(value: string) {
    const token = value.trim();
    if (token === this.settings.apiToken) return;
    this.generation++; // Revoke before any await or debounce.
    this.settings.apiToken = token;
    this.syncState = migrateSyncState(null);
    this.lastAutomaticAttempt = null;
    this.updateStatusBar();
    this.resetAutoSync();
    await this.savePluginData();
    if (this.credentialTimer !== null) clearTimeout(this.credentialTimer);
    if (!this.stopped) this.credentialTimer = setTimeout(() => {
      this.credentialTimer = null;
      this.requestAutomaticSync();
    }, 1000);
  }

  resetAutoSync() {
    this.clearAutoSync();
    if (!this.stopped && this.settings.autoSyncEnabled && this.settings.apiToken) {
      const minutes = Math.max(1, Math.min(60, Number(this.settings.autoSyncIntervalMinutes) || 5));
      this.autoSyncIntervalId = window.setInterval(() => this.requestAutomaticSync(), minutes * 60_000);
      this.registerInterval(this.autoSyncIntervalId);
      if (this.ready) this.requestAutomaticSync();
    }
  }

  private clearAutoSync() {
    if (this.autoSyncIntervalId !== null) window.clearInterval(this.autoSyncIntervalId);
    this.autoSyncIntervalId = null;
  }

  private requestAutomaticSync() {
    if (this.stopped || !this.ready || !this.settings.autoSyncEnabled || !this.settings.apiToken || document.visibilityState === "hidden" || this.activeSync) return;
    if (this.lastAutomaticAttempt !== null && Date.now() - this.lastAutomaticAttempt < 60_000) return;
    this.lastAutomaticAttempt = Date.now();
    void this.runSync(true);
  }

  getSyncStatus(): string {
    if (!this.settings.apiToken) return t("missingToken");
    const state = this.syncState;
    switch (state.outcome) {
      case "paused": return t("paused");
      case "syncing": return t("syncing");
      case "partial": return t("partial", {count: state.failureCount ?? 0});
      case "conflict": return t("conflict", {count: state.conflictCount ?? 0});
      case "failed": return t("failed");
    }
    if (state.lastSyncTime) return t("synced", {time: new Date(state.lastSyncTime).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})});
    return t("notSynced");
  }

  private updateStatusBar() {
    this.statusBarEl?.setText(this.getSyncStatus());
    this.settingTab?.refreshStatus();
  }

  async runSync(silent = false): Promise<void> {
    if (this.stopped) return;
    if (this.activeSync) return this.activeSync;
    if (!this.settings.apiToken) {
      if (!silent) new Notice(t("missingToken"));
      return;
    }
    // The first await in performSync happens before the operation is published here.
    const startedGeneration = this.generation;
    this.lastAutomaticAttempt = Date.now();
    const operation = this.performSync(silent);
    this.activeSync = operation;
    try { await operation; }
    finally {
      if (this.activeSync === operation) this.activeSync = null;
      if (startedGeneration !== this.generation) this.requestAutomaticSync();
    }
  }

  private async performSync(silent: boolean) {
    const generation = this.generation;
    const token = this.settings.apiToken;
    const folder = this.settings.syncFolder;
    const visibilityGeneration = this.visibilityGeneration;
    const sameSettings = () => !this.stopped && this.generation === generation && this.settings.apiToken === token && this.settings.syncFolder === folder;
    const current = () => sameSettings() && (!silent || (document.visibilityState !== "hidden" && this.visibilityGeneration === visibilityGeneration));
    const check = () => { if (!current()) throw new Error("Sync session changed"); };
    let state: SyncState | null = null;
    this.syncState.outcome = "syncing";
    this.updateStatusBar();
    try {
      const api = new SpeakPenAPI(token, current);
      const owner = await api.fetchOwnerId(); check();
      state = this.accounts[owner] ?? migrateSyncState(null);
      const legacy = !this.accounts[owner] ? this.legacyState : null;
      // An unbound legacy cursor could belong to another account. Walk once and
      // only adopt tracking for IDs actually returned by this verified owner.
      const changed = await api.fetchIdeasSince(legacy ? null : state.cursor); check();
      if (legacy) {
        const ids = new Set(changed.map(idea => idea.id));
        state.notes = Object.fromEntries(Object.entries(legacy.notes).filter(([id]) => ids.has(id)));
        state.legacyIds = legacy.legacyIds.filter(id => ids.has(id));
        state.syncFolder = legacy.syncFolder;
        this.legacyState = null;
      }
      state.ownerId = owner;
      state.lastAttemptTime = new Date().toISOString();
      state.outcome = "syncing";
      this.accounts[owner] = state;
      this.syncState = state;
      const checkpoint = async (notes: SyncState["notes"]) => {
        Object.assign(state!.notes, notes);
        // A filesystem operation already issued cannot be revoked. Its receipt
        // belongs only to this captured owner, never to the new active state.
        await this.savePluginData();
      };
      const hooks = { isCurrent: current, checkpoint };
      const migration = await migrateSyncFolder(state.notes, state.syncFolder, folder, this.app.vault, hooks);
      check();
      Object.assign(state.notes, migration.moved);
      if (migration.failures.length === 0) state.syncFolder = folder;
      const report = await syncIdeasToVault(changed, folder, this.app.vault, state, hooks);
      check();
      Object.assign(state.notes, report.notes);
      state.cursor = report.cursor;
      state.failureCount = report.failures.length + migration.failures.length;
      state.conflictCount = report.localEdits.length;
      state.outcome = state.failureCount ? "partial" : state.conflictCount ? "conflict" : "success";
      if (state.outcome === "success") state.lastSyncTime = new Date().toISOString();
      await this.savePluginData(); check();
      if (state.outcome !== "success") new Notice(this.getSyncStatus());
      else if (!silent || report.created.length || report.updated.length || Object.keys(migration.moved).length) {
        new Notice(t("result", {created: report.created.length, updated: report.updated.length, moved: Object.keys(migration.moved).length}));
      }
    } catch {
      if (sameSettings() && !current()) {
        this.syncState.outcome = "paused";
        this.updateStatusBar();
      }
      if (current()) {
        this.syncState.outcome = "failed";
        this.syncState.lastAttemptTime = new Date().toISOString();
        // Failure text is deliberately independent of provider/filesystem errors.
        try { await this.savePluginData(); } catch { /* Status still reports failure. */ }
        if (current()) new Notice(this.getSyncStatus());
      }
    } finally {
      if (current()) this.updateStatusBar();
    }
  }
}

/**
 * Bring sync state forward from the pre-0.3.0 shape.
 *
 * That version recorded a flat list of synced ids and nothing else — no path, no content,
 * no cursor. Those ids move to `legacyIds`, which still prevents duplicates but cannot
 * support updates or moves, since we know neither where those notes went nor whether the
 * user has since rewritten them. Everything synced from now on is tracked properly.
 *
 * The cursor deliberately stays null so the first run after upgrading walks the whole
 * history once: that is what populates `notes` for anything still current, and it is a
 * single expensive sync in exchange for cheap ones from then on.
 */
export function migrateSyncState(stored: unknown): SyncState {
  const state = Object.assign({}, DEFAULT_SYNC_STATE, (stored as Partial<SyncState>) ?? {});
  state.notes = { ...(state.notes ?? {}) };
  state.legacyIds = [...(state.legacyIds ?? [])];

  const legacy = (stored as { syncedIds?: unknown })?.syncedIds;
  if (Array.isArray(legacy) && legacy.length > 0) {
    const known = new Set(state.legacyIds);
    for (const id of legacy) {
      if (typeof id === "string" && !known.has(id) && !state.notes[id]) {
        state.legacyIds.push(id);
        known.add(id);
      }
    }
  }

  return state;
}
