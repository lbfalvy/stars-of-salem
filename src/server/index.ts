import { TextDecoder, TextEncoder } from "util";
import { createHash, randomBytes } from "crypto";
import { Server as WsServer } from "ws";
import * as  WsWrapper from './WsWrapper';
import * as Interfaces from "../shared/connection/Interfaces";
import * as Multiplexer from "../shared/connection/multiplexer";
import { getUid, setHashFunc, setSeed } from "../shared/uids";
import { bufferToArrayBuffer } from "../shared/arrayBuffer";
import * as Sessions from "../shared/connection/sessions";

function main() {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');
    setSeed(randomBytes(4).readInt32BE());
    setHashFunc(input => createHash('sha256').update(input).digest('base64'));
    const wss = new WsServer({ port: 3000 });
    const wrapper = new WsWrapper.Server(wss, 1000); // Ping every second
    const sessions = new Sessions.Server(wrapper, {
        sessionFactory: conn => new Sessions.Session(conn, {
            takeover: true,
            timeout: 10_000, // Drop session after 10s of abscence.
        }),
        getKey: getUid
    });
    sessions.connection.on(async (conn: Interfaces.Connection) => {
        console.log('connection ready');
        const mux = new Multiplexer.Host.Host(conn, {
            channelFactory: (conn, id) => new Multiplexer.Channel.Channel(conn, id, {
                encode: (data: string) => bufferToArrayBuffer(encoder.encode(data)),
                decode: (source: ArrayBuffer, offset?: number, length?: number) => {
                    return decoder.decode(new Uint8Array(source, offset, length));
                }
            })
        });
        const _commands = await mux.createChannel();
        const _voice = await mux.createChannel();
        
    });
}

main();