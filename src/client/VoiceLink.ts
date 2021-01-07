import { ConnectionClosedError } from "../shared/connection";
import AudIO from "./AudIO";

export default class VoiceLink {
    private terminated = false;
    private readonly uplinkHandle: Disposable;
    private readonly downlinkHandle: Disposable;
    private constructor(private readonly connection: Net.Connection, private readonly io: AudIO) {
        // This handler is queued basically every round, so it will likely run once or twice
        // before the 'closed' promise is resolved. To prevent an application crash in this event,
        // we replace it with an extra call to dispose() which is repeatable
        this.uplinkHandle = io.gotFrame.on(blob => {
            try {
                connection.send(blob);
            } catch(ex) {
                if (ex instanceof ConnectionClosedError) this.dispose();
            }
        });
        this.downlinkHandle = connection.message.on(msg => {
            if (typeof msg == 'string') throw new Error('String on voice channel');
            this.io.playBuffer(msg);
        });
        connection.closed.then(() => this.dispose());
    }

    public static async create(channel: Net.Connection): Promise<VoiceLink> {
        const props = await channel.message.next;
        if (typeof props !== 'string') throw new Error('Didn\'t receive voice channel properties');
        const { sampleRate, bufferSize } = JSON.parse(props);
        console.debug('Voice channel properties (sr bs):', sampleRate, bufferSize);
        const io = await AudIO.create(sampleRate, bufferSize);
        return new VoiceLink(channel, io);
    }

    // NOTICE: this function has to be repeatable for the above hack to work.
    public dispose(): void {
        if (this.terminated) return;
        this.downlinkHandle.dispose();
        this.uplinkHandle.dispose();
        this.io.dispose();
        this.connection.terminate();
        this.terminated = true;
    }
}