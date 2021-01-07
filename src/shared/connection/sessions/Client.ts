import { exposeResolve, TypedEvent } from '../../TypedEvent';
import { ConnectionClosedError, ProtocolError, PROTOCOL_MESSAGE, TERMINATED_MESSAGE } from '..';
import * as Protocol from './Protocol';

export class Client implements Net.Connection {
    private readonly connFactory: () => Promise<Net.Connection>;
    private conn: Net.Connection | undefined;
    private id: Protocol.Key = Protocol.NO_KEY;
    public readonly message = new TypedEvent<Net.Data>();
    public readonly ready = exposeResolve<this>();
    public readonly closed = exposeResolve<Net.CloseEvent>();
    public readonly brokenPipe = new TypedEvent<Net.CloseEvent>();
    public readonly resuming = new TypedEvent<void>();
    public isClosed = false;
    public isReady = false; // Whether we currently have a connection

    public constructor(conn_factory: () => Promise<Net.Connection>) {
        this.connFactory = conn_factory;
        this.ready.then(() => this.isReady = true);
        this.brokenPipe.on(() => this.isReady = false);
        this.resuming.on(() => this.isReady = true);
        this.closed.then(() => {
            this.ready.reject(new Error('The connection had been closed by the server'));
            this.isReady = false;
        });
        this.setupConnection();
    }

    public async send(msg: Net.Data): Promise<void> {
        if (this.isClosed) throw new ConnectionClosedError();
        if (this.isReady) return await this.conn?.send(msg);
        await Promise.race([
            this.resuming.next,
            this.closed
        ]);
        if (!this.conn) throw new ConnectionClosedError();
        await this.conn.send(msg);
    }

    public async close(msg: Net.CloseMessage): Promise<void> {
        if (this.isClosed) throw new ConnectionClosedError();
        await this.conn?.close(msg);
        this.isClosed = true;
        this.closed.resolve({ message: msg, local: true });
    }

    public terminate(): void {
        this.isClosed = true;
        this.conn?.close(TERMINATED_MESSAGE);
        this.closed.resolve({ message: TERMINATED_MESSAGE, local: true });
        // This is a promise but we aren't waiting for it
    }

    private async setupConnection() {
        this.conn = await this.connFactory();
        // Set a handler that will retry if the connection breaks
        this.conn.closed.then(ev => this.closeHandler(ev));
        this.conn.send(this.id); // Send the key or lack thereof
        const result = await this.conn.message.next; // Wait for a reply
        // If the connection breaks while we're waiting, the rest of the function will never run.
        // If the connection had been manually closed
        if (this.isClosed) throw new ConnectionClosedError();
        // assert it's not a blob
        if (typeof result != 'string') throw new ProtocolError("The server didn't send an id");
        if (this.id != Protocol.NO_KEY) { // If we already had a handshake
            // assert the reply is resume
            if (result != Protocol.RESUME_COMMAND) throw new ProtocolError("The server didn't send a resume command");
            this.resuming.emit(); // Announce that we'd resumed
        } else this.id = result; // If we didn't, 
        this.conn.message.pipeRaw(this.message);
        this.ready.resolve(this);
    }

    private async closeHandler(ev: Net.CloseEvent) {
        // Don't do anything if it was intentional
        if (this.isClosed) return;
        if (ev.message.code == Protocol.messages.rejectedTakeover.code) {
            await new Promise(res => setTimeout(res, 500));
            // Wait half a second, we don't want to overload the server with connection requests.
        } else if (ev.message.code >= 0) {
            // Positive codes indicate outside websocket-space messages
            
            this.isClosed = true;
            this.closed.resolve(ev);
            return;
        }
        // If we already had a session, announce this
        if (this.id != Protocol.NO_KEY) this.brokenPipe.emit(ev); 
        try {
            await this.setupConnection(); // Try resuming the session
        } catch (e) {
            this.close(PROTOCOL_MESSAGE);
        }
    }
}