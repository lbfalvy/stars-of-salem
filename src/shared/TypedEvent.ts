type Listener<T> = (event: T) => unknown;

export interface Disposable {
    dispose(): void;
}

export interface TypedEventSource<T> {
    on(listener:Listener<T>):Disposable;
    readonly next:Promise<T>;
    pipe<K>(te:TypedEvent<K>, transform: (x:T) => K):Disposable;
    pipeRaw(te:TypedEvent<T>):Disposable;
}

/** passes through events as they happen. You will not get events from before you start listening */
export class TypedEvent<T> implements TypedEventSource<T> {
    private readonly listeners: Listener<T>[] = [];
    private listenersOncer: Listener<T>[] = [];

    public on(listener: Listener<T>): Disposable {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const callbackIndex = this.listeners.indexOf(listener);
                if (callbackIndex > -1) {
                    this.listeners.splice(callbackIndex, 1);
                }
            }
        };
    }

    public get next(): Promise<T> {
        return new Promise(res => {
            this.listenersOncer.push(ev => res(ev));
        });
    }

    private runHandler(listener:Listener<T>, event:T) {
        listener(event);
    }

    public emit(event: T): void {
        // Collective delay to prevent unpredictable function runtimes.
        queueMicrotask(() => {
            /** Update any general listeners */
            this.listeners.forEach((listener) => this.runHandler(listener, event));

            /** Clear the `once` queue */
            if (this.listenersOncer.length > 0) {
                const toCall = this.listenersOncer;
                this.listenersOncer = [];
                toCall.forEach((listener) => this.runHandler(listener, event));
            }
        });
    }

    public pipeRaw(te: TypedEvent<T>): Disposable {
        return this.on((e) => te.emit(e));
    }

    public pipe<K>(te: TypedEvent<K>, transform: (x: T) => K): Disposable {
        return this.on((e) => te.emit(transform(e)));
    }
}

// The following appears in this file because it's mainly used to represent events
// that happen only once.

export type ExposedPromise<T> = Promise<T> & { 
    resolve: (arg:T) => void
    reject: (arg:any) => void
};
export function exposeResolve<T>():ExposedPromise<T> {
    let res!:(arg:T)=>void;
    let rej!:(arg:any)=>void;
    const p = new Promise<T>((resolve, reject) => {
        res = resolve;
        rej = reject;
    });
    return Object.assign(p, {resolve:res, reject:rej});
}
export function isExposed<T>(p:Promise<T>): p is ExposedPromise<T> {
    return 'resolve' in p;
}