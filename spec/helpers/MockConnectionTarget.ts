import { TypedEvent } from '../../src/shared/TypedEvent';
import { MockConnection } from './MockConnection';

export class Target implements Net.ConnectionTarget {
    public connection = new TypedEvent<Net.Connection>();
    public clients = new Set<Net.Connection>();
    
    public connect(): Net.Connection {
        const [c1, c2] = MockConnection.getPair();
        this.clients.add(c1);
        c1.closed.then(() => this.clients.delete(c1));
        this.connection.emit(c1);
        return c2;
    }
}