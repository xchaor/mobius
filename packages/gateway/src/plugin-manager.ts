import { EventBus } from "./event-bus.js";

export interface Plugin {
  name: string; version: string; description?: string;
  onRegister?(eventBus: EventBus): void | Promise<void>;
  onActivate?(): void | Promise<void>;
  onDeactivate?(): void | Promise<void>;
}

export class PluginManager {
  private plugins = new Map<string, { plugin: Plugin; active: boolean; registeredAt: Date }>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) { this.eventBus = eventBus; }

  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) throw new Error(`Plugin '${plugin.name}' is already registered`);
    if (plugin.onRegister) await plugin.onRegister(this.eventBus);
    this.plugins.set(plugin.name, { plugin, active: false, registeredAt: new Date() });
    await this.eventBus.emit({ type: "plugin:registered", source: "plugin-manager", timestamp: new Date(), payload: { pluginName: plugin.name, version: plugin.version } });
  }

  async activate(name: string): Promise<void> {
    const registered = this.plugins.get(name);
    if (!registered) throw new Error(`Plugin '${name}' not registered`);
    if (registered.active) return;
    if (registered.plugin.onActivate) await registered.plugin.onActivate();
    registered.active = true;
    await this.eventBus.emit({ type: "plugin:activated", source: "plugin-manager", timestamp: new Date(), payload: { pluginName: name } });
  }

  list(): string[] { return Array.from(this.plugins.keys()); }
  activePlugins(): string[] { return Array.from(this.plugins.entries()).filter(([, v]) => v.active).map(([k]) => k); }
}
