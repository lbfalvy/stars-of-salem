declare var currentFrame: number;
declare var currentTime: number;
declare var sampleRate: number;

class VoipAudioProcessor extends AudioWorkletProcessor {
    private late?: {
        readonly sampleRate: number,
        readonly bufferSize: number,
        recBuffer: Float32Array,
    } = undefined;

    private playBuffer = new Array<Float32Array>();
    private playIndex = 0;
    private lastInputFrame = 0;
    private lastPlayedFrame = 0;
    private inputTime = 0;
    private recordTime = 0;
    private recordIndex = 0;
    private outputTime = 0;
    private playTime = 0;

    public constructor(options?:AudioWorkletNodeOptions) {
        super(options);
        this.port.addEventListener('message', ev => {
            if (typeof ev.data.sampleRate == 'number' && typeof ev.data.bufferSize == 'number') {
                this.late = {
                    sampleRate: ev.data.sampleRate,
                    bufferSize: ev.data.bufferSize,
                    recBuffer: new Float32Array(ev.data.bufferSize)
                };
            } else throw new RangeError();
            this.port.addEventListener('message', ev => {
                this.playBuffer.push(ev.data);
            });
            this.port.postMessage('start');
        }, { once: true })
    }

    public process(inputs: Float32Array[][], outputs: Float32Array[][],
                   parameters: Record<string, Float32Array>): boolean {
        if (!this.late) return false;
        const sampleLength = 1 / this.late.sampleRate;
        const localSampleLength = 1 / sampleRate;
        const input = inputs[0][0];
        for (let i = 0; i < input.length; i++) {
            this.inputTime += localSampleLength;
            while (this.recordTime < this.inputTime + localSampleLength) {
                this.recordIndex++;
                this.recordTime += sampleLength;
                const ratio = (this.recordTime - this.inputTime) / localSampleLength; 
                const sample = lerp(this.lastInputFrame, input[i], ratio);
                this.late.recBuffer[this.recordIndex] = sample;
                if (this.recordIndex == this.late.bufferSize) {
                    this.port.postMessage(this.late.recBuffer);
                    this.late.recBuffer = new Float32Array(this.late.bufferSize);
                    this.recordIndex = 0;
                }
            }
            this.lastInputFrame = input[i];
        }
        // Mod by a second to improve float accuracy
        if (1 < this.recordTime && 1 < this.inputTime) {
            this.inputTime -= 1;
            this.recordTime -= 1;
        }
        if (!this.playBuffer[0]) return true;
        const output = outputs[0][0];
        let i = 0;
        for (let i = 0; i < output.length; i++) {
            this.outputTime += localSampleLength;
            while (this.playTime + sampleLength < this.outputTime) {
                this.playTime += sampleLength;
                this.playIndex ++;
            }
            while (this.late.bufferSize < this.playIndex) {
                this.playIndex -= this.late.bufferSize;
                this.playBuffer.shift();
                if (!this.playBuffer[0]) return true;
            }
            const ratio = (this.outputTime - this.playTime) / sampleLength;
            const sample = lerp(this.lastPlayedFrame, this.playBuffer[0][i], ratio);
            output[i] = sample;
            this.lastPlayedFrame = this.playBuffer[0][i];
        }
        return true;
    }
}

registerProcessor('voip-processor', VoipAudioProcessor);

function lerp(a: number, b: number, x: number) {
    return a + (b - a) * x;
}