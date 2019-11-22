/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto) // 原型继承,arrayMethods.__proto__===Array.prototype

// 改变数组自身内容的方法都需要拦截
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function(method) {
  // cache original method
  // 缓存原始方法
  const original = arrayProto[method]

  def(arrayMethods, method, function mutator(...args) {
    // 调用原始方法，拿到正确结果
    const result = original.apply(this, args)

    // 拿到定义在Array实例上的Observer实例
    const ob = this.__ob__

    // 将数组中新添加的元素转为响应式
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)

    // notify change
    // 调用方法时，通知依赖进行更新
    ob.dep.notify()

    // 返回原始方法执行结果
    return result
  })
})
