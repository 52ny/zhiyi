/**
 * AI Provider 契约：所有推理来源（内置智能体、本地模型、云端接口）
 * 都必须实现 `chat(messages, opts) => Promise<string>`。
 */

/**
 * @param {{chat: (messages: Array<{role:string,content:string}>, opts?: Object) => Promise<string>}} adapter
 */
export function createProvider(adapter) {
  if (!adapter || typeof adapter.chat !== 'function') {
    throw new Error('Provider 必须实现 chat(messages, opts)');
  }
  return {
    chat: (messages, opts) => adapter.chat(messages, opts)
  };
}

/**
 * 测试用 Mock：返回固定文本或按调用生成文本。
 * @param {string|((messages:any[], opts?:Object)=>string)} reply
 */
export function createMockProvider(reply) {
  const calls = [];
  const provider = createProvider({
    chat: async (messages, opts) => {
      calls.push({ messages, opts });
      return typeof reply === 'function' ? reply(messages, opts) : reply;
    }
  });
  provider.calls = calls;
  return provider;
}
