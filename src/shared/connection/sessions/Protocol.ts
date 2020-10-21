
export type Key = string;

export const messages = {
    noHandshake: {
        code: 3401,
        reason: "The first message wasn't a session key or empty string"
    },
    invalidSession: {
        code: 3402,
        reason: "The provided session key didn't correspond to an existing session."
    },
    takeover: {
        code: 3201,
        reason: "Your session had been taken over by another connection."
    },
    rejectedTakeover: {
        code: 3403,
        reason: "The previous connection is still alive, and takeovers aren't \
allowed by the server configuration."
    },
    timeout: {
        code: 3404,
        reason: "Client didn't attempt a reconnect within the defined timeout"
    }
};
export const RESUME_COMMAND = 'resume';
export const NO_KEY = '';