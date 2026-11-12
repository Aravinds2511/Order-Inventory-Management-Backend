export class AppError extends Error {
    public readonly code: string;

    constructor(
        message: string,
        code: string,
        options?: ErrorOptions
    ) {
        super(message, options);
        this.code = code;
        this.name = this.constructor.name;

        // Restore prototype chain for instanceof checks across inheritance
        Object.setPrototypeOf(this, new.target.prototype);

        // Capture stack trace if available (V8 engines)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export class ConfigurationError extends AppError {
    constructor(
        message: string,
        codeOrOptions: string | ErrorOptions = "CONFIGURATION_ERROR",
        options?: ErrorOptions
    ) {
        if (typeof codeOrOptions === "object" && codeOrOptions !== null) {
            super(message, "CONFIGURATION_ERROR", codeOrOptions);
        } else {
            super(message, codeOrOptions, options);
        }
    }
}

export class HttpError extends AppError {
    public readonly statusCode: number;

    constructor(
        statusCode: number,
        message: string,
        code: string,
        options?: ErrorOptions
    ) {
        super(message, code, options);
        this.statusCode = statusCode;
    }
}

export class NotFoundError extends HttpError {
    constructor(
        message: string = "Resource not found",
        code: string = "NOT_FOUND",
        options?: ErrorOptions
    ) {
        super(404, message, code, options);
    }
}

export class MethodNotAllowedError extends HttpError {
    public readonly allowedMethods: readonly string[];

    constructor(
        allowedMethods: readonly string[],
        message?: string,
        code: string = "METHOD_NOT_ALLOWED",
        options?: ErrorOptions
    ) {
        const allowed = allowedMethods.join(", ");
        super(
            405,
            message ?? `Method not allowed. Supported methods: ${allowed}`,
            code,
            options
        );
        this.allowedMethods = allowedMethods;
    }
}
