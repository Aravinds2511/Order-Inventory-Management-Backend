import { orderEventBus } from "./order-event-bus.js";

orderEventBus.on("order.created", (event) => {
    console.log("New order created:", event.orderId);
});

orderEventBus.on("order.cancelled", (event) => {
    console.log("Order cancelled:", event.orderId);
});