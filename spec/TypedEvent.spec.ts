import { TypedEvent } from "../src/shared/TypedEvent";

describe('A typed event object', function() {
    it('should resolve next when fired', async function() {
        const ev = new TypedEvent<number>();
        let result = 0;
        ev.next.then(n => result = n);
        ev.emit(14);
        expect(result).toBe(0);
        await ev.next;
        expect(result).toBe(14);
    });

    it('should call all handlers', async function() {
        const ev = new TypedEvent<void>();
        let callcnt = 0;
        ev.on(() => callcnt++);
        const handle = ev.on(() => callcnt++);
        ev.emit();
        await ev.next;
        expect(callcnt).toBe(2);
        handle.dispose();
        ev.emit();
        await ev.next;
        expect(callcnt).toBe(3);
    });
    it('should be running on a node version >= 11', function(){
        // This test is here to help when debugging issues with queueMicrotask and
        // immediate promise resolution
        const node_version = process.version.slice(1); // Snip off the 'v'
        const version_semver = node_version.split('.');
        const node_major = Number(version_semver[0]);
        expect(node_major).toBeGreaterThanOrEqual(11);
    });
});