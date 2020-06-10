---
layout: post
title:  "RxJS in depth"
date:   2019-09-26 00:00:00 +0200
categories: javascript rxjs
---

Google released a major overhaul for its Angular framework in late 2016. Among other new features, it shipped with RxJS, a library for asynchronous data streams. RxJS' observables turned out to be the most significant improvement of Angular 2 over its predecessor AngularJS. Up until then, developers didn't have a simple means of representing values that changed over time; promises provided limited help for that, as they were able to handle only a single value over time.

The aim of this post is to give you a better understanding of RxJS. To do so, I'll first give a few examples that explain why FRP is useful. Then, I'll present some of the library's most common operators. After that, I'll delve into more advanced topics, and lastly, I'll show you how to implement an observable from scratch. 

The slides for the series of tech talks I gave at SBB about RxJS can be downloaded here: [Part 1 - The basics][1], [Part 2 - Write your own observable][2], [Part 3 - Beyond the basics][3].

# Why obserables matter

Let's take a look at a simple webapp, to understand why observables can come in handy for asynchronous tasks.

#### Example task

The goal is to extend the app with an information page for the user that is currently logged in. In other words, we would like to do the following:

1. Call a `/checkCredentials` endpoint that verifies whether username and password match
2. Call a `/getUser` endpoint that returns the user details
3. Display the retrieved user details

#### Solution with callbacks

```
function checkCredentials(
    username: string,
    password: string,
    callback: (credentialsOk: boolean) => void
): void {
    // Simulate REST call
    setTimeout(() => {
        callback(username == "test" && password == "1234");
    }, 2000);
}

function getUser(
    credentialsOk: boolean,
    callback: (user?: string) => void
): void {
    if (!credentialsOk) {
        callback(undefined);
    } else {
        // Simulate REST call
        setTimeout(() => {
            callback("USER DETAILS");
        }, 2000);
    }
}

function buildPage(): void {
    checkCredentials("test", "1234", credentialsOk => {
        getUser(credentialsOk, console.log);
    });
}
```
{: .language-javascript}

Besides the unsecure authorisation mechanism, we unfortunately have a few additional issues:
* `checkCredentials` and `getUser` break the single responsibility principle, since they have to invoke the next callback themselves
* We would have to modify both `buildPage` and `checkCredentials` in case of a change to the signature of `getUser`
* We can't easily deal with errors
* We can't easily write tests
* The code would quickly become unreadable in case additional endpoints have to be called 

#### Solution with promises

In order to address those issues, we could use promises. Promises have been introduced in ES6, and represent an asynchronous computation that results in a (single) value. In other words, a promise will always be in one of those three states:
* Pending: the initial state, before completion or rejection
* Fulfilled: the operation completed successfully, and the value may be retrieved
* Rejected: the operation failed (and there is no value to be retrieved)

As shown on the diagram below, two promises can be chained together with `then()`, and potential errors caught with `catch()`. The static methods `all()`, `allSettled()` and `race()` can be used for the case where two or more promises have to be combined. 

![Promise]({{ site.url }}/_downloads/2019/09/26/promise.png "Promise")

We can therefore rewrite our app as follows:

```
function checkCredentials(
    username: string,
    password: string
): Promise<boolean> {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(username == "test" && password == "1234");
        }, 2000);
    });
}

function getUser(credentialsOk: boolean): Promise<string> {
    return new Promise(resolve => {
        if (!credentialsOk) {
            resolve(undefined);
        } else {
            setTimeout(() => {
                resolve("USER DETAILS");
            }, 2000);
        }
    });
}

function buildPage(): void {
    checkCredentials("test", "1234")
        .then(getUser)
        .then(console.log)
        .catch(console.log);
}
```
{: .language-javascript}

Thanks to promises, the code looks much more readable already:
* `checkCredentials` and `getUser` do not break the single responsibility principle anymore
* A signature change of `getUser` does not affect `checkCredentials` (directly) anymore
* We can deal with errors more easily thanks to the `catch` method
* `checkCredentials` and `getUser` return their result in a promise, making tests much easier to write
* And most importantly, we a have a flat hierarchy for the calls to `checkCredentials` and `getUser`

#### Additional requirements for the example task

Suppose now that we have two additional requirements:
* The user details should be reloaded on a button click
* And in order to reduce the server load, at most one request per second should be let through

