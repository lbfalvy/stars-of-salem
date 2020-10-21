export const MAGIC_WORD = 0xBEEF;

export const CONTROL_PACKET = 0xffff;
export const CREATE_CHANNEL = 0;
export const REJECTED = 1;
export const APPROVED = 2;
export const CONTENT_STRING = 0;
export const CONTENT_BINARY = 1;
export const END_OF_TRANSMISSION = 2;
export const CONTROL_HEADER = [MAGIC_WORD, CONTROL_PACKET];