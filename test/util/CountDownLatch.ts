export class CountDownLatch {
    private resolvePromise: () => void;
    private promise = new Promise<void>((resolve: () => void) => {
        this.resolvePromise = resolve;
    });

    constructor(private _count: number) {
        if (_count < 1) {
            throw new Error();
        }
    }

    countDown(): void {
        if (!this._count) {
            throw new Error();
        }
        this._count--;

        if (!this._count) {
            this.resolvePromise();
        }
    }

    get count(): number {
        return this._count;
    }

    async wait(): Promise<void> {
        return this.promise;
    }
}
