import { exposeResolve, TypedEvent } from '../../TypedEvent';
import * as Interfaces from '../Interfaces';
import * as Protocol from './Protocol';

export class Client implements Interfaces.Connection {
    private readonly connFactory: () => Promise<Interfaces.Connection>;
    private conn: Interfaces.Connection | undefined;
    private id: Protocol.Key = Protocol.NO_KEY;
    public readonly message = new TypedEvent<Interfaces.Data>();
    public readonly ready = exposeResolve<this>();
    public readonly closed = exposeResolve<Interfaces.CloseEvent>();
    public readonly brokenPipe = new TypedEvent<Interfaces.CloseEvent>();
    public readonly resuming = new TypedEvent<void>();
    public isClosed = false;
    public isReady = false; // Whether we currently have a connection

    public constructor(conn_factory: () => Promise<Interfaces.Connection>) {
        this.connFactory = conn_factory;
        this.ready.then(() => this.isReady = true);
        this.brokenPipe.on(() => this.isReady = false);
        this.resuming.on(() => this.isReady = true);
        this.closed.then(() => this.isReady = false);
        this.setupConnection();
    }

    public async send(msg: Interfaces.Data): Promise<void> {
        if (this.isClosed) {
            throw new Interfaces.ConnectionClosedError();
        }
        if (this.isReady) {
            await this.conn?.send(msg);
            return;
        }
        await Promise.race([
            this.resuming.next,
            this.closed
        ]);
        if (!this.conn) {
            throw new Interfaces.ConnectionClosedError();
        }
        await this.conn.send(msg);
    }

    public async close(msg: Interfaces.CloseMessage): Promise<void> {
        if (this.isClosed) {
            throw new Interfaces.ConnectionClosedError();
        }
        await this.conn?.close(msg);
        this.isClosed = true;
        this.closed.resolve({ message: msg, local: true });
    }

    public terminate():void {
        this.isClosed = true;
        this.conn?.close(Interfaces.TERMINATED_MESSAGE);
        this.closed.resolve({ message: Interfaces.TERMINATED_MESSAGE, local: true });
        // This is a promise but we aren't waiting for it
    }

    private async setupConnection() {
        this.conn = await this.connFactory();
        // Set a handler that will retry if the connection breaks
        this.conn.closed.then(ev => this.closeHandler(ev));
        this.conn.send(this.id); // Send the key or lack thereof
        const result = await this.conn.message.next; // Wait for a reply
        // If the connection breaks while we're waiting, the rest of the function will never run.
        if (this.isClosed) { // If the connection had been manually closed
            throw new Interfaces.ConnectionClosedError();
        }
        if (typeof result != 'string') { // assert it's not a blob
            throw new Interfaces.ProtocolError("The server didn't send an id");
        }
        if (this.id != Protocol.NO_KEY) { // If we already had a handshake
            if (result != Protocol.RESUME_COMMAND) { // assert the reply is resume
                throw new Interfaces.ProtocolError("The server didn't send a resume command");
            }
            this.resuming.emit(); // Announce that we'd resumed
        } else {
            this.id = result; // If we didn't, 
        }
        this.conn.message.pipeRaw(this.message);
        this.ready.resolve(this);
    }

    private async closeHandler(ev: Interfaces.CloseEvent) {
        if (this.isClosed) { // Don't do anything if it was intentional
            return;
        }
        if (ev.message.code == Protocol.messages.rejectedTakeover.code) {
            await new Promise(res => setTimeout(res, 500));
            // Wait half a second, we don't want to overload the server with connection requests.
        } else if (ev.message.code >= 0) {
            // Positive codes indicate outside websocket-space messages
            
            this.isClosed = true;
            this.closed.resolve(ev);
            return;
        }
        if (this.id != Protocol.NO_KEY) { // If we already had a session
            this.brokenPipe.emit(ev); // announce this
        }
        try {
            await this.setupConnection(); // Try resuming the session
        } catch (e) {
            this.close(Interfaces.PROTOCOL_MESSAGE);
        }
    }
}