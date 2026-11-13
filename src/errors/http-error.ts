import { AppError } from "./app-error.js";

export class HttpError extends AppError {
    constructor(
        message: string,
        code: string,
        public readonly statusCode: number
    ) {
        super(message, code);
    }
}