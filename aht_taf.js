const async_hooks = require('async_hooks');
const asyncHookMap = global.asyncHookMap = new Map();
// longStackTrace另外算；剩下的全部放在comonDynamicArr
const transactionReqArr = ['transactionLogId'];
global.transactionLogId = global.transactionLogId || '';
let initFlag = false;
const asyncHooksTool = {
  init: function (params) {
    if (initFlag) {
      return;
    }
    initFlag = true;
    //start async hooks
    const asyncHook = async_hooks.createHook({
      init, before, after, destroy
    });
    asyncHook.enable();

    function init(asyncId, type, triggerId, resource) {
      try {
        //debug

        const cid = async_hooks.executionAsyncId();
        const tid = async_hooks.triggerAsyncId();
        params && params.debug && process._rawDebug('async_hook_init', asyncId, type, triggerId, cid, tid);
        params && params.longStackTrace && longStackTrace(asyncId, type, triggerId, resource);
        params && params.transactionReq && transactionReq(asyncId, type, triggerId, resource);
      } catch (e) {
        params && params.debug && process._rawDebug('aysnc_hook init error', e);
      }
    }

    // before is called just before the resource's callback is called. It can be
    // called 0-N times for handles (e.g. TCPWrap), and will be called exactly 1
    // time for requests (e.g. FSReqWrap).

    function before(asyncId) {
      params && params.debug && process._rawDebug('async_hook_before', asyncId);
      const cid = async_hooks.executionAsyncId();
      const tid = async_hooks.triggerAsyncId();
      let curResourceInfo = asyncHookMap.get(asyncId);
      if (curResourceInfo) {
        curResourceInfo.longStackTrace && (global.longStackTrace = curResourceInfo.longStackTrace);
        transactionReqArr.forEach(property => {
          curResourceInfo[property] && (global[property] = curResourceInfo[property]);
        });
      } else {
        global.longStackTrace = '';
        transactionReqArr.forEach(property => {
          global[property] = '';
        });
      }
      //asyncHookMap.delete(asyncId);
    }

    // after is called just after the resource's callback has finished.

    function after(asyncId) {
      //asyncHookMap.delete(asyncId);
    }

    // destroy is called when an AsyncWrap instance is destroyed.

    function destroy(asyncId) {
      asyncHookMap.delete(asyncId);

    }

    function longStackTrace(asyncId, type, triggerId, resource) {
      const cid = async_hooks.executionAsyncId();
      const tid = async_hooks.triggerAsyncId();
      let emptyObj = {};
      Error.captureStackTrace(emptyObj, init); //第二参数，指定忽略init一会的stack
      let parentInfo = asyncHookMap.get(cid);
      // 使用IncomingMessage.Readable.resume或者
      // HTTPParser.parserOnMessageComplete判断http请求到来并不准确
      if (type === 'HTTPPARSER') {
        setResourceMap(asyncId, 'longStackTrace', emptyObj.stack);
      }
      if (parentInfo && parentInfo.longStackTrace) {
        setResourceMap(asyncId, 'longStackTrace', emptyObj.stack + parentInfo.longStackTrace);
      }
    }

    function transactionReq(asyncId, type, triggerId, resource) {
      const cid = async_hooks.executionAsyncId();
      const tid = async_hooks.triggerAsyncId();
      if (type === 'TCPWRAP' && cid === 0) {
        let reqId = mimicUuid();
        // 初始化时只设置logId
        setResourceMap(asyncId, 'transactionLogId', reqId);
      } else {
        let parentInfo = asyncHookMap.get(cid);
        // 批量
        transactionReqArr.forEach(property => {
          parentInfo && parentInfo[property] && setResourceMap(asyncId, property, parentInfo[property]);
        });
      }

    }
  },
  set: function (property, value) {
    const cid = async_hooks.executionAsyncId();
    let item = asyncHookMap.get(cid);
    if (item) {
      !~transactionReqArr.indexOf(property) && transactionReqArr.push(property);
      if (property === 'transactionLogId') { // 初始化一个uuid
        global[property] = item[property] = value || mimicUuid();
      } else {
        global[property] = item[property] = value;
      }
    }
  }
}

function setResourceMap(asyncId, key, value) {
  let curResourceMap = asyncHookMap.get(asyncId);
  if (curResourceMap) {
    curResourceMap['' + key] = value;
  } else {
    let mapObj = {};
    mapObj['' + key] = value;
    asyncHookMap.set(asyncId, mapObj);
  }
}
function mimicUuid() {
  // Date.now 13位   Mathrandom 取小数点后面16位
  // pid不固定，
  let randomGenerator = function (len) {
    let text = '';
    let possible = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < len; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };
  let reqId = '' + process.pid + Date.now();
  reqId += randomGenerator(32 - reqId.length);
  /*if (reqId.length > 32) {
   reqId = reqId.slice(0, 32 - reqId.length);
   } else if (reqId.length < 32) {
   reqId += Math.random().toString().slice(reqId.length - 32);
   }*/
  reqId = reqId.slice(0, 8) + '-' + reqId.slice(8, 12) + '-' + reqId.slice(12, 16) + '-' + reqId.slice(16, 20) + '-' + reqId.slice(20, 32);
  return reqId;
}
module.exports = asyncHooksTool;
/**
 * Created by Administrator on 2017/12/4.
 */
