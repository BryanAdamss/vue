/* @flow */

import { toArray } from '../util/index'

// 注册Plugin
export function initUse(Vue: GlobalAPI) {
  // plugin可以是一个对象，也可以是一个函数
  // 若是对象，则需要提供install方法；若是函数，则其会当作install
  // 注册时，会将Vue传入plugin，供其初始化
  Vue.use = function(plugin: Function | Object) {
    const installedPlugins =
      this._installedPlugins || (this._installedPlugins = []) // 缓存

    // 防止重复安装plugin
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1) // 切分额外参数
    args.unshift(this) // 塞入this即Vue

    // 提供了install的对象
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 传入的是函数，则将其当作install方法调用
      plugin.apply(null, args)
    }

    // 添加到缓存中
    installedPlugins.push(plugin)
    return this
  }
}
