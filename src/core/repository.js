/**
 * 文档仓储接口：业务层只依赖这组方法，不直接触碰 IndexedDB。
 * 实现可替换为 IndexedDB、内存或未来的远端同步。
 */

const REQUIRED = ['getDoc', 'allDocs', 'putDoc', 'deleteDoc', 'clear'];

/**
 * @param {Object} adapter
 * @returns {{get:Function, all:Function, save:Function, remove:Function, clear:Function}}
 */
export function createDocRepository(adapter) {
  if (!adapter) throw new Error('Repository 需要数据适配器');
  for (const m of REQUIRED) {
    if (typeof adapter[m] !== 'function') throw new Error('适配器缺少方法：' + m);
  }
  return {
    get: (id) => adapter.getDoc(id),
    all: () => adapter.allDocs(),
    save: (doc) => adapter.putDoc(doc),
    remove: (doc) => adapter.deleteDoc(doc),
    clear: () => adapter.clear()
  };
}

/** 浏览器实现：用 IndexedDB 适配器（Z.DB）构造仓储 */
export function browserRepo() {
  return createDocRepository(/** @type {any} */ (window).ZY.DB);
}
