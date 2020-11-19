import { TypedEvent } from "../shared/TypedEvent";
import NoiseGateNode from 'noise-gate';

export default class AudIO {
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
    public readonly gotFrame = new TypedEvent<ArrayBuffer>();
    public readonly processor: ScriptProcessorNode;

    private readonly backbuffer = new Array<ArrayBuffer>();

    private constructor(private readonly context: AudioContext, stream: MediaStream, 
                        private readonly bufferSize:number) {
        const src = context.createMediaStreamSource(stream);
        this.processor = context.createScriptProcessor(bufferSize, 1, 1);
        this.processor.addEventListener('audioprocess', ev => {
            const floats = ev.inputBuffer.getChannelData(0);
            this.gotFrame.emit(floats.buffer.slice(floats.byteOffset, 
                                                   floats.byteOffset + floats.byteLength));
            const buf = this.backbuffer.pop();
            if (buf) {
                ev.outputBuffer.copyToChannel(new Float32Array(buf), 0, 0);
            }
        });
        const gate = new NoiseGateNode(context);
        src.connect(gate);
        gate.connect(this.processor);
        this.processor.connect(this.context.destination);
        this.startDataCallbacks();
    }

    public startDataCallbacks():void {
        this.context.resume();
    }

    public stopDataCallbacks():void {
        this.context.suspend();
    }

    public async playBuffer(value:ArrayBuffer):Promise<void> {
        this.backbuffer.unshift(value);
    }

    public static async create(sampleRate:number, bufferSize:number):Promise<AudIO> {
        // Create common deps
        const context = new AudioContext({ sampleRate });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const duplex = new AudIO(context, stream, bufferSize);
        
        return duplex;
    }
}