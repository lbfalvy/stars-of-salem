/**
 * Copies an arraybuffer in 8 byte batches.
 * @param from source arraybuffer
 * @param start offset in source
 * @param length length of copied section in bytes
 * @param to target arraybuffer
 * @param offset offset in target
 */
export function copy_arraybuffer(from: ArrayBuffer, start: number, length: number, to: ArrayBuffer,
                                 offset: number): void {
    /* The next line casts the three arguments to integer by executing a bitwise operation.
    This optimization was standardised as part of the (now obsolete) asm.js specification.
    Although not all browsers support it, it can still be a performance improvement.*/
    [start, length, offset] = [start | 0, length | 0, offset | 0];
    const source_view = new DataView(from);
    const target_view = new DataView(to);
    // Precomputing these allows us to do less computation per round
    const relative_offset = offset - start;
    const end = start + length;
    while (end - start > 8) {
        target_view.setBigUint64(start + relative_offset, source_view.getBigUint64(start));
        start += 8;
    }
    if (end - start > 4) {
        target_view.setUint32(start + relative_offset, source_view.getUint32(start));
        start += 4;
    }
    if (end - start > 2) {
        target_view.setUint16(start + relative_offset, source_view.getUint16(start));
        start += 2;
    }
    if (end - start > 1) {
        target_view.setUint8(start + relative_offset, source_view.getUint8(start));
    }
}

export function compose(words: Array<number>): ArrayBuffer {
    const message = new ArrayBuffer(words.length * 2);
    const view = new DataView(message);
    words.forEach((value, index) => view.setUint16(index * 2, value));
    return message;
}

export function buffer_to_arraybuffer(buffer: Uint8Array): ArrayBuffer {
    let data: ArrayBuffer;
    if (buffer.byteLength == buffer.buffer.byteLength) {
        data = buffer.buffer;
    } else {
        data = new ArrayBuffer(buffer.byteLength);
        copy_arraybuffer(buffer.buffer, buffer.byteOffset, buffer.byteLength, data, 0);
    }
    return data;
}

export function buffer_array_to_arraybuffer(buf: Buffer[]): ArrayBuffer {
    // Sum of the individual byteLengths
    const total_length = buf.reduce((total, next) => total + next.byteLength, 0);
    const result = new ArrayBuffer(total_length);
    // Copy each AB to the common one.
    buf.reduce((offset, next) => {
        copy_arraybuffer(next.buffer, next.byteOffset, next.byteLength, result, offset);
        return offset + next.byteLength;
    }, 0);
    return result;
}