import { UserRole } from "../generated/prisma/client.js";

export interface AuthenticatedUser {
    id: string;
    email: string;
    role: UserRole;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}
