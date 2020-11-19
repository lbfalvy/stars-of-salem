import { Connection, ConnectionTarget } from '../shared/connection/Interfaces';
import { ExposedPromise, exposeResolve } from '../shared/TypedEvent';

// TODO: test this
export default class ChannelResolver {
    private resolved = new Map<string, Promise<Connection>>();
    private pending = new Map<string, ExposedPromise<Connection>>();
    public constructor(mux:ConnectionTarget) {
        mux.connection.on(c => this.handleConnection(c));
    }

    public get(id:string):Promise<Connection> {
        const previous = this.pending.get(id) || this.resolved.get(id);
        if (previous) {
            return previous;
        }
        const new_promise = exposeResolve<Connection>();
        this.pending.set(id, new_promise);
        return new_promise;
    }

    private async handleConnection(conn:Connection) {
        console.log('Got connection');
        // Channels in a resolver context introduce themselves by id
        const id = await conn.message.next;
        console.log('Got connection name', id);
        if (id instanceof ArrayBuffer) {
            throw new Error('First message wasn\'t string on resolver managed connection');
        }
        // If we were storing anything about it
        if (this.resolved.has(id)) {
            throw new Error('Duplicate channel name on resolver!');
        }
        // Try to get it from the pending map
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
        this.resolved.delete(id);
    }
}