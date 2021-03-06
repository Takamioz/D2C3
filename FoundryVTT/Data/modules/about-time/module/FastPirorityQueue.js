/**
 * FastPriorityQueue.js : a fast heap-based priority queue  in JavaScript.
 * (c) the authors
 * Licensed under the Apache License, Version 2.0.
 *
 * Speed-optimized heap-based priority queue for modern browsers and JavaScript engines.
 *
 * Usage :
         Installation (in shell, if you use node):
         $ npm install fastpriorityqueue

         Running test program (in JavaScript):

         // var FastPriorityQueue = require("fastpriorityqueue");// in node
         var x = new FastPriorityQueue();
         x.add(1);
         x.add(0);
         x.add(5);
         x.add(4);
         x.add(3);
         x.peek(); // should return 0, leaves x unchanged
         x.size; // should return 5, leaves x unchanged
         while(!x.isEmpty()) {
           console.log(x.poll());
         } // will print 0 1 3 4 5
         x.trim(); // (optional) optimizes memory usage
 */
'use strict';
var defaultcomparator = function (a, b) {
    if (a._time !== b._time)
        return a._time < b._time;
    return a._uid < b._uid;
};
export class Quentry {
    constructor(time, recurring, increment, handler, uid, ...args) {
        this._time = time;
        this._recurring = recurring;
        this._increment = increment;
        this._handler = handler;
        this._uid = uid === null ? Date.now() : uid;
        this._args = args;
    }
    exportToJson() {
        let handler;
        if (typeof this._handler === "function") {
            handler = { type: "function", val: this._handler.toString() };
        }
        else {
            handler = { type: "string", val: this._handler };
        }
        return {
            time: this._time,
            recurring: this._recurring,
            increment: this._increment,
            handler: handler,
            uid: this._uid,
            args: this._args
        };
    }
    static createFromJSON(data) {
        let handler;
        try {
            if (data.handler.type === "function")
                handler = eval(data.handler.val);
            else
                handler = data.handler.val;
        }
        catch (err) {
            console.warn(err);
            handler = null;
        }
        if (!handler) {
            console.warn("about-time | Could not restore handler ", data.handler, "substituting console.log");
            handler = console.log;
        }
        return new Quentry(data.time, data.recurring, data.recurring ? data.increment : null, handler, data.uid, ...data.args);
    }
}
export class FastPriorityQueue {
    // the provided comparator function should take a, b and return *true* when a < b
    constructor(comparator = defaultcomparator) {
        // copy the priority queue into another, and return it. Queue items are shallow-copied.
        // Runs in `O(n)` time.
        this.clone = function () {
            var fpq = new FastPriorityQueue(this.compare);
            fpq.size = this.size;
            for (var i = 0; i < this.size; i++) {
                fpq.array.push(this.array[i]);
            }
            return fpq;
        };
        // Add an element into the queue
        // runs in O(log n) time
        this.add = function (myval) {
            var i = this.size;
            this.array[this.size] = myval;
            this.size += 1;
            var p;
            var ap;
            while (i > 0) {
                p = (i - 1) >> 1;
                ap = this.array[p];
                if (!this.compare(myval, ap)) {
                    break;
                }
                this.array[i] = ap;
                i = p;
            }
            this.array[i] = myval;
        };
        // replace the content of the heap by provided array and "heapify it"
        this.heapify = function (arr) {
            this.array = arr;
            this.size = arr.length;
            for (let i = this.size >> 1; i >= 0; i--) {
                this._percolateDown(i);
            }
        };
        // for internal use
        this._percolateUp = function (i, force) {
            var myval = this.array[i];
            var p;
            var ap;
            while (i > 0) {
                p = (i - 1) >> 1;
                ap = this.array[p];
                // force will skip the compare
                if (!force && !this.compare(myval, ap)) {
                    break;
                }
                this.array[i] = ap;
                i = p;
            }
            this.array[i] = myval;
        };
        // for internal use
        this._percolateDown = function (i) {
            var size = this.size;
            var hsize = this.size >>> 1;
            var ai = this.array[i];
            var l;
            var r;
            var bestc;
            while (i < hsize) {
                l = (i << 1) + 1;
                r = l + 1;
                bestc = this.array[l];
                if (r < size) {
                    if (this.compare(this.array[r], bestc)) {
                        l = r;
                        bestc = this.array[r];
                    }
                }
                if (!this.compare(bestc, ai)) {
                    break;
                }
                this.array[i] = bestc;
                i = l;
            }
            this.array[i] = ai;
        };
        // internal
        // _removeAt(index) will remove the item at the given index from the queue,
        // retaining balance. returns the removed item, or undefined if nothing is removed.
        this._removeAt = function (index) {
            if (index > this.size - 1 || index < 0)
                return undefined;
            // impl1:
            //this.array.splice(index, 1);
            //this.heapify(this.array);
            // impl2:
            this._percolateUp(index, true);
            return this.poll();
        };
        // remove(myval) will remove an item matching the provided value from the
        // queue, checked for equality by using the queue's comparator.
        // return true if removed, false otherwise.
        this.remove = function (myval) {
            for (var i = 0; i < this.size; i++) {
                if (!this.compare(this.array[i], myval) && !this.compare(myval, this.array[i])) {
                    // items match, comparator returns false both ways, remove item
                    this._removeAt(i);
                    return true;
                }
            }
            return false;
        };
        this.removeId = function (id) {
            for (var i = 0; i < this.size; i++) {
                if (this.array[i]._uid === id) {
                    return this._removeAt(i);
                }
            }
            return undefined;
        };
        // internal
        // removes and returns items for which the callback returns true.
        this._batchRemove = function (callback, limit) {
            // initialize return array with max size of the limit or current queue size
            var retArr = new Array(limit ? limit : this.size);
            var count = 0;
            if (typeof callback === 'function' && this.size) {
                var i = 0;
                while (i < this.size && count < retArr.length) {
                    if (callback(this.array[i])) {
                        retArr[count] = this._removeAt(i);
                        count++;
                        // move up a level in the heap if we remove an item
                        i = i >> 1;
                    }
                    else {
                        i++;
                    }
                }
            }
            retArr.length = count;
            return retArr;
        };
        // removeOne(callback) will execute the callback function for each item of the queue
        // and will remove the first item for which the callback will return true.
        // return the removed item, or undefined if nothing is removed.
        this.removeOne = function (callback) {
            var arr = this._batchRemove(callback, 1);
            return arr.length > 0 ? arr[0] : undefined;
        };
        // remove(callback[, limit]) will execute the callback function for each item of
        // the queue and will remove each item for which the callback returns true, up to
        // a max limit of removed items if specified or no limit if unspecified.
        // return an array containing the removed items.
        this.removeMany = function (callback, limit) {
            return this._batchRemove(callback, limit);
        };
        // Look at the top of the queue (one of the smallest elements) without removing it
        // executes in constant time
        //
        // Calling peek on an empty priority queue returns
        // the "undefined" value.
        // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/undefined
        //
        this.peek = () => {
            if (this.size === 0)
                return undefined;
            return this.array[0];
        };
        // remove the element on top of the heap (one of the smallest elements)
        // runs in logarithmic time
        //
        // If the priority queue is empty, the function returns the
        // "undefined" value.
        // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/undefined
        //
        // For long-running and large priority queues, or priority queues
        // storing large objects, you may  want to call the trim function
        // at strategic times to recover allocated memory.
        this.poll = function () {
            if (this.size == 0)
                return undefined;
            var ans = this.array[0];
            if (this.size > 1) {
                this.array[0] = this.array[--this.size];
                this._percolateDown(0);
            }
            else {
                this.size -= 1;
            }
            return ans;
        };
        // This function adds the provided value to the heap, while removing
        // and returning one of the smallest elements (like poll). The size of the queue
        // thus remains unchanged.
        this.replaceTop = function (myval) {
            if (this.size == 0)
                return undefined;
            var ans = this.array[0];
            this.array[0] = myval;
            this._percolateDown(0);
            return ans;
        };
        // recover unused memory (for long-running priority queues)
        this.trim = function () {
            this.array = this.array.slice(0, this.size);
        };
        // Check whether the heap is empty
        this.isEmpty = function () {
            return this.size === 0;
        };
        // iterate over the items in order, pass a callback that receives (item, index) as args.
        // TODO once we transpile, uncomment
        // if (Symbol && Symbol.iterator) {
        //   FastPriorityQueue.prototype[Symbol.iterator] = function*() {
        //     if (this.isEmpty()) return;
        //     var fpq = this.clone();
        //     while (!fpq.isEmpty()) {
        //       yield fpq.poll();
        //     }
        //   };
        // }
        this.forEach = function (callback) {
            if (this.isEmpty() || typeof callback != 'function')
                return;
            var i = 0;
            var fpq = this.clone();
            while (!fpq.isEmpty()) {
                callback(fpq.poll(), i++);
            }
        };
        // return the k 'smallest' elements of the queue
        // runs in O(k log k) time
        // this is the equivalent of repeatedly calling poll, but
        // it has a better computational complexity, which can be
        // important for large data sets.
        this.kSmallest = function (k) {
            if (this.size == 0)
                return [];
            var comparator = this.compare;
            var arr = this.array;
            var fpq = new FastPriorityQueue(function (a, b) {
                return comparator(arr[a], arr[b]);
            });
            k = Math.min(this.size, k);
            var smallest = new Array(k);
            var j = 0;
            fpq.add(0);
            while (j < k) {
                var small = fpq.poll();
                smallest[j++] = this.array[small];
                var l = (small << 1) + 1;
                var r = l + 1;
                if (l < this.size)
                    fpq.add(l);
                if (r < this.size)
                    fpq.add(r);
            }
            return smallest;
        };
        this.toString = () => {
            return this.array.toString();
        };
        if (!(this instanceof FastPriorityQueue))
            return new FastPriorityQueue(comparator);
        this.array = [];
        this.size = 0;
        this.compare = comparator || defaultcomparator;
        return this;
    }
    static createFromJson(data) {
        let fpq = new FastPriorityQueue();
        if (!data)
            return fpq;
        fpq.size = data.size;
        // fpq.compare = eval(data.compare);
        fpq.array = data.array.map(qe => Quentry.createFromJSON(qe));
        return fpq;
    }
    exportToJSON() {
        let returnval = {
            size: this.size,
            compare: this.compare.toString(),
            array: this.array.map(e => e.exportToJson()).slice(0, this.size)
        };
        return returnval;
    }
}
