import { TypedEvent } from "../shared/TypedEvent";
import NoiseGateNode from 'noise-gate';

export default class AudIO {
    public get running(): boolean {
        return this.context.state == 'running';
    }
    public get closed(): boolean {
        return this.context.state == 'closed';
    }
    public get suspended(): boolean {
        return this.context.state == 'suspended';
    }
    public currentlyPlaying = false;
    public readonly gotFrame = new TypedEvent<ArrayBuffer>();

    private readonly backbuffer = new Array<ArrayBuffer>();

    private constructor(private readonly context: AudioContext,
                        private readonly stream: MediaStream,
                        private readonly voipNode: AudioWorkletNode) {
        const src = context.createMediaStreamSource(stream);
        voipNode.port.onmessage = (ev: { data: Float32Array }) => {
            this.gotFrame.emit(ev.data.buffer.slice(ev.data.byteOffset,
                ev.data.byteOffset + ev.data.byteLength));
        }
        const gate = new NoiseGateNode(context);
        src.connect(gate);
        gate.connect(voipNode);
        voipNode.connect(this.context.destination);
        this.startDataCallbacks();
    }

    public startDataCallbacks(): void {
        this.context.resume();
    }

    public stopDataCallbacks(): void {
        this.context.suspend();
    }

    public dispose(): void {
        this.context.close();
        this.stream.getAudioTracks().forEach(track => track.stop());
    }

    public async playBuffer(value: ArrayBuffer): Promise<void> {
        if (this.closed) {
            console.error('Playing buffers on a closed connection');
            throw new MediaError();
        }
        const floats = new Float32Array(value);
        this.voipNode.port.postMessage(floats, [floats, value]);
    }

    public static async create(sampleRate: number, bufferSize: number): Promise<AudIO> {
        const context = new AudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: {
            echoCancellation: true,
            noiseSuppression: true,
        } });
        await context.audioWorklet.addModule('/audio.js');
        const voipNode = new AudioWorkletNode(context, 'voip-processor');
        voipNode.port.postMessage({ sampleRate, bufferSize });
        await new Promise(res => voipNode.port.addEventListener('message', res, { once: true }));
        const duplex = new AudIO(context, stream, voipNode);
        return duplex;
    }
}
