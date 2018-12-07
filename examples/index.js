/**
 * 文件描述
 * @author ydr.me
 * @create 2016-06-27 17:34
 */


'use strict';

var MarkEditor = require('../src/index');

var me = new MarkEditor({
    el: '#textarea',
    id: 'demo'
});


// document.getElementById('focus1').onclick = function () {
//     me.focus();
// };
//
// document.getElementById('focus2').onclick = function () {
//     me.focus(true);
// };
//
// me.on('different', function (backup, current) {
//     if (confirm(
//         '发现备份的内容（' + backup.val.length + '字）与当前内容（' +
//         current.val.length + '字）不同，是否需要恢复？'
//     )) {
//         me.setText(backup.val, backup.sel);
//     }
// });

window.me = me;

