/* @flow */
/* globals MessageChannel */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

const callbacks = [] // 保存一个事件循环中，需要执行的cb

// 标记当前是否已经向(微、宏)任务队列中添加过flushCallbacks任务
// 如果为true，代表已经向(微、宏)任务队列中添加过一个flushCallback任务
// 如果此时，重复执行nextTick，不会重复添加flushCallback任务，只会再向callbacks中添加一个回调
// 等待flushCallbacks被调用时，一并执行
// 这样就在一个事件循环中，实现了缓冲多个回调一并执行的功能

let pending = false

// 刷新callbacks任务(执行所有callback，并重置callbacks队列)
// 一个事件循环中，flushCallbacks任务只会被执行一次
function flushCallbacks() {
  pending = false
  // 拷贝一份callback
  const copies = callbacks.slice(0)

  // 重置callbacks
  callbacks.length = 0

  // 执行拷贝的callback
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using both microtasks and (macro) tasks.
// In < 2.4 we used microtasks everywhere, but there are some scenarios where
// microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690) or even between bubbling of the same
// event (#6566). However, using (macro) tasks everywhere also has subtle problems
// when state is changed right before repaint (e.g. #6813, out-in transitions).
// Here we use microtask by default, but expose a way to force (macro) task when
// needed (e.g. in event handlers attached by v-on).
// 全部使用微任务、宏任务都会有一些问题；
// 所以vue优先使用微任务，在某些特殊场景(通过v-on绑定的事件处理函数)，会降级使用宏任务
let microTimerFunc
let macroTimerFunc
let useMacroTask = false

// Determine (macro) task defer implementation.
// Technically setImmediate should be the ideal choice, but it's only available
// in IE. The only polyfill that consistently queues the callback after all DOM
// events triggered in the same loop is by using MessageChannel.
/* istanbul ignore if */
// 确定宏任务用哪种方式实现
// setTimeout、setInterval、setImmediate、MessageChanel、raf、I/O、UI交互事件都属于宏任务
// 优先使用setImmediate(仅IE支持)
// 其次选择都支持(>= IE10)的MessageChannel
// 最后选择setTimeout实现
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  macroTimerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else if (
  typeof MessageChannel !== 'undefined' &&
  (isNative(MessageChannel) ||
    // PhantomJS
    MessageChannel.toString() === '[object MessageChannelConstructor]')
) {
  // https://developer.mozilla.org/zh-CN/docs/Web/API/MessageChannel
  const channel = new MessageChannel()
  const port = channel.port2
  channel.port1.onmessage = flushCallbacks
  macroTimerFunc = () => {
    port.postMessage(1)
  }
} else {
  /* istanbul ignore next */
  macroTimerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// Determine microtask defer implementation.
// 确定微任务实现
// Promise.then、MutationObserver、Object.observe(废弃)、process.nextTick(仅有node实现)都属于微任务
// vue使用Promise.then
/* istanbul ignore next, $flow-disable-line */
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  microTimerFunc = () => {
    p.then(flushCallbacks)

    // in problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    // 在ios的UIWebViews中，可能出现callbacks已经被推入微任务队列中，但不会被刷新，除非浏览器执行一些其他工作，例如处理timer
    // 所以，这里通过执行一个空timer，来强制微任务队列刷新
    if (isIOS) setTimeout(noop)
  }
} else {
  // 降级使用宏任务
  // fallback to macro
  microTimerFunc = macroTimerFunc
}

/**
 * Wrap a function so that if any code inside triggers state change,
 * the changes are queued using a (macro) task instead of a microtask.
 */
// 包装一个函数，如果函数内部触发了状态改变，则将改变排在宏任务队列中执行
// 常用在包裹DOM事件处理函数
export function withMacroTask(fn: Function): Function {
  return (
    fn._withTask ||
    (fn._withTask = function() {
      useMacroTask = true
      const res = fn.apply(null, arguments)
      useMacroTask = false
      return res
    })
  )
}

// this.$nextTick、Vue.nextTick实现
export function nextTick(cb?: Function, ctx?: Object) {
  let _resolve

  // 向callback中push一个函数
  callbacks.push(() => {
    // 尝试执行cb
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      // 如果没传cb，则会对_resolve赋值(见line 130)，则调用_resolve
      _resolve(ctx)
    }
  })

  // 如果当前事件循环中，还没有向(微、宏)任务队列中添加过flushCallbacks任务
  // 则向(微、宏)任务队列中添加一个flushCallbacks任务
  // 当重复执行nextTick时，不会向(微、宏)任务队列中添加flushCallbacks任务，只会向callbacks中再添加一个回调，等待flushCallbacks被调用时，一并执行
  if (!pending) {
    pending = true

    // 宏任务
    if (useMacroTask) {
      macroTimerFunc()
    } else {
      // 微任务
      microTimerFunc()
    }
  }

  // $flow-disable-line
  // nextTick支持不传cb，此时会返回一个Promise
  // 如果没有提供cb并且Promise存在则，this.$nextTick()返回一个promise
  // 可以使用this.$nextTick().then(ctx=>{ console.log(ctx) })
  // https://cn.vuejs.org/v2/api/#vm-nextTick
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
