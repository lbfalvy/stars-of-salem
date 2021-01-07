import { exposeResolve, TypedEvent } from '../../shared/TypedEvent';
import AudioImpl from '../Audio';

// TODO: Move this sound stuff elsewhere
const sampleRate = 44100;
const bufferSize = 1024;
const _messageRate = sampleRate / bufferSize;
AudioImpl.setProperties(sampleRate, bufferSize);

export default class PlayerImpl implements Server.Player {
    public readonly positionChanged = new TypedEvent<[Server.Position, Server.Position]>();
    public readonly ready = exposeResolve<void>();
    private connection!: Net.Connection;
    private voice = new AudioImpl();
    public constructor(private readonly session: Net.Session,
                       private readonly multiplexer: Net.Multiplexer,
                       public name: string, 
                       public position: Server.Position,
                       public inventory: Array<Transfer.Item> = []) {
        this.ready.then(() => {
            if (inventory.length > 0) this.syncInventory();
            this.position.enter(this);
            this.sendEvent(this.position.transfer);
            this.connection.closed.then(_ev => this.position.leave(this));
        });
        this.createChannel('control').then(conn => {
            this.connection = conn;
            conn.message.on(msg => {
                if (msg instanceof ArrayBuffer) throw new Error('Got binary on the control channel');
                this.handleAction(JSON.parse(msg));
            });
            return this.createChannel('voice');
        }).then(channel => {
            channel.send(JSON.stringify({ sampleRate, bufferSize }));
            const DownlinkHandle = this.voice.output.on(samples => {
                if (!session.isReady) return;
                channel.send(samples.buffer, {immediate: true}) // immediate == now or never
                .catch(() => console.debug(`${this.name}'s session timed out.`));
            });
            const UplinkHandle = channel.message.on(samples => {
                if (typeof samples == 'string') throw new Error('Got string on the voice channel');
                this.voice.input(new Float32Array(samples));
            });
            session.brokenPipe.on(() => this.voice.pause(true));
            session.resuming.on(() => this.voice.pause(false));
            channel.closed.then(() => {
                this.voice.leaveSpaces([...this.voice.spaces]);
                DownlinkHandle.dispose();
                UplinkHandle.dispose();
            });
            this.voice.enterSpaces(['radio']);
            this.ready.resolve();
        });
    }

    public async move(position: Server.Position) {
        // If we're also switching spaces, update the audio worker about it.
        if (position.space != this.position.space) {
            this.voice.leaveSpaces(['space:' + this.position.space.name]);
            this.voice.enterSpaces(['space:' + position.space.name]);
        }
        const oldPosition = this.position;
        this.position.leave(this);
        position.enter(this);
        this.position = position;
        await this.sendEvent(this.position.transfer);
        this.positionChanged.emit([oldPosition, position]);
    }

    public async give(index: number, target: Server.Player): Promise<void> | never {
        if (index < 0 || this.inventory.length < index) {
            throw new RangeError(`This item isn't in the player's inventory`);
        }
        const item = this.inventory[index];
        this.inventory.splice(index, 1);
        target.addItem(item);
        await this.syncInventory();
    }

    public findInventoryIndex(id: string): number {
        return this.inventory.findIndex(item => item.id == id);
    }

    private async handleAction(msg: Transfer.AnyMessage): Promise<void> {
        if (msg.typeid == 'Move') {
            // Locate our new position
            if (!(msg.route in this.position.routes)) throw new Error('Route out of range!');
            const newPosition = this.position.routes[msg.route];
            this.move(newPosition);
        } else if (msg.typeid == 'Give') {
            const idx = this.findInventoryIndex(msg.item);
            const target = this.position.reachablePlayers.find(p => p.name == msg.player);
            if (!target) {
                this.sendEvent(this.position.transfer);
                return;
            }
            try {
                this.give(idx, target);
            } catch {
                await this.syncInventory();
            }
        } else if (msg.typeid == 'Volume') {
            this.voice.volume = msg.value;
        }
    }

    private syncInventory(): Promise<void> {
        const itemMessages = this.inventory.map<Transfer.Item>(item => ({
            typeid: "Item",
            id: item.id,
            name: item.name,
            description: item.description
        }));
        return this.sendEvent({
            typeid: 'Inventory',
            items: itemMessages
        } as Transfer.Inventory);
    }

    public get transfer(): Transfer.Player {
        return {
            typeid: 'Player',
            name: this.name,
            position: this.position.name
        };
    }

    public sendEvent(data: Transfer.AnyMessage): Promise<void> {
        return this.connection.send(JSON.stringify(data));
    }

    public addItem(item: Transfer.Item): void {
        this.inventory.push(item);
        this.syncInventory();
    }

    public async createChannel(intent_id: string): Promise<Net.Connection> {
        const chan = await this.multiplexer.createChannel();
        await chan.send(intent_id);
        return chan;
    }
}