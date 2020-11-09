import { copyArrayBuffer } from "../src/shared/arrayBuffer";

describe("Helper methods for arraybuffer manipulation", function () {
    describe("copy_arraybuffer", function () {
        it("should work in the trivial case", function () {
            const src = new ArrayBuffer(17);
            const dv = new DataView(src);
            const really_big_value = BigInt(0xfffffffffffffff);
            dv.setBigUint64(0, BigInt(1234));
            dv.setBigUint64(8, really_big_value);
            dv.setUint8(16, 4);
            const tgt = new ArrayBuffer(17);
            copyArrayBuffer(src, 0, 17, tgt, 0);
            const dv2 = new DataView(tgt);
            dv2.getBigUint64(0) == BigInt(1234);
            dv2.getBigUint64(8) == really_big_value;
            dv2.getUint8(16) == 4;
        });

        it("should work in the less trivial case", function () {
            const src = new ArrayBuffer(21);
            const dv = new DataView(src);
            const really_big_value = BigInt(0xfffffffffffffff);
            dv.setBigUint64(2, BigInt(1234));
            dv.setBigUint64(10, really_big_value);
            dv.setUint8(18, 4);
            const tgt = new ArrayBuffer(35);
            copyArrayBuffer(src, 2, 17, tgt, 5);
            const dv2 = new DataView(tgt);
            dv2.getBigUint64(5) == BigInt(1234);
            dv2.getBigUint64(13) == really_big_value;
            dv2.getUint8(21) == 4;
        });

        it("should function even with an empty buffer", function(){
            const src = new ArrayBuffer(0);
            const tgt = new ArrayBuffer(0);
            copyArrayBuffer(src, 0, 0, tgt, 0);
        });
    });
});