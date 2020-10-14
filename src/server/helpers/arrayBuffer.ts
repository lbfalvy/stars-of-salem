import { TextDecoder, TextEncoder } from "util";

/**
 * Copies an arraybuffer in 8 byte batches.
 * @param from source arraybuffer
 * @param start offset in source
 * @param length length of copied section in bytes
 * @param to target arraybuffer
 * @param offset offset in target
 */
export function copy_arraybuffer( from:ArrayBuffer, start:number, length:number, to:ArrayBuffer,
                           offset:number ) {
    [start, length, offset] = [start|0, length|0, offset|0]; // asmjs-like argument type check.
    var source_view = new DataView(from);
    var target_view = new DataView(to);
    // Precomputing these allows us to do less computation per round
    var relative_offset = offset - start; 
    var end = start + length;
    while (end - start > 8) {
        target_view.setBigUint64(start+relative_offset, source_view.getBigUint64(start));
        start += 8;
    }
    if (end - start > 4) {
        target_view.setUint32(start+relative_offset, source_view.getUint32(start));
        start += 4;
    }
    if (end - start > 2) {
        target_view.setUint16(start+relative_offset, source_view.getUint16(start));
        start += 2;
    }
    if (end - start > 1) target_view.setUint8(start+relative_offset, source_view.getUint8(start));
}

export const encoder = new TextEncoder();
export const decoder = new TextDecoder('utf-8');

export function compose( words:Array<number> ):ArrayBuffer {
    var message = new ArrayBuffer(words.length*2);
    var view = new DataView(message);
    words.forEach((value, index) => view.setUint16(index*2, value));
    return message;
}