import { ConnectionClosedError, TERMINATED_MESSAGE } from '../../src/shared/connection';
import { exposeResolve, TypedEvent } from '../../src/shared/TypedEvent';

export class MockConnection implements Net.Connection {
    private static counter = 0;
    public static debug = false;

    private other: MockConnection | undefined;
    private _isClosed = false;
    private readonly uid = MockConnection.counter++;

    public readonly closed = exposeResolve<Net.CloseEvent>();
    public readonly message = new TypedEvent<Net.Data>();
    public get isClosed(): boolean {
        return this._isClosed;
    }

    public constructor() {
        if (MockConnection.debug) console.debug(this.uid, 'created');
    }

    public async send(data: Net.Data): Promise<void> {
        if (this.isClosed) throw new ConnectionClosedError();
        if (!this.other || this.other.isClosed) throw new ConnectionClosedError();
        if (MockConnection.debug) console.debug(this.uid, 'sending', data, 'to', this.other.uid);
        this.other.message.emit(data);
    }
    public async close(message: Net.CloseMessage): Promise<void> {
        if (this.isClosed) throw new ConnectionClosedError();
        if (!this.other || this.other.isClosed) throw new ConnectionClosedError();
        if (MockConnection.debug) {
            console.debug(this.uid, 'closing with', message, 'pair:', this.other.uid);
        }
        this._isClosed = true;
        this.other._isClosed = true;
        this.other.closed.resolve({ local: false, message });
        this.closed.resolve({ local: true, message });
    }
    public terminate(): void {
        if (MockConnection.debug) console.debug(this.uid, 'terminating, pair:', this.other?.uid);
        this._isClosed = true;
        if (this.other) this.other._isClosed = true;
        this.other?.closed.resolve({
            local: false,
            message: TERMINATED_MESSAGE
        });
        this.closed.resolve({
            local: true,
            message: TERMINATED_MESSAGE
        });
    }

    public static getPair(): [MockConnection, MockConnection] {
        const c1 = new MockConnection();
        const c2 = new MockConnection();
        c1.other = c2;
        c2.other = c1;
        if (MockConnection.debug) console.debug('New pair created', c1.uid, 'and', c2.uid);
        return [c1, c2];
    }
}