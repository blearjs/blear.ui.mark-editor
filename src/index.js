/**
 * blear.ui.mark-editor
 * @author ydr.me
 * @create 2016年06月04日14:09:36
 */

'use strict';

var UI = require('blear.ui');
var Textarea = require('blear.ui.textarea');
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
var attribute = require('blear.core.attribute');
var layout = require('blear.core.layout');

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
    tabSize: 4,

    /**
     * 最大高度
     */
    maxHeight: 400
};
var namspace = 'blear.ui.mark-editor';
var MarkEditor = UI.extend({
    className: 'MarkEditor',
    constructor: function (options) {
        var the = this;

        the[_options] = object.assign({}, defaults, options);
        MarkEditor.parent(the);
        the[_initData]();
        the[_initNode]();
        the[_initEvent]();
        // 初始历史记录点
        the.setText(the[_textareaEl].value);
    },

    /**
     * 获取选区里的行信息
     * @returns {{line: number, start: number, end: number, selStart: number, selEnd: number, text: string, inSel: boolean}[]}
     */
    getLines: function (inSel) {
        var the = this;
        var sel = the.getSelection();
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

            if (inSel && lineStart > end) {
                return false;
            }

            // 不选区的行
            if (lineEnd < start || lineStart > end) {
                if (!inSel) {
                    lines.push({
                        line: index,
                        start: lineStart,
                        end: lineEnd,
                        text: text,
                        inSel: false
                    });
                }
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
     * @param [preventDefault=true] {boolean} 是否阻止默认行为
     * @returns {MarkEditor}
     */
    bind: function (key, callback, preventDefault) {
        var the = this;

        // 增加缩进
        the[_hotkey].bind(key, function (ev, keys) {
            if (preventDefault !== false) {
                ev.preventDefault();
            }

            callback.call(the, ev, keys);
            the[_pushHistory]();
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
        var lines = the.getLines(true);
        var selStart = -1;
        var selEnd = -1;
        var tabs = 0;
        var detaches = the[_detachLines](lines);
        var before = detaches[0];
        var after = detaches[1];
        var center = '';

        array.each(lines, function (index, line) {
            var lineText = line.text;

            if (selStart === -1) {
                selStart = line.selStart + tabSize;
            }

            tabs++;
            selEnd = line.selEnd + tabSize * tabs;
            center += tab + lineText + '\n';
        });
        the.setText(
            before + center + after,
            [selStart, selEnd]
        );

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
        // var tab = string.repeat(' ', tabSize);
        var tabRE = new RegExp('^\\s{' + tabSize + '}');
        var lines = the.getLines(true);
        var selStart = -1;
        var selEnd = -1;
        var tabs = 0;
        var detaches = the[_detachLines](lines);
        var before = detaches[0];
        var after = detaches[1];
        var center = '';

        array.each(lines, function (index, line) {
            var lineText1 = line.text;
            var lineText2 = lineText1.replace(tabRE, '');
            var lineSelStart = line.selStart;

            // 没有任何缩进了
            if (lineText2 === lineText1) {
                if (selStart === -1) {
                    selStart = lineSelStart;
                }
            } else {
                tabs++;

                if (selStart === -1) {
                    selStart = lineSelStart - tabSize;
                }
            }

            center += lineText2 + '\n';
            selEnd = line.selEnd - tabSize * tabs;
        });
        the.setText(
            before + center + after,
            [selStart, selEnd]
        );

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
    },

    /**
     * 包裹
     * @param before {string} 开始字符
     * @param after {string} 结束字符
     * @param [repeat=false] {boolean} 是否可以重复
     */
    wrap: function (before, after, repeat) {
        var the = this;
        var text = the.getText();
        var sel = the.getSelection();
        var start = sel[0];
        var end = sel[1];
        var begin = text.slice(0, start);
        var finish = text.slice(end);
        var focus = text.slice(start, end);
        var beforeLength = before.length;
        var afterLength = after.length;
        var focusBefore = text.slice(start - beforeLength, start);
        var focusAfter = text.slice(end, end + afterLength);

        // unwrap
        if (!repeat && focusBefore === before && focusAfter === after) {
            the.setText(
                begin.slice(0, -beforeLength) + focus + finish.slice(afterLength),
                [
                    start - beforeLength,
                    end - beforeLength
                ]
            );
        }
        // wrap
        else {
            the.setText(
                begin + before + focus + after + finish,
                [
                    start + beforeLength,
                    end + beforeLength
                ]
            );
        }

        return the;
    },

    /**
     * 加粗
     * @returns {MarkEditor}
     */
    bold: function () {
        return this.wrap('**', '**');
    },

    /**
     * 斜体
     * @returns {MarkEditor}
     */
    italic: function () {
        return this.wrap('_', '_');
    },

    /**
     * 行内代码
     * @returns {MarkEditor}
     */
    lineCode: function () {
        return this.wrap('`', '`', true);
    },

    /**
     * 删除线
     * @returns {MarkEditor}
     */
    through: function () {
        return this.wrap('~~', '~~');
    },

    /**
     * 标题
     * @param level {number} 级别，0-6，0=段落
     * @returns {MarkEditor}
     */
    heading: function (level) {
        var the = this;
        var sel = the.getSelection();
        var start = sel[0];
        var end = sel[1];
        var lines = the.getLines(true);

        // 只有一行
        if (lines.length === 1) {
            var currLine = lines[0];
            var detaches = the[_detachLines](lines);
            var before = detaches[0];
            var after = detaches[1];
            var heading = level ? string.repeat('#', level) + ' ' : '';
            var headingRE = /^#+\s+/;
            var text1 = currLine.text;
            // 1. 先删除已有标题
            var text2 = text1.replace(headingRE, '');
            var delta = text1.length - text2.length;
            var selStart = start - delta;
            var selEnd = end - delta;
            var center = heading + text2;
            var length = heading.length;

            center += '\n';
            the.setText(
                before + center + after,
                [
                    selStart + length,
                    selEnd + length
                ]
            );
        }
    },

    /**
     * 销毁实例
     */
    destroy: function () {
        var the = this;

        event.un(the[_textareaEl], 'input', the[_onInput]);
        the[_textarea].destroy();
        the[_hotkey].destroy();
        the[_history].destroy();
        the[_textarea] = the[_hotkey] = the[_history] = null;
    }
});
var proto = MarkEditor.prototype;
var sole = MarkEditor.sole;
var _options = sole();
var _textareaEl = sole();
var _initData = sole();
var _initNode = sole();
var _initEvent = sole();
var _textarea = sole();
var _hotkey = sole();
var _history = sole();
var _onInput = sole();
var _pushHistory = sole();
var _listenEnter = sole();
var _detachLines = sole();


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
 * 初始化节点
 */
proto[_initNode] = function () {
    var the = this;
    the[_textareaEl] = selector.query(the[_options].el)[0];
};

/**
 * 初始化事件
 */
proto[_initEvent] = function () {
    var the = this;
    var ctrlKey = Hotkey.mac ? 'cmd' : 'ctrl';
    var shiftKey = 'shift';
    var tabKey = 'tab';
    var keys = function () {
        return access.args(arguments).join('+');
    };
    var heading = function (level) {
        return function () {
            return the.heading(level);
        };
    };

    the[_hotkey] = new Hotkey({
        el: the[_textareaEl]
    });
    the[_history] = new History();
    the.bind(keys(tabKey), the.indent);
    the.bind(keys(shiftKey, tabKey), the.outdent);
    the.bind(keys(ctrlKey, 'z'), the.undo);
    the.bind(keys(ctrlKey, shiftKey, 'z'), the.redo);
    the.bind(keys('enter'), the[_listenEnter]);
    the.bind(keys(ctrlKey, 'b'), the.bold);
    the.bind(keys(ctrlKey, 'i'), the.italic);
    the.bind(keys(ctrlKey, 'u'), the.through);
    the.bind(keys('`'), the.lineCode);
    the.bind(keys(ctrlKey, '0'), heading(0));
    the.bind(keys(ctrlKey, '1'), heading(1));
    the.bind(keys(ctrlKey, '2'), heading(2));
    the.bind(keys(ctrlKey, '3'), heading(3));
    the.bind(keys(ctrlKey, '4'), heading(4));
    the.bind(keys(ctrlKey, '5'), heading(5));
    the.bind(keys(ctrlKey, '6'), heading(6));

    event.on(the[_textareaEl], 'input select', the[_onInput] = fun.throttle(function () {
        the[_pushHistory]();
    }));
    the[_textarea] = new Textarea({
        el: the[_textareaEl],
        maxHeight: the[_options].maxHeight,
        // 自行控制更新时机
        keyEvent: null
    });
    the[_textarea].autoHeight();
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

    if (active && val !== active.val) {
        the[_textarea].updateHeight();
    }


    if (id) {
        setBackup(id, val, sel);
    }
};

/**
 * enter 监听
 * @param ev
 */
proto[_listenEnter] = function (ev) {
    var the = this;
    var sel = the.getSelection();
    var start = sel[0];
    var end = sel[1];
    var enterChar = '\n';
    var text = the.getText();
    var before = text.slice(0, start);
    var after = text.slice(end);
    var center = enterChar;

    // 无选区回车
    if (start === end) {
        var lines = the.getLines(true);
        var currLine = lines[0];
        var orderStartRE = /^(\s*)((?:[+*-]|\d+\.)\s)?/;
        // ```在中间回车```
        var preStartRE = /^\s*`{6,}/;
        var currText = currLine.text;
        var orderIndentMatches = currText.match(orderStartRE);

        // 有列表或缩进符号
        if (orderIndentMatches) {
            var tab = orderIndentMatches[1];
            var order = orderIndentMatches[2] || '';

            // 空白列表项，删除之
            if (tab + order === currText) {
                start -= currText.length;
                before = before.slice(0, start);
            } else {
                order = order.replace(/^(\d+)\./, function (input, index) {
                    return index * 1 + 1 + '.';
                });
                center += tab + order;
            }
        }

        // 有块级代码
        if (preStartRE.test(currText)) {
            after = '\n' + after;
        }
    }

    // 1. 删除选区内的内容
    // 2. 插入一个换行符号
    var delta = center.length;
    // 3. 定位到换行符之后
    the.setText(
        before + center + after,
        [start + delta, start + delta]
    );
};

/**
 * 分离行
 * @param lines
 * @returns {string[]}
 */
proto[_detachLines] = function (lines) {
    var the = this;
    var firstLine = lines[0];
    var lastLine = lines[lines.length - 1];
    var text = the.getText();
    var before = text.slice(0, firstLine.start);
    var after = text.slice(lastLine.end + 1);
    return [before, after];
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
