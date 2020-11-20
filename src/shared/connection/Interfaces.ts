import { TypedEventSource } from '../TypedEvent';

export type Data = string|ArrayBuffer;

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

export const RESERVED_CODE_RANGE = 100;
export const PROTOCOL_CODE_RANGE = 200;
export const PROTOCOL_MESSAGE:CloseMessage = { code: 1, reason: 'protocol violation' };
export const TERMINATED_MESSAGE:CloseMessage = { code: 0, reason: 'terminated' };
export const TIMEOUT_MESSAGE:CloseMessage = { code: 2, reason: 'timeout' };

/**
 * Disambiguation:
 *  closed() is fired even when we initiated the closing handshake.
 *  isClosed is true while the closed() handlers are running.
 *  if message doesn't arrive, send() will fail.
 */
export interface Connection {
    readonly message:TypedEventSource<Data>;
    readonly closed:Promise<CloseEvent>;
    readonly isClosed:boolean;

    send( data:Data, params?:Record<string, any>):Promise<void>|never;
    close( message:CloseMessage ):Promise<void>|never;
    terminate():void;
}

export interface ConnectionTarget {
    readonly connection:TypedEventSource<Connection>;
    readonly clients:Set<Connection>;
}