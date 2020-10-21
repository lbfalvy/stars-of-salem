import { TypedEvent } from '../TypedEvent';

export type Data = string|ArrayBuffer;

export interface MessageEvent {
    data:Data;
}

export interface CloseEvent {
    message:CloseMessage,
    local:boolean
}

export interface CloseMessage {
    code:number
    reason:string
}

export class ConnectionClosedError extends Error {
    public constructor(message?: string) {
        super(message || 'This connection is closed.');
        this.name = 'SessionClosedError';
    }
}

export class ProtocolError extends Error {
    public constructor(message?: string) {
        super(message || 'Unexpected reply.');
        this.name = 'ProtocolError';
    }
}

export const ProtocolMessage:CloseMessage = {
    code: 3405,
    reason: 'The other peer broke the protocol'
};

export const TERMINATED_MESSAGE:CloseMessage = { code: -2, reason: 'terminated' };

/**
 * Disambiguation:
 *  closed() is fired even when we initiated the closing handshake.
 *  isClosed is true while the closed() handlers are running.
 *  if message doesn't arrive, send() will fail.
 */
export interface Connection {
    readonly message:TypedEvent<MessageEvent>;
    readonly closed:TypedEvent<CloseEvent>;
    readonly isClosed:boolean;

    send( data:Data ):Promise<void>|never;
    close( message:CloseMessage ):Promise<void>|never;
    terminate():void;
}

export interface ConnectionTarget {
    readonly connection:TypedEvent<Connection>;
    readonly clients:Set<Connection>;
}