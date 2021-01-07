import { PROTOCOL_CODE_RANGE } from "./connection";

export const is = {
    player(m: Transfer.Message): m is Transfer.Player {
        return m.typeid == 'Player';
    },
    device(m: Transfer.Message): m is Transfer.Device {
        return m.typeid == 'Device';
    },
    item(m: Transfer.Message): m is Transfer.Item {
        return m.typeid == 'Item';
    },
    inventory(m: Transfer.Message): m is Transfer.Inventory {
        return m.typeid == 'Inventory';
    },
    volume(m: Transfer.Message): m is Transfer.Volume {
        return m.typeid == 'Volume';
    },
    move(m: Transfer.Message): m is Transfer.Move {
        return m.typeid == 'Move';
    },
    give(m: Transfer.Message): m is Transfer.Give {
        return m.typeid == 'Give';
    },
    position(m: Transfer.Message): m is Transfer.Position {
        return m.typeid == 'Position';
    },
};

/*export type Constructor<T> = new (...args: any[]) => T;

export class Message {
    protected constructor(public readonly typeid: string) {}
}

export function is<T implements Message>(m: Message, c: Constructor<T>): m is T {
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

export class Position extends Message { // to client
    public constructor(
        public readonly name: string,
        public readonly space: string,
        public readonly users: Array<Player>, // Players visible here
        public readonly routes: Array<string>, // List of routes from here
        public readonly devices?: Array<DeviceDetails>, // List of devices to render here
        public readonly aspectRatio?: number, // Aspect ratio of the device view
    ) {
        super(Position.name);
    }
}*/


/*export class PlayerLeft extends Message { // to client
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
}*/
//throw new Error('This file shouldn\'t be included');