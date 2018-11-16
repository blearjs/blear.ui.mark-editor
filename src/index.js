/**
 * blear.ui.mark-editor
 * @author ydr.me
 * @create 2016年06月04日14:09:36
 */

'use strict';

var UI = require('blear.ui');
var array = require('blear.utils.array');
var object = require('blear.utils.object');
var string = require('blear.utils.string');
var textarea = require('blear.utils.textarea');
var access = require('blear.utils.access');
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
        // 初始历史记录点
        the.setText(the[_textareaEl].value);
    },

    /**
     * 获取选区里的行信息
     * @param sel
     * @returns {{line: number, start: number, end: number, selStart: number, selEnd: number, text: string, inSel: boolean}[]}
     */
    getLines: function (sel) {
        var the = this;
        var start = sel[0];
        var end = sel[1];
        var splits = the[_textareaEl].value.split(/\n/);
        var pass = 0;
        var lines = [];

        array.each(splits, function (index, text) {
            var length = text.length;
            var lineStart = pass;
            var lineEnd = pass + length;
            pass += length + 1;

            // 不选区的行
            if (lineEnd < start || lineStart > end) {
                lines.push({
                    line: index,
                    start: lineStart,
                    end: lineEnd,
                    text: text,
                    inSel: false
                });
            } else {
                lines.push({
                    line: index,
                    start: lineStart,
                    end: lineEnd,
                    selStart: Math.max(lineStart, start),
                    selEnd: Math.min(lineEnd, end),
                    text: text,
                    inSel: true
                });
            }
        });

        return lines;
    },

    /**
     * 设置文本
     * @param text {string} 值
     * @param [sel] {(number)[]} 选区，默认末尾
     * @returns {MarkEditor}
     */
    setText: function (text, sel) {
        var the = this;
        var length = text.length;
        the[_textareaEl].value = text;
        sel = sel || [length, length];
        the.setSelection(sel);
        the[_pushHistory]();
        return the;
    },

    /**
     * 获取文本
     * @returns {string}
     */
    getText: function () {
        return this[_textareaEl].value;
    },

    /**
     * 聚焦
     * @param [end=false] {boolean} 是否聚焦到末尾
     * @returns {MarkEditor}
     */
    focus: function (end) {
        var the = this;
        var sel = the.getSelection();

        if (end) {
            var length = the[_textareaEl].value.length;
            sel = [length, length];
        }

        the.setSelection(sel);
        return the;
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
     * 获取选区位置
     * @returns {(number)[]}
     */
    getSelection: function () {
        var the = this;
        return textarea.getSelection(the[_textareaEl]);
    },

    /**
     * 获取选区坐标
     * @returns {({left: number, top: number})[]}
     */
    getSelectionRect: function () {
        var the = this;
        return textarea.getSelectionRect(the[_textareaEl]);
    },

    /**
     * 设置选区位置
     * @param sel
     * @returns {MarkEditor}
     */
    setSelection: function (sel) {
        var the = this;
        textarea.setSelection(the[_textareaEl], sel);
        return the;
    },

    /**
     * 增加缩进
     * @returns {MarkEditor}
     */
    indent: function () {
        var the = this;
        var options = the[_options];
        var tabSize = options.tabSize;
        var tab = string.repeat(' ', tabSize);
        var sel = the.getSelection();
        var lines = the.getLines(sel);
        var val = '';
        var selStart = -1;
        var selEnd = -1;
        var tabs = 0;

        array.each(lines, function (index, line) {
            var text1 = line.text;

            if (line.inSel) {
                if (selStart === -1) {
                    selStart = line.selStart + tabSize;
                }

                tabs++;
                selEnd = line.selEnd + tabSize * tabs;
                val += tab + text1 + '\n';
            } else {
                val += text1 + '\n';
            }
        });
        the.setText(val, [selStart, selEnd]);
        return the;
    },

    /**
     * 减少缩进
     * @returns {MarkEditor}
     */
    outdent: function () {
        var the = this;
        var options = the[_options];
        var tabSize = options.tabSize;
        var tab = string.repeat(' ', tabSize);
        var tabRE = new RegExp('^\\s{' + tabSize + '}');
        var sel = the.getSelection();
        var lines = the.getLines(sel);
        var val = '';
        var selStart = -1;
        var selEnd = -1;
        var tabs = 0;

        array.each(lines, function (index, line) {
            var text1 = line.text;

            if (line.inSel) {
                var text2 = text1.replace(tabRE, '');
                var selStart1 = line.selStart;

                // 没有任何缩进了

                if (text2 === text1) {
                    val += text1 + '\n';

                    if (selStart === -1) {
                        selStart = selStart1;
                    }
                } else {
                    val += text2 + '\n';
                    tabs++;

                    if (selStart === -1) {
                        selStart = selStart1 - tabSize;
                    }
                }

                selEnd = line.selEnd - tabSize * tabs;
            } else {
                val += text1 + '\n';
            }
        });
        the.setText(val, [selStart, selEnd]);
        return the;
    },

    /**
     * 撤销
     * @returns {MarkEditor}
     */
    undo: function () {
        var the = this;
        var record = the[_history].back();
        the.setText(record.val, record.sel);
        return the;
    },

    /**
     * 重做
     * @returns {MarkEditor}
     */
    redo: function () {
        var the = this;
        var record = the[_history].forward();
        the.setText(record.val, record.sel);
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
    var shiftKey = 'shift';
    var tabKey = 'tab';
    var keys = function () {
        return access.args(arguments).join('+');
    };

    the[_hotkey] = new Hotkey({
        el: the[_textareaEl]
    });
    the[_history] = new History();
    the.bind(keys(tabKey), the.indent);
    the.bind(keys(shiftKey, tabKey), the.outdent);
    the.bind(keys(ctrlKey, 'z'), the.undo);
    the.bind(keys(ctrlKey, shiftKey, 'z'), the.redo);
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
    var id = the[_options].id;

    // 两次记录完全一致，则不入栈
    if (
        active &&
        // 选区一致
        active.sel[0] === sel[0] && active.sel[1] === sel[1] &&
        // 内容一致
        val === active.val
    ) {
        return;
    }

    the[_history].push({
        sel: sel,
        val: val
    });
    setBackup(id, val, sel);
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
 * @param val
 * @param sel
 * @returns {Object}
 */
function setBackup(id, val, sel) {
    return storage.set(keyWrap(id), {
        val: val,
        sel: sel,
        url: location.href,
        time: new Date()
    });
}
