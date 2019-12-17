/* @flow */

import config from '../config'
import { warn } from './debug'
import { inBrowser, inWeex } from './env'

// 错误传播规则见https://cn.vuejs.org/v2/api/#errorCaptured
export function handleError (err: Error, vm: any, info: string) {
  if (vm) {
    let cur = vm
    while ((cur = cur.$parent)) {
      // 依次触发父组件errorCaptured钩子函数
      const hooks = cur.$options.errorCaptured
      if (hooks) {
        for (let i = 0; i < hooks.length; i++) {
          try {
            const capture = hooks[i].call(cur, err, vm, info) === false // 如果errorCaptured钩子返回false，则停止向上传播错误
            if (capture) return
          } catch (e) {
            // errorCaptured中抛出的错误，也会发送给config.errorHandler
            globalHandleError(e, cur, 'errorCaptured hook')
          }
        }
      }
    }
  }
  // 将当前错误err发送给config.errorHandler
  globalHandleError(err, vm, info)
}

function globalHandleError (err, vm, info) {
  if (config.errorHandler) {
    try {
      return config.errorHandler.call(null, err, vm, info)
    } catch (e) {
      // config.errorHandler抛出的错误，会打印出来
      logError(e, null, 'config.errorHandler')
    }
  }
  logError(err, vm, info)
}

function logError (err, vm, info) {
  if (process.env.NODE_ENV !== 'production') {
    warn(`Error in ${info}: "${err.toString()}"`, vm)
  }
  /* istanbul ignore else */
  if ((inBrowser || inWeex) && typeof console !== 'undefined') {
    console.error(err)
  } else {
    throw err
  }
}
