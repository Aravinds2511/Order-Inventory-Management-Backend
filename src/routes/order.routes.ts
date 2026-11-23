import { Router } from "express";
import { createOrder } from "../controllers/order.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createOrderSchema } from "../validation/order.schema.js";

const router = Router();

router.post(
    "/",
    authenticate,
    validate({ body: createOrderSchema }),
    createOrder
);

export default router;
