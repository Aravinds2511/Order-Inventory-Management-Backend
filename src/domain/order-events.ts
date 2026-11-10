export interface OrderCreatedEvent {
    orderId: string;
    userId: string;
    totalAmountInPaise: number;
    occurredAt: Date;
}

export interface OrderCancelledEvent {
    orderId: string;
    userId: string;
    reason: string;
    occurredAt: Date;
}

export interface OrderEventMap {
    "order.created": OrderCreatedEvent;
    "order.cancelled": OrderCancelledEvent;
}