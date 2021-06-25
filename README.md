# nodejs-libuv-demo

Within is an example of how nodejs (and subsequently, libuv, under the hood) can lead to unexpected deadlocks.

## Usage
In on terminal, run web.js:
```bash
nodejs web.js
```
In another, run demo.js:
```bash
nodejs demo.js
```
Use Ctrl-C to send SIGINT to demo.js and observe that it exits gracefully.

Start over, but this time, kill the web server before sending SIGINT to demo.js and observe that it deadlocks.

## Explanation

In most languages, `stopped` is a variable in the program heap that can be accessed by any thread. Even if one thread is stuck in a `while (!stopped)` loop, another thread can atomically store a value of "true" in the variablee, causing the first thread to exit the loop.

This is a pretty common pattern in programs that have a number of worker threads... Each thread will stop when the main thread instructs them to.

In NodeJS, there are no threads, but instead chains of events scheduled via libuv. Instead of a separate thread setting `stopped` to `true`, a separate event chain must.

When you send Ctrl-C to the process, NodeJS catche the signal it and schedules an event to run the callback specified in `process.on()`, which in our case sets `stopped` to `true`. However, if another event chain is currently in a `while(!stopped)` loop, the new event will not be executed until the loop yields processing back to the event base.

If you send SIGINT to the demo.js process before killing the webserver, the `while(!stopped)` loop yields back to the event base every time we do `await getWork()`, as the I/O implementation will yield back to the event base while the response is pending, so we are able to exit cleanly.

However, if you kill the webserver first, `getWork()`'s Promise is actually _synchronously_ resolved, and the `while(!stopped)` loop never yields back to the event base, so the signal event is never executed.

## Solution
The commented block resolves this.
```
    // Uncomment to fix deadlock
    //await new Promise(resolve => {
    //  setImmediate(resolve);
    //});
```
`setImmediate` is a special function which effectively schedules a new event to continue the current one, and then yields execution back to the event base. This means that once per loop, we open the event base back up to process the signal event, and the program can exit.

Of course, one might say that a developer should simply never write a `while()` loop that has the potential to hog the only thread, but it becomes difficult to tell from context that a given loop does. After all, the example loop here unconditionally calls `await` as its first step. Unless you know that all paths through the while loop `await` at least one Promise that never resolves synchronously, you can't say that a given loop is safe.

The older method of using a function that reschedules itself on the event loop is somewhat safer, though it has its own downsides (left as an exercise to the reader):
```
function main() {
    doSomething();

    if (!stopped) {
        setImmediate(main);
    }
}
```

## License
[MIT](https://choosealicense.com/licenses/mit/)
