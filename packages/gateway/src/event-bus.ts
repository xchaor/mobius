import { EventEmitter } from "events";

export interface MobiusEvent { type: string; source: string; timestamp: Date; payload: Record<string, unknown>; }
export type EventHandler = (event: MobiusEvent) => void | Promise<void>;

export class EventBus {
  private emitter = new EventEmitter();
  private handlerCount = 0;
  private handlerMap = new Map<string, { eventType: string; fn: (...args: any[]) => void }>();

  on(eventType: string, handler: EventHandler): string {
    const id = `handler-${++this.handlerCount}`;
    const wrapped = async (event: MobiusEvent) => { try { await handler(event); } catch (err) { console.error(`[EventBus] Handler ${id} error:`, err); } };
    this.emitter.on(eventType, wrapped);
    this.handlerMap.set(id, { eventType, fn: wrapped });
    return id;
  }

  once(eventType: string, handler: EventHandler): string {
    const id = `handler-${++this.handlerCount}`;
    const wrapped = async (event: MobiusEvent) => { try { await handler(event); } catch (err) { console.error(`[EventBus] Handler ${id} error:`, err); } finally { this.handlerMap.delete(id); } };
    this.emitter.once(eventType, wrapped);
    this.handlerMap.set(id, { eventType, fn: wrapped });
    return id;
  }

  off(handlerId: string): void {
    const registered = this.handlerMap.get(handlerId);
    if (registered) { this.emitter.removeListener(registered.eventType, registered.fn); this.handlerMap.delete(handlerId); }
  }

  async emit(event: MobiusEvent): Promise<void> {
    this.emitter.emit(event.type, event);
    this.emitter.emit("*", event);
    const colonIndex = event.type.indexOf(":");
    if (colonIndex > 0) this.emitter.emit(event.type.slice(0, colonIndex) + ":*", event);
  }

  listenerCount(eventType: string): number { return this.emitter.listenerCount(eventType); }
}
