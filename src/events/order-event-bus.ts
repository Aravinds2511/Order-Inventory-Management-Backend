import { EventEmitter } from "node:events";
import type { OrderEventMap } from "../domain/order-events.js";

export class OrderEventBus {
    private readonly emitter = new EventEmitter();

    /**
     * Registers a listener for the specified event.
     */
    on<K extends keyof OrderEventMap>(
        event: K,
        listener: (payload: OrderEventMap[K]) => void
    ): this {
        this.emitter.on(event, listener as (...args: unknown[]) => void);
        return this;
    }

    /**
     * Registers a one-time listener for the specified event.
     */
    once<K extends keyof OrderEventMap>(
        event: K,
        listener: (payload: OrderEventMap[K]) => void
    ): this {
        this.emitter.once(event, listener as (...args: unknown[]) => void);
        return this;
    }

    /**
     * Removes the specified listener from the event.
     */
    off<K extends keyof OrderEventMap>(
        event: K,
        listener: (payload: OrderEventMap[K]) => void
    ): this {
        this.emitter.off(event, listener as (...args: unknown[]) => void);
        return this;
    }

    /**
     * Synchronously calls each listener registered for the event with the typed payload.
     */
    emit<K extends keyof OrderEventMap>(
        event: K,
        payload: OrderEventMap[K]
    ): boolean {
        return this.emitter.emit(event, payload);
    }

    /**
     * Alias for on()
     */
    addListener<K extends keyof OrderEventMap>(
        event: K,
        listener: (payload: OrderEventMap[K]) => void
    ): this {
        return this.on(event, listener);
    }

    /**
     * Alias for off()
     */
    removeListener<K extends keyof OrderEventMap>(
        event: K,
        listener: (payload: OrderEventMap[K]) => void
    ): this {
        return this.off(event, listener);
    }

    /**
     * Removes all listeners, or those of the specified event.
     */
    removeAllListeners<K extends keyof OrderEventMap>(event?: K): this {
        this.emitter.removeAllListeners(event);
        return this;
    }

    /**
     * Returns the number of listeners listening to the specified event.
     */
    listenerCount<K extends keyof OrderEventMap>(event: K): number {
        return this.emitter.listenerCount(event);
    }
}

export const orderEventBus = new OrderEventBus();

