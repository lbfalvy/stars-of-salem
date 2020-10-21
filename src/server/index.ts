import { TextDecoder, TextEncoder } from "util";
import { createHash, randomBytes } from "crypto";
import { Server as WsServer } from "ws";
import * as  WsWrapper from './WsWrapper';
import * as Interfaces from "../shared/connection/Interfaces";
import * as Multiplexer from "../shared/connection/multiplexer";
import { get_uid, set_hash_func, set_seed } from "../shared/uids";
import { buffer_to_arraybuffer } from "../shared/arrayBuffer";
import * as Sessions from "../shared/connection/sessions";

function main() {

    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');
    set_seed(randomBytes(4).readInt32BE());
    set_hash_func(input => createHash('sha256').update(input).digest('base64'));
    const wss = new WsServer({ port: 3000 });
    const wrapper = new WsWrapper.Server(wss, 1000); // Ping every second
    const sessions = new Sessions.Server(wrapper, {
        session_factory: conn => new Sessions.Session(conn, {
            takeover: true,
            timeout: 10_000, // Drop session after 10s of abscence.
        }),
        get_key: get_uid
    });
    sessions.connection.on(async (conn: Interfaces.Connection) => {
        console.log('connection ready');
        /*const mux = new Multiplexer.Host.Host(conn, {
            channel_factory: (conn, id) => new Multiplexer.Channel.Channel(conn, id, {
                encode: (data: string) => buffer_to_arraybuffer(encoder.encode(data)),
                decode: (source: ArrayBuffer, offset?: number, length?: number) => {
                    return decoder.decode(new Uint8Array(source, offset, length));
                }
            })
        });
        const c1 = await mux.create_channel();
        const c2 = await mux.create_channel();
        c1.message.on(ev => console.log('c1: ', ev.data));
        c2.message.on(ev => console.log('c2: ', ev.data));*/
        
    });
}

main();