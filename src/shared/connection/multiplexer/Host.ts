import { TypedEvent } from '../../TypedEvent';
import * as Protocol from './Protocol';

export type ChannelFactory = (conn: Net.Connection, id: number) => Net.Connection;

export interface Dependencies {
    channelFactory: ChannelFactory,
}

export class Host implements Net.Multiplexer {
    private readonly conn: Net.Connection
    private readonly injected: Dependencies;
    private readonly channels = new Map<number, Net.Connection>();
    private nextId = 0;
    public readonly connection = new TypedEvent<Net.Connection>();
    public readonly message = new TypedEvent<Net.Data>();
    public readonly closed: Promise<Net.CloseEvent>;

    public get isClosed(): boolean {
        return this.conn.isClosed;
    }
    public get clients(): Set<Net.Connection> {
        return new Set(this.channels.values());
    }

    public constructor(conn: Net.Connection, injected: Dependencies) {
        this.injected = injected;
        this.conn = conn;
        this.closed = conn.closed;
        conn.message.on(msg => {
            // If it's a string, it's definitely in default
            if (typeof msg == 'string') return this.message.emit(msg);
            const data = new DataView(msg);
            // If it doesn't start with the protocol word, it also belongs in default.
            if (!Protocol.isRelevant(data)) return this.message.emit(msg);
            // We only need to handle it here if it's addressed to us and it's a create packet
            if (Protocol.isCreateChannel(data)) this.receiveChannel(data);
        });
    }

    public async createChannel(id = this.getNextId()): Promise<Net.Connection> {
        // Must be a word and not 0xfff (gateway address)
        if (0xfffe < id || id < 0) throw new RangeError('Channel ids can only be uint16 values below 0xffff');
        if (this.channels.has(id)) throw new RangeError('Channel id already in use');
        // Tell the other half about the new channel
        this.conn.send(Protocol.buildCreateChannel(id));
        // Discard messages until one is a channel reply
        let view: DataView;
        do {
            let msg: Net.Data;
            do msg = await this.conn.message.next; // Get a new message
            while (typeof msg == 'string'); // If it's string, repeat
            view = new DataView(msg); // interpret as ArrayBuffer
        } while (!Protocol.isChannelReplyFor(id, view)); // If it isn't a channel reply, repeat

        if (Protocol.isChannelReplyAccepted(view)) {
            const chan = this.injected.channelFactory(this.conn, id);
            this.channels.set(id, chan);
            chan.closed.then(() => this.channels.delete(id));
            return chan;
        } else throw new RangeError('Channel id already in use');
    }

    public send(msg: Net.Data): Promise<void> | never {
        return this.conn.send(msg);
    }
    public close(msg: Net.CloseMessage): Promise<void> | never {
        return this.conn.close(msg);
    }
    public terminate(): void {
        return this.conn.terminate();
    }

    private getNextId(): number {
        const last = this.nextId;
        do {
            this.nextId = this.nextId + 1 % 0xfffe;
            if (!this.channels.has(this.nextId)) {
                const final = this.nextId;
                this.nextId = this.nextId + 1 % 0xfffe;
                return final;
            }
        } while (this.nextId != last);
        throw new RangeError('Out of session slots.');
        // More than 65534 different channels
    }

    private receiveChannel(view: DataView): void {
        const id = Protocol.getCreateChannelId(view);
        if (this.channels.has(id)) {
            this.conn.send(Protocol.buildChannelReply(false, id));
            return;
        }
        const chan = this.injected.channelFactory(this.conn, id);
        this.channels.set(id, chan);
        chan.closed.then(() => this.channels.delete(id));
        this.conn.send(Protocol.buildChannelReply(true, id));
        this.connection.emit(chan);
    }
}