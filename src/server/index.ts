import path from 'path';
import { TextDecoder, TextEncoder } from "util";
import { createHash, randomBytes } from "crypto";
import { Server as WsServer } from "ws";
import * as WsWrapper from './WsWrapper';
import * as Mux from "../shared/connection/multiplexer";
import { getUid, setHashFunc, setSeed } from "../shared/uids";
import { bufferToArrayBuffer } from "../shared/arrayBuffer";
import * as Sessions from "../shared/connection/sessions";
import config from './config';
import serveStatic from './StaticServer';
import { ChannelFactory } from '../shared/connection/multiplexer/Host';
import { Construct } from './Construct';
import loadPlugins from './plugins';
import AudioImpl from './Audio';
import PlayerImpl from './GameElements/Player';
import PositionImpl from './GameElements/Position';

// DI stuff
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const encode = (data: string) => bufferToArrayBuffer(encoder.encode(data));
const decode = (source: ArrayBuffer, offset?: number, length?: number) => {
    return decoder.decode(new Uint8Array(source, offset, length));
};
const chan_deps = { encode, decode };
const channelFactory: ChannelFactory = (conn, id) => new Mux.Channel.Channel(conn, id, chan_deps);
const mux_deps = { channelFactory };

// Initialize getUid
setSeed(randomBytes(4).readInt32BE());
setHashFunc(input => createHash('sha256').update(input).digest('base64'));

const construct = Construct.start() as Construct;
const context: Server.PluginContext = {
    audioFactory: (spaces) => {
        const audio = new AudioImpl();
        audio.enterSpaces(spaces);
        return audio;
    },
    playerFactory: (session, multiplexer, name, position, inventory) =>
        new PlayerImpl(session, multiplexer, name, position, inventory),
    positionFactory: (name, space, routes, devices, aspectRatio, cover) => 
        new PositionImpl(name, space, routes, devices, aspectRatio, cover),
    spaceFactory: (name, positions = []) => ({ name, positions }),
    get sceneList() {
        return construct.scenes;
    },
    set sceneList(value) {
        construct.scenes = value;
    }
};
construct.scenes = [];
construct.load.on(scene => game = scene.start());
loadPlugins().forEach(plugin => plugin.default(context));
console.debug('Scenes in construct: ', construct.scenes);

let game: Server.Game = construct;
construct.load.next.then(scene => game = scene.start());
const static_dir = path.join(process.cwd(), 'dist');
const http_server = serveStatic(static_dir);
const wss = new WsServer({ server: http_server });
const wrapper = new WsWrapper.Server(wss, config.connectionTimeout);
const sessions = new Sessions.Server(wrapper, {
    sessionFactory: conn => new Sessions.Session(conn, {
        takeover: true,
        timeout: config.sessionTimeout,
    }),
    getUid
});
sessions.connection.on(async (conn: Net.Connection) => {
    console.log('Client connected');
    const name = await conn.message.next;
    if (name instanceof ArrayBuffer) throw new Error('got binary for initial config');
    console.log('Client identified as', name);
    const mux = new Mux.Host.Host(conn, mux_deps);
    game.join(conn as Net.Session, mux, name);
});

http_server.listen(config.port);
console.log(`server listening on port ${config.port}`);