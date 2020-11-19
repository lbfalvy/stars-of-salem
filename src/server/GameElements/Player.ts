import { Connection } from '../../shared/connection/Interfaces';
import * as Mux from '../../shared/connection/multiplexer';
import { exposeResolve, TypedEvent } from '../../shared/TypedEvent';
import Item from './Item';
import * as Messages from '../../shared/Messages';
import Position from './Position';
import Audio from '../Audio';

// TODO: Move this sound stuff elsewhere
const sampleRate = 44100;
const bufferSize = 1024;
const _messageRate = sampleRate / bufferSize;
Audio.setProperties(sampleRate, bufferSize);

export default class Player {
    public readonly positionChanged = new TypedEvent<[Position, Position]>();
    public readonly ready = exposeResolve<void>();
    private connection!: Connection;
    private voice = new Audio();
    public constructor(private readonly multiplexer: Mux.Host.Host,
                       public name: string, public position: Position,
                       public inventory: Array<Item> = []) {
        if (inventory.length) {
            this.syncInventory();
        }
        this.createChannel('control').then(conn => {
            this.connection = conn;
            conn.message.on(msg => {
                if (msg instanceof ArrayBuffer) {
                    throw new Error('Got binary on the control channel');
                }
                this.handleAction(JSON.parse(msg));
            });
            return this.createChannel('voice');
        }).then(voice => {
            voice.send(JSON.stringify({ sampleRate, bufferSize }));
            this.voice.output.on(samples => voice.send(samples.buffer));
            voice.message.on(samples => {
                if (typeof samples == 'string') {
                    throw new Error('Got string on the voice channel');
                }
                this.voice.input(new Float32Array(samples));
            });
            this.voice.enterSpaces(['radio']);
            this.ready.resolve();
        });
    }

    private handleAction(msg: Messages.Message): void {
        if (Messages.is(msg, Messages.Move)) {
            // Locate our new position
            if (!(msg.route in this.position.routes)) {
                throw new Error('Route out of range!');
            }
            const newPosition = this.position.routes[msg.route];
            // If we're also switching spaces, update the audio worker about it.
            if (newPosition.space != this.position.space) {
                this.voice.leaveSpaces(['space:'+this.position.space.name]);
                this.voice.enterSpaces(['space:'+newPosition.space.name]);
            }
            this.position.leave(this);
            newPosition.enter(this);
            this.position = newPosition;
        } else if (Messages.is(msg, Messages.PassItem)) {
            const idx = this.inventory.findIndex(item => item.id == msg.id);
            const target = this.position.reachablePlayers.find(p => p.name == msg.player);
            if (target && idx != -1) {
                const item = this.inventory[idx];
                this.inventory.splice(idx, 1);
                target.addItem(item);
            }
        } else if (Messages.is(msg, Messages.SetVolume)) {
            this.voice.setVolume(msg.volume);
        }
    }

    private syncInventory():Promise<void> {
        const itemMessages = this.inventory.map(item => item.getMessage());
        return this.sendEvent(new Messages.InventoryContents(itemMessages));
    }

    public getMessage():Messages.Player {
        return {
            typeid: 'player',
            name: this.name,
            position: this.position.name
        };
    }

    public sendEvent(data: Messages.Message):Promise<void> {
        return this.connection.send(JSON.stringify(data));
    }

    public addItem(item:Item):void {
        this.inventory.push(item);
        this.syncInventory();
    }

    public async createChannel(intent_id:string):Promise<Connection> {
        const chan = await this.multiplexer.createChannel();
        await chan.send(intent_id);
        return chan;
    }
}