Promises do not seem to be overly useful for this task. The second point in particular seems difficult to achieve with promises.

#### Solution with observables

In order to meet the additional requirements, we'll have to resort to a more powerful abstraction: observables. Observables represent an asynchronous computation just like promises, but may emit multiple values over time. Essentially, they can deliver the following three notifications:
* *next*: contains the value that is emitted. The observable can emit multiple *next* notifications during its lifetime.
* *error*: contains an error or exception. No other notification can be emitted after it.
* *complete*: indicates a successful completion of the observable's execution. No other notification can be emitted after it.

![RxJS observable]({{ site.url }}/_downloads/2019/09/26/observable.png "RxJS observable")

Using RxJS observables, our example app can  easily meet the new requirements:

```
function checkCredentials(
    username: string,
    password: string
): Observable<boolean> {
    return of(username == "test" && password == "1234").pipe(delay(2000));
}

function getUser(credentialsOk: boolean): Observable<string> {
    return of("USER DETAILS").pipe(delay(2000));
}

function buildPage(): void {
    fromEvent(document.querySelector('button'), 'click').pipe(
        debounceTime(1000),
        switchMap(() => checkCredentials("test", "1234")),
        switchMap(getUser)
    ).subscribe(console.log);
}
```
{: .language-javascript}

As we can see, both of the new requirements could be addressed easily: the first one with the `fromEvent` factory function that turns button clicks into observables, and the second one with the `debounceTime` operator that throttles the observable's emission rate.

# Common RxJS operators

In the previous section, we used three RxJS operators, namely `debounceTime`, `delay` and `switchMap`. RxJS defines many other operators and factory methods, such as the following ones:

