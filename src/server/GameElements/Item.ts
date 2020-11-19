import * as Messages from '../../shared/Messages';
let NEXT_ID = 0;
export default class Item {
    public readonly id = (NEXT_ID++).toString();
    public constructor(public name: string, public description: string) {}
    public getMessage():Messages.Item {
        return new Messages.Item(this.name, this.description, this.id);
    }
}