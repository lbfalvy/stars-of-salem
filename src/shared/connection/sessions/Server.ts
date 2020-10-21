import { TypedEvent } from '../../TypedEvent';
import * as Interfaces from '../Interfaces';
import * as Protocol from './Protocol';
import * as Session from './Session';

export interface ServerOptions {
    session_timeout?: number,
    socket_timeout?: number
}

export type ConnectionWrapper = 
    (conn: Interfaces.Connection, resuming: boolean) => Interfaces.Connection;
export type SessionFactory = (conn: Interfaces.Connection) => Session.ISession
export type KeyGenerator = () => string;
export interface ServerDependencies {
    session_factory: SessionFactory,
    conn_wrapper?: ConnectionWrapper,
    get_key: KeyGenerator
}

export class Server implements Interfaces.ConnectionTarget {
    private session_store = new Map<Protocol.Key, Session.ISession>(); 
    public connection = new TypedEvent<Interfaces.Connection>();

    public constructor(server: Interfaces.ConnectionTarget, deps: ServerDependencies) {
        const wrap_conn = deps.conn_wrapper || (c => c);
        server.connection.on(async conn => {
            conn.closed.on(ev => console.debug('Client disconnected:', ev));
            conn.message.on(ev => console.debug('Client sent:', ev));
            const key = await conn.message.wait();
            if (typeof key.data !== 'string') {
                // Protocol mismatch, presumably
                conn.close(Protocol.messages.noHandshake);
                console.warn('Unknown message, expected string.', key.data);
            } else if (key.data === '') {
                // Generate a new session key and send it to the other end
                const id: Protocol.Key = deps.get_key();
                try {
                    await conn.send(id);
                } catch(e) {
                    console.debug('Couldn\'t send key;', e);
                    return conn.terminate();
                }
                // Create session and save it
                const session = deps.session_factory(wrap_conn(conn, false));
                this.session_store.set(id, session);
                // eventually delete the session once it's closed
                session.closed.once(() => this.session_store.delete(id));
                // notify everyone that we have a new session
                this.connection.emit(session);
            } else {
                const session = this.session_store.get(key.data);
                if (session) {
                    session.connection = wrap_conn(conn, true);
                } else {
                    conn.close(Protocol.messages.invalidSession);
                }
            }
        });
    }

    public get clients(): Set<Session.ISession> {
        return new Set(this.session_store.values());
    }
}