* *[of](https://rxmarbles.com/#of)*: creates an observable that emits the values passed as parameter:

```
of(42).subscribe(console.log);
```
{: .language-javascript}

* *[map](https://rxmarbles.com/#map)*: transforms the emitted values with a mapping function. For example, we can retrieve the click's coordinates from the event:

```
fromEvent(document.querySelector('button'), 'click').pipe(
        map((event) => [event.pageX, event.pageY]),
).subscribe(console.log);
```
{: .language-javascript}

* *[zip](https://rxmarbles.com/#zip)*: merges two observables into a single one, by pairing up the values the observables emit. The operator can e.g. be used to calculate the duration of mouse clicks:

```
zip(
  fromEvent(document, 'mousedown').pipe(map(() => new Date())),
  fromEvent(document, 'mouseup').pipe(map(() => new Date()))
).pipe(
  map(([start, end]) => end.getTime() - start.getTime())
).subscribe(console.log);
```
{: .language-javascript}

* *[switchMap](https://rxmarbles.com/#switchMap)*: this operator maps each value emitted by the observable to another observable. The resulting observables are then combined into a single observable. This is very similar to flatMap operations on streams (it can be shown that observables are monads).[^1] Do note that the operator will interrupt (i.e. complete) inner observables as soon as a new value is available in the outer observable. The example below shows how to make a simple timer with a reset button: 

```
fromEvent(
  document.getElementById('reset'),
  'click'
).pipe(
  switchMap(() => interval(1000))
).subscribe(console.log);
```
{: .language-javascript}


* *[concatMap](https://rxmarbles.com/#concatMap)*: `switchMap` completes inner subscriptions when the outer observable emits. This is not always desirable, for example when combining multiple network requests together:

```
  from(postIds).pipe(
     concatMap(postId => this.postService.getPost(postId))
  ).subscribe(console.log);
```
{: .language-javascript}

* *[mergeMap](https://rxmarbles.com/#mergeMap)*: if you were to run the last example, you would notice that the requests are executed in serial. That was to be expected: `concatMap` waits for the inner observable to complete, before executing the next one. To have requests executed in parallel, use `mergeMap` instead. Beware that the answers might come back out of order:

```
  from(postIds).pipe(
     mergeMap(postId => this.postService.getPost(postId))
  ).subscribe(console.log);
```
{: .language-javascript}

* *[debounceTime](https://rxmarbles.com/#debounceTime)*: Operators like `debounceTime` are called lossy backpressure operators. Their purpose is to limit the producer's emission rate, in case the consumer cannot keep up with the new notifications. For example, this could happen when two infinite observables with different emission rates have to be zipped together. On the other hand, there are also lossless operators like `bufferCount` that can be used whenever dropping notifications is not desirable. In the following example, we use `debounceTime` to log at most two events per second to the console:

```
fromEvent(document.querySelector('button'), 'click').pipe(
    debounceTime(500)
).subscribe(console.log);
```
{: .language-javascript}

# Error handling strategies

RxJS has a particularly practical error handling mechanism: error operators. Those operators do not differ much from other operators, apart from dealing with errors instead of regular values. Let's consider the following observable:
```
const observable$ = interval(1000).pipe(
    tap((i) => {
        if (i > 3) {
            throw "error";
        }
    })
);
observable$.subscribe(
    (value) => { console.log("next: " + value); },
    (error) => { console.log("error: " + error); },
    () => { console.log("complete"); }
); 
```
{: .language-javascript}

This observable emits the values `0`, `1`, `2` and `3` at intervals of 1000ms, and then errors out. Since we haven't used any error operator, the error will just bubble up to the subscription's error callback. That's a quite primitive error handling mechanism, but fortunately, error operators are able to deal with more complex cases. 

#### Catch & replace

Sometimes, an error can be replaced with a sensible default value. The *catch and replace strategy* will likely prove useful in those cases. In RxJS, this strategy can be implemented with the `catchError` operator, `switchMap`'s equivalent for errors:
```
observable$.pipe(
    catchError((error) => {
        // provide replacement values
        return of(-1);
    }),
    map((value) => {
        // replacement values will be processed like regular values here
    })
).subscribe(
    (value) => { console.log("next: " + value); },
    (error) => { console.log("error: " + error); },
    () => { console.log("complete"); }
); 
```
{: .language-javascript}

#### Catch & rethrow

Other times, we might want to handle the error locally, before propagating it further. This can be achieved with the *catch and rethrow* strategy, that uses the `catchError` operator and the `throwError` factory method:
```
observable$.pipe(
    switchMap((id) => this.postService.getPost(id))
    catchError((error) => {
        // local error handling
        console.log("The post could not be found");
        // create an obserable that errors out on subscription
        return throwError(error);
    })
).subscribe(
    (value) => { console.log("next: " + value); },
    (error) => { console.log("error: " + error); },
    () => { console.log("complete"); }
);
```
{: .language-javascript}

#### Catch & retry

The two error handling strategies we have seen so far fail to address the case where servers are unreachable. In such a situation, waiting a bit and retrying later might be a better course of action. That's the gist of the *catch and retry strategy*:
```
observable$.pipe(
    retryWhen((errors$) => {
        return errors$.pipe(
            delayWhen((error) => {
                return timer(3000);
            }),
            tap(() => {
                console.log("retrying...")
            })
        );
    })
).subscribe(
    (value) => { console.log("next: " + value); },
    (error) => { console.log("error: " + error); },
    () => { console.log("complete"); }
);
// 1000ms - next: 0
// 2000ms - next: 1
// 3000ms - next: 2
// 4000ms - next: 3
// 8000ms - retrying...
// 9000ms - next: 0
// ...
```
{: .language-javascript}

`retryWhen` allows to rerun a source observable in case an error occurred. Its `errors$` parameter is an observable that contains the errors from all the retries that have been made. `retryWhen` expects its callback to return an observable that emits an event every time the source observable is supposed to be rerun. In the example above, we simply use the `errors$` observable, with events delayed by 3000ms. That way, there will be an interval of 3 seconds between a failed attempt and a retry.

# Hot and cold observables

You might have noticed that some observables behaved differently from others. The reason is that there are actually two types of observables: hot ones and cold ones.[^5]

**Cold observables** create the producer (an `XMLHttpRequest` in the example below) themselves, and start running on subscription. Therefore, every new subscriber will receive the same notification sequence:
```
const cold$ = Observable.create((observer) => {
    let xhr = new XMLHttpRequest();
    xhr.addEventListener("load", v => observer.next(v));
    xhr.open("GET", "http://www.example.org/example.json");
    xhr.send();
});
cold$.subscribe((v) => {
    console.log("cold subscription #1: " + v);
});
setTimeout(
  () => cold$.subscribe((v) => {
    console.log("cold subscription #2: " + v);
  }),
  1000
);

// 0ms - cold subscription #1: <json>
// 1000ms - cold subscription #2: <json>
```
{: .language-javascript}

**Hot observables** close over an already existing producer (the button's event handlers in the example below). Since the producer is already running, a new observer will only get the events that have been emitted after it subscribed to the observable:
```
const hot$ = Observable.create((observer) => {
    document
      .getElementById("button")
      .addEventListener("click", e => observer.next(e));
});
hot$.subscribe((v) => {
    console.log("hot subscription #1: " + v);
});
setTimeout(
  () => hot$.subscribe((v) => {
    console.log("hot subscription #2: " + v);
  }),
  5000
);

// 1000ms - <click>
// 1000ms - hot subscription #1: <event>
// 2000ms - <click>
// 2000ms - hot subscription #1: <event>
// 6000ms - <click>
// 6000ms - hot subscription #1: <event>
// 6000ms - hot subscription #2: <event>
```
{: .language-javascript}

RxJS unfortunately doesn't distinguish between hot and cold observables at the type level. Developers therefore have to refer to the documentation to figure out whether an observable is hot or cold. The most common cases are summarised in the following table:

|-------------------|-------------------------------|
| Cold observables  | Hot observables               |
|-------------------|-------------------------------|
| of()              | fromEvent()                   |
| interval()        | ActivatedRoute.queryParams()  |
| HttpClient.get()  |                               |
| ...               | ...                           |
|-------------------|-------------------------------|

# Subjects

You might now wonder whether a cold observable can be turned into hot a one. The answer is yes, and to achieve that, we'll have to use *subjects*, another abstraction from RxJS.

Subjects act like a proxy between observables and observers. They do not trigger a new execution of the observable, but allow values to be multicasted to several observers instead. They have a `subscribe` method like observables, as well as additional `next`, `error` and `complete` methods. Therefore, they can act as observables, but also be used to emit notifications.

An otherwise cold observable can be turned into a hot one with the `multicast` operator:
```
const hot$ = cold$.pipe(multicast(new Subject()));
hot$.connect();
```
{: .language-javascript}

The `multicast` operator returns a so-called `ConnectableObservable`. The subject will be linked (i.e. subscribe itself) to the source only once the `connect` method is called. From that moment on, notifications will be forwarded to all subscribed observers.

Although this mechanism allows to control the execution start precisely, it is somewhat cumbersome. RxJS provides a higher level `share` operator for that reason:
```
const hot$ = cold$.pipe(share());
```
{: .language-javascript}

A `share` is roughly equivalent to a `multicast` followed by a `refCount`, which automates observable connection / disconnection. The example below shows that it effectively turns a cold observable into a hot one: 
```
const cold$ = interval(1000);
const hot$ = cold$.pipe(share()); 
hot$.subscribe((v) => console.log("#1: " + v));
setTimeout(
    () => hot$.subscribe((v) => console.log("#2: " + v)),
    3500
);

// Output
// #1: 0
// #1: 1
// #1: 2
// #1: 3
// #2: 3
// #1: 4
// #2: 4
// ...
```
{: .language-javascript}

RxJS provides four different subject implementations, to accommodate various use cases:
* *Subject*: vanilla subjects neither have an initial value nor a cache. New observers will therefore only receive notifications that have been emitted after they subscribed:

```
const subject = new Subject();
subject.subscribe((n) => {
    console.log("subject #1: " + n);
});
subject.next(Math.random()); 
subject.next(Math.random()); 
subject.next(Math.random());
setTimeout(() => {
    subject.subscribe((n) => {
        console.log("subject #2: " + n);
    });
}, 2000);

// Output
// subject #1: 0.799064507560346
// subject #1: 0.5626115223854045
// subject #1: 0.5820694908227122
// subject #1: 0.5041551012937133
```
{: .language-javascript}

* *BehaviorSubject*: this subject requires an initial value, and emits its current value to new subscribers. The example below shows what happens when an observer subscribes immediately, and another one 2000ms later:

```
const behaviorSubject = new BehaviorSubject(42);
behaviorSubject.subscribe((n) => {            
    console.log("behaviorSubject #1: " + n);
});
behaviorSubject.next(Math.random()); 
behaviorSubject.next(Math.random()); 
behaviorSubject.next(Math.random());
setTimeout(() => {
    behaviorSubject.subscribe((n) => {          
        console.log("behaviorSubject #2: " + n);
    });
}, 2000);

// Output
// behaviorSubject #1: 42
// behaviorSubject #1: 0.28484506095836926
// behaviorSubject #1: 0.14382412500454356
// behaviorSubject #1: 0.821816890661595
// behaviorSubject #2: 0.6979675610150831
```
{: .language-javascript}

* *ReplaySubject*: buffers *n* notifications, and replays them to new subscribers. Taking the same example as above, with a `ReplaySubject` instead of a `BehaviorSubject`: 

```
const replaySubject = new ReplaySubject(2); 
replaySubject.subscribe((n) => {     
    console.log("replaySubject #1: " + n);
});
replaySubject.next(Math.random()); 
replaySubject.next(Math.random());
replaySubject.next(Math.random());
setTimeout(() => {
    replaySubject.subscribe((n) => {
        console.log("replaySubject #2: " + n);
    });
}, 2000);

// Output
// replaySubject #1: 0.5656977118236854
// replaySubject #1: 0.2378906195692394
// replaySubject #2: 0.6571879405725616
// replaySubject #2: 0.2378906195692394
// replaySubject #2: 0.6571879405725616
```
{: .language-javascript}

* *AsyncSubject*: only emits its last value upon completion. Such subjects can be useful e.g. for caching purposes: 

```
const asyncSubject = new AsyncSubject(); 
asyncSubject.subscribe((n) => { 
    console.log("asyncSubject #1: " + n);
});
asyncSubject.next(Math.random()); 
asyncSubject.next(Math.random()); 
asyncSubject.next(Math.random());
setTimeout(() => {
    asyncSubject.subscribe((n) => { 
        console.log("asyncSubject #2: " + n);
    });
}, 2000);
asyncSubject.complete();

// Output
// asyncSubject #1: 0.8994070709645197
// asyncSubject #2: 0.8994070709645197
```
{: .language-javascript}

# Schedulers

We'll conclude our tour of RxJS features by looking into schedulers, a fairly advanced functionality that is rarely used in conventional webapps. Nevertheless, it can't hurt to have a basic understanding of how it works. The main purpose of schedulers is to control the execution context of observables, i.e. whether the notifications are delivered synchronously, on the microtask queue or on the macrotask queue. RxJS provides the following schedulers:
* *null scheduler*: this scheduler emits notifications synchronously with a simple imperative loop. For example, `of([1,2,3])` will immediately emit 1, 2 and 3.
* *queueScheduler*: this scheduler emits its notifications in the same event frame. The example below shows how it differs from the null scheduler:

```
console.log("start");
const a$ = of(1, 2);
const b$ = of(3, 4);
const c$ = of(5, 6);
combineLatest(a$, b$, c$).subscribe(console.log);
console.log("end");

// Output:
// start
// [2, 4, 5]
// [2, 4, 6]
// end
```
{: .language-javascript}

```
console.log("start");
const a$ = of(1, 2, queueScheduler);
const b$ = of(3, 4, queueScheduler);
const c$ = of(5, 6, queueScheduler);
combineLatest(a$, b$, c$, queueScheduler).subscribe(console.log);
console.log("end");

// Output:
// start
// [1, 3, 5]
// [2, 3, 5]
// [2, 4, 5]
// [2, 4, 6]
// end
```
{: .language-javascript}

* *asapScheduler*: this scheduler delivers its notifications in a new micro task event
* *asyncScheduler*: this scheduler is similar to the asapScheduler, but uses the macro task queue instead. The following example shows the difference between both:

```
console.log("start");

const null$ = of("null", queueScheduler);
const asap$ = of("asap", asapScheduler);
const async$ = of("async", asyncScheduler);

merge(null$, asap$, async$)
	.pipe(filter((value) => { return !!value; }))
  .subscribe(console.log);
  
console.log("end");

// Output:
// start
// null
// end
// asap
// async
```
{: .language-javascript}

For completeness' sake, the *animationFrameScheduler* and the *virtualTimeScheduler* also have to be mentioned. The former is primarily used for browser animations and the latter for marble testing.


# Observable anti-patterns

When starting out with RxJS, it usually takes a bit of time to get comfortable with observables. The execution flow is different, and finding out the right operator for the task at hand is not always straightforward. For these reasons, it is all too easy to write code that is hard to test, maintain and understand. To save you from some trouble, I compiled a list with the most common anti-patterns I came across during code reviews:

#### Nested observables

Let's assume we want to use a URL parameter to call an external API. In Angular, URL parameters are usually retrieved by subscribing on the `activatedRoute.params` observable. Because of that, it is really tempting to implement the API call like this:
```
this.activatedRoute.params.subscribe(params => {
    const id = params['id'];
    if (id !== null && id !== undefined) {
        this.userService.getUser(id).subscribe(user => this.user = user);
    }
}); 
```
{: .language-javascript}

Nested subscriptions are not much better than nested callbacks: the code is hardly testable, and not really readable either. It would be better to keep a flat call hierarchy and use `switchMap` instead:
```
this
    .activatedRoute
    .params
    .pipe(
        map(params => params['id']),
        filter(id => id !== null && id !== undefined)
        switchMap(id => this.userService.getUser(id))
    ).subscribe(user => this.user = user);
}); 
```
{: .language-javascript}

#### Observables that error out instead of completing

In the previous example, we used the `map`, `filter` and `switchMap` operators. Could we replace `filter` by an `if` clause?
```
this
    .activatedRoute
    .params
    .pipe(
        map(params => params['id']),
        switchMap(id => {
            if(id !== null && id !== undefined) {
                return this.getUser(id);
            }
        })
    ).subscribe(user => this.user = user);
}); 
```
{: .language-javascript}

Not really: since `switchMap` expects an observable, it would throw an error in case id is null or undefined, instead of completing successfully. To avoid this, return the empty observable in an else clause:
```
this
    .activatedRoute
    .params
    .pipe(
        map(params => params['id']),
        switchMap(id => {
            if(id !== null && id !== undefined) {
                return this.getUser(id);
            } else {
                return EMPTY;
            }
        })
    ).subscribe(user => this.user = user);
}); 
```
{: .language-javascript}

#### Memory leaks

Subscriptions can introduce memory leaks that are hard to track down. Those leaks come from the callbacks of `subscribe` in most cases: the issue is that these callbacks hold their references until `unsubscribe()` is called. This can prevent the garbage collection of large objects like UI components, and make the app quite a bit more memory hungry than necessary. The example below shows an Angular component with such a leak: 
```
@Component(...)
class MyComponent implements OnInit {

    ngOnInit() {
        this
            .someService
            .someObservable$
            .subscribe(this.someMethod);
    }

    someMethod(value) {...}
}
```
{: .language-javascript}

The `ngOnInit` hook creates a subscription to `someObservable$`. At the end of the component's lifecycle, Angular will take care of calling `ngOnDestroy`. At this point, we expect that the garbage collector will reclaim `MyComponent` from memory. That's not the case though: the subscription still listens to `someObservable$`, and still holds a reference to `MyComponent` through `this`. In order to fix the memory leak, we would have to unsubscribe from the observable in the `ngOnDestroy` hook:
```
@Component(...)
class MyComponent implements OnDestroy, OnInit {

    someSubscription: Subscription;

    ngOnInit() {
        this.someSubscription = this
            .someService
            .someObservable$
            .subscribe(this.someMethod);
    }

    ngOnDestroy() {
        this.someSubscription.unsubscribe();
    }

    someMethod(value) {...}
}
```
{: .language-javascript}

That being said, it is not always necessary to unsubscribe from observables in Angular. As a rule of thumb, a call to `unsubscribe` is not necessary for:
* ActivatedRoute subscriptions
* HttpClient subscriptions
* Observables used with the async pipe
* Finite observables

However, an explicit call is mandatory in these cases:
* Form subscriptions (valueChanges / statusChanges / ...)
* Renderer2 subscriptions
* Observables that never complete (or error out)

# Implement an observable from scratch

In this section, we'll write our own observable implementation. This task is not as daunting as it looks: since JavaScript is based on an event loop, we can skirt around most typical concurrency issues. A reference implementation with the code snippets from this section is available [here][4].

#### Observer

We'll start by defining observers. In a nutshell, an observer is an object with the three methods `next`, `error` and `complete`. These methods will be called when the observable that has been subscribed to emits the corresponding event. Besides that, it contains an `_isUnsubscribed` flag, that prevents the callbacks from being called once the observer has been unsubscribed.

```
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

    next(value: T): void {…}

    error<E extends Error>(error: E): void {…}

    complete(): void {…}

    unsubscribe(): void {…}
} 
```
{: .language-javascript}

`next` can now be implemented relatively straightforwardly. As long as the subscription is still active, it simply invokes the `_next` callback if defined:
```
next(value: T): void {
    if (!this._isUnsubscribed && this._next) {
        this._next(value);
    }
}
```
{: .language-javascript}

`error` is similar to `next`, with the exception that the subscription has to be closed if it is still active:
```
error<E extends Error>(error: E): void {
    if (!this._isUnsubscribed) {
        if (this._error) {
            this._error(error);
        }
        this.unsubscribe();
    }
}
```
{: .language-javascript}

The `complete` notification is handled the same way:
```
complete(): void {
    if (!this._isUnsubscribed) {
        if (this._complete) {
            this._complete();
        }
        this.unsubscribe();
    }
}
```
{: .language-javascript}

Lastly, `unsubscribe` toggles the `_isUnsubscribed` flag, and executes the cleanup logic by calling `_unsubscribe`:
```
    unsubscribe(): void {
        if (!this._isUnsubscribed) {
            this._isUnsubscribed = true;
            this._unsubscribe();
        }
    }
```
{: .language-javascript}

#### Subscription

Subscriptions (returned by `Observable`'s `subscribe` method) are straightforward to implement as well. They simply wrap an `_unsubscribe` function, that disposes resources held by the execution of an observable:
```
class Subscription {
    constructor(private _unsubscribe?: () => void) {}

    unsubscribe(): void {
        if (this._unsubscribe) {
            this._unsubscribe();
        }
    }
}
```
{: .language-javascript}

#### Observable

Last but not least, we'll implement the `Observable` class. Its constructor is private; only the factory methods and operators are supposed to invoke it. We'll define two factory methods (`from` and `interval`), and one operator (`map`). To keep things simple, they'll be implemented on the `Observable` class directly.[^2]
```
class Observable<T> {
    private constructor(private _subscribe: (observer: Observer<T>) => Subscription) {}

    static from<T>(...values: T[]): Observable<T> {...}

    static interval(ms: number): Observable<number> {...}

    map<U>(f: (value: T) => U): Observable<U> {...}

    subscribe(
        next?: (value: T) => void,
        error?: <E extends Error> (error: E) => void,
        complete?: () => void
    ): Subscription {...}
}
```
{: .language-javascript}

Simply put, observables wrap around a function that is invoked every time an observer subscribes to the observable. To understand that better, let's implement a `from` factory. Every time an observer subscribes to the observable, we want to synchronously emit the values from the array, and then complete it. This is an example of a cold observable: each observer will receive the same notifications. 
```
static from<T>(...values: T[]): Observable<T> {
    return new Observable((observer: Observer<T>) => {
        values.forEach((value) => {observer.next(value)});
        observer.complete();
        return new Subscription();
    });
}
```
{: .language-javascript}

Let's now take a look at a factory that actually needs unsubscription logic. In the `interval` factory, we want to emit an increasing number every *n* milliseconds. For that, we'll use the built-in `setInterval` method. However, we'll have to stop the emission of new values upon unsubscription from the observable. To address this requirement, we'll simply return a subscription that invokes `clearInterval` once disposed:
```
static interval(ms: number): Observable<number> {
    return new Observable((observer: Observer<number>) => {
        let i = 0;
        const handle = setInterval(() => {observer.next(i += 1)}, ms);
        return new Subscription(() => {clearInterval(handle)});
    });
}
```
{: .language-javascript}

`subscribe` stitches everything together. First, it creates a new observer with the provided callbacks. Then, it invokes the internal `_subscribe` method to retrieve the subscription. After that, it sets the observer's unsubscription logic. And finally, it returns a subscription that unsubscribes the observer once disposed:
```
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
```
{: .language-javascript}

To round things off, let's implement a `map` operator. The logic is quite simple, as we just have to subscribe to the existing observable and forward any incoming notification: 
```
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
```
{: .language-javascript}

And that's it! We have been able to implement observers, subscriptions and observables in a mere hundred lines. To test our implementation, we can write a little counter that counts down from -1 to -20, at intervals of 100ms:
```
const observable$ = Observable
    .interval(100)
    .map(value => { return -value; });

const subscription = observable$.subscribe(
  (value: number) => {console.log("next: " + value)},
  (error: Error) => {console.log("error")},
  () => {console.log("complete")}
);

setTimeout(
    () => { subscription.unsubscribe() },
    2000
);
```
{: .language-javascript}

# Conclusion

The idea of modelling events that occur at multiple points of time predates RxJS of course. The library is an implementation[^3] of a more abstract paradigm from the late 1990s called functional reactive programming.[^4] Although people usually associate reactive programming with frontend development, the trend is picking up in the backend world too. Sharp tongues would argue it became mainstream the moment Spring released its Webflux module. Either way, it is a useful programming paradigm that every developer should be familiar with.

We have covered quite a lot of ground in this blog post: among other things, we examined a few operators, learnt about different strategies to cope with errors, and looked at various kinds of subjects. Lastly, we implemented our own observable; I hope this demystified RxJS a bit. In case anything is unclear or missing, feel free to reach out on [twitter](https://twitter.com/_jagauthier).

Happy hacking :)

# References
1. [A simple Observable implementation – Federico Knüssel](https://medium.com/@fknussel/a-simple-observable-implementation-c9c809c89c69)
2. [Callbacks vs promises vs rxjs vs async awaits – Maximilian Schwarzmüller](https://reactivex.io/documentation/observable.html)
3. [Exploring Async/Await Functions in JavaScript – alligator.io](https://alligator.io/js/async-functions/)
4. [Implementing JavaScript Promise in 70 lines of code! – Keyvan M. Sadeghi](https://hackernoon.com/implementing-javascript-promise-in-70-lines-of-code-b3592565af0f)
5. [learnrxjs.io](https://www.learnrxjs.io/)
6. [reactivex.io](https://reactivex.io/documentation/observable.html)
7. [RxJs Error Handling: Complete Practical Guide - Angular University](https://blog.angular-university.io/rxjs-error-handling/)
8. [rxmarbles.com](https://rxmarbles.com/)
9. [Should I care about RxJS schedulers? - Wojciech Trawiński](https://medium.com/javascript-everyday/should-i-care-about-rxjs-schedulers-862b5646d40d)
10. [The Best Way To Unsubscribe RxJS Observables In The Angular Applications! – Tomas Traja](https://blog.angularindepth.com/the-best-way-to-unsubscribe-rxjs-observable-in-the-angular-applications-d8f9aa42f6a0)
11. [The Evolution of Asynchronous JavaScript – Gergely Nemeth](https://blog.risingstack.com/asynchronous-javascript/)
12. [Understanding rxjs BehaviorSubject, ReplaySubject and AsyncSubject – Luuk Gruijs](https://medium.com/@luukgruijs/understanding-rxjs-behaviorsubject-replaysubject-and-asyncsubject-8cc061f1cfc0)
13. [When to Unsubscribe in Angular – Netanel Basal](https://netbasal.com/when-to-unsubscribe-in-angular-d61c6b21bad3)

# Notes

[^1]: Cf. [Is RxJS.Observable a monad? - StackOverflow](https://stackoverflow.com/questions/51542865/is-rxjs-observable-a-monad) for a formal discussion
[^2]: Actually, this was the way it was done prior to RxJS 5.5: [Pipeable Operators - ReactiveX/RxJs](https://github.com/ReactiveX/rxjs/blob/91088dae1df097be2370c73300ffa11b27fd0100/doc/pipeable-operators.md)
[^3]: Strictly speaking, RxJS is not exactly equivalent to FRP, as it operates on discrete instead of continuous values. But in practice, a lot of people call it like that nevertheless.
[^4]: [Functional Reactive Animation - Conal Elliott and Paul Hudak](http://conal.net/papers/icfp97/icfp97.pdf)
[^5]: Ignoring corner cases such as warm observables [Hot vs Cold Observables - Ben Lesh](https://medium.com/@benlesh/hot-vs-cold-observables-f8094ed53339)

[1]: {{ site.url }}/_downloads/2019/09/26/rxjs-in-depth-part-1.pptx
[2]: {{ site.url }}/_downloads/2019/09/26/rxjs-in-depth-part-2.pptx
[3]: {{ site.url }}/_downloads/2019/09/26/rxjs-in-depth-part-3.pptx
[4]: {{ site.url }}/_downloads/2019/09/26/reference-implementation.ts