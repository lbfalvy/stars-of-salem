import { TypedEvent } from "../shared/TypedEvent";
import { 
    AudioContext,
    addAudioWorkletModule,
    AudioWorkletNode,
    IAudioBuffer,
    AudioBufferSourceNode,
} from 'standardized-audio-context';
import { 
    addRecorderAudioWorkletModule, 
    createRecorderAudioWorkletNode, 
    IRecorderAudioWorkletNode
} from 'recorder-audio-worklet';

function asyncGetUserMedia(constraints:MediaStreamConstraints):Promise<MediaStream> {
    return new Promise((resolve, reject) => navigator.getUserMedia(constraints, resolve, reject));
}
function asyncDecodeData(context:AudioContext, buf:ArrayBuffer):Promise<IAudioBuffer> {
    return new Promise((resolve, reject) => context.decodeAudioData(buf, resolve, reject));
}

/**
 * Two way audio stream
 * - engage stream
 * - retrieve messageport
 * - set playback cb
 * - pause stream
 * - resume stream
 * - stop stream
 */

export class DuplexAudio {
    public get running():boolean {
        return this.context.state == 'running';
    }
    public get closed():boolean {
        return this.context.state == 'closed';
    }
    public get suspended():boolean {
        return this.context.state == 'suspended';
    }
    public currentlyPlaying = false;
    public readonly gotFrame = new TypedEvent<Float32Array>();
    public readonly source: AudioBufferSourceNode<AudioContext>;

    private backbuffer: IAudioBuffer | undefined;

    private constructor(private readonly context: AudioContext,
                        private readonly recNode: IRecorderAudioWorkletNode<AudioContext>,
                        private readonly stream: MediaStream) { // mic
        this.source = context.createBufferSource();
        this.source.connect(context.destination);
        const playback = context.createMediaStreamSource(stream);
        playback.connect(recNode);
    }

    public async playBuffer(value:ArrayBuffer):Promise<void> {
        const buf = await asyncDecodeData(this.context, value);
        this.backbuffer = buf; // Play this next
        if (!this.currentlyPlaying) {
            this.processBackbuffer();
        } 
    }

    private processBackbuffer() {
        const next = this.backbuffer;
        if (next == undefined) {
            this.currentlyPlaying = false;
            return;
        }
        this.currentlyPlaying = true;
        this.source.buffer = next;
        this.source.start();
        this.source.onended = () => {
            this.processBackbuffer();
        };
    }

    public async suspend():Promise<void> {
        if(this.running) {
            await this.context.suspend();
        }
    }

    public async resume():Promise<void> {
        if (this.suspended) {
            await this.context.resume();
        }
    }

    public async close():Promise<void> {
        if (!this.closed) {
            await this.suspend();
            this.recNode.stop();
            await this.context.close();
        }
    }

    public static async create():Promise<DuplexAudio> {
        // Check all dependencies
        if (!AudioWorkletNode || !addAudioWorkletModule) {
            throw new ReferenceError('audio worklets are unsupported in this browser');
        }
        // Create common deps
        const context = new AudioContext();
        // Create recorder
        await addRecorderAudioWorkletModule((url) => {
            if (addAudioWorkletModule === undefined) {
                throw 0; // Will never happen because we check above
            }
            return addAudioWorkletModule(context, url);
        });
        const stream = await asyncGetUserMedia({ audio: true });
        const recorder_node = await createRecorderAudioWorkletNode(AudioWorkletNode, context);
        const duplex = new DuplexAudio(context, recorder_node, stream);
        const record_channel = new MessageChannel();
        await duplex.recNode.record(record_channel.port1);
        record_channel.port2.onmessage = ev => duplex.gotFrame.emit(ev.data as Float32Array);
        return duplex;
    }
}