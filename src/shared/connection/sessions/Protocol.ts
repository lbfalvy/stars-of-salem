import { RESERVED_CODE_RANGE } from "..";

export type Key = string;

export const messages = {
    /**
     * In response to opening message if it was binary
     */
    noHandshake: {
        code: RESERVED_CODE_RANGE + 1,
        reason: "The first message wasn't a session key or empty string"
    },

    /**
     * In response to opening message if it wasn't a known session key
     */
    invalidSession: {
        code: RESERVED_CODE_RANGE + 2,
        reason: "The provided session key didn't correspond to an existing session."
    },

    /**
     * On the old channel in response to a takeover if they're allowed
     */
    takeover: {
        code: RESERVED_CODE_RANGE + 3,
        reason: "Your session had been taken over by another connection."
    },

    /**
     * In response to a takeover if they're not allowed
     */
    rejectedTakeover: {
        code: RESERVED_CODE_RANGE + 4,
        reason: "The previous connection is still alive, and takeovers aren't \
allowed by the server configuration."
    },

    /**
     * Towards application code if the session timed out
     */
    timeout: {
        code: RESERVED_CODE_RANGE + 5,
        reason: "Client didn't attempt a reconnect within the defined timeout"
    }
};
// Sent by the server if the session key is accepted
export const RESUME_COMMAND = 'resume';
// Sent by the client in place of a key to start a new session
export const NO_KEY = '';