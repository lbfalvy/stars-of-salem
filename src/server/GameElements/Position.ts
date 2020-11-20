import Space from './Space';
import { Connection } from '../../shared/connection/Interfaces';
import { Disposable } from '../../shared/TypedEvent';
import Player from './Player';
import * as Messages from '../../shared/Messages';

export interface Device extends Messages.Device {
    onViewed(conn: Connection, player: Player): Disposable;
}

export default class Position {
    private playerDisposables = new Map<Player, Disposable[]>();

    public players = new Array<Player>();

    public constructor(public name: string, public space: Space, 
                       public routes: Array<Position>,
                       public devices?: Array<Device>,
                       public cover?: Array<Position>) {
        space.positions.push(this);
    }

    public enter(player:Player):void {
        this.players.push(player);
        // Notify spectators
        this.spectators.forEach(spec => spec.sendEvent(player.getMessage()));
        player.sendEvent(this.getEntryMessage());
        // Construct devices along with their channels and prepare all for disposal
        const dev_handles = new Array<Disposable>();
        this.devices?.forEach(async dev => {
            if (dev.channel) {
                const chan = await player.createChannel(dev.channel);
                dev_handles.push(dev.onViewed(chan, player));
                dev_handles.push({ dispose: () => chan.close(Messages.Left) });
            }
        });
        this.playerDisposables.set(player, dev_handles);
    }

    public leave(player:Player):void {
        // Dispose of their stuff
        this.playerDisposables.get(player)?.forEach(d => d.dispose());
        // Notify spectators
        this.spectators.forEach(
            spec => spec.sendEvent({ typeid: 'playerLeft', name: player.name } as Messages.PlayerLeft)
        );
        // Remove player
        const idx = this.players.findIndex(p => p.name == player.name);
        this.players.splice(idx, 1);
    }

    public getEntryMessage():Messages.Position {
        return new Messages.Position(
            this.name, 
            this.space.name,
            this.visiblePlayers.map(p => p.getMessage()),
            this.routes.map(r => r.name), 
            this.devices
        );
    }

    // all positions that we can see
    public get visiblePositions():Array<Position> {
        return this.space.positions.filter(pos => !this.cover?.includes(pos));
    }

    // all players we can see
    public get visiblePlayers():Array<Player> {
        return this.visiblePositions.flatMap(pos => pos.players);
    }

    // all positions that can see us
    public get watchingPositions():Array<Position> {
        return this.space.positions.filter(pos => !pos.cover?.includes(this));
    }

    // all players that can see us
    public get spectators():Array<Player> {
        return this.watchingPositions.flatMap(pos => pos.players);
    }

    // Find all directly reachable players
    public get reachablePlayers():Array<Player> {
        return this.players.concat(this.routes.flatMap(pos => pos.players));
    }
}