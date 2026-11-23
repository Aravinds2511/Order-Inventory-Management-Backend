import { Router } from "express";

import {
    getProducts,
    getProductById,
    createProduct
} from "../controllers/product.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createProductSchema } from "../validation/product.schema.js";
import { UserRole } from "../generated/prisma/client.js";

const router = Router();

router.get("/", getProducts);
router.get("/:id", getProductById);
router.post(
    "/",
    authenticate,
    requireRole([UserRole.ADMIN]),
    validate({ body: createProductSchema }),
    createProduct
);

export default router;
