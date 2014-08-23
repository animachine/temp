var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var dialogKeyOptions = require('./dialogKeyOptions');
var amgui = require('../../amgui');

function Key (opt) {

    EventEmitter.call(this);
    
    this._time = opt.time || 0,
    this._value = opt.value || '',
    this._deKeyline = opt.deKeyline,
    this.ease = 'linear';

    this._onChangeDeTime = this._onChangeDeTime.bind(this);
    this._onSelectDropdown = this._onSelectDropdown.bind(this);
    this._onChangeEase = this._onChangeEase.bind(this);
    this._onChangeTape = this._onChangeTape.bind(this);

    this.domElem = this._deKeyline.addKey({
        timescale: am.timeline.timescale,
        time: this.time
    });

    this._deMenu = amgui.createDropdown({
        options: ['ease', 'delete']
    });
    this._deMenu.addEventListener('select', this._onSelectDropdown);

    this.domElem.addEventListener('changeTime', this._onChangeDeTime);
    am.timeline.on('changeTape', this._onChangeTape);

    amgui.bindDropdown({
        deTarget: this.domElem,
        deMenu: this._deMenu,
        asContextMenu: true
    });
}

inherits(Key, EventEmitter);
var p = Key.prototype;

Object.defineProperties(p, {

    time: {
        set: function (v) {

            if (this._time === v) return;

            this._time = v;

            this.domElem.setTime(this._time);
        },
        get: function () {

            return this._time;
        }
    },
    value: {
        set: function (v) {

            if (this._value === v) return;

            this._value = v;
        },
        get: function () {

            return this._value;
        }
    }
})

p._onChangeDeTime = function (e) {

    this.time = e.detail.time;

    this.emit('changeTime');
};

p._onSelectDropdown = function (e) {
    
    var selection = e.detail.selection;

    if (selection === 'ease') {

        dialogKeyOptions.show({
            ease: this.ease,
        });
        
        dialogKeyOptions.on('changeEase', this._onChangeEase);
    }
    else if (selection === 'delete') {

        this.emit('delete', this);
    }
};

p._onChangeEase = function (ease) {

    this.ease = ease;
};

p._onChangeTape = function () {

    domElem.setTimescale(am.timeline.timescale);
};

p.dispose = function () {

    this.domElem.removeEventListener('changeTime', this._onChangeDeTime);
    this._deMenu.removeEventListener('select', this._onSelectDropdown);
    am.timeline.removeListener('changeTape', this._onChangeTape);

    if (this.domElem.parentNode) this.domElem.parentNode.removeChild(this.domElem); 
    if (this._deMenu.parentNode) this._deMenu.parentNode.removeChild(this._deMenu); 
};

module.exports = Key;
