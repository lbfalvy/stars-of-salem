import { MockConnection } from '../helpers/MockConnection';
import { doesHandleClosing, doesHandleTermination, doesRelayArrayBuffers, doesRelayStrings } from "./generic_tests";

describe('Connection mock', function () {
    describe('should pass all the tests that a normal connection would', function () {
        let c1: Net.Connection;
        let c2: Net.Connection;

        beforeEach(function(){
            [c1, c2] = MockConnection.getPair();
        });
        
        // c1/2 need to be evaluated late.
        it('should relay strings', () => doesRelayStrings(c1, c2)());
        it('should relay arraybuffers', () => doesRelayArrayBuffers(c1, c2)());
        it('should handle closing', () => doesHandleClosing(c1, c2)());
        it('should handle termination', () => doesHandleTermination(c1, c2)());
    });
});