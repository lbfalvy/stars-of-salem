import { exposeResolve } from '../shared/TypedEvent';
import { getUid } from '../shared/uids';

// TODO: test this
export default class ChannelResolver {
    private resolved = new Map<string, Promise<Net.Connection>>();
    private pending = new Map<string, ExposedPromise<Net.Connection>>();
    public constructor(mux: Net.ConnectionTarget) {
        mux.connection.on(c => this.handleConnection(c));
    }

    public get(id: string): Promise<Net.Connection> {
        const previous = this.pending.get(id) || this.resolved.get(id);
        if (previous) {
            console.debug('Resolving previously established channel', id);
            return previous;
        }
        console.debug('Requested yet-unresolvable channel', id);
        const new_promise = exposeResolve<Net.Connection>();
        this.pending.set(id, new_promise);
        new_promise.then(() => console.debug('Resolving previously requested channel', id));
        return new_promise;
    }

    private async handleConnection(conn: Net.Connection) {
        const debug_code = getUid().slice(0, 16);
        console.debug(`Connection #${debug_code} established`);
        // Channels in a resolver context introduce themselves by id
        const id = await conn.message.next;
        // Artificially skip voice to prevent log flooding.
        if (id != 'voice') conn.message.on(msg => console.debug('Received message on channel', id, msg));
        if (id instanceof ArrayBuffer) throw new Error('First message wasn\'t string on resolver managed connection');
        // If we were storing anything about it
        if (this.resolved.has(id)) throw new Error(`Connection #${debug_code} had duplicate channel name ${id}!`);
        // Try to get it from the pending map
        console.debug(`Connection #${debug_code} resolved under name`, id);
        const promise = this.pending.get(id);
        if (promise) {
            // If found, resolve and move to resolved
            promise.resolve(conn);
            this.pending.delete(id);
            this.resolved.set(id, promise);
        } else {
            // Otherwise create one directly in the resolved map
            const new_promise = Promise.resolve(conn);
            this.resolved.set(id, new_promise);
        }
        // Once the channel closes, forget about it
        await conn.closed;
        console.debug(`Channel ${id} (#${debug_code}) closed`);
        this.resolved.delete(id);
    }
}