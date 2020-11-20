import { CloseMessage, PROTOCOL_CODE_RANGE } from './connection/Interfaces';

export type Constructor<T> = new (...args: any[]) => T;

export class Message {
    protected constructor(public readonly typeid: string) {}
}

export function is<T extends Message>(m:Message, c:Constructor<T>): m is T {
    return m.typeid == c.name;
}

export class Player extends Message {
    protected static readonly id = 'player';
    public constructor(
        public readonly name: string,
        public readonly position: string
    ) {
        super(Player.name);
    }
}

export interface Device {
    readonly type: string; // Identifier for the cilent-side thing
    readonly channel?: string; // Specified here so the device def can be simpler
                               // Optional to allow more things to be described as devices
    readonly options?: any; // This is passed as-is to the component
    readonly position: {x:number,y:number}
}

export class Position extends Message { // to client
    public constructor(
        public readonly name: string,
        public readonly space: string,
        public readonly users: Array<Player>, // Players visible here
        public readonly routes: Array<string>, // List of routes from here
        public readonly devices?: Array<Device>, // List of devices to render here
        public readonly aspectRatio?: number, // Aspect ratio of the device view
    ) {
        super(Position.name);
    }
}

export const Left : CloseMessage = {
    code: PROTOCOL_CODE_RANGE + 1,
    reason: 'The player left this position'
};

export class PlayerLeft extends Message { // to client
    public constructor(
        public readonly name: string
    ) {
        super(PlayerLeft.name);
    }
}

export class Move extends Message { // to server
    public constructor(
        public readonly route: number
    ) {
        super(Move.name);
    }
}

export class Item extends Message {
    public constructor(
        public readonly name: string,
        public readonly description: string,
        public readonly id: string
        //iconUrl: string // Aesthetic rework
    ) {
        super(Item.name);
    }
}

export class InventoryContents extends Message { // to client
    public constructor(
        public readonly contents: Array<Item>
    ) {
        super(InventoryContents.name);
    }
}

export class PassItem extends Message { // to server
    public constructor(
        public readonly id: string,
        public readonly player: string
    ) {
        super(PassItem.name);
    }
}

export class SetVolume extends Message { // to server
    public constructor(
        public readonly volume: number
    ) {
        super(SetVolume.name);
    }
}