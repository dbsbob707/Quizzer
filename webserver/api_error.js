// Custom APIError class which extends from the Error class
// This can be used to Handle Errors using -> instanceOf APIError

class APIError extends Error {
    constructor(...params) {
        super(...params);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, APIError);
        }
    }
}

module.exports = APIError;