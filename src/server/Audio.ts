import { TypedEvent } from "../shared/TypedEvent";
import { Worker, MessageChannel, MessagePort } from 'worker_threads';

/*
TODO: non-listen clients, some degree of caching
- Allow for environmental sounds like background music or machine noise
- Allow for temporary sounds like an alarm or the opening of a door
*/

function worker_function(): void {
    // We need this to make sure the module gets into the worker
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const worker_threads = require('worker_threads');
    console.debug('The audio worker_thread is working');
    let sample_count: number | undefined;
    let sample_rate: number | undefined;
    let interval_handle: ReturnType<typeof setInterval> | undefined;
    interface Client {
        spaces: Set<Space>
        port: MessagePort
        samples: Float32Array
        volume: number
        paused: boolean
    }
    interface Space {
        name: string
        clients: Set<Client>
    }
    const state = {
        spacesByName: new Map<string, Space>(),
        allClients: new Set<Client>()
    };

    const handleBuffer = (client: Client, samples: Float32Array): void => {
        if (samples.length != sample_count) throw new Error('bad sample count');
        client.samples = samples;
    };

    const processCommand = (client: Client, cmd: any): void => {
        if (cmd == 'close') {
            processCommand(client, { leaveSpaces: client.spaces });
            state.allClients.delete(client);
            client.port.close();
            return;
        }
        if (typeof cmd.paused == 'boolean') client.paused = cmd.paused;
        if (cmd.leaveSpaces instanceof Array) {
            const leaveSpaces: Array<string> = cmd.leaveSpaces;
            for (const space_name of leaveSpaces) {
                const space = state.spacesByName.get(space_name);
                if (!space) return;
                space.clients.delete(client);
                client.spaces.delete(space);
                if (space.clients.size == 0) state.spacesByName.delete(space_name);
            }
        }
        if (cmd.enterSpaces instanceof Array) {
            const enterSpaces: Array<string> = cmd.enterSpaces;
            for (const space_name of enterSpaces) {
                let space = state.spacesByName.get(space_name);
                if (!space) {
                    space = {
                        name: space_name,
                        clients: new Set([client])
                    };
                    state.spacesByName.set(space_name, space);
                }
                space.clients.add(client);
                client.spaces.add(space);
            }
        }
        if (typeof cmd.setVolume == 'number') client.volume = cmd.setVolume;
    };

    worker_threads.parentPort.on('message', (port_or_initconf: any) => {
        if (port_or_initconf instanceof worker_threads.MessagePort) {
            if (!sample_count) throw new Error('Specify the sample count before registering clients');
            const client: Client = {
                spaces: new Set(),
                port: port_or_initconf,
                samples: new Float32Array(sample_count),
                volume: 1,
                paused: false
            };
            state.allClients.add(client);
            client.port.on('message', samples_or_command => {
                if (samples_or_command instanceof Float32Array) {
                    handleBuffer(client, samples_or_command);
                } else processCommand(client, samples_or_command);
            });
            return;
        }
        sample_count = port_or_initconf.sampleCount || sample_count;
        sample_rate = port_or_initconf.sampleRate || sample_rate;
        // If either was updated and both have a value, (re)start the interval
        if ((port_or_initconf.sampleRate || port_or_initconf.sampleCount)
            && (sample_rate && sample_count)) {
            run_interval(sample_rate, sample_count);
        }
    });

    function run_interval(sample_rate: number, sample_count: number) {
        if (interval_handle) clearInterval(interval_handle);
        const MESSAGES_PER_SECOND = sample_rate / sample_count;
        interval_handle = setInterval(() => {
            for(const client of state.allClients) {
                if (client.paused) continue;
                // We define the AB separately so the buffer fits the array perfectly
                // and the recipient doesn't have to slice before sending.
                const ab = new ArrayBuffer(sample_count * 4);
                const samples = new Float32Array(ab);
                // This is so that we don't count clients twice
                const peers = new Set<Client>();
                client.spaces.forEach(s => s.clients.forEach(peer => peers.add(peer)));
                // To produce everything a client hears
                for (const peer of peers) {
                    // Add every tag's voice into the total
                    for (let i = 0; i < sample_count; i++) {
                        samples[i] += (peer.samples[i] || 0) * peer.volume;
                        // The logical operator above is to ensure that range errors resulting from
                        // sample count changes will introduce a line of zeroes which will only be
                        // an audible click click rather than NaN-s which coould break the client.
                    }
                }
                client.port.postMessage(samples, [samples.buffer]);
            }
        }, 1000 / MESSAGES_PER_SECOND);
    }
}

const worker_text = '(' + worker_function.toString() + ')()';
const audio_worker = new Worker(worker_text, {eval:true});
// Note that this is a Node.js worker, which is slightly different from
// browser workers in every way.

export default class AudioImpl {
    private static sampleRate: number | undefined;
    private static sampleCount: number | undefined;
    private readonly port: MessagePort;
    public readonly output = new TypedEvent<Float32Array>();
    public readonly spaces = new Set<string>();
    private _volume = 1;

    public constructor() {
        if (!AudioImpl.sampleCount || !AudioImpl.sampleRate) throw new Error('Set the sample properties before registering a client');
        const chan = new MessageChannel();
        audio_worker.postMessage(chan.port1, [chan.port1]);
        this.port = chan.port2;
        this.handleOutput = this.handleOutput.bind(this);
        this.port.on('message', this.handleOutput);
    }

    private handleOutput(data: any) {
        if (data instanceof Float32Array) this.output.emit(data);
    }

    public input(samples: Float32Array): void {
        if (samples.length != AudioImpl.sampleCount) throw new RangeError('Bad sample count!');
        this.port.postMessage(samples, [samples.buffer]);
    }

    public enterSpaces(spaces: Array<string>): void {
        spaces.forEach(s => this.spaces.add(s));
        this.port.postMessage({ enterSpaces: spaces });
    }

    public leaveSpaces(spaces: Array<string>): void {
        spaces.forEach(s => this.spaces.delete(s));
        this.port.postMessage({ leaveSpaces: spaces });
    }

    public set volume(vol: number) {
        this._volume = vol;
        this.port.postMessage({ setVolume: vol });
    }

    public get volume(): number {
        return this._volume;
    }

    public static setSampleRate(sampleRate: number): void {
        AudioImpl.sampleRate = sampleRate;
        audio_worker.postMessage({ sampleRate });
    }
    public static setSampleCount(sampleCount: number): void {
        AudioImpl.sampleCount = sampleCount;
        audio_worker.postMessage({ sampleCount });
    }
    public static setProperties(sampleRate: number, sampleCount: number): void {
        AudioImpl.sampleRate = sampleRate;
        AudioImpl.sampleCount = sampleCount;
        audio_worker.postMessage({ sampleRate, sampleCount });
    }
    public pause(state: boolean): void {
        this.port.off('message', this.handleOutput);
        if (state) this.port.on('message', this.handleOutput);
        this.port.postMessage({ pause: state });
    }
}