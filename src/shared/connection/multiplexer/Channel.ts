import { copyArrayBuffer } from '../../arrayBuffer';
import { exposeResolve, TypedEvent } from '../../TypedEvent';
import * as Interfaces from '../Interfaces';
import * as Protocol from './Protocol';

export interface ChannelDependencies { // TODO figure out why the interface is different and fix it
    decode: (source: ArrayBuffer, offset?: number, length?: number) => string,
    encode: (data: string) => ArrayBuffer
}
/*
Protocol:
                        | type ID | message data     |
 | magic word | id      | EOT     | code    | reason |
 | 2 bytes    | 2 bytes | 1 byte  | 2 bytes | ...    |
*/
export class Channel implements Interfaces.Connection {
    private readonly conn: Interfaces.Connection;
    public readonly id: number;
    private readonly injected: ChannelDependencies;
    public readonly closed = exposeResolve<Interfaces.CloseEvent>();
    public readonly message = new TypedEvent<Interfaces.Data>();
    public isClosed = false;

    public constructor(conn: Interfaces.Connection, id: number, deps: ChannelDependencies) {
        this.injected = deps;
        this.conn = conn;
        this.id = id;
        const message_handle = conn.message.on(msg => {
            if (typeof msg == 'string') {
                return;
            }
            const view = new DataView(msg);
            if (!Protocol.isClientMessage(view, this.id)) {
                return;
            }
            if (Protocol.isClose(view)) { // If it's closed
                let message:Interfaces.CloseMessage;
                if (Protocol.hasContent(view)) {
                    message = {
                        code: Protocol.getCloseCode(view),
                        reason: deps.decode(msg, Protocol.CLOSE_MSG_OFFSET)
                    };
                } else {
                    message = Interfaces.TERMINATED_MESSAGE;
                }
                this.closeInterface({ message, local: false });
                return;
            }
            let payload: string | ArrayBuffer;
            if (Protocol.isTypeString(view)) {
                payload = deps.decode(msg, Protocol.HEAD_LEN);
            } else {
                payload = Protocol.getBinaryData(msg);
            }
            this.message.emit(payload); // Emit the remaining data
        });
        conn.closed.then(() => {
            if (this.isClosed) {
                return;
            }
            message_handle.dispose();
        });
    }

    public async send(msg: Interfaces.Data): Promise<void> {
        if (msg instanceof ArrayBuffer) { // If it's binary, just send it
            this.conn.send(Protocol.writeBinaryMsg(this.id, msg));
            return;
        }
        // Otherwise it's a string
        const blob = this.injected.encode(msg);
        const frame = new ArrayBuffer(blob.byteLength + Protocol.HEAD_LEN);
        const writer = new DataView(frame);
        Protocol.writeStringHeader(this.id, writer);
        copyArrayBuffer(blob, 0, blob.byteLength, frame, Protocol.HEAD_LEN);
        this.conn.send(frame);
    }

    public async close(msg: Interfaces.CloseMessage): Promise<void> {
        const reason = this.injected.encode(msg.reason);
        await this.conn.send(Protocol.buildCloseMsg(this.id, msg.code, reason));
        this.closeInterface({ message: msg, local: true });
    }

    public terminate(): void {
        // Notice that we aren't waiting.
        this.conn.send(Protocol.buildEmptyCloseMsg(this.id));
        this.closeInterface({ message: Interfaces.TERMINATED_MESSAGE, local: true });
    }

    /** Update this and fire closed event. */
    private closeInterface(ev: Interfaces.CloseEvent) {
        this.isClosed = true;
        this.closed.resolve(ev);
        return;
    }
}