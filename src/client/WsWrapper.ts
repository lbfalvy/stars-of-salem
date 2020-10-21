import * as Interfaces from '../shared/connection/Interfaces';
import { TypedEvent } from '../shared/TypedEvent';

export class WsWrapper implements Interfaces.Connection {
    private ws:WebSocket;
    public message = new TypedEvent<Interfaces.MessageEvent>();
    public closed = new TypedEvent<Interfaces.CloseEvent>();
    public isClosed:boolean;

    public constructor( ws:WebSocket ) {
        this.ws = ws;
        this.isClosed = ws.readyState == WebSocket.CLOSED || ws.readyState == WebSocket.CLOSING;
        ws.binaryType = "arraybuffer";
        ws.onmessage = ev => {
            // Will always be true, this is just to please typescript
            if ( typeof ev.data == 'string' || ev.data instanceof ArrayBuffer ) {
                this.message.emit({ data: ev.data });
            }
        };
        ws.onclose = ev => {
            if ( this.isClosed ) {
                return;
            }
            this.isClosed = true;
            this.closed.emit({
                message: { code: ev.code, reason: ev.reason },
                local: false
            });
        };
    }

    public async send( msg:Interfaces.Data ):Promise<void> {
        if ( this.isClosed ) {
            throw new Interfaces.ConnectionClosedError();
        }
        this.ws.send(msg);
        return; 
        // TODO: pray it arrives because the browser WS api has no callback
    }

    public async close( msg:Interfaces.CloseMessage ):Promise<void> {
        if ( this.isClosed ) {
            throw new Interfaces.ConnectionClosedError();
        }
        this.isClosed = true;
        this.ws.close( msg.code, msg.reason );
        this.closed.emit({ message: msg, local: true });
        return;
    }

    public terminate():void {
        this.isClosed = true;
        this.ws.close();
        this.closed.emit({ message: Interfaces.TERMINATED_MESSAGE, local: true });
    }
}