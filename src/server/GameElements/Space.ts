import Position from './Position';

export default class Space {
    public positions = new Array<Position>();
    public constructor(public name: string) {}
}