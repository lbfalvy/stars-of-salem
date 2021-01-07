import { exposeResolve, TypedEvent } from '../../TypedEvent';
import { ConnectionClosedError, TERMINATED_MESSAGE } from '..';
import * as Protocol from './Protocol';

export interface SessionOptions {
    timeout?: number,
    takeover?: boolean
}

export class Session implements Net.Session {
    public readonly message = new TypedEvent<Net.Data>();
    public readonly closed = exposeResolve<Net.CloseEvent>();
    public readonly brokenPipe = new TypedEvent<Net.CloseMessage>();
    public readonly resuming = new TypedEvent<void>();
    public isClosed = false;
    public get isReady(): boolean {
        return this.connection !== undefined;
    }
    private connection: Net.Connection | undefined;
    private timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    private readonly timeout: number;
    private readonly takeover: boolean;

    public constructor(socket: Net.Connection, options?: SessionOptions) {
        this.connection = socket;
        this.engageHandlers(socket);
        this.timeout = options?.timeout || 10_000;
        this.takeover = options?.takeover === undefined ? true : options.takeover;
    }

    public onReconnect(conn: Net.Connection): void {
        // If it's been closed already
        if (this.isClosed) throw new ConnectionClosedError();
        // If the old connection is still open, close one based on the takeover policy
        if (this.connection !== undefined) {
            if (!this.takeover) {
                conn.close(Protocol.messages.rejectedTakeover);
                return;
            }
            this.connection.close(Protocol.messages.takeover);
        }
        // Get rid of the timeout
        if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
        // Update field
        if (!this.isReady) this.resuming.emit();
        this.connection = conn;
        conn.send(Protocol.RESUME_COMMAND);
        this.engageHandlers(conn);
    }

    // This could have been an async function if it wasn't for Typescript
    public send(msg: Net.Data, params?: Record<string, any>): Promise<void> {
        // Closed session
        if (this.isClosed) return Promise.reject(new ConnectionClosedError());
        // Open session
        if (this.connection) return this.connection.send(msg, params);
        // Hanging session and we can't wait
        if (params?.immediate) return Promise.reject(new ConnectionClosedError());
        // Hanging session and we can wait
        return Promise.race([
            this.resuming.next,
            this.closed
        ]).then(() => {
            // Session restored
            if (this.connection) return this.connection.send(msg, params);
            // Session timed out
            return Promise.reject(new ConnectionClosedError());
        });
    }

    public async close(message: Net.CloseMessage): Promise<void> {
        if (this.isClosed) throw new ConnectionClosedError();
        if (this.connection) this.connection.close(message);
        this.closeObject({ message, local: true });
    }

    public terminate(): void {
        this.isClosed = true;
        this.connection?.close(TERMINATED_MESSAGE);
        this.closed.resolve({ message: TERMINATED_MESSAGE, local: true });
        // This is a promise but we aren't waiting for it
    }

    private engageHandlers(conn: Net.Connection) {
        // Forward messages
        conn.message.pipeRaw(this.message);
        // When the pipe breaks
        conn.closed.then(ev => this.handleConnectionClose(ev));
    }

    private handleConnectionClose(ev: Net.CloseEvent) {
        // Positive values mean application reasons
        // Negative values mean websocket reasons
        if (ev.message.code >= 0) this.closeObject({ message: ev.message, local: false });
        else this.handleBrokenPipe(ev.message);
    }

    private handleBrokenPipe(msg: Net.CloseMessage) {
        this.brokenPipe.emit(msg); // Notify
        this.connection = undefined;
        // After `timeout` ms, unless cleared, notify that the session was closed.
        this.timeoutHandle = setTimeout(
            () => this.closeObject({ message: Protocol.messages.timeout, local: false }),
            this.timeout
        );
    }

    private closeObject(event: Net.CloseEvent): void {
        this.isClosed = true;
        this.connection = undefined;
        this.closed.resolve(event);
    }
}