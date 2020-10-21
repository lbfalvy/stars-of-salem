import { compose } from '../../arrayBuffer';
import { TypedEvent } from '../../TypedEvent';
import * as Interfaces from '../Interfaces';
import * as Protocol from './Protocol';

export type ChannelFactory = (conn: Interfaces.Connection, id: number) => Interfaces.Connection;

export interface Dependencies {
    channel_factory: ChannelFactory,
}

export class Host implements Interfaces.ConnectionTarget, Interfaces.Connection {
    private readonly conn: Interfaces.Connection
    private readonly injected: Dependencies;
    private readonly channels = new Map<number, Interfaces.Connection>();
    private next_id = 0;
    public readonly connection = new TypedEvent<Interfaces.Connection>();
    public readonly message = new TypedEvent<Interfaces.MessageEvent>();
    public readonly closed: TypedEvent<Interfaces.CloseEvent>;

    public get isClosed(): boolean {
        return this.conn.isClosed;
    }
    public get clients(): Set<Interfaces.Connection> {
        return new Set(this.channels.values());
    }

    public constructor(conn: Interfaces.Connection, injected: Dependencies) {
        this.injected = injected;
        this.conn = conn;
        this.send = conn.send;
        this.close = conn.close;
        this.terminate = conn.terminate;
        this.closed = conn.closed;
        conn.message.on(ev => {
            // If it's a string, it's definitely in default
            if (typeof ev.data == 'string') {
                return this.message.emit(ev);
            }
            const data = new DataView(ev.data);
            // If it doesn't start with the protocol word, it also belongs in default.
            if (data.getUint16(0) != Protocol.MAGIC_WORD) {
                return this.message.emit(ev);
            }
            // We only need to handle it here if it's addressed to us and it's a create packet
            if (data.getUint16(2) == Protocol.CONTROL_PACKET &&
                data.getUint16(4) == Protocol.CREATE_CHANNEL) {
                let body: Array<number>;
                try {
                    this.connection.emit(this.receive_channel(data.getUint16(6)));
                    body = [Protocol.APPROVED, data.getUint16(6)];
                } catch (e) {
                    body = [Protocol.REJECTED, data.getUint16(6)];
                }
                this.conn.send(compose(Protocol.CONTROL_HEADER.concat(body)));
            }
        });
    }

    public create_channel(id?: number): Promise<Interfaces.Connection> {
        let id_:number;
        try { // Ensure that we don't throw by accident.
            // Ensure ID is a valid id number (at least for us)
            if (!id) {
                id = this.get_next_id();
            }
            // convince typescript that the local doesn't get unset when callbacks run.
            id_ = id; 
            if (0xfffe < id || id < 0) { // Must be a word and not 0xfff (gateway address)
                throw new RangeError(
                    'Channel ids can only be uint16 values below 0xffff'
                );
            }
            this.assert_unique_id(id);
            // Tell the other half about the new channel
            this.conn.send(compose(Protocol.CONTROL_HEADER.concat(Protocol.CREATE_CHANNEL, id)));
        } catch(ex) {
            return Promise.reject(ex);
        }
        return new Promise((res, rej) => {
            // Set up a temporary message handler
            const disp = this.conn.message.on(ev => {
                // discard all strings
                if (typeof ev.data == 'string') {
                    return;
                }
                const view = new DataView(ev.data);
                // Only proceed if it's a control packet addressed to us
                if (!this.is_control_packet(view) || view.getUint16(6) != id_) {
                    return;
                }
                // Get rid of the handler
                disp.dispose();
                if (view.getUint16(4) == Protocol.REJECTED) {
                    rej(new RangeError('Channel id already in use')); // Async throw
                } else {
                    const chan = this.injected.channel_factory(this.conn, id_);
                    this.channels.set(id_, chan);
                    chan.closed.on(() => this.channels.delete(id_));
                    res(chan); // async resolve
                }
            });
        });
    }

    public send: (msg: Interfaces.Data) => Promise<void> | never;
    public close: (msg: Interfaces.CloseMessage) => Promise<void> | never;
    public terminate: () => void;

    private get_next_id() {
        const last = this.next_id;
        do {
            this.next_id = this.next_id + 1 % 0xfffe;
            if (!this.channels.has(this.next_id)) {
                const final = this.next_id;
                this.next_id = this.next_id + 1 % 0xfffe;
                return final;
            }
        } while (this.next_id != last);
        throw new RangeError('Out of session slots.');
        // A websocket couldn't handle more than 65534 different channels
    }

    private receive_channel(id: number): Interfaces.Connection {
        this.assert_unique_id(id);
        const chan = this.injected.channel_factory(this.conn, id);
        this.channels.set(id, chan);
        chan.closed.once(() => this.channels.delete(id));
        return chan;
    }

    private assert_unique_id(id: number) {
        if (this.channels.has(id)) {
            throw new RangeError('Channel id already in use');
        }
    }

    private is_control_packet(view: DataView) {
        return (view.getUint16(0) == Protocol.MAGIC_WORD &&
            view.getUint16(2) == Protocol.CONTROL_PACKET);
    }
}