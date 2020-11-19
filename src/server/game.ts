import { Connection } from '../shared/connection/Interfaces';
import { Position, Space, Device } from './GameElements';

// A dead simple notepad component to demonstrate the concept
class Notepad implements Device {
    public data = '';
    public clients = new Set<Connection>();
    public onViewed(conn:Connection) {
        conn.send(this.data);
        this.clients.add(conn);
        conn.message.on(value => {
            if (value instanceof ArrayBuffer) {
                throw new Error('Notepad got binary');
            }
            this.data = value;
            this.clients.forEach(c => c.send(value));
        });
        return {dispose: () => {
            this.clients.delete(conn);
        }};
    }
}

// We've got a position in the lobby, another and a table in the lab.
const lobby = new Space('Lobby');
const start = new Position('Lobby', lobby, []);
const lab = new Space('Laboratory');
const table = new Position('Table', lab, [], new Map([
    ['notepad', new Notepad()]
]));
const labpos = new Position('Laboratory', lab, [start, table]);
start.routes = [labpos];
table.routes = [labpos];

export { start };