import { App, PluginSettingTab, Setting } from "obsidian";
import type SpeakPenPlugin from "./main";
import { translate as t } from "./i18n";

export class SpeakPenSettingTab extends PluginSettingTab {
  plugin: SpeakPenPlugin;
  private statusSetting: Setting | null = null;

  refreshStatus() { this.statusSetting?.setDesc(this.plugin.getSyncStatus()); }
  hide() { this.statusSetting = null; }

  constructor(app: App, plugin: SpeakPenPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.statusSetting = new Setting(containerEl)
      .setName(t("status"))
      .setDesc(this.plugin.getSyncStatus())
      .addButton(button => button.setButtonText(t("syncNow")).onClick(async () => {
        button.setDisabled(true);
        try { await this.plugin.runSync(); } finally { button.setDisabled(false); this.display(); }
      }));

    // 说明里点明 token 存在哪、什么动作会带走它、以及可以随时吊销。
    // 语气保持平实：token 是只读的，说清事实即可，不必渲染成风险提示。
    const tokenDesc = new DocumentFragment();
    tokenDesc.append(
      t("tokenHelp")
    );
    tokenDesc.append(tokenDesc.createEl("br"));
    tokenDesc.append(
      t("tokenPrivacy")
    );

    new Setting(containerEl)
      .setName(t("apiToken"))
      .setDesc(tokenDesc)
      .addText((text) =>
        text
          .setPlaceholder(t("pasteToken"))
          .setValue(this.plugin.settings.apiToken)
          .onChange(async (value) => {
            await this.plugin.setApiToken(value);
          })
      );

    new Setting(containerEl)
      .setName(t("folder"))
      .setDesc(t("folderHelp"))
      .addText((text) =>
        text
          .setPlaceholder(t("folderPlaceholder"))
          .setValue(this.plugin.settings.syncFolder)
          .onChange(async (value) => {
            this.plugin.settings.syncFolder = value || "SpeakPen";
            await this.plugin.savePluginData();
          })
      );

    new Setting(containerEl)
      .setName(t("autoSync"))
      .setDesc(t("autoSyncHelp"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoSyncEnabled)
          .onChange(async (value) => {
            this.plugin.settings.autoSyncEnabled = value;
            await this.plugin.savePluginData();
            this.plugin.resetAutoSync();
          })
      );

    new Setting(containerEl)
      .setName(t("interval"))
      .setDesc(t("intervalHelp"))
      .addSlider((slider) =>
        slider
          .setLimits(1, 60, 1)
          .setValue(this.plugin.settings.autoSyncIntervalMinutes)
          .onChange(async (value) => {
            this.plugin.settings.autoSyncIntervalMinutes = value;
            await this.plugin.savePluginData();
            this.plugin.resetAutoSync();
          })
      );
  }
}
