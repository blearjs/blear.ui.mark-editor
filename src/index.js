/**
 * blear.ui.mark-editor
 * @author ydr.me
 * @create 2016年06月04日14:09:36
 */

'use strict';

var UI = require('blear.ui');
var object = require('blear.utils.object');
var string = require('blear.utils.string');
var textarea = require('blear.utils.textarea');
var fun = require('blear.utils.function');
var selector = require('blear.core.selector');
var event = require('blear.core.event');
var storage = require('blear.core.storage')(localStorage);
var History = require('blear.classes.history');
var Hotkey = require('blear.classes.hotkey');

var defaults = {
    /**
     * @type HTMLTextAreaElement | string
     */
    el: '',

    /**
     * 编辑器对应唯一 ID，用于历史记录恢复
     * @type string
     */
    id: '',

    /**
     * 缩进长度
     * @type number
     */
    tabSize: 4
};
var namspace = 'blear.ui.mark-editor';
var MarkEditor = UI.extend({
    className: 'MarkEditor',
    constructor: function (options) {
        var the = this;

        options = the[_options] = object.assign({}, defaults, options);
        the[_textareaEl] = selector.query(options.el)[0];
        MarkEditor.parent(the);
        the[_initData]();
        the[_initEvent]();
    },

    /**
     * 绑定热键
     * @param key {string} 键
     * @param callback {function} 回调
     * @returns {MarkEditor}
     */
    bind: function (key, callback) {
        var the = this;

        // 增加缩进
        the[_hotkey].bind(key, function (ev, keys) {
            callback.call(the, ev, keys);
            the[_pushHistory]();
            ev.preventDefault();
        });

        return the;
    },

    /**
     * 增加缩进
     * @returns {MarkEditor}
     */
    indent: function () {
        var the = this;
        var tab = string.repeat(' ', options.tabSize);
        var sel = textarea.getSelection(the[_textareaEl]);

        textarea.insert(the[_textareaEl], tab, sel, false);
        the[_pushHistory]();
        return the;
    },

    /**
     * 减少缩进
     * @returns {MarkEditor}
     */
    outdent: function () {
        var the = this;

        the[_pushHistory]();
        return the;
    }
});
var proto = MarkEditor.prototype;
var sole = MarkEditor.sole;
var _options = sole();
var _textareaEl = sole();
var _initData = sole();
var _initEvent = sole();
var _hotkey = sole();
var _history = sole();
var _onInput = sole();
var _pushHistory = sole();

/**
 * 初始化数据
 */
proto[_initData] = function () {
    var the = this;
    var options = the[_options];
    var id = options.id;

    // 没有 ID 不需要关心历史记录问题
    if (!id) {
        return;
    }

    var neo = the[_textareaEl].value;
    var old = getBackup(id);

    the.emit('different', neo, old);
};

/**
 * 初始化事件
 */
proto[_initEvent] = function () {
    var the = this;
    var ctrlKey = Hotkey.mac ? 'meta' : 'ctrl';

    the[_hotkey] = new Hotkey({
        el: the[_textareaEl]
    });
    the[_history] = new History();
    the.bind('tab', the.indent);
    the.bind('shift+tab', the.outdent);
    event.on(the[_textareaEl], 'input select', the[_onInput] = fun.throttle(function () {
        the[_pushHistory]();
    }));
};

/**
 * 入栈
 */
proto[_pushHistory] = function () {
    var the = this;
    var active = the[_history].active();
    var sel = textarea.getSelection(the[_textareaEl]);
    var val = the[_textareaEl].value;

    // 两次记录完全一致，则不入栈
    if (active && active.sel[0] === sel[0] && active.sel[1] === sel[1] && val === active.val) {
        return;
    }

    the[_history].push({
        sel: sel,
        val: val
    });
};


MarkEditor.defaults = defaults;
module.exports = MarkEditor;

// =================================================================
// =================================================================
// =================================================================

function keyWrap(id) {
    return namspace + 'ø' + id;
}

/**
 * 获取备份信息
 * @param id
 * @returns {Object}
 */
function getBackup(id) {
    return storage.get(keyWrap(id));
}

/**
 * 获取备份信息
 * @param id
 * @param value
 * @returns {Object}
 */
function setBackup(id, value) {
    return storage.get(keyWrap(id), {
        value: value,
        url: location.href,
        time: new Date()
    });
}
