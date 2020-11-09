import { copyArrayBuffer } from "../../arrayBuffer";

export const MAGIC_WORD = 0xBEEF;

export const CONTROL_PACKET = 0xffff;
export const CREATE_CHANNEL = 0;
export const REJECTED = 1;
export const APPROVED = 2;
export const CONTENT_STRING = 0;
export const CONTENT_BINARY = 1;
export const END_OF_TRANSMISSION = 2;

export function isRelevant(v: DataView): boolean {
    return v.getUint16(0) == MAGIC_WORD;
}

// ==================
// ===== Server =====
// ==================

// Control packets
export function isControlPacket(view: DataView): boolean {
    return view.getUint16(2) == CONTROL_PACKET;
}
export function writeControlHeader(view: DataView): void {
    view.setUint16(0, MAGIC_WORD);
    view.setUint16(2, CONTROL_PACKET);
}

// Create channel <id>
export function buildCreateChannel(id: number): ArrayBuffer {
    const frame = new ArrayBuffer(8);
    const view = new DataView(frame);
    writeControlHeader(view);
    view.setUint16(4, CREATE_CHANNEL);
    view.setUint16(6, id);
    return frame;
}
export function isCreateChannel(view: DataView): boolean {
    return isControlPacket(view)
        && view.getUint16(4) == CREATE_CHANNEL;
}
export function getCreateChannelId(view: DataView): number {
    return view.getUint16(6);
}

// Channel reply <id, approved>
export function buildChannelReply(approved: boolean, id: number): ArrayBuffer {
    const frame = new ArrayBuffer(8);
    const view = new DataView(frame);
    writeControlHeader(view);
    view.setUint16(4, approved ? APPROVED : REJECTED);
    view.setUint16(6, id);
    return frame;
}
export function isChannelReplyFor(id: number, view: DataView): boolean {
    return isControlPacket(view)
        && [APPROVED, REJECTED].includes(view.getUint16(4))
        && view.getUint16(6) == id;
}
export function isChannelReplyAccepted(view: DataView): boolean {
    return view.getUint16(4) == APPROVED;
}

// ==================
// ===== Client =====
// ==================

export function isClientMessage(view: DataView, id: number): boolean {
    return isRelevant(view) && view.getUint16(2) == id;
}
export function writeClientHeader(view: DataView, id: number): void {
    view.setUint16(0, MAGIC_WORD);
    view.setUint16(2, id);
}

// Close <[code, message]?>
export function isClose(view: DataView): boolean {
    return view.getUint8(4) == END_OF_TRANSMISSION;
}
export function hasContent(view: DataView): boolean {
    return view.byteLength > HEAD_LEN;
}
export function getCloseCode(view: DataView): number {
    return view.getUint16(HEAD_LEN);
}
export function writeCloseHeader(view: DataView, id: number, code?: number | undefined): void {
    writeClientHeader(view, id);
    view.setUint8(4, END_OF_TRANSMISSION);
    if (code !== undefined) {
        view.setUint16(HEAD_LEN, code);
    }
}
export function buildCloseMsg(id: number, code: number, reason: ArrayBuffer): ArrayBuffer {
    const frame = new ArrayBuffer(CLOSE_MSG_OFFSET + reason.byteLength);
    const v = new DataView(frame);
    writeCloseHeader(v, id, code);
    copyArrayBuffer(reason, 0, reason.byteLength, frame, CLOSE_MSG_OFFSET);
    return frame;
}
export function buildEmptyCloseMsg(id: number): ArrayBuffer {
    const frame = new ArrayBuffer(HEAD_LEN);
    const v = new DataView(frame);
    writeCloseHeader(v, id);
    return frame;
}
export const CLOSE_MSG_OFFSET = 7;

// Message <data:string|ArrayBuffer> (but we won't decode it)
export function isTypeString(view: DataView): boolean {
    return view.getUint8(4) == CONTENT_STRING;
}
export const HEAD_LEN = 5;
export function writeStringHeader(id: number, view: DataView): void {
    writeClientHeader(view, id);
    view.setUint8(4, CONTENT_STRING);
}
export function writeBinaryHeader(id: number, view: DataView): void {
    writeClientHeader(view, id);
    view.setUint8(4, CONTENT_BINARY);
}
export function writeBinaryMsg(id: number, msg: ArrayBuffer): ArrayBuffer {
    const buf = new ArrayBuffer(HEAD_LEN + msg.byteLength);
    const v = new DataView(buf);
    writeBinaryHeader(id, v);
    copyArrayBuffer(msg, 0, msg.byteLength, buf, HEAD_LEN);
    return buf;
}
export function getBinaryData(msg: ArrayBuffer): ArrayBuffer {
    return msg.slice(HEAD_LEN);
}