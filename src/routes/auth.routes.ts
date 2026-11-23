import { Router } from "express";

import {
    register,
    login,
    refreshToken,
    logout,
    getMe
} from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
    registerSchema,
    loginSchema,
    refreshTokenSchema
} from "../validation/auth.schema.js";

const router = Router();

router.post("/register", validate({ body: registerSchema }), register);
router.post("/login", validate({ body: loginSchema }), login);
router.post("/refresh", validate({ body: refreshTokenSchema }), refreshToken);
router.post("/logout", validate({ body: refreshTokenSchema }), logout);
router.get("/me", authenticate, getMe);

export default router;
