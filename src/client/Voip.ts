//import { MediaRecorder, IMediaRecorder } from "extendable-media-recorder";
import RawMediaRecorder from "raw-media-recorder";
import { copyArrayBuffer } from "../shared/arrayBuffer";
import { TypedEvent } from "../shared/TypedEvent";
import NoiseGateNode from 'noise-gate';

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
    public readonly gotFrame = new TypedEvent<ArrayBuffer>();
    public readonly processor: ScriptProcessorNode;

    private readonly backbuffer = new Array<ArrayBuffer>();
    private static readonly bufferSize = 8192;

    private constructor(private readonly context: AudioContext, stream: MediaStream) {
        /*this.recorder = new RawMediaRecorder(context, 1024);
        this.recorder.ondata = async (buf:AudioBuffer) => {
            const floats = buf.getChannelData(0);
            const new_ab = new ArrayBuffer(floats.byteLength);
            copyArrayBuffer(floats.buffer, floats.byteOffset, floats.byteLength, new_ab, 0);
            this.gotFrame.emit(new_ab);
        };*/
        const src = context.createMediaStreamSource(stream);
        this.processor = context.createScriptProcessor(DuplexAudio.bufferSize, 1, 1);
        this.processor.addEventListener('audioprocess', ev => {
            const floats = ev.inputBuffer.getChannelData(0);
            //const new_ab = new ArrayBuffer(floats.byteLength);
            //copyArrayBuffer(floats.buffer, floats.byteOffset, floats.byteLength, new_ab, 0);
            this.gotFrame.emit(floats.buffer.slice(floats.byteOffset, 
                                                   floats.byteOffset + floats.byteLength));
            const buf = this.backbuffer.pop();
            if (buf) {
                ev.outputBuffer.copyToChannel(new Float32Array(buf), 0, 0);
            }
        });
        /*const filter = this.context.createBiquadFilter();
        src.connect(filter);
        filter.type = 'highpass';
        filter.frequency.value = 100;
        const filter2 = this.context.createBiquadFilter();
        filter2.type = 'lowpass';
        filter2.frequency.value = 480;
        filter.connect(filter2);
        filter2.connect(this.processor);*/
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

    public static async create():Promise<DuplexAudio> {
        // Create common deps
        const context = new AudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const duplex = new DuplexAudio(context, stream);
        
        return duplex;
    }
}