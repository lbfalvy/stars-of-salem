import * as Interfaces from '../../src/shared/connection/Interfaces';
export type ConnectionWrapperFactory = (underlying: [
    Interfaces.Connection,
    Interfaces.Connection
]) => Promise<[
    Interfaces.Connection,
    Interfaces.Connection
]>;
export function doesRelayStrings(c1: Interfaces.Connection, c2: Interfaces.Connection) {
    return async (): Promise<void> => {
        c1.send(`asdf`);
        const msg = await c2.message.next;
        expect(typeof msg).toBe('string'); // String type preserved
        expect(msg).toBe('asdf');
        return;
        /* TODO: finish session tests */
    };
}
export function doesRelayArrayBuffers(c1: Interfaces.Connection, c2: Interfaces.Connection) {
    return async (): Promise<void> => {
        const ab = new ArrayBuffer(8);
        const view = new DataView(ab);
        view.setUint32(0, 2500);
        view.setUint32(4, 0xffffffff);
        c1.send(ab);
        const msg = await c2.message.next;
        expect(msg).toBeInstanceOf(ArrayBuffer); // ArrayBuffer type preserved
        const result_view = new DataView(msg as ArrayBuffer);
        expect(result_view.getUint32(0)).toBe(2500); // ArrayBuffer content preserved
        expect(result_view.getUint32(4)).toBe(0xffffffff);
    };
}
export function closeEventAsserts(
    conn: Interfaces.Connection, 
    expected_event: Interfaces.CloseEvent
): (ev: Interfaces.CloseEvent) => void | never {
    return (ev: Interfaces.CloseEvent) => {
        expect(ev).toEqual(expected_event);
        expect(conn.isClosed).toBeTrue(); // isClosed updated before event
    };
}
export function doesHandleClosing(c1: Interfaces.Connection, c2: Interfaces.Connection) {
    return async (): Promise<void> => {
        expect(c2.isClosed).toBeFalse(); // isClosed false at start
        expect(c1.isClosed).toBeFalse();
        const message = { code: 3042, reason: 'Test reason' };
        c2.closed.then(closeEventAsserts(c2, { message, local: false }));
        c1.closed.then(closeEventAsserts(c1, { message, local: true }));
        c1.close(message);
        await Promise.all([c1.closed, c2.closed]);
    };
}
export function doesHandleTermination(c1: Interfaces.Connection, c2: Interfaces.Connection) {
    return async (): Promise<void> => {
        c2.closed.then(closeEventAsserts(c2, {
            message: Interfaces.TERMINATED_MESSAGE,
            local: false
        }));
        c1.closed.then(closeEventAsserts(c1, {
            message: Interfaces.TERMINATED_MESSAGE,
            local: true
        }));
        c1.terminate();
        await Promise.all([c1.closed, c2.closed]);
    };
}
export function doesKeepClientList(host: Interfaces.ConnectionTarget, 
                                   connect: () => Promise<Interfaces.Connection>) {
    return async (): Promise<void> => {
        expect(host.clients.size).toBe(0);
        const [cl_conn, srv_conn] = await Promise.all([
            connect(),
            host.connection.next
        ]);
        expect(host.clients.size).toBe(1); // Sender.clients is empty
        expect(host.clients.has(srv_conn)).toBeTrue();
        // Closing serverside
        srv_conn.terminate();
        await cl_conn.close;
        expect(host.clients.size).toBe(0);
        // Closing clientside
        const [cl_conn2, srv_conn2] = await Promise.all([connect(), host.connection.next]);
        srv_conn2.terminate();
        await cl_conn2.close;
        expect(host.clients.size).toBe(0);
    };
}