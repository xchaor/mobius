import { describe, it, expect } from "vitest";
import { Gateway } from "../gateway.js";
import { EventBus } from "../event-bus.js";
import { PluginManager } from "../plugin-manager.js";

describe("EventBus", () => {
  it("delivers events", async () => {
    const bus = new EventBus(); const received: any[] = [];
    bus.on("test:e", e => received.push(e));
    await bus.emit({ type: "test:e", source: "t", timestamp: new Date(), payload: { v: 42 } });
    expect(received[0].payload.v).toBe(42);
  });
  it("delivers to wildcard", async () => {
    const bus = new EventBus(); const received: any[] = [];
    bus.on("*", e => received.push(e));
    await bus.emit({ type: "x:y", source: "t", timestamp: new Date(), payload: {} });
    expect(received).toHaveLength(1);
  });
  it("off() removes handler", async () => {
    const bus = new EventBus(); const received: any[] = [];
    const id = bus.on("test:e", e => received.push(e));
    bus.off(id);
    await bus.emit({ type: "test:e", source: "t", timestamp: new Date(), payload: {} });
    expect(received).toHaveLength(0);
  });
});

describe("PluginManager", () => {
  it("registers and activates", async () => {
    const bus = new EventBus(); const pm = new PluginManager(bus);
    let activated = false;
    await pm.register({ name: "p", version: "1", onActivate: () => { activated = true; } });
    await pm.activate("p");
    expect(activated).toBe(true);
  });
  it("prevents duplicate", async () => {
    const bus = new EventBus(); const pm = new PluginManager(bus);
    await pm.register({ name: "p", version: "1" });
    await expect(pm.register({ name: "p", version: "2" })).rejects.toThrow();
  });
});

describe("Gateway", () => {
  it("starts and emits", async () => {
    const gw = new Gateway({ name: "g", version: "0.1" }); const events: any[] = [];
    gw.eventBus.on("gateway:starting", e => events.push(e));
    await gw.start();
    expect(events).toHaveLength(1);
  });
});
