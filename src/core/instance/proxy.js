/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import { warn, makeMap, isNative } from '../util/index'

let initProxy

if (process.env.NODE_ENV !== 'production') {
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
      'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
      'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
      'require' // for Webpack/Browserify
  )

  // 警告，在渲染时使用了未定义的属性
  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
        'referenced during render. Make sure that this property is reactive, ' +
        'either in the data option, or for class-based components, by ' +
        'initializing the property. ' +
        'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }
  // 判断原生的Proxy对象是否存在
  const hasProxy = typeof Proxy !== 'undefined' && isNative(Proxy)

  if (hasProxy) {
    const isBuiltInModifier = makeMap(
      'stop,prevent,self,ctrl,shift,alt,meta,exact'
    )
    config.keyCodes = new Proxy(config.keyCodes, {
      set(target, key, value) {
        if (isBuiltInModifier(key)) {
          warn(
            `Avoid overwriting built-in modifier in config.keyCodes: .${key}`
          )
          return false
        } else {
          target[key] = value
          return true
        }
      }
    })
  }

  // 判断target中是否有key属性
  const hasHandler = {
    has(target, key) {
      const has = key in target // key在target中存在
      const isAllowed =
        allowedGlobals(key) ||
        (typeof key === 'string' && key.charAt(0) === '_') // key是一个被允许的全局关键字，或私有属性

      // 既不存在也不被允许，则报找不到属性的错误
      if (!has && !isAllowed) {
        warnNonPresent(target, key)
      }

      return has || !isAllowed
    }
  }

  // 返回target[key]
  const getHandler = {
    get(target, key) {
      // key为string但不存在于target中，则报找不到属性的错误
      if (typeof key === 'string' && !(key in target)) {
        warnNonPresent(target, key)
      }

      return target[key]
    }
  }

  initProxy = function initProxy(vm) {
    if (hasProxy) {
      // determine which proxy handler to use
      const options = vm.$options
      const handlers =
        options.render && options.render._withStripped ? getHandler : hasHandler
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
