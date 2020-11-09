import * as Interfaces from '../../src/shared/connection/Interfaces';
import { TypedEvent } from '../../src/shared/TypedEvent';
import { MockConnection } from './MockConnection';

export class Target implements Interfaces.ConnectionTarget {
    public connection = new TypedEvent<Interfaces.Connection>();
    public clients = new Set<Interfaces.Connection>();
    
    public connect(): Interfaces.Connection {
        const [c1, c2] = MockConnection.getPair();
        this.clients.add(c1);
        c1.closed.then(() => this.clients.delete(c1));
        this.connection.emit(c1);
        return c2;
    }
}