import { Interfaces } from './Interfaces';
import { TypedEvent } from '../helpers/TypedEvent';

/**
 * Guarantees that close events are dispatched by using a ping.
 */
export class PingedConnection implements Interfaces.Connection {
    private isAlive:boolean = true;
    private check:NodeJS.Timeout;
    private conn:Interfaces.Connection;
    public readonly message:TypedEvent<Interfaces.MessageEvent>;
    public readonly closed:TypedEvent<Interfaces.CloseEvent>;
    public readonly ponged:TypedEvent<Buffer>;
    public readonly pinged:TypedEvent<Buffer>;
    
    public get isClosed() { return this.conn.isClosed; }

    public constructor(conn: Interfaces.Connection, timeout: number = 10_000) {
        this.conn = conn;
        this.send = conn.send.bind(conn);
        this.close = conn.close.bind(conn);
        this.terminate = conn.terminate.bind(conn);
        this.ping = conn.ping.bind(conn);
        this.pinged = conn.pinged;
        this.ponged = conn.ponged;
        this.message = conn.message;
        this.closed = conn.closed;
        conn.ponged.on(() => this.isAlive = true);
        conn.closed.once(ev => clearInterval(this.check));
        this.check = setInterval(() => {
            if (!this.isAlive) {
                this.terminate();
                this.closed.emit({
                    message: { code: 0, reason: 'timeout' }, local: false
                });
                return;
            }
            this.isAlive = false;
            conn.ping();
        }, timeout);
    }

    // Functions ported over from the internal connection
    public send: ( msg:any ) => Promise<void>;
    public close: ( msg:Interfaces.CloseMessage ) => Promise<void>;
    public terminate: () => void;
    public ping: (data:Buffer) => void;
}