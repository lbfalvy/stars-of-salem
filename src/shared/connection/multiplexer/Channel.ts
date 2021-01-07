import { copyArrayBuffer } from '../../arrayBuffer';
import { exposeResolve, TypedEvent } from '../../TypedEvent';
import { TERMINATED_MESSAGE } from '..';
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
export class Channel implements Net.Connection {
    private readonly messageHandle: Disposable;
    public readonly closed = exposeResolve<Net.CloseEvent>();
    public readonly message = new TypedEvent<Net.Data>();
    public isClosed = false;

    public constructor(private readonly conn: Net.Connection,
                       public readonly id: number,
                       private readonly injected: ChannelDependencies) {
        this.messageHandle = conn.message.on(msg => {
            if (typeof msg == 'string') return;
            const view = new DataView(msg);
            if (!Protocol.isClientMessage(view, this.id)) return;
            if (Protocol.isClose(view)) { // If it's closed
                let message: Net.CloseMessage;
                if (Protocol.hasContent(view)) message = {
                    code: Protocol.getCloseCode(view),
                    reason: injected.decode(msg, Protocol.CLOSE_MSG_OFFSET)
                };
                else message = TERMINATED_MESSAGE;
                this.closeInterface({ message, local: false });
                return;
            }
            let payload: Net.Data;
            if (Protocol.isTypeString(view)) payload = injected.decode(msg, Protocol.HEAD_LEN);
            else payload = Protocol.getBinaryData(msg);
            this.message.emit(payload); // Emit the remaining data
        });
        conn.closed.then(ev => {
            if (this.isClosed) return;
            this.closeInterface(ev);
        });
    }

    public async send(msg: Net.Data, params?: Record<string, any>): Promise<void> {
        if (msg instanceof ArrayBuffer) { // If it's binary, just send it
            return await this.conn.send(Protocol.writeBinaryMsg(this.id, msg), params);
        }
        // Otherwise it's a string
        const blob = this.injected.encode(msg);
        const frame = new ArrayBuffer(blob.byteLength + Protocol.HEAD_LEN);
        const writer = new DataView(frame);
        Protocol.writeStringHeader(this.id, writer);
        copyArrayBuffer(blob, 0, blob.byteLength, frame, Protocol.HEAD_LEN);
        await this.conn.send(frame, params);
    }

    public async close(msg: Net.CloseMessage, params?: Record<string, any>): Promise<void> {
        const reason = this.injected.encode(msg.reason);
        await this.conn.send(Protocol.buildCloseMsg(this.id, msg.code, reason), params);
        this.closeInterface({ message: msg, local: true });
    }

    public terminate(): void {
        // Terminating is intended for unreliable state, so double-terminating a connection
        // technically isn't a problem.
        this.conn.send(Protocol.buildEmptyCloseMsg(this.id))
                 .catch(ex => console.info('Terminated an already closed connection', ex));
        this.closeInterface({ message: TERMINATED_MESSAGE, local: true });
    }

    /** Update this and fire closed event. */
    private closeInterface(ev: Net.CloseEvent) {
        this.messageHandle.dispose();
        this.isClosed = true;
        this.closed.resolve(ev);
        return;
    }
}