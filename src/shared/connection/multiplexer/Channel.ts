import { compose, copy_arraybuffer } from '../../arrayBuffer';
import { TypedEvent } from '../../TypedEvent';
import * as Interfaces from '../Interfaces';
import * as Protocol from './Protocol';

export interface ChannelDependencies { // TODO figure out why the interface is different and fix it
    decode: (source: ArrayBuffer, offset?: number, length?: number) => string,
    encode: (data: string) => ArrayBuffer
}

export class Channel implements Interfaces.Connection {
    private readonly conn: Interfaces.Connection;
    private readonly id: number;
    private readonly injected: ChannelDependencies;
    public readonly closed = new TypedEvent<Interfaces.CloseEvent>();
    public readonly message = new TypedEvent<Interfaces.MessageEvent>();
    public isClosed = false;

    public constructor(conn: Interfaces.Connection, id: number, deps: ChannelDependencies) {
        this.injected = deps;
        this.conn = conn;
        this.id = id;
        const message_handle = conn.message.on(ev => {
            if (typeof ev.data == 'string') {
                return;
            }
            const view = new DataView(ev.data);
            if (!this.is_message(view)) {
                return;
            }
            if (view.getUint16(4) == Protocol.END_OF_TRANSMISSION) { // If it's closed
                if (view.byteLength > 8) {
                    const message = {
                        code: view.getUint16(6),
                        reason: deps.decode(ev.data, 8)
                    };
                    this.close_object({ message, local: false });
                } else {
                    this.close_object({ message: Interfaces.TERMINATED_MESSAGE, local: false });
                }
                return;
            }
            let payload: string | ArrayBuffer;
            if (view.getUint8(4) == Protocol.CONTENT_STRING) {
                payload = deps.decode(ev.data, 5);
            } else {
                payload = ev.data.slice(5);
            }
            this.message.emit({ data: payload }); // Emit the remaining data
        });
        conn.closed.on(() => {
            if (this.isClosed) {
                return;
            }
            message_handle.dispose();
        });
    }

    public async send(msg: Interfaces.Data): Promise<void> {
        // Determine type code and convert msg to ArrayBuffer
        let typemark: number;
        if (typeof msg == 'string') {
            typemark = Protocol.CONTENT_STRING;
            msg = this.injected.encode(msg);
        } else {
            typemark = Protocol.CONTENT_BINARY;
        }
        // Construct message
        const blob = new ArrayBuffer(msg.byteLength + 5);
        const writer = new DataView(blob);
        this.write_head(writer);
        writer.setUint8(4, typemark);
        copy_arraybuffer(msg, 0, msg.byteLength, blob, 5);
        // Send message
        return this.conn.send(blob);
    }

    public async close(msg: Interfaces.CloseMessage): Promise<void> {
        // Construct closing message
        // - encode reason
        const reason = this.injected.encode(msg.reason);
        const close_message = new ArrayBuffer(8 + reason.byteLength);
        const msgWriter = new DataView(close_message);
        this.write_head(msgWriter);
        msgWriter.setUint16(4, Protocol.END_OF_TRANSMISSION);
        msgWriter.setUint16(6, msg.code);
        copy_arraybuffer(reason, 0, reason.byteLength, close_message, 8);
        // Send closing message
        await this.conn.send(close_message);
        this.close_object({ message: msg, local: true });
    }

    public terminate(): void {
        // Notice that we aren't waiting.
        this.conn.send(compose(this.head.concat(Protocol.END_OF_TRANSMISSION)));
        this.close_object({ message: Interfaces.TERMINATED_MESSAGE, local: true });
    }

    /** Update this and fire closed event. */
    private close_object(ev: Interfaces.CloseEvent) {
        this.isClosed = true;
        this.closed.emit(ev);
        return;
    }

    /** Checks the header and decides if this is a message for us. */
    private is_message(view: DataView) {
        return view.getUint16(0) == Protocol.MAGIC_WORD && view.getUint16(2) == this.id;
    }

    /** Writes a header for this channel. */
    private write_head(view: DataView) {
        view.setUint16(0, Protocol.MAGIC_WORD);
        view.setUint16(2, this.id);
    }

    /** Header for this channel (for use with compose()).*/
    private get head() {
        return [Protocol.MAGIC_WORD, this.id];
    }
}