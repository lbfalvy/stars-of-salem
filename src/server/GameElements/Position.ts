import { Server } from 'http';
import { PROTOCOL_CODE_RANGE } from '../../shared/connection';
import { getUid } from '../../shared/uids';

export const PlayerLeft: Net.CloseMessage = {
    code: PROTOCOL_CODE_RANGE + 1,
    reason: 'The player left this position'
};

export default class PositionImpl implements Server.Position {
    private playerDisposables = new Map<Server.Player, Disposable[]>();
    private _devices!: ReadonlyArray<Server.Device>;
    public players = new Array<Server.Player>();
    public set routes(value: ReadonlyArray<Server.Position>) {
        this._routes = value;
        this.updatePlayers();
    }
    public get routes(): ReadonlyArray<Server.Position> { return this._routes; }
    public set aspectRatio( value: number | undefined ) {
        this._aspectRatio = value;
        this.updatePlayers();
    }
    public get aspectRatio(): number | undefined { return this._aspectRatio; }
    public set devices(value: ReadonlyArray<Server.Device>) {
        this._devices = value.map(dev => dev.channel ? dev : {...dev, channel: getUid()});
        this.updatePlayers();
    }
    public get devices(): ReadonlyArray<Server.Device> { return this._devices; }

    public constructor(public name: string, public space: Server.Space, 
                       private _routes: ReadonlyArray<Server.Position>,
                       devices?: ReadonlyArray<Server.Device>,
                       private _aspectRatio?: number,
                       public cover: Array<Server.Position> = []) {
        this.devices = devices ?? [];
        space.positions.push(this);
    }

    public enter(player: Server.Player): void {
        this.players.push(player);
        // Notify spectators
        this.watchingPlayers.forEach(watcher => {
            watcher.sendEvent(watcher.position.transfer)
                .catch(() => console.log(`Player ${watcher} has already disconnected.`));
        });
        // Construct devices along with their channels and prepare all for disposal
        const dev_handles = new Array<Disposable>();
        this.devices.forEach(async dev => {
            if (dev.channel) {
                console.log('Now creating new connection', dev.channel);
                const chan = await player.createChannel(dev.channel);
                dev_handles.push(dev.onViewed(chan, player));
                dev_handles.push({ dispose: () => {
                    if (!chan.isClosed) chan.close(PlayerLeft);
                }});
            }
        });
        this.playerDisposables.set(player, dev_handles);
    }

    public leave(player: Server.Player): void {
        // Dispose of their stuff
        this.playerDisposables.get(player)?.forEach(d => d.dispose());
        // Remove player
        const idx = this.players.findIndex(p => p == player);
        this.players.splice(idx, 1);
        // Notify spectators
        this.watchingPlayers.forEach(watcher => {
            watcher.sendEvent(watcher.position.transfer);
        });
    }

    private updatePlayers() {
        this.players.forEach(p => p.sendEvent(this.transfer));
    }

    public get transfer(): Transfer.Position {
        return {
            typeid: 'Position',
            name: this.name, 
            space: this.space.name,
            players: this.visiblePlayers.map(p => p.transfer),
            routes: this.routes.map(r => r.partialTransfer), 
            devices: this.devices,
            aspectRatio: this.aspectRatio || 0
        };
    }

    public get partialTransfer(): Transfer.Position {
        return {
            typeid: 'Position',
            name: this.name,
            space: this.space.name,
            players: this.players.map(p => p.transfer),
            routes: [], devices: [], aspectRatio: 0
        };
    }

    // all positions that we can see
    public get visiblePositions(): Array<Server.Position> {
        return this.space.positions.filter(pos => !this.cover.includes(pos));
    }

    // all players we can see
    public get visiblePlayers(): Array<Server.Player> {
        return this.visiblePositions.flatMap(pos => pos.players);
    }

    // all positions that can see us
    public get watchingPositions(): Array<Server.Position> {
        return this.space.positions.filter(pos => !pos.cover.includes(this));
    }

    // all players that can see us
    public get watchingPlayers(): Array<Server.Player> {
        return this.watchingPositions.flatMap(pos => pos.players);
    }

    // Find all directly reachable players
    public get reachablePlayers(): Array<Server.Player> {
        return this.players.concat(this.routes.flatMap(pos => pos.players));
    }
}