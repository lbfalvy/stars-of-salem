import * as Ses from '../../src/shared/connection/sessions';
import { Target } from '../helpers/MockConnectionTarget';
import { doesHandleClosing, doesHandleTermination, doesRelayArrayBuffers, doesRelayStrings } from './generic_tests';
import { exposeResolve } from '../../src/shared/TypedEvent';
describe('Session', function () {
    let i = 0;
    let mock_tgt: Target;
    let session: Net.Connection;
    let srv: Ses.Server;
    let client: Ses.Client;
    beforeEach(async function() {
        mock_tgt = new Target();
        srv = new Ses.Server(mock_tgt, {
            getUid: () => (i++).toString(16),
            sessionFactory: (conn) => new Ses.Session(conn)
        });
        srv.connection.next.then(c => session = c);
        client = new Ses.Client(async () => mock_tgt.connect());
        //mock_tgt.connection.on(c => console.log(c));
        await client.ready;
    });

    describe('should act like a normal connection', function () {
        
        it('should be ready', function(){
            expect(client.isReady).toBeTrue(); // client not immediately ready
        });
        // c1/2 need to be evaluated late.
        it('should relay strings client to session', () => doesRelayStrings(client, session)());
        it('should relay strings session to client', () => doesRelayStrings(session, client)());
        it('should relay arraybuffers client to session', () => doesRelayArrayBuffers(client, session)());
        it('should relay arraybuffers session to client', () => doesRelayArrayBuffers(session, client)());
        it('should handle closing client to session', () => doesHandleClosing(client, session)());
        it('should handle closing session to client', () => doesHandleClosing(session, client)());
        it('should handle termination client to session', () => doesHandleTermination(client, session)());
        it('should handle termination session to client', () => doesHandleTermination(session, client)());
    });

    it('should trigger appropriate lifecycle events', async function() {
        const mock_tgt = new Target();
        let i = 0;
        const srv = new Ses.Server(mock_tgt, {
            getUid: () => (i++).toString(),
            sessionFactory: (conn) => new Ses.Session(conn)
        });
        let p = exposeResolve<Net.Connection>();
        // Client created, but connection not yet available
        const client = new Ses.Client(() => p);
        expect(client.isReady).toBeFalse(); // Client.isReady false before receiving connection
        // Connection provided. 'ready' should fire, isReady should update
        // and the session should appear
        p.resolve(mock_tgt.connect());
        const [ses] = await Promise.all([
            srv.connection.next as Promise<Net.Session>,
            client.ready
        ]);
        expect(client.isReady).toBeTrue();
        expect(ses.isReady).toBeTrue();
        p = exposeResolve();
        // Connection broken.
        mock_tgt.clients.values().next().value.close(-1); 
        // Negative numbers are ws-domain, and should trigger a reconnect attempt
        await Promise.all([
            ses.brokenPipe.next,
            client.brokenPipe.next
        ]);
        expect(client.isReady).toBeFalse();
        expect(ses.isReady).toBeFalse();
        // Resuming connection.
        p.resolve(mock_tgt.connect());
        await Promise.all([
            ses.resuming.next,
            client.resuming.next
        ]);
        expect(client.isReady).toBeTrue();
        expect(ses.isReady).toBeTrue();
        // Closing connection
        client.terminate();
        await Promise.all([
            ses.closed,
            client.closed
        ]);
        expect(client.isReady).toBeFalse();
        expect(ses.isReady).toBeFalse();
        expect(client.isClosed).toBeTrue();
        expect(ses.isClosed).toBeTrue();
    });

    it('should allow a takeover by default', async function(){
        const conn = mock_tgt.connect();
        conn.send('');
        const [ses, key] = await Promise.all([
            srv.connection.next as Promise<Net.Session>,
            conn.message.next
        ]);
        // Attempt takeover
        const conn2 = mock_tgt.connect();
        conn2.send(key);
        // Old should close with appropriate message, new should get a RESUME command
        const [resume, takeover] = await Promise.all([
            conn2.message.next,
            conn.closed
        ]);
        expect(resume).toBe(Ses.Protocol.RESUME_COMMAND);
        expect(takeover.message.code).toBe(Ses.Protocol.messages.takeover.code);
        // The new one should work as expected
        conn2.send('asdf');
        expect(await ses.message.next).toBe('asdf');
    });

    it('should reject a takeover if configured', async function(){
        const mock_tgt = new Target();
        let i = 0;
        const srv = new Ses.Server(mock_tgt, {
            getUid: () => (i++).toString(),
            sessionFactory: (conn) => new Ses.Session(conn, {
                takeover: false,
            })
        });
        const conn = mock_tgt.connect();
        // Open a connection manually
        conn.send('');
        const [ses, key] = await Promise.all([
            srv.connection.next as Promise<Net.Session>,
            conn.message.next
        ]);
        // - We'll pretend the connection broke here, but the server doesn't know it yet
        // Open another one with the same key
        const conn2 = mock_tgt.connect();
        conn2.send(key);
        // The response should be immediately closing the new connection 
        // with message rejectedTakeover 
        conn2.message.next.then(m => fail(m));
        const close_ev = await conn2.closed;
        expect(close_ev.message.code).toBe(Ses.Protocol.messages.rejectedTakeover.code);
        // The old connection should continue to work
        conn.send('asdf');
        expect(await ses.message.next).toBe('asdf');
    });
});