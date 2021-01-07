
export class ConnectionClosedError extends Error {
    public name = ConnectionClosedError.name;
    public constructor(message = 'This connection is closed.') {
        super(message);
    }
}

export class ProtocolError extends Error {
    public name = ProtocolError.name;
    public constructor(message = 'Unexpected reply.') {
        super(message);
    }
}

export const RESERVED_CODE_RANGE = 100;
export const PROTOCOL_CODE_RANGE = 200;
export const PROTOCOL_MESSAGE: Net.CloseMessage = { code: 1, reason: 'protocol violation' };
export const TERMINATED_MESSAGE: Net.CloseMessage = { code: 0, reason: 'terminated' };
export const TIMEOUT_MESSAGE: Net.CloseMessage = { code: 2, reason: 'timeout' };