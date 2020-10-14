import WebSocket from "ws";
import { copy_arraybuffer } from "../helpers/arrayBuffer";
import { TypedEvent } from "../helpers/TypedEvent";
import { Interfaces } from "./Interfaces";

function buffer_array_to_array_buffer( buf:Buffer[] ):ArrayBuffer {
    var total_length = buf.reduce( (total, next) => total + next.byteLength, 0 );
    var result = new ArrayBuffer(total_length);
    buf.reduce((offset, next) => {
        copy_arraybuffer(next.buffer, next.byteOffset, next.byteLength, result, offset);
        return offset+next.byteLength;
    }, 0);
    return result;
}

/**
 * A wrapper on regular websockets that implements a typescript-friendly interface.
 */
export namespace WsWrapper {
    export class Connection implements Interfaces.Connection {
        private ws:WebSocket;
        public readonly message = new TypedEvent<Interfaces.MessageEvent>();
        public readonly closed = new TypedEvent<Interfaces.CloseEvent>();
        public readonly pinged = new TypedEvent<Buffer>();
        public readonly ponged = new TypedEvent<Buffer>();
        public isClosed:boolean = false;

        public constructor(ws:WebSocket) {
            this.ws = ws;
            this.isClosed = ws.readyState == WebSocket.CLOSED || ws.readyState == WebSocket.CLOSING;
            this.ws.onmessage = ev => {
                var data:ArrayBuffer|string;
                if (ev.data instanceof Array) {
                    data = buffer_array_to_array_buffer(ev.data);
                }
                else if (ev.data instanceof Buffer) {
                    if (ev.data.byteLength == ev.data.buffer.byteLength) {
                        data = ev.data.buffer
                    } else {
                        data = new ArrayBuffer( ev.data.byteLength );
                        copy_arraybuffer( ev.data.buffer, ev.data.byteOffset, ev.data.byteLength, data, 0);
                    }
                }
                else data = ev.data;
                this.message.emit({ data })
            }
            this.ws.onclose = ev => {
                if (this.isClosed) return;
                this.isClosed = true;
                this.closed.emit({
                    message: ev,
                    local: false
                });
            }
            this.ws.on('ping', data => this.pinged.emit(data));
            this.ws.on('pong', data => this.ponged.emit(data));
        }

        public send( message:any ):Promise<void> {
            if (this.closed) throw new Interfaces.ConnectionClosedError();
            return new Promise(( res, rej ) => {
                // send has a callback to show that the message was sent.
                this.ws.send( message, err => err ? rej(err) : res() );
            });
        }

        public close( message:Interfaces.CloseMessage ):Promise<void> {
            if (this.isClosed) throw new Interfaces.ConnectionClosedError();
            this.isClosed = true;
            this.ws.close( message.code, message.reason );
            this.closed.emit({ message, local:true });
            return Promise.resolve();
        }

        public terminate() {
            this.isClosed = true;
            this.ws.terminate();
            this.closed.emit({ message: { code: 0, reason: 'terminated' }, local:true })
        }
        public ping( data:Buffer ) {
            if (this.isClosed) throw new Interfaces.ConnectionClosedError();
            this.ws.ping(data);
        }
    }

    export class Server implements Interfaces.ConnectionTarget {
        public readonly connection = new TypedEvent<Interfaces.Connection>();
        public readonly clients = new Set<Interfaces.Connection>();
        private readonly wss:WebSocket.Server;

        constructor( wss:WebSocket.Server ) {
            this.wss = wss;
            wss.on("connection", ws => {
                const conn = new Connection(ws);
                this.clients.add(conn);
                conn.closed.once(ev => this.clients.delete(conn));
                this.connection.emit(conn);
            });
        }
    }
}