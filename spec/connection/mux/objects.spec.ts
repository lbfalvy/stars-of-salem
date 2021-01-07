import * as Mux from '../../../src/shared/connection/multiplexer';
import { doesHandleClosing, doesHandleTermination, doesKeepClientList, doesRelayArrayBuffers, doesRelayStrings } from '../generic_tests';
import { bufferToArrayBuffer } from '../../../src/shared/arrayBuffer';
import { MockConnection } from '../../helpers/MockConnection';

describe('Multiplexer', function () {
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();
    const channel_deps: Mux.Channel.ChannelDependencies = {
        decode: (ab, offset, length) => decoder.decode(new Uint8Array(ab, offset, length)),
        encode: (string) => bufferToArrayBuffer(encoder.encode(string))
    };
    

    describe('should act like a normal connection', function () {
        const host_deps: Mux.Host.Dependencies = {
            channelFactory: () => {
                fail('This multiplexer shouldn\'t create channels');
                throw new Error();
            }
        };
        let c1!: Mux.Host.Host;
        let c2!: Mux.Host.Host;
        beforeEach(function() {
            const [m1, m2] = MockConnection.getPair();
            c1 = new Mux.Host.Host(m1, host_deps);
            c2 = new Mux.Host.Host(m2, host_deps);
        });
        // c1/2 need to be evaluated late.
        it('should relay strings', () => doesRelayStrings(c1, c2)());
        it('should relay arraybuffers', () => doesRelayArrayBuffers(c1, c2)());
        it('should handle closing', () => doesHandleClosing(c1, c2)());
        it('should handle termination', () => doesHandleTermination(c1, c2)());
    });

    describe('should create channels that act like a normal connection', function () {
        const host_deps: Mux.Host.Dependencies = {
            channelFactory: (c, id) => new Mux.Channel.Channel(c, id, channel_deps)
        };
        let c1: Net.Connection;
        let c2: Net.Connection;
        beforeEach(function(done) {
            const [m1, m2] = MockConnection.getPair();
            const h1 = new Mux.Host.Host(m1, host_deps);
            const h2 = new Mux.Host.Host(m2, host_deps);
            // In whatever order they resolve, map the results to the connection and finish
            Promise.all([
                h1.createChannel(12),
                h2.connection.next
            ]).then(([chan1, chan2]) => {
                c1 = chan1;
                c2 = chan2;
                done();
            });
        });
        // c1/2 need to be evaluated late.
        it('should relay strings', () => doesRelayStrings(c1, c2)());
        it('should relay arraybuffers', () => doesRelayArrayBuffers(c1, c2)());
        it('should handle closing', () => doesHandleClosing(c1, c2)());
        it('should handle termination', () => doesHandleTermination(c1, c2)());
    });

    it('should keep an up-to-date list of clients', async function () {
        const [m1, m2] = MockConnection.getPair();
        const host_deps: Mux.Host.Dependencies = {
            channelFactory: (c, id) => new Mux.Channel.Channel(c, id, channel_deps)
        };
        const h1 = new Mux.Host.Host(m1, host_deps);
        const h2 = new Mux.Host.Host(m2, host_deps);
        await Promise.all([
            doesKeepClientList(h2, () => h1.createChannel(14)),
            doesKeepClientList(h1, () => h1.createChannel(14))
        ]);
    });
});