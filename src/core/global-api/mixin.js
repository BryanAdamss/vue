/* @flow */

import { mergeOptions } from '../util/index'

// 注册mixin；全局的mixin会影响之后创建的所有Vue实例(因为其永久更改了Vue构造函数的options)
export function initMixin(Vue: GlobalAPI) {
  Vue.mixin = function(mixin: Object) {
    // 合并options
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
