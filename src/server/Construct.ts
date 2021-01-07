import { TypedEvent } from "../shared/TypedEvent";
import PlayerImpl from "./GameElements/Player";
import PositionImpl from "./GameElements/Position";

class BasicSelect {
    private _options: ReadonlyArray<string> = [];
    private _value = '';
    private clients = new Set<Net.Connection>()
    public constructor() {
        this.onViewed = this.onViewed.bind(this);
    }
    public get value(): string {
        return this._value;
    }
    public set value(value: string) {
        if (this.options.includes(value) || value == '') {
            this._value = value;
            this.clients.forEach(client => this.sendOptions(client));
        } else throw new RangeError('The assigned value is not in the options array');
    }
    public get options(): ReadonlyArray<string> { 
        return [...this._options];
    }
    public set options(value: ReadonlyArray<string>) {
        this._options = value;
        if (!this.options.includes(this.value)) this.value = '';
        this.clients.forEach(conn => this.sendOptions(conn));
    }
    public onViewed(conn: Net.Connection): Disposable {
        this.clients.add(conn);
        console.debug('new client, options: ', this._options);
        this.sendOptions(conn).then(() => {
            conn.message.on(data => {
                try {
                    this.value = data as string;
                } catch {
                    this.sendOptions(conn);
                }
            });
        });
        return { dispose: () => this.clients.delete(conn) };
    }
    public async sendOptions(conn: Net.Connection) {
        conn.send(JSON.stringify({
            options: this.options,
            value: this.value
        }));
    }
}

export class Construct implements Server.Game {
    private readonly global: Server.Space 
    private readonly loadScene: Server.Position
    private readonly sceneSelector: BasicSelect
    private _scenes: ReadonlyArray<Server.Scene> = [];
    public static readonly title = 'Construct';
    public static readonly description = 'The default scene loader';
    public load = new TypedEvent<Server.Scene>();

    public set scenes(value: ReadonlyArray<Server.Scene>) {
        this._scenes = value;
        this.sceneSelector.options = value.map(scene => scene.title);
    }
    public get scenes(): ReadonlyArray<Server.Scene> {
        return this._scenes;
    }
    public get selectedScene(): Server.Scene | undefined {
        return this.scenes.find(s => s.title == this.sceneSelector.value);
    }

    public constructor() {
        this.sceneSelector = new BasicSelect();
        this.global = { name: 'Construct', positions: [] };
        this.loadScene = new PositionImpl('Load Scene', this.global, [], [{
            typeid: 'Device' as const,
            component: 'single-select',
            channel: 'select-scene',
            position: {
                x: 0, y: 0,
                h: 1, w: 7 / 8
            },
            onViewed: this.sceneSelector.onViewed
        },{
            typeid: "Device",
            component: 'button',
            channel: 'button-load-selected-scene',
            componentOptions: 'Load scene',
            onViewed: (conn) => conn.message.on(data => {
                if (data == 'activate' && this.selectedScene) {
                    this.load.emit(this.selectedScene);
                }
                return { dispose: () => { /* Nothing to do */ } } as Disposable;
            }),
            position: {
                x: 7 / 8,  y: 0,
                h: 1 / 10, w: 1 / 8
            }
        }], 16/9, []);
    }
    public join(session: Net.Session, multiplexer: Net.Multiplexer, name: string): Server.Player {
        const player = new PlayerImpl(session, multiplexer, name, this.loadScene, []);
        player.ready.then(() => console.log(`Player ${name} entered the construct`));
        return player;
    }

    public static start(): Construct {
        return new Construct();
    }
}