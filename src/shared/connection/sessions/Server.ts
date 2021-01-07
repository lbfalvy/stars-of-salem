import { TypedEvent } from '../../TypedEvent';
import * as Protocol from './Protocol';

export interface ServerOptions {
    sessionTimeout?: number,
    socketTimeout?: number
}

export type ConnectionWrapper = (conn: Net.Connection, resuming: boolean) => Net.Connection;
export interface ServerDependencies {
    sessionFactory(conn: Net.Connection): Net.Session,
    connWrapper?: ConnectionWrapper,
    getUid(): string
}

export class Server implements Net.ConnectionTarget {

    private sessionStore = new Map<Protocol.Key, Net.Session>(); 
    public readonly connection = new TypedEvent<Net.Connection>();

    public constructor(server: Net.ConnectionTarget, deps: ServerDependencies) {
        const wrap_conn = deps.connWrapper || (c => c);
        server.connection.on(async conn => {
            //conn.closed.then(ev => console.debug('Client disconnected:', ev));
            //conn.message.on(ev => console.debug('Client sent:', ev));
            const key = await conn.message.next;
            if (typeof key !== 'string') {
                // Protocol mismatch, presumably
                conn.close(Protocol.messages.noHandshake);
                console.warn('Unknown message, expected string.', key);
            } else if (key === '') {
                // Generate a new session key and send it to the other end
                const id: Protocol.Key = deps.getUid();
                try {
                    await conn.send(id);
                } catch(e) {
                    console.info('Couldn\'t send key;', e);
                    return conn.terminate();
                }
                // Create session and save it
                const session = deps.sessionFactory(wrap_conn(conn, false));
                this.sessionStore.set(id, session);
                // eventually delete the session once it's closed
                session.closed.then(() => this.sessionStore.delete(id));
                // notify everyone that we have a new session
                this.connection.emit(session);
            } else {
                const session = this.sessionStore.get(key);
                if (session) session.onReconnect(wrap_conn(conn, true));
                else conn.close(Protocol.messages.invalidSession);
            }
        });
    }

    public get clients(): Set<Net.Session> {
        return new Set(this.sessionStore.values());
    }
}
