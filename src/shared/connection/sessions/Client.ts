import { TypedEvent } from '../../TypedEvent';
import * as Interfaces from '../Interfaces';
import * as Protocol from './Protocol';

export class Client implements Interfaces.Connection {
    private conn_factory: () => Promise<Interfaces.Connection>;
    private conn: Interfaces.Connection|undefined;
    private id: Protocol.Key = Protocol.NO_KEY;
    private call_when_ready: (() => unknown) | undefined;
    public message = new TypedEvent<Interfaces.MessageEvent>();
    public ready = new Promise(res => this.call_when_ready = res);
    public closed = new TypedEvent<Interfaces.CloseEvent>(); // never called
    public broken_pipe = new TypedEvent<Interfaces.CloseEvent>();
    public resuming = new TypedEvent<void>();
    public isClosed = false;
    public isReady = false;

    public constructor(conn_factory: () => Promise<Interfaces.Connection>) {
        this.conn_factory = conn_factory;
        this.ready.then(() => this.isReady = true);
        this.broken_pipe.on(() => this.isReady = false);
        this.resuming.on(() => this.isReady = true);
        this.setup_connection();
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
            this.resuming.wait(),
            this.closed.wait()
        ]);
        if (this.closed) {
            throw new Interfaces.ConnectionClosedError();
        }
        await this.conn?.send(msg);
    }

    public async close(msg: Interfaces.CloseMessage): Promise<void> {
        if (this.isClosed) {
            throw new Interfaces.ConnectionClosedError();
        }
        this.isClosed = true;
        this.conn?.close(msg);
        this.closed.emit({ message: msg, local: true });
    }

    public terminate():void {
        this.isClosed = true;
        this.conn?.terminate();
    }

    private async setup_connection() {
        this.conn = await this.conn_factory();
        // Set a handler that will retry if the connection breaks
        this.conn.closed.once(ev => this.close_handler(ev));

        this.conn.send(this.id); // Send the key or lack thereof
        const result = await this.conn.message.wait(); // Wait for a reply
        // If the connection breaks while we're waiting, the rest of the function will never run.
        if (this.isClosed) { // If the connection had been manually closed
            throw new Interfaces.ConnectionClosedError();
        }
        if (typeof result.data != 'string') { // assert it's not a blob
            throw new Interfaces.ProtocolError("The server didn't send an id");
        }
        if (this.id != Protocol.NO_KEY) { // If we already had a handshake
            if (result.data != Protocol.RESUME_COMMAND) { // assert the reply is resume
                throw new Interfaces.ProtocolError("The server didn't send a resume command");
            }
            this.resuming.emit(); // Announce that we'd resumed
        } else {
            this.id = result.data; // If we didn't, 
        }
        this.conn.message.pipe_raw(this.message);

        this.call_when_ready?.call(this);
    }

    private async close_handler(ev: Interfaces.CloseEvent) {
        if (this.isClosed) { // Don't do anything if it was intentional
            return;
        }
        if (ev.message.code == Protocol.messages.invalidSession.code) {
            // If the server forgot our session
            this.closed.emit(ev); // Close this
            return;
        }
        if (this.id != Protocol.NO_KEY) { // If we already had a session
            this.broken_pipe.emit(ev); // announce this
        }
        try {
            await this.setup_connection(); // Try resuming the session
        } catch (e) {
            this.close(Interfaces.ProtocolMessage);
        }
    }
}