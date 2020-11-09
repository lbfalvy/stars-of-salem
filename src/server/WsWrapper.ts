import WebSocket from "ws";
import { bufferToArrayBuffer, bufferArrayToArrayBuffer } from "../shared/arrayBuffer";
import { exposeResolve, TypedEvent } from "../shared/TypedEvent";
import * as Interfaces from "../shared/connection/Interfaces";

/**
 * A wrapper on regular websockets that implements a typescript-friendly interface.
 */

export class Connection implements Interfaces.Connection {
    private ws: WebSocket;
    public readonly message = new TypedEvent<Interfaces.Data>();
    public readonly closed = exposeResolve<Interfaces.CloseEvent>();
    private _isClosed = false;
    public get isClosed():boolean {
        return this._isClosed;
    }
    public set isClosed(value:boolean) {
        this._isClosed = value;
    }

    public constructor(ws: WebSocket, timeout: number) {
        this.ws = ws;
        this.isClosed = (ws.readyState == WebSocket.CLOSED || ws.readyState == WebSocket.CLOSING);
        this.ws.onmessage = ev => { // Convert the message and emit an event
            let data: ArrayBuffer | string;
            if (ev.data instanceof Array) { // handle Buffer[]
                data = bufferArrayToArrayBuffer(ev.data);
            } else if (ev.data instanceof Buffer) { // handle Buffer
                data = bufferToArrayBuffer(ev.data);
            } else { // string|ArrayBuffer is fine as is
                data = ev.data;
            }
            this.message.emit(data);
        };
        this.ws.onclose = ev => {
            clearInterval(check); // end ping

            if (this.isClosed) {
                return; // don't emit twice
            }
            this.isClosed = true;

            this.closed.resolve({
                message: { code: ev.code-3000, reason: ev.reason },
                local: false
            });
        };
        // Ping mechanism
        let isAlive = true;
        const check = setInterval(() => {
            if (!isAlive) {
                this.terminate();
                this.closed.resolve({
                    message: { code: -1, reason: 'timeout' }, local: false
                });
                return;
            }
            isAlive = false;
            ws.ping();
        }, timeout);
        ws.on('pong', () => isAlive = true);
    }

    public send(message: Interfaces.Data): Promise<void> {
        return new Promise((res, rej) => {
            if (this.isClosed) {
                return rej(new Interfaces.ConnectionClosedError());
            }
            // send has a callback to show that the message was sent.
            this.ws.send(message, err => err ? rej(err) : res());
        });
    }

    public async close(message: Interfaces.CloseMessage): Promise<void> {
        if (this.isClosed) {
            throw new Interfaces.ConnectionClosedError();
        }
        this.isClosed = true;
        this.ws.close(3000+message.code, message.reason);
        this.closed.resolve({ message, local: true });
        return;
    }

    public terminate(): void {
        this.isClosed = true;
        this.ws.terminate();
        this.closed.resolve({ message: Interfaces.TERMINATED_MESSAGE, local: true });             
    }
}

export class Server implements Interfaces.ConnectionTarget {
    public readonly connection = new TypedEvent<Interfaces.Connection>();
    public readonly clients = new Set<Interfaces.Connection>();
    private readonly wss: WebSocket.Server;

    public constructor(wss: WebSocket.Server, timeout: number) {
        this.wss = wss;
        wss.on("connection", ws => {
            const conn = new Connection(ws, timeout);
            this.clients.add(conn);
            conn.closed.then(() => this.clients.delete(conn));
            this.connection.emit(conn);
        });
    }
}