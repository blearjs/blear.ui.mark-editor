/**
 * 文件描述
 * @author ydr.me
 * @create 2016-06-27 17:34
 */


'use strict';

var MarkEditor = require('../src/index');

window.layout = require('blear.core.layout');

var me = new MarkEditor({
    el: '#textarea'
});

document.getElementById('focus1').onclick = function () {
    me.focus();
};

document.getElementById('focus2').onclick = function () {
    me.focus(true);
};


window.me = me;

