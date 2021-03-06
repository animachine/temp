'use strict';

var EventEmitter = require('eventman');
var inherits = require('inherits');
var Symbol = require('es6-symbol');

function Chronicler() {

    EventEmitter.call(this);

    this._stack = [],
    this._pointer = -1;
    this._chains = [];
    this._blocks = new Set();
}

inherits(Chronicler, EventEmitter);
module.exports = Chronicler;
var p = Chronicler.prototype;

p.undo = function() {

    if (this._pointer < 0) {

        return false;
    }

    var rec = this._stack[this._pointer--];

    if (rec instanceof Flag) {

        var startFlagIdx = this._stack.indexOf(rec.pair);

        if (startFlagIdx !== -1) {

            while (this._pointer !== startFlagIdx) {

                let _rec = this._stack[this._pointer--];

                if (!(_rec instanceof Flag)) {
                    this._call(_rec.undo);
                }
            }

            this._pointer--;
        }
    }
    else {
        this._call(rec.undo);
    }

    this.emit('change');
};

p.redo = function() {

    if (this._pointer >= this._stack.length - 1) {

        return false;
    }

    var rec = this._stack[++this._pointer];

    if (rec instanceof Flag) {

        var endFlagIdx = this._stack.indexOf(rec.pair);

        if (endFlagIdx !== -1) {

            while (++this._pointer !== endFlagIdx) {

                let _rec = this._stack[this._pointer];

                if (!(_rec instanceof Flag)) {
                    this._call(_rec.redo);
                }
            }
        }
    }
    else {
        this._call(rec.redo);
    }

    this.emit('change');
};

p._call = function (reg) {

    var block = this.blockSaving();

    if (typeof reg === 'function') {

        reg();
    }
    else {
        reg[0].apply(reg[1], reg.slice(2));
    }

    this.releaseBlock(block);
};

p.save = function (...args) {

    if (this.isBlocked) return;

    if (args.length === 0) throw Error;

    var reg = args[0];

    if (args.length !== 1) {

        reg = {
            undo: args[0],
            redo: args[1],
            name: args[2],
        };
    }

    this._saveReg(reg);

    return reg;
};


p._saveReg = function (reg) {

    if (this.isBlocked) return;

    this._stack.splice(++this._pointer, this._stack.length, reg);

    this.emit('change');
};



p.getRecords = function () {

    var items = [], currFlag, pointer = this._pointer;

    this._stack.forEach(function (item, idx) {

        if (currFlag) {

            if (item === currFlag.pair) {

                currFlag = undefined;
            }
        }
        else {

            if (item instanceof Flag) {

                currFlag = item;
                add(item.name, this._stack.indexOf(item.pair) - 1);
            }
            else {
                add(item.name, idx);
            }
        }
    }, this);

    return items;


    function add(name, idx) {

        items.push({
            name: name || 'unnamed record',
            idx: idx,
            executed: idx <= pointer
        });
    }
};

p.goto = function (idx) {

    idx = Math.max(-1, Math.min(this._stack.length-1, parseInt(idx)));

    if (idx < this._pointer) {

        while (idx < this._pointer) {

            this.undo();
        }
    }
    else if (idx > this._pointer) {

        while (idx > this._pointer) {

            this.redo();
        }
    }
};




Object.defineProperty(p, 'isBlocked', {
    get: function () {
        return this._blocks.size !== 0;
    }
});

p.blockSaving = function () {

    var block = Symbol();
    this._blocks.add(block);

    return block;
};

p.releaseBlock = function (block) {

    this._blocks.delete(block);
};

p.dontSave = function (fn) {

    var block = this.blockSaving();
    fn();
    this.releaseBlock(block);
};






function Flag(name, pair) {

    this.name = name;
    this.pair = pair || new Flag(name, this);

    Object.freeze(this);
}

p.startFlag = function (name) {

    var flag = new Flag(name);

    this._saveReg(flag);

    return flag.pair;
};

p.endFlag = function (flag) {

    this._saveReg(flag);
};

p.wrap = function (opt) {

    var history = this,
        fn = opt.fn,
        delay = opt.delay,
        name = opt.name;

    if (delay === undefined) {

        return function () {

            let endFlag = history.startFlag(name);

            fn.apply(this, arguments);

            history.endFlag(endFlag);
        };
    }
    else {
        let closeFlagSetT,
            endFlag,
            finish = () => {
                history.endFlag(endFlag);
                endFlag = undefined;
            },
            onCalled = () => {
                if (!endFlag) {
                    endFlag = am.history.startFlag(name);
                }
                clearTimeout(closeFlagSetT);
                closeFlagSetT = setTimeout(finish, delay);
            };

        return function () {

            onCalled();

            fn.apply(this, arguments);
        };
    }
};








p.saveChain = function (opt) {

    if (this.isBlocked) return;

    var chain = this.getChain(opt.id);

    if (chain) {

        chain.reg.redo = opt.redo;
    }
    else {

        chain = {
            id: opt.id,
            reg: this.save(opt.undo, opt.redo, opt.name)
        };
        this._chains.push(chain);
    }

    if (opt.delay === undefined) {
        opt.delay = 312;
    }

    clearTimeout(chain.tid);
    chain.tid = setTimeout(this.closeChain.bind(this, opt.id), opt.delay);
};

p.closeChain = function (id) {

    var chain = this.getChain(id);

    if (!chain) {
        return;
    }

    clearTimeout(chain.tid);
    this._chains.splice(this._chains.indexOf(chain), 1);
};

p.clear = function () {

    while (this._chains.length) {
        this.closeChain(this._chains[0].id);
    }

    this._stack.length = 0,
    this._pointer = -1;

    this.emit('change');
};

p.getChain = function (id) {

    return this._chains.find(function (chain) {

        return chain.id === id;
    });
};







//TODO
// p.wrapFunctionPairs(opt) {

//     var slice = Array.prototype.slice,
//         oriUndoFn = opt.undoRoot[opt.undoFnName],
//         history = this,
//         dummyHistory = {
//             save: function () {},
//             flag: function () {},
//             endFlag: function () {},
//         },
//         undoHistory = Object.create(dummyHistory),
//         redoHistory = Object.create(dummyHistory);

//     undoHistory.save = function () {

//         history.save([opt.undo.addParam, this, param, true],
//             [this.removeParam, this, param, true], 'remove param ' + opt.name);
//     }

//     opt.undo.parent[opt.undo.fnName] = function () {

//         var args = slice.call(arguments);
//         args.push(undoHistory);

//         oriUndoFn.apply(opt.undo.thisArg, args)
//     }
// }
