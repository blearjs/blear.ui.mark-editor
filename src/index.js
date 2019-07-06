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
var time = require('blear.utils.time');
var selector = require('blear.core.selector');
var attribute = require('blear.core.attribute');
var modification = require('blear.core.modification');
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
    tabSize: 4,

    /**
     * 最大高度
     */
    maxHeight: 400,

    /**
     * 添加的 className
     */
    addClass: '',

    /**
     * 渲染头部（全屏下显示）
     * @param headerEl
     */
    renderHeader: function (headerEl) {

    },

    /**
     * 渲染底部（全屏下显示）
     * @param footerEl
     */
    renderFooter: function (footerEl) {

    },

    /**
     * 粘贴图片时
     * @param image
     * @param done
     */
    onPasteImage: function (image, done) {
        // done(null, url);
        done(new Error('未配置粘贴图片上传函数'));
    },

    onMention: function () {
        // return false 表示禁止默认行为
    }
};
var namspace = 'blearui-markEditor';
var inputEventType = 'input';
var inputSelectEventType = inputEventType + ' select';
var pastDropEventType = 'paste drop';
var ctrlKey = Hotkey.mac ? 'cmd' : 'ctrl';
var shiftKey = 'shift';
var altKey = 'alt';
var tabKey = 'tab';
var nextTick = time.nextTick;
var MarkEditor = UI.extend({
    className: 'MarkEditor',
    constructor: function (options) {
        var the = this;

        the[_options] = object.assign({}, defaults, options);
        the[_fullscreen] = false;
        the[_hotkeyCtrled] = true;
        the[_mentionStarted] = false;
        the[_mentionPos0] = 0;
        the[_mentionPos1] = 0;
        MarkEditor.parent(the);
        the[_initNode]();
        the[_initData]();
        the[_initEvent]();
        the[_initMention]();
        the[_pushHistory]();
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
        event.emit(the[_textareaEl], 'input');
        event.emit(the[_textareaEl], 'change');
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

        // 绑定热键
        the[_hotkey].bind(key, function (ev, keys) {
            if (!the[_hotkeyCtrled]) {
                return;
            }

            if (preventDefault !== false) {
                ev.preventDefault();
            }

            callback.call(the, ev, keys);
            the[_pushHistory]();
        });

        return the;
    },

    /**
     * 控制热键，可以将热键控制权移交出去
     * @param boolean
     * @returns {MarkEditor}
     */
    ctrlHotkey: function (boolean) {
        var the = this;
        the[_hotkeyCtrled] = boolean;
        return the;
    },

    /**
     * 外部主动结束 mention 行为
     * @returns {MarkEditor}
     */
    mentionEnd: function () {
        var the = this;

        if (!the[_mentionStarted]) {
            return the;
        }

        the[_mentionStarted] = false;
        nextTick(function () {
            the.ctrlHotkey(true);
            the.emit('mentionEnd', [the[_mentionPos0], the[_mentionPos1]]);
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
        // 1 - tabSize 个空格都可以
        var tabRE = new RegExp('^\\s{1,' + tabSize + '}');
        var lines = the.getLines(true);
        var selStart = -1;
        var selEnd = -1;
        var detaches = the[_detachLines](lines);
        var before = detaches[0];
        var after = detaches[1];
        var center = '';
        var deltas = 0;

        array.each(lines, function (index, line) {
            var lineText1 = line.text;
            var lineText2 = lineText1.replace(tabRE, '');
            var lineSelStart = line.selStart;
            var delta = lineText1.length - lineText2.length;

            if (selStart === -1) {
                // 起点必须在当前行
                selStart = Math.max(lineSelStart - delta, line.start);
            }

            center += lineText2 + '\n';
            deltas += delta;
            selEnd = line.selEnd - deltas;
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
        the[_textarea].updateHeight();
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
        the[_textarea].updateHeight();
        return the;
    },

    /**
     * 插入文本
     * @param text {String} 待插入的文本
     * @param [mode=2] {Number|Array} 插入模式，0=定位到文本开始，1=选中文本，2=定位到文本结尾，如果是数组则作为相对选区
     * @returns {MarkEditor}
     */
    insert: function (text, mode) {
        var the = this;
        textarea.insert(the[_textareaEl], text, mode);
        the[_pushHistory]();
        return the;
    },

    /**
     * 包裹
     * @param before {string} 开始字符
     * @param after {string} 结束字符
     * @param [mode=0] {Number} 模式，0=切换模式，1=重复模式
     * @returns {MarkEditor}
     */
    wrap: function (before, after, mode) {
        var the = this;
        textarea.wrap(the[_textareaEl], before, after, mode);
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
    code: function () {
        return this.wrap('`', '`', 1);
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
     * 插入横线
     * @returns {MarkEditor}
     */
    line: function () {
        return this.insert('\n\n------\n\n', 2);
    },

    /**
     * 插入链接
     * @returns {MarkEditor}
     */
    link: function (text, url) {
        var start = 1;
        var end = text.length + start;
        return this.insert('[' + text + '](' + url + ')', [start, end]);
    },

    /**
     * 插入图片
     * @param alt
     * @param url
     * @returns {MarkEditor}
     */
    image: function (alt, url) {
        var start = 2;
        var end = start + alt.length;
        return this.insert('![' + alt + '](' + url + ')', [start, end]);
    },

    /**
     * 插入表格
     * @returns {MarkEditor}
     */
    table: function () {
        return this.insert(
            [
                '| th1 | th2 |',
                '| --- | --- |',
                '| td1 | td2 |',
                ''
            ].join('\n'),
            [2, 5]
        );
    },

    /**
     * 切换全屏
     * @returns {MarkEditor}
     */
    fullscreen: function () {
        var the = this;
        var fullscreenClassName = namspace + '_fullscreen';
        var overflowClassName = namspace + '-overflow';
        var htmlEl = document.documentElement;
        var bodyEl = document.body;

        if (the[_fullscreen]) {
            attribute.removeClass(the[_editorEl], fullscreenClassName);
            attribute.removeClass(htmlEl, overflowClassName);
            attribute.removeClass(bodyEl, overflowClassName);
            the[_textarea].autoHeight(true);
            attribute.style(the[_bodyEl], 'zIndex', '');
            the.emit('exitFullscreen');
        } else {
            attribute.addClass(the[_editorEl], fullscreenClassName);
            the[_textarea].autoHeight(false);
            attribute.style(the[_textareaEl], {
                height: '100%'
            });
            attribute.addClass(htmlEl, overflowClassName);
            attribute.addClass(bodyEl, overflowClassName);
            attribute.style(the[_bodyEl], 'zIndex', UI.zIndex());
            the.emit('enterFullscreen');
        }

        the[_fullscreen] = !the[_fullscreen];
        return the;
    },

    /**
     * 判断当前是否为全屏状态
     * @returns {Boolean}
     */
    isFullscreen: function () {
        return this[_fullscreen];
    },

    /**
     * 获取头部元素
     * @returns {HTMLDivElement}
     */
    getHeaderEl: function () {
        return this[_headerEl];
    },

    /**
     * 获取容器元素
     * @returns {HTMLDivElement}
     */
    getContainerEl: function () {
        return this[_containerEl];
    },

    /**
     * 获取底部元素
     * @returns {HTMLDivElement}
     */
    getFooterEl: function () {
        return this[_footerEl];
    },

    /**
     * 销毁实例
     */
    destroy: function () {
        var the = this;

        event.un(the[_textareaEl], inputSelectEventType, the[_onInput]);
        event.un(the[_textareaEl], inputEventType, the[_onMentionPress]);
        the[_textarea].destroy();
        the[_hotkey].destroy();
        the[_history].destroy();
        the[_textarea] = the[_hotkey] = the[_history] = null;
        modification.insert(the[_textareaEl], the[_placeholderEl], 3);
        modification.remove(the[_placeholderEl]);
        modification.remove(the[_containerEl]);
    }
});
var proto = MarkEditor.prototype;
var sole = MarkEditor.sole;
var _options = sole();
var _textareaEl = sole();
var _editorEl = sole();
var _placeholderEl = sole();
var _bodyEl = sole();
var _headerEl = sole();
var _containerEl = sole();
var _footerEl = sole();
var _initData = sole();
var _initNode = sole();
var _initEvent = sole();
var _initMention = sole();
var _textarea = sole();
var _hotkey = sole();
var _history = sole();
var _onInput = sole();
var _onPaste = sole();
var _onMentionStart = sole();
var _onMentionPress = sole();
var _onMentionEnd = sole();
var _pushHistory = sole();
var _listenEnter = sole();
var _detachLines = sole();
var _fullscreen = sole();
var _parsePasteImage = sole();
var _hotkeyCtrled = sole();
var _mentionStarted = sole();
var _mentionPos0 = sole();
var _mentionPos1 = sole();

/**
 * 初始化节点
 */
proto[_initNode] = function () {
    var the = this;
    var options = the[_options];

    the[_editorEl] = modification.parse(require('./template.html'));
    the[_textareaEl] = selector.query(the[_options].el)[0];
    modification.insert(the[_editorEl], the[_textareaEl], 3);

    var children = selector.children(the[_editorEl]);
    the[_placeholderEl] = children[0];
    the[_bodyEl] = children[1];

    children = selector.children(the[_bodyEl]);
    the[_headerEl] = children[0];
    the[_containerEl] = children[1];
    the[_footerEl] = children[2];
    modification.insert(the[_textareaEl], the[_containerEl]);

    attribute.addClass(the[_editorEl], options.addClass);
    options.renderHeader.call(the, the[_headerEl]);
    options.renderFooter.call(the, the[_footerEl]);
};

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

    var val = the[_textareaEl].value;
    var sel = the.getSelection();
    var current = {
        val: val,
        sel: sel
    };
    var backup = getBackup(id);

    if (backup && backup.val.length > 0 && backup.val !== current.val) {
        // 异步发送
        nextTick(function () {
            the.emit('different', backup, current);
        });
    }
};

/**
 * 初始化事件
 */
proto[_initEvent] = function () {
    var the = this;
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
    the.bind(keys('`'), the.code);
    the.bind(keys(ctrlKey, '0'), heading(0));
    the.bind(keys(ctrlKey, '1'), heading(1));
    the.bind(keys(ctrlKey, '2'), heading(2));
    the.bind(keys(ctrlKey, '3'), heading(3));
    the.bind(keys(ctrlKey, '4'), heading(4));
    the.bind(keys(ctrlKey, '5'), heading(5));
    the.bind(keys(ctrlKey, '6'), heading(6));
    the.bind(keys(ctrlKey, 'l'), the.line);
    the.bind(keys(ctrlKey, 'k'), function () {
        the.link('text', 'url');
    });
    the.bind(keys(ctrlKey, 'g'), function () {
        the.image('alt', 'url');
    });
    the.bind(keys(ctrlKey, altKey, 't'), the.table);
    the.bind(keys(ctrlKey, 'enter'), the.fullscreen);
    event.on(the[_textareaEl], inputSelectEventType, the[_onInput] = fun.throttle(function () {
        the[_pushHistory]();
    }));
    event.on(the[_textareaEl], pastDropEventType, the[_onPaste] = fun.bind(the[_parsePasteImage], the));
    the[_textarea] = new Textarea({
        el: the[_textareaEl],
        maxHeight: the[_options].maxHeight,
        // 自行控制更新时机
        keyEvent: null
    });
    time.nextTick(function () {
        the[_textarea].autoHeight();
    });
    the[_textarea].on('updateHeight', function (height) {
        attribute.style(the[_placeholderEl], 'height', height);
    });
};

proto[_initMention] = function () {
    var the = this;
    var options = the[_options];
    // @
    var mentionStart = function (ev, keys) {
        if (the[_mentionStarted]) {
            mentionEnd();
            return;
        }

        var line = the.getLines(true)[0];
        var text = the.getText();
        var selStart = line.selStart;
        var atBeforeTxt = text.slice(0, selStart);
        var atLeftChar = atBeforeTxt.slice(-1);

        if (!text || /[\s\n]/.test(atLeftChar)) {
            the[_mentionStarted] = true;
            the[_mentionPos0] = the[_mentionPos1] = selStart + 1;
            the.ctrlHotkey(false);
            the.emit('mentionStart', [the[_mentionPos0], the[_mentionPos1]]);
        }
    };
    var mentionMatch = the[_onMentionPress] = function (ev) {
        if (!the[_mentionStarted]) {
            return;
        }

        var line = the.getLines(true)[0];
        var text = the.getText();
        the[_mentionPos1] = line.selStart;

        // 倒删除
        if (the[_mentionPos0] > the[_mentionPos1]) {
            mentionEnd();
            return;
        }

        var keywords = text.slice(the[_mentionPos0], the[_mentionPos1]);
        the.emit('mentionMatch', keywords, [the[_mentionPos0], the[_mentionPos1]]);
    };
    var mentionEnd = function () {
        the.mentionEnd();
    };

    the[_hotkey].bind(shiftKey + '+2', mentionStart);
    event.on(the[_textareaEl], inputEventType, mentionMatch);
    the[_hotkey].bind('space', mentionEnd);
    the[_hotkey].bind('esc', mentionEnd);
    the[_hotkey].bind('enter', mentionEnd);
};

/**
 * 入栈
 */
proto[_pushHistory] = function () {
    var the = this;
    var active = the[_history].active();
    var sel = the.getSelection();
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
    the.emit('change', val, sel);

    if (active && val !== active.val) {
        the[_textarea].updateHeight();
    }

    if (id) {
        setBackup(id, val, sel);
        the.emit('backup', val, sel);
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
        var orderStartRE = /^(\s*)((?:[+*>-]|\d+\.)\s+)?/;
        // ```在中间回车```
        // ```lang在中间回车```
        var preStartRE = /^\s*(([+*>-]|\d+\.)\s+)?`{3,}(.+)?`{3,}/;
        var currText = currLine.text;

        // 有块级代码
        if (preStartRE.test(currText)) {
            after = '\n' + after;
        } else {
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

    // 在末尾回车，自动将编辑器滚动到末尾
    // @todo 判断光标是否在编辑器的可视区域内
    if (after === '') {
        the[_textareaEl].scrollTop = the[_textareaEl].scrollHeight;
    }
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

proto[_parsePasteImage] = function (ev) {
    var the = this;
    var options = the[_options];
    var clipboardData = ev.clipboardData;
    var dataTransfer = ev.dataTransfer;
    var files = null;

    if (clipboardData && clipboardData.files) {
        files = clipboardData.files;
    }

    if (dataTransfer && dataTransfer.files) {
        files = dataTransfer.files;
    }

    if (!files) {
        return;
    }

    var image = null;

    array.each(files, function (index, file) {
        if (/^image\//.test(file.type)) {
            image = file;
            return false;
        }
    });

    if (!image) {
        return false;
    }

    the.emit('pasteImage', image);
    options.onPasteImage.call(the, image, function (err, url) {
        if (err) {
            the.emit('error', err);
            return;
        }

        the.image('粘贴图片', url);
    });

    return false;
};

require('./style.css', 'css|style');
MarkEditor.defaults = defaults;
MarkEditor.Hotkey = Hotkey;
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
        id: keyWrap(id),
        val: val,
        sel: sel,
        url: location.href,
        time: new Date()
    });
}
