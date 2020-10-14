import { TypedEvent } from '../helpers/TypedEvent';

export namespace Interfaces {
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
        constructor(message?: string) {
            super(message || 'This connection is closed.');
            this.name = 'SessionClosedError';
        }
    }
    export const TERMINATED_MESSAGE:CloseMessage = { code: 0, reason: 'terminated' }

    /**
     * Disambiguation:
     *  closed() is fired even when we initiated the closing handshake.
     *  isClosed is true while the closed() handlers are running.
     *  if message doesn't arrive, send() will fail.
     */
    export interface Connection {
        readonly message:TypedEvent<MessageEvent>;
        readonly closed:TypedEvent<CloseEvent>;
        readonly pinged:TypedEvent<Buffer>;
        readonly ponged:TypedEvent<Buffer>;
        readonly isClosed:boolean;

        send( data:Data ):Promise<void>|never;
        close( message:CloseMessage ):Promise<void>|never;
        terminate():void;
        ping( data?:Buffer ):void|never;
    }

    export interface ConnectionTarget {
        readonly connection:TypedEvent<Connection>;
        readonly clients:Set<Connection>;
    }
}