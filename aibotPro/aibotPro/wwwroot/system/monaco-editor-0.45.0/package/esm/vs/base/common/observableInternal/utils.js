/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { toDisposable } from '../lifecycle.js';
import { autorun } from './autorun.js';
import { BaseObservable, ConvenientObservable, _setRecomputeInitiallyAndOnChange, getDebugName, getFunctionName, subtransaction, transaction } from './base.js';
import { derived } from './derived.js';
import { getLogger } from './logging.js';
/**
 * Represents an efficient observable whose value never changes.
 */
export function constObservable(value) {
    return new ConstObservable(value);
}
class ConstObservable extends ConvenientObservable {
    constructor(value) {
        super();
        this.value = value;
    }
    get debugName() {
        return this.toString();
    }
    get() {
        return this.value;
    }
    addObserver(observer) {
        // NO OP
    }
    removeObserver(observer) {
        // NO OP
    }
    toString() {
        return `Const: ${this.value}`;
    }
}
export function waitForState(observable, predicate) {
    return new Promise(resolve => {
        let didRun = false;
        let shouldDispose = false;
        const stateObs = observable.map(state => ({ isFinished: predicate(state), state }));
        const d = autorun(reader => {
            /** @description waitForState */
            const { isFinished, state } = stateObs.read(reader);
            if (isFinished) {
                if (!didRun) {
                    shouldDispose = true;
                }
                else {
                    d.dispose();
                }
                resolve(state);
            }
        });
        didRun = true;
        if (shouldDispose) {
            d.dispose();
        }
    });
}
export function observableFromEvent(event, getValue) {
    return new FromEventObservable(event, getValue);
}
export class FromEventObservable extends BaseObservable {
    constructor(event, _getValue) {
        super();
        this.event = event;
        this._getValue = _getValue;
        this.hasValue = false;
        this.handleEvent = (args) => {
            var _a;
            const newValue = this._getValue(args);
            const oldValue = this.value;
            const didChange = !this.hasValue || oldValue !== newValue;
            let didRunTransaction = false;
            if (didChange) {
                this.value = newValue;
                if (this.hasValue) {
                    didRunTransaction = true;
                    subtransaction(FromEventObservable.globalTransaction, (tx) => {
                        var _a;
                        (_a = getLogger()) === null || _a === void 0 ? void 0 : _a.handleFromEventObservableTriggered(this, { oldValue, newValue, change: undefined, didChange, hadValue: this.hasValue });
                        for (const o of this.observers) {
                            tx.updateObserver(o, this);
                            o.handleChange(this, undefined);
                        }
                    }, () => {
                        const name = this.getDebugName();
                        return 'Event fired' + (name ? `: ${name}` : '');
                    });
                }
                this.hasValue = true;
            }
            if (!didRunTransaction) {
                (_a = getLogger()) === null || _a === void 0 ? void 0 : _a.handleFromEventObservableTriggered(this, { oldValue, newValue, change: undefined, didChange, hadValue: this.hasValue });
            }
        };
    }
    getDebugName() {
        return getFunctionName(this._getValue);
    }
    get debugName() {
        const name = this.getDebugName();
        return 'From Event' + (name ? `: ${name}` : '');
    }
    onFirstObserverAdded() {
        this.subscription = this.event(this.handleEvent);
    }
    onLastObserverRemoved() {
        this.subscription.dispose();
        this.subscription = undefined;
        this.hasValue = false;
        this.value = undefined;
    }
    get() {
        if (this.subscription) {
            if (!this.hasValue) {
                this.handleEvent(undefined);
            }
            return this.value;
        }
        else {
            // no cache, as there are no subscribers to keep it updated
            return this._getValue(undefined);
        }
    }
}
(function (observableFromEvent) {
    observableFromEvent.Observer = FromEventObservable;
    function batchEventsGlobally(tx, fn) {
        let didSet = false;
        if (FromEventObservable.globalTransaction === undefined) {
            FromEventObservable.globalTransaction = tx;
            didSet = true;
        }
        try {
            fn();
        }
        finally {
            if (didSet) {
                FromEventObservable.globalTransaction = undefined;
            }
        }
    }
    observableFromEvent.batchEventsGlobally = batchEventsGlobally;
})(observableFromEvent || (observableFromEvent = {}));
export function observableSignalFromEvent(debugName, event) {
    return new FromEventObservableSignal(debugName, event);
}
class FromEventObservableSignal extends BaseObservable {
    constructor(debugName, event) {
        super();
        this.debugName = debugName;
        this.event = event;
        this.handleEvent = () => {
            transaction((tx) => {
                for (const o of this.observers) {
                    tx.updateObserver(o, this);
                    o.handleChange(this, undefined);
                }
            }, () => this.debugName);
        };
    }
    onFirstObserverAdded() {
        this.subscription = this.event(this.handleEvent);
    }
    onLastObserverRemoved() {
        this.subscription.dispose();
        this.subscription = undefined;
    }
    get() {
        // NO OP
    }
}
export function observableSignal(debugNameOrOwner) {
    if (typeof debugNameOrOwner === 'string') {
        return new ObservableSignal(debugNameOrOwner);
    }
    else {
        return new ObservableSignal(undefined, debugNameOrOwner);
    }
}
class ObservableSignal extends BaseObservable {
    get debugName() {
        var _a;
        return (_a = getDebugName(this, this._debugName, undefined, this._owner, this)) !== null && _a !== void 0 ? _a : 'Observable Signal';
    }
    constructor(_debugName, _owner) {
        super();
        this._debugName = _debugName;
        this._owner = _owner;
    }
    trigger(tx, change) {
        if (!tx) {
            transaction(tx => {
                this.trigger(tx, change);
            }, () => `Trigger signal ${this.debugName}`);
            return;
        }
        for (const o of this.observers) {
            tx.updateObserver(o, this);
            o.handleChange(this, change);
        }
    }
    get() {
        // NO OP
    }
}
/**
 * This converts the given observable into an autorun.
 */
export function recomputeInitiallyAndOnChange(observable, handleValue) {
    const o = new KeepAliveObserver(true, handleValue);
    observable.addObserver(o);
    if (handleValue) {
        handleValue(observable.get());
    }
    else {
        observable.reportChanges();
    }
    return toDisposable(() => {
        observable.removeObserver(o);
    });
}
_setRecomputeInitiallyAndOnChange(recomputeInitiallyAndOnChange);
class KeepAliveObserver {
    constructor(_forceRecompute, _handleValue) {
        this._forceRecompute = _forceRecompute;
        this._handleValue = _handleValue;
        this._counter = 0;
    }
    beginUpdate(observable) {
        this._counter++;
    }
    endUpdate(observable) {
        this._counter--;
        if (this._counter === 0 && this._forceRecompute) {
            if (this._handleValue) {
                this._handleValue(observable.get());
            }
            else {
                observable.reportChanges();
            }
        }
    }
    handlePossibleChange(observable) {
        // NO OP
    }
    handleChange(observable, change) {
        // NO OP
    }
}
export function derivedObservableWithCache(computeFn) {
    let lastValue = undefined;
    const observable = derived(reader => {
        lastValue = computeFn(reader, lastValue);
        return lastValue;
    });
    return observable;
}
