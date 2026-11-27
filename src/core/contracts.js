/**
 * 核心数据类型契约（渐进式类型化的起点）。
 * 供 JSDoc 引用：`@param {Doc} doc`。
 */

/**
 * @typedef {'h1'|'h2'|'h3'|'p'|'li'} BlockType
 */

/**
 * @typedef {Object} Block
 * @property {BlockType} t
 * @property {string} text
 * @property {number} [page]
 */

/**
 * @typedef {'qa'|'word'|'cloze'} CardKind
 */

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {CardKind} kind
 * @property {string} front
 * @property {string} back
 * @property {number} due
 * @property {number} interval
 * @property {number} ease
 * @property {number} reps
 * @property {number} lapses
 * @property {number} [createdAt]
 */

/**
 * @typedef {Object} Highlight
 * @property {string} id
 * @property {number} block
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {string} color
 * @property {string} [note]
 */

/**
 * @typedef {'text'|'knowledge'|'image'|'pdf'|'quiz'} DocType
 * @typedef {'zh'|'en'|'ja'|'wenyan'} DocLang
 * @typedef {'agent'|'local'|'online'|'deepseek'|'openai'|'custom'} AiProvider
 */

/**
 * @typedef {Object} Doc
 * @property {string} id
 * @property {string} [title]
 * @property {DocType} [type]
 * @property {DocLang} [lang]
 * @property {Block[]} blocks
 * @property {Record<string, string>} [translations]
 * @property {Highlight[]} [highlights]
 * @property {Card[]} [cards]
 * @property {Object} [meta]
 * @property {number} [createdAt]
 * @property {number} [updatedAt]
 */

/**
 * @typedef {Object} AiConfig
 * @property {AiProvider} provider
 * @property {string} baseUrl
 * @property {string} model
 * @property {string} [apiKey]
 * @property {number} [temperature]
 */

export {};
