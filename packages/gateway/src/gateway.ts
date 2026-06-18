import { EventBus } from "./event-bus.js";
import { PluginManager } from "./plugin-manager.js";

export interface GatewayConfig { name: string; version: string; }

export class Gateway {
  readonly eventBus: EventBus;
  readonly pluginManager: PluginManager;
  readonly config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.eventBus = new EventBus();
    this.pluginManager = new PluginManager(this.eventBus);
  }

  async start(): Promise<void> {
    console.log(`[Gateway] Starting ${this.config.name} v${this.config.version}`);
    await this.eventBus.emit({ type: "gateway:starting", source: "gateway", timestamp: new Date(), payload: { name: this.config.name, version: this.config.version } });
  }

  async stop(): Promise<void> {
    console.log(`[Gateway] Stopping ${this.config.name}`);
    await this.eventBus.emit({ type: "gateway:stopping", source: "gateway", timestamp: new Date(), payload: {} });
  }
}
