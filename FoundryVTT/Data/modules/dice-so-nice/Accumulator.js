export class Accumulator {
    constructor(delay, onEnd) {
        this._timeout = null;
        this._delay = delay;
        this._onEnd = onEnd;
        this._items = [];
    }

    addItem(item) {
        this._items.push(item);
        if (this._timeout)
            clearTimeout(this._timeout);
        let callback = function () {
            this._onEnd(this._items)
            this._timeout = null
            this._items = [];
        }.bind(this);
        if (this._delay)
            this._timeout = setTimeout(callback, this._delay);
        else
            callback();
    }
}