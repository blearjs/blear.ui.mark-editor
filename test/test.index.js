/**
 * karma 测试 文件
 * @author ydr.me
 * @create 2016-05-17 12:13
 */


'use strict';

var index = require('../src/index.js');

describe('blear.ui.mark-editor', function () {

    it('exports', function () {
        expect(index).toEqual('index');
    });

});
