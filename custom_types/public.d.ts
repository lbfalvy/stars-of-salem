type Listener<T> = (event: T) => unknown;

// This is readonly to practically prevent reference loops. Since it only represents network data,
// this shouldn't block any reasonable use-cases.
type JsonData = readonly string 
              | readonly number 
              | readonly JsonArray 
              | readonly JsonObject
type JsonArray = ReadonlyArray<JsonData>
interface JsonObject {
    readonly [key: string]: JsonData
}

interface Disposable {
    dispose(): void;
}

interface TypedEventSource<T> {
    on(listener: Listener<T>): Disposable;
    readonly next: Promise<T>;
    pipe<K>(te: TypedEmitter<K>, transform: (x: T) => K): Disposable;
    pipeRaw(te: TypedEmitter<T>): Disposable;
}

interface TypedEmitter<T> {
    emit(event: T): void
}

type ExposedPromise<T> = Promise<T> & { 
    resolve: (arg: T) => void
    reject: (arg: any) => void
};

declare namespace Net {
    // The possible types of messages sent over our networking stack
    type Data = string|ArrayBuffer;

    // Reason for closing the connection, as provided by the other peer.
    interface CloseMessage {
        code: number
        reason: string
    }

    // Emitted when a network connection is closed
    interface CloseEvent {
        message: sCloseMessage,
        local: boolean
    }

    /**
     * A network connection
     * Disambiguation:
     *  closed() is fired even when we initiated the closing handshake.
     *  isClosed is true while the closed() handlers are running.
     *  if message doesn't arrive, send() should fail.
     */
    interface Connection {
        readonly message: TypedEventSource<Data>;
        readonly closed: Promise<CloseEvent>;
        readonly isClosed: boolean;

        send( data: Data, params?: Record<string, any>): Promise<void>|never;
        close( message: CloseMessage ): Promise<void>|never;
        terminate(): void;
    }

    // Something that receives network connections, like a server or an automatic demultiplexer
    interface ConnectionTarget {
        readonly connection: TypedEventSource<Connection>;
        readonly clients: Set<Connection>;
    }

    interface Multiplexer extends ConnectionTarget, Connection {
        createChannel(id?: number): Promise<Connection>
    }

    interface Session extends Connection {
        readonly brokenPipe: TypedEvent<CloseMessage>;
        readonly resuming: TypedEvent<void>;
        readonly isReady: boolean;
        //connection: Interfaces.Connection | undefined;
        onReconnect(conn: Connection): void
    }
}

// Transferred between client and server
declare namespace Transfer {
    interface Message {
        readonly typeid: string
    }
    type AnyMessage = Player | Device | Item | Inventory | Volume | Position | Move | Give | Refresh

    interface Player extends Message{
        readonly typeid: 'Player'
        readonly name: string
        readonly position?: string // If this is undefined, the player just left.
    }

    interface Device extends Message {
        readonly typeid: 'Device'
        readonly component: string // Identifier for the cilent-side thing
        readonly channel?: string // Specified here so the device def can be simpler
                                // Optional to allow more things to be described as devices
        readonly componentOptions?: JsonData; // This is passed as-is to the component
        readonly position: { // Values in range [0;1]
            x: number
            y: number
            w: number
            h: number
        }
    }

    interface Item extends Message {
        readonly typeid: 'Item'
        readonly id: string
        readonly name: string
        readonly description: string
    }

    interface Inventory extends Message {
        readonly typeid: 'Inventory'
        readonly items: ReadonlyArray<Item>
    }

    interface Volume extends Message {
        readonly typeid: 'Volume'
        readonly value: number
    }

    interface Position extends Message {
        readonly typeid: 'Position'
        readonly name: string
        readonly space: string
        readonly devices?: ReadonlyArray<Device>
        readonly routes: ReadonlyArray<Position>
        readonly aspectRatio: number
        readonly players: ReadonlyArray<Player>
    }

    interface Move extends Message {
        readonly typeid: 'Move'
        readonly route: number
    }

    interface Give extends Message {
        readonly typeid: 'Give'
        readonly item: string
        readonly player: string
    }

    interface Refresh extends Message {
        readonly typeid: 'Refresh'
    }
}

declare namespace Server {
    interface Player {
        name: string
        position: Position
        readonly inventory: ReadonlyArray<Transfer.Item>
        readonly ready: Promise<void>
        sendEvent(data: Transfer.AnyMessage): Promise<void>
        addItem(item: Transfer.Item): void
        createChannel(intent: string): Promise<Net.Connection>
        findInventoryIndex(id: string): number
        give(index: number, target: Player): void | never
        move(position: Server.Position)
        readonly transfer: Transfer.Player
    }

    // State by the state-machine analogy
    // View by GUI terminology
    interface Position {
        readonly name: string
        readonly space: Space
        routes: ReadonlyArray<Position> // Positions the player can transition to
        readonly devices?: ReadonlyArray<Device> // Provides UI details and view handlers
        aspectRatio: number | undefined;
        readonly cover: ReadonlyArray<Position> // Positions you don't see from here
        readonly players: Array<Player> // Players presently in this position
        enter(player: Player): void
        leave(player: Player): void
        readonly transfer: Transfer.Position
        readonly partialTransfer: Transfer.Position // doesn't include devices and routes
        readonly visiblePositions: ReadonlyArray<Position>;
        readonly visiblePlayers: ReadonlyArray<Player>;
        readonly watchingPositions: ReadonlyArray<Position>;
        readonly watchingPlayers: ReadonlyArray<Player>;
        readonly reachablePlayers: ReadonlyArray<Player>;
    }

    // Players in the same space can hear each other 
    interface Space {
        readonly name: string
        readonly positions: Array<Position>
    }

    // An audio client, the single access point to the audio subsystem.
    interface Audio {
        readonly output: TypedEventSource<Float32Array>
        input(samples: Float32Array): void

        readonly spaces: Set<string>
        enterSpaces(spaces: Array<string>)
        leaveSpaces(spaces: Array<string>)

        pause(state: boolean)
        volume: number
    }

    // All the properties needed to create a device on the server
    interface Device extends Transfer.Device {
        onViewed(conn: Net.Connection, player: Player): Disposable;
    }

    // A running game
    interface Game extends Partial<Disposable> {
        join(session: Net.Session, multiplexer: Net.Multiplexer, name: string): Player | never;
    }

    // A selectable scene
    interface Scene {
        title: string
        description: string
        start(): Game
    }

    interface PluginContext {
        playerFactory(session: Net.Session, multiplexer: Net.Multiplexer, name: string, 
                      position: Position, inventory?: Array<Transfer.Item>): Player
        positionFactory(name: string, space: Space, routes: Array<Position>, 
                        devices?: Array<Device>, aspectRatio?: number,
                         cover?: Array<Position>): Position
        spaceFactory(name: string, positions?: Array<Position>): Space
        audioFactory(spaces: Array<string>): Audio
        sceneList: ReadonlyArray<Scene>
    }

    type Plugin = {
        default: (context: PluginContext) => Disposable
    }
}

declare namespace Client {
    type ComponentParams = { 
        channel: Promise<Net.Connection>
        init?: JsonData
    }

    type Component = (props: ComponentParams) => JSX.Element

    interface PluginInterface {
        components: Map<string, Component>
            // This is where devices are loaded from
    }

    interface Window { app: PluginInterface }
}