class Observer<T> {

    private _isUnsubscribed: boolean;
    public _unsubscribe: () => void;

    constructor(
        private _next?: (value: T) => void,
        private _error?: <E extends Error> (error: E) => void,
        private _complete?: () => void
    ) {
        this._isUnsubscribed = false;
        this._unsubscribe = () => { };
    }

    next(value: T): void {
        if (!this._isUnsubscribed && this._next) {
            this._next(value);
        }
    }

    error<E extends Error>(error: E): void {
        if (!this._isUnsubscribed) {
            if (this._error) {
                this._error(error);
            }
            this.unsubscribe();
        }
    }

    complete(): void {
        if (!this._isUnsubscribed) {
            if (this._complete) {
                this._complete();
            }
            this.unsubscribe();
        }
    }

    unsubscribe(): void {
        if (!this._isUnsubscribed) {
            this._isUnsubscribed = true;
            this._unsubscribe();
        }
    }
}

class Observable<T> {
    private constructor(private _subscribe: (observer: Observer<T>) => Subscription) {}

    static from<T>(...values: T[]): Observable<T> {
        return new Observable((observer: Observer<T>) => {
            values.forEach((value) => {observer.next(value)});
            observer.complete();
            return new Subscription();
        });
    }

    static interval(ms: number): Observable<number> {
        return new Observable((observer: Observer<number>) => {
            let i = 0;
            const handle = setInterval(() => {observer.next(i += 1)}, ms);
            return new Subscription(() => {clearInterval(handle)});
        });
    }

    map<U>(f: (value: T) => U): Observable<U> {
        const self = this;
        return new Observable((observer: Observer<U>) => {
            const subscription = self.subscribe(
                (value: T) => {observer.next(f(value))},
                <E extends Error>(error: E) => {observer.error(error)},
                () => {observer.complete()}
            );
            return subscription;
        });
    }

    subscribe(
        next?: (value: T) => void,
        error?: <E extends Error> (error: E) => void,
        complete?: () => void
    ): Subscription {
        const self = this;
        const observer = new Observer(next, error, complete);
        const subscription = self._subscribe(observer);
        observer._unsubscribe = () => {subscription.unsubscribe()};
        return new Subscription(() => {observer.unsubscribe()});
    }
}

class Subscription {
    constructor(private _unsubscribe?: () => void) {}

    unsubscribe(): void {
        if (this._unsubscribe) {
            this._unsubscribe();
        }
    }
}

/*const fromObservable = Observable.from(1, 2, 3, 4);
const fromObservableSubscription = fromObservable.subscribe(
    (value: number) => {console.log("next (fromObservable): " + value)},
    (error: Error) => {console.log("error (fromObservable)")},
    () => {console.log("complete (fromObservable)")}
);
fromObservableSubscription.unsubscribe();*/

const intervalObservable = Observable.interval(100);
const intervalSubscription = intervalObservable.subscribe(
    (value: number) => {console.log("next (intervalObservable): " + value)},
    (error: Error) => {console.log("error (intervalObservable)")},
    () => {console.log("complete (intervalObservable)")}
);
setTimeout(() => {intervalSubscription.unsubscribe()}, 1000);
/*
const mappedIntervalObservable = intervalObservable.map(value => {return -value;});
const mappedIntervalSubscription = mappedIntervalObservable.subscribe(
  (value: number) => {console.log("next (mappedIntervalObservable): " + value)},
  (error: Error) => {console.log("error (mappedIntervalObservable)")},
  () => {console.log("complete (mappedIntervalObservable)")}
);
setTimeout(() => {mappedIntervalSubscription.unsubscribe()}, 2000);*/
