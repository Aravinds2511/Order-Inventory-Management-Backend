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