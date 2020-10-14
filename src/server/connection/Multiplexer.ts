import { encoder, decoder, compose, copy_arraybuffer } from "../helpers/arrayBuffer";
import { TypedEvent } from "../helpers/TypedEvent";
import { Interfaces } from "./Interfaces";

export class Multiplexer implements Interfaces.ConnectionTarget, Interfaces.Connection {
    private conn: Interfaces.Connection
    private channel_factory: Multiplexer.ChannelFactory;
    private channels = new Map<number, Interfaces.Connection>();
    private next_id = 1;
    public connection = new TypedEvent<Interfaces.Connection>();
    public message = new TypedEvent<Interfaces.MessageEvent>();
    public closed: TypedEvent<Interfaces.CloseEvent>;
    public pinged: TypedEvent<Buffer>;
    public ponged: TypedEvent<Buffer>;

    public get isClosed() { return this.conn.isClosed; }
    public get clients() {
        return new Set(this.channels.values());
    }

    public constructor(conn: Interfaces.Connection, get_channel: Multiplexer.ChannelFactory) {
        this.channel_factory = get_channel;
        this.conn = conn;
        this.ping = conn.ping;
        this.send = conn.send;
        this.close = conn.close;
        this.terminate = conn.terminate;
        this.closed = conn.closed;
        this.pinged = conn.pinged;
        this.ponged = conn.ponged;
        conn.message.on(ev => {
            // If it's a string, it's definitely in default
            if (typeof ev.data == 'string') return this.message.emit(ev);
            let data = new DataView(ev.data);
            // If it doesn't start with the protocol word, it also belongs in default.
            if (data.getUint16(0) != Multiplexer.MAGIC_WORD) return this.message.emit(ev);
            // We only need to handle it here if it's addressed to us and it's a create packet
            if (data.getUint16(2) == Multiplexer.CONTROL_PACKET &&
                data.getUint16(4) == Multiplexer.CREATE_CHANNEL) {
                var body: number[];
                try {
                    this.connection.emit(this.receive_channel(data.getUint16(6)));
                    body = [Multiplexer.APPROVED, data.getUint16(6)];
                } catch (e) {
                    body = [Multiplexer.REJECTED, data.getUint16(6)];
                }
                this.conn.send(compose(Multiplexer.CONTROL_HEADER.concat(body)));
            }
        });
    }

    public create_channel(id: number | undefined): Promise<Interfaces.Connection> {
        // Ensure ID is a valid id number (at least for us)
        if (!id) id = this.get_next_id();
        if (id > 0xfffe || id < 0) { // Must be a word
            throw new RangeError('Channel ids can only be uint16 values below 0xffff');
        }
        var id_ = id; // convince typescript that the local doesn't get unset when callbacks run.
        if (this.channels.has(id)) {
            throw new RangeError('Channel id already in use');
        }
        // Tell the other half about the new channel
        this.conn.send(compose(Multiplexer.CONTROL_HEADER.concat(Multiplexer.CREATE_CHANNEL, id)));
        return new Promise((res, rej) => {
            // Set up a temporary message handler
            var disp = this.conn.message.on(ev => {
                if (typeof ev.data == 'string') return; // discard all strings
                var view = new DataView(ev.data);
                // Only proceed if it's a control packet addressed to us
                if (!this.is_control_packet(view) || view.getUint16(6) != id_) return;
                // Get rid of the handler
                disp.dispose();
                if (view.getUint16(4) == Multiplexer.REJECTED) {
                    rej(new RangeError('Channel id already in use')); // Async throw
                } else {
                    var chan = this.channel_factory(this.conn, id_);
                    this.channels.set(id_, chan);
                    chan.closed.on(() => this.channels.delete(id_));
                    res(chan); // async resolve
                }
            });
        });
    }

    public ping: (data: Buffer) => void | never
    public send: (msg: Interfaces.Data) => Promise<void> | never;
    public close: (msg: Interfaces.CloseMessage) => Promise<void> | never;
    public terminate: () => void;

    private get_next_id() {
        var last = this.next_id;
        do {
            this.next_id = this.next_id + 1 % 0xfffe;
            if (!this.channels.has(this.next_id)) {
                let final = this.next_id;
                this.next_id = this.next_id + 1 % 0xfffe;
                return final;
            }
        } while (this.next_id != last);
        throw new RangeError('Out of session slots.');
        // A websocket couldn't handle more than 65534 different channels
    }

    private receive_channel(id: number): Interfaces.Connection {
        this.assert_unique_id(id);
        var chan = this.channel_factory(this.conn, id);
        this.channels.set(id, chan);
        chan.closed.once(() => this.channels.delete(id));
        return chan;
    }

    private assert_unique_id(id: number) {
        if (this.channels.has(id)) throw new RangeError('Channel id already in use');
    }

