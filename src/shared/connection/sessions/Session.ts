import { TypedEvent } from '../../TypedEvent';
import * as Interfaces from '../Interfaces';
import * as Protocol from './Protocol';

export interface SessionOptions {
    timeout?: number,
    takeover?: boolean
}

export class Session implements ISession {
    public readonly message = new TypedEvent<Interfaces.MessageEvent>();
    public readonly closed = new TypedEvent<Interfaces.CloseEvent>();
    public readonly broken_pipe = new TypedEvent<Interfaces.CloseMessage>();
    public readonly resuming = new TypedEvent<void>();
    public isClosed = false;
    private _connection: Interfaces.Connection | undefined;
    private timeout_handle: number | NodeJS.Timeout | undefined;
    private readonly timeout: number;
    private readonly takeover: boolean;
    public get connection(): Interfaces.Connection | undefined {
        return this._connection;
    }
    public set connection(value: Interfaces.Connection | undefined) {
        // If it's been closed already
        if (this.isClosed) {
            throw new Interfaces.ConnectionClosedError();
        }
        // If it's a reconnection
        const resuming = value && !this.connection;
        if (value && this.connection) {
            // This is a takeover. If takeovers aren't supported, reject the socket
            if (!this.takeover) {
                value.close(Protocol.messages.rejectedTakeover);
                return;
            }
            this.connection.close(Protocol.messages.takeover);
        }
        // Get rid of the timeout
        if (this.timeout_handle) {
            if (typeof this.timeout_handle == 'number') {
                clearTimeout(this.timeout_handle); // In browser
            } else {
                clearTimeout(this.timeout_handle); // In Node
            }
        }

        // Update field
        this._connection = value;

        // Forward messages
        value?.message.pipe_raw(this.message);
        // When the pipe breaks, signal, start timeout.
        value?.closed.once(ev => {
            this.broken_pipe.emit(ev.message);
            this.connection = undefined;
            const th = this.close.bind(this, Protocol.messages.timeout);
            this.timeout_handle = setTimeout(th, this.timeout);
        });
        if (resuming) {
            // Simple case
            this.resuming.emit();
            value?.send(Protocol.RESUME_COMMAND);
        }
    }

    public constructor(socket: Interfaces.Connection, options?: SessionOptions) {
        this.connection = socket;
        this.timeout = options?.timeout || 10_000;
        this.takeover = options?.takeover || true;
    }

    // This could have been an async function if it wasn't for Typescript
    public send(msg: Interfaces.Data):Promise<void> {
        // Closed session
        if (this.isClosed) {
            return Promise.reject(new Interfaces.ConnectionClosedError());
        }
        // Open session
        if (this.connection) {
            return this.connection.send(msg);
        } 
        // Hanging session
        return Promise.race([
            this.resuming.wait(),
            this.closed.wait()
        ]).then(() => {
            // Session restored
            if (this.connection) {
                return this.connection.send(msg);
            }
            // Session timed out
            return Promise.reject(new Interfaces.ConnectionClosedError());
        });
    }

    public async close(message: Interfaces.CloseMessage):Promise<void> {
        if (this.isClosed) {
            throw new Interfaces.ConnectionClosedError();
        }
        if (this.connection) {
            this.connection.close(message);
        }
        this.isClosed = true;
        this.closed.emit({ message, local: true });
        return;
    }

    public terminate():void {
        this.isClosed = true;
        return this.connection?.terminate();
    }
}

export interface ISession extends Interfaces.Connection {
    readonly broken_pipe: TypedEvent<Interfaces.CloseMessage>;
    readonly resuming: TypedEvent<void>;
    connection: Interfaces.Connection | undefined;
}