import "./events/order-event-handlers.js";

import { orderEventBus } from "./events/order-event-bus.js";

orderEventBus.emit("order.cancelled", {
    orderId: "ORD001",
    userId: "USER001",
    reason: "Order not fulfilled",
    occurredAt: new Date()
});

orderEventBus.emit("order.cancelled", {
    orderId: "ORD002",
    userId: "USER001",
    reason: "Order not fulfilled",
    occurredAt: new Date()
});