    private is_control_packet(view: DataView) {
        return (view.getUint16(0) == Multiplexer.MAGIC_WORD &&
            view.getUint16(2) == Multiplexer.CONTROL_PACKET);
    }
}

export namespace Multiplexer {
    export const MAGIC_WORD = 0xBEEF;

    export const CONTROL_PACKET = 0xffff;
    export const CREATE_CHANNEL = 0;
    export const REJECTED = 1;
    export const APPROVED = 2;
    export const CONTENT_STRING = 0;
    export const CONTENT_BINARY = 1;
    export const END_OF_TRANSMISSION = 2;
    export const CONTROL_HEADER = [Multiplexer.MAGIC_WORD, Multiplexer.CONTROL_PACKET];

    export type ChannelFactory = (conn: Interfaces.Connection, id: number) => Interfaces.Connection;

    export class Channel implements Interfaces.Connection {
        private conn: Interfaces.Connection;
        private id: number;
        public closed = new TypedEvent<Interfaces.CloseEvent>();
        public message = new TypedEvent<Interfaces.MessageEvent>();
        public pinged: TypedEvent<Buffer>;
        public ponged: TypedEvent<Buffer>;
        public isClosed = false;

        constructor(conn: Interfaces.Connection, id: number) {
            this.conn = conn;
            this.id = id;
            this.pinged = conn.pinged;
            this.ponged = conn.ponged;
            this.ping = conn.ping;
            let message_handle = conn.message.on(ev => {
                if (typeof ev.data == 'string') return;
                let view = new DataView(ev.data);
                if (!this.is_message(view)) return;
                if (view.getUint16(4) == END_OF_TRANSMISSION) { // If it's closed
                    if (view.byteLength > 8) {
                        var message = {
                            code: view.getUint16(6),
                            reason: decoder.decode(new Uint8Array(ev.data, 8))
                        }
                        this.close_object({ message, local: false });
                    } else {
                        this.close_object({ message: Interfaces.TERMINATED_MESSAGE, local: false });
                    }
                    return;
                }
                let payload: string | ArrayBuffer;
                if (view.getUint8(4) == CONTENT_STRING) {
                    payload = decoder.decode(new Uint8Array(ev.data, 5));
                } else payload = ev.data.slice(5);
                this.message.emit({ data: payload }); // Emit the remaining data
            });
            conn.closed.on(() => {
                if (this.isClosed) return;
                message_handle.dispose();
            })
        }

        public async send(msg: Interfaces.Data) {
            // Determine type code and convert msg to ArrayBuffer
            var typemark: number;
            if (typeof msg == 'string') {
                typemark = CONTENT_STRING;
                msg = encoder.encode(msg);
            } else typemark = CONTENT_BINARY;
            // Construct message
            var blob = new ArrayBuffer(msg.byteLength + 5);
            var writer = new DataView(blob);
            this.write_head(writer);
            writer.setUint8(4, typemark);
            copy_arraybuffer(msg, 0, msg.byteLength, blob, 5);
            // Send message
            return this.conn.send(blob);
        }

        public async close(msg: Interfaces.CloseMessage) {
            // Construct closing message
            var close_message = new ArrayBuffer(8 + msg.reason.length);
            var msgWriter = new DataView(close_message);
            this.write_head(msgWriter);
            msgWriter.setUint16(4, END_OF_TRANSMISSION);
            msgWriter.setUint16(6, msg.code);
            var messageArr = new Uint8Array(close_message, 8);
            encoder.encodeInto(msg.reason, messageArr);
            // Send closing message
            await this.conn.send(close_message);
            this.close_object({ message: msg, local: true });
        }

        public terminate() {
            // Closing message without body. Notice that we aren't waiting.
            this.conn.send(compose(this.head.concat(END_OF_TRANSMISSION)));
            this.close_object({ message: Interfaces.TERMINATED_MESSAGE, local: true });
        }

        public ping: (data: Buffer) => void; // inherited from connection.

        /** Update this and fire closed event. */
        private close_object(ev: Interfaces.CloseEvent) {
            this.isClosed = true;
            this.pinged = new TypedEvent<Buffer>();
            this.ponged = new TypedEvent<Buffer>();
            this.send = this.ping = () => { throw new Interfaces.ConnectionClosedError(); }
            this.closed.emit(ev);
            return;
        }

        /** Checks the header and decides if this is a message for us. */
        private is_message(view: DataView) {
            return view.getUint16(0) == MAGIC_WORD && view.getUint16(2) == this.id;
        }

        /** Writes a header for this channel. */
        private write_head(view: DataView) {
            view.setUint16(0, MAGIC_WORD);
            view.setUint16(2, this.id);
        }

        /** Header for this channel (for use with compose()).*/
        private get head() { return [MAGIC_WORD, this.id]; }
    }
}