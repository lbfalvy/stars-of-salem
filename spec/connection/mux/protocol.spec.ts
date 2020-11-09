import { 
    buildChannelReply, buildCloseMsg, buildCreateChannel, buildEmptyCloseMsg, CLOSE_MSG_OFFSET, 
    getCloseCode, getCreateChannelId, hasContent, isChannelReplyAccepted, isChannelReplyFor,
    isClientMessage, isClose, isControlPacket,
    isCreateChannel, isRelevant
} from "../../../src/shared/connection/multiplexer/Protocol";

describe('Functions that deal with arraybuffers', function(){
    describe('build and recognize CreateChannel messages', function(){
        let v:DataView;
        beforeEach(function(){
            const b:ArrayBuffer = buildCreateChannel(14);
            v = new DataView(b);
        });
        it('should recognize as a createChannel with ID 14', function(){
            expect(isRelevant(v)).toBeTrue();
            expect(isControlPacket(v)).toBeTrue();
            expect(isCreateChannel(v)).toBeTrue();
            expect(getCreateChannelId(v)).toEqual(14);
        });
    });

    describe('build and recognize ChannelReply messages', function(){
        let v:DataView;
        beforeAll(function(){
            const b = buildChannelReply(true, 14);
            v = new DataView(b);
        });
        it('should recognize as an accepted channel reply for client 14', function(){
            expect(isRelevant(v)).toBeTrue();
            expect(isControlPacket(v)).toBeTrue();
            expect(isChannelReplyFor(14, v)).toBeTrue();
            expect(isChannelReplyFor(7, v)).toBeFalse();
            expect(isChannelReplyAccepted(v)).toBeTrue();
        });
        it('should recognize rejection', function(){
            const reply = new DataView(buildChannelReply(false, 14));
            expect(isChannelReplyAccepted(reply)).toBeFalse();
        });
    });

    describe('build and recognize close messages', function(){
        it('should build and recognize empty close messages', function(){
            const msg = new DataView(buildEmptyCloseMsg(14));
            expect(isClientMessage(msg, 14)).toBeTrue();
            expect(isClose(msg)).toBeTrue();
            expect(hasContent(msg)).toBeFalse();
        });
        let msg:ArrayBuffer;
        let msg_view:DataView;
        beforeAll(function(){
            const reason = new ArrayBuffer(2);
            const reason_view = new DataView(reason);
            reason_view.setUint16(0, 24);
            msg = buildCloseMsg(14, 3014, reason);
            msg_view = new DataView(msg);
        });
        it('should recognize as a close message for channel 14 with code 3014', function(){
            expect(isRelevant(msg_view)).toBeTrue();
            expect(isClientMessage(msg_view, 14)).toBeTrue();
            expect(isClose(msg_view)).toBeTrue();
            expect(hasContent(msg_view)).toBeTrue();
            expect(getCloseCode(msg_view) == 3014).toBeTrue();
        });
        it('should contain the reason', function(){
            const reason = new DataView(msg, CLOSE_MSG_OFFSET);
            expect(reason.byteLength).toBe(2); // Message length preserved
            expect(reason.getUint16(0)).toBe(24); // Message content preserved
        });
    });

});