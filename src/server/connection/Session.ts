import { TypedEvent } from '../helpers/TypedEvent';
import { get_uid } from '../helpers/uids';
import { Interfaces } from './Interfaces';

export class Session implements Session.IServerSession {
    readonly message = new TypedEvent<Interfaces.MessageEvent>();
    readonly closed = new TypedEvent<Interfaces.CloseEvent>();
    readonly pinged = new TypedEvent<Buffer>();
    readonly ponged = new TypedEvent<Buffer>();
    readonly broken_pipe = new TypedEvent<this>();
    readonly resuming = new TypedEvent<this>();
    
    isClosed = false;
    private _connection: Interfaces.Connection | undefined;
    private timeout_handle: NodeJS.Timeout | undefined;
    private readonly timeout: number;
    private readonly takeover: boolean;
    get connection() {
        return this._connection;
    }
    set connection(value) {
        // If it's been closed already
        if (this.isClosed) throw new Interfaces.ConnectionClosedError();
        // If it's a reconnection
        const resuming = value && !this.connection;
        if (value && this.connection) {
            // This is a takeover. If takeovers aren't supported, reject the socket
            if (!this.takeover) {
                value.close(Session.messages.rejectedTakeover);
                return;
            }
            this.connection.close(Session.messages.takeover);
        }
        // Get rid of the timeout
        if (this.timeout_handle) clearTimeout(this.timeout_handle);

        // Update field
        this._connection = value;

        // Forward messages
        value?.message.pipe_raw(this.message);
        value?.pinged.pipe_raw(this.pinged);
        value?.ponged.pipe_raw(this.ponged);
        // When the pipe breaks, signal, start timeout.
        value?.closed.once(ev => {
            this.broken_pipe.emit(this);
            this.connection = undefined;
            const th = this.close.bind(this, Session.messages.timeout);
            this.timeout_handle = setTimeout(th, this.timeout);
        });
        if (resuming) {
            // Simple case
            this.resuming.emit(this);
        }
    }

    constructor( socket:Interfaces.Connection, options?:Session.Options ) {
        this.connection = socket;
        this.timeout = options?.timeout || 10_000;
        this.takeover = options?.takeover || true;
    }

    send( msg:Interfaces.Data ) {
        // Closed session
        if (this.isClosed) return Promise.reject(new Interfaces.ConnectionClosedError());
        // Open session
        if (this.connection) return this.connection.send(msg);
        // Hanging session
        return Promise.race([
            this.resuming.wait(),
            this.closed.wait()
        ]).then(() => {
            // Session restored
            if (this.connection) return this.connection.send(msg);
            // Session timed out
            return Promise.reject(new Interfaces.ConnectionClosedError());
        })
    }

    /**
     * @param data Data you want to send
     */
    ping( data:Buffer|undefined ) {
        if (this.isClosed) throw new Interfaces.ConnectionClosedError();
        this.connection?.ping(data);
    }

    close( message:Interfaces.CloseMessage ) {
        if (this.isClosed) throw new Interfaces.ConnectionClosedError();
        if (this.connection) {
            this.connection.close( message );
        }
        this.isClosed = true;
        this.closed.emit({ message, local: true });
        return Promise.resolve();
    }

    terminate() {
        this.isClosed = true;
        return this.connection?.terminate();
    }
}

export namespace Session {
    export const messages = {
        noHandshake: {
            code: 401,
            reason: "The first message wasn't a session key or empty string"
        },
        invalidSession: {
            code: 402,
            reason: "The provided session key didn't correspond to an existing session."
        },
        takeover: {
            code: 201,
            reason: "Your session had been taken over by another connection."
        },
        rejectedTakeover: {
            code: 403,
            reason: "The previous connection is still alive, and takeovers aren't \
allowed by the server configuration."
        },
        timeout: {
            code: 404,
            reason: "Client didn't attempt a reconnect within the defined timeout"
        }
    }

    export interface ServerOptions {
        session_timeout?:number,
        socket_timeout?:number
    }

    export interface Options {
        timeout?:number,
        takeover?:boolean
    }

    export type ConnectionWrapper = ( conn:Interfaces.Connection, resuming:boolean )=>Interfaces.Connection;
    export type SessionFactory = ( conn:Interfaces.Connection )=>IServerSession
    
    export class Server implements Interfaces.ConnectionTarget {
        private session_store = new Map<string, IServerSession>();
        public connection = new TypedEvent<Interfaces.Connection>();

        public constructor( server:Interfaces.ConnectionTarget, 
                            wrap_conn:ConnectionWrapper,
                     get_session: SessionFactory) {
            server.connection.on(async conn => {
                const key = await conn.message.wait();
                if (typeof key !== 'string') { 
                    // Protocol mismatch, presumably
                    conn.close(messages.noHandshake);
                    console.warn("Unknown message, expected string.", key);
                } else if (key === '') {
                    // Generate a new session
                    let id = get_uid();
                    let session = get_session(wrap_conn(conn, false));
                    this.session_store.set(id, session);
                    session.closed.once(() => this.session_store.delete(id));
                    this.connection.emit(session);
                } else {
                    let session = this.session_store.get(key);
                    if (session) {
                        session.connection = wrap_conn(conn, true);
                    } else {
                        conn.close(messages.invalidSession)
                    }
                }
            })
        }

        get clients(): Set<IServerSession> {
            let sessions = this.session_store.values();
            return new Set(sessions);
        }
    }

    export interface IServerSession extends Interfaces.Connection {
        readonly closed: TypedEvent<Interfaces.CloseEvent>;
        connection: Interfaces.Connection | undefined;
    }
}