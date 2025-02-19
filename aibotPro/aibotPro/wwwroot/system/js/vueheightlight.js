function hljsDefineVue(hljs) {
    return {
        name: 'Vue',
        aliases: ['vue'],
        case_insensitive: true,
        keywords: {
            keyword: 'in of if for let new try catch finally else return async await break continue throw while switch case default do else export extends import return super this',
            literal: 'true false null undefined NaN Infinity',
            built_in: 'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Error EvalError InternalError RangeError ReferenceError StopIteration SyntaxError TypeError URIError Number Math Date String RegExp Array Float32Array Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require module console window document Symbol Set Map WeakSet WeakMap Proxy Reflect Promise',
        },
        contains: [
            // Template 块
            {
                className: 'template-tag',
                begin: /<template.*?>/, end: /<\/template>/,
                contains: [
                    {
                        className: 'template-expression',
                        begin: /{{/, end: /}}/,
                        contains: [
                            hljs.BACKSLASH_ESCAPE,
                            {
                                className: 'literal',
                                begin: /\bon[A-Za-z].*?\B/,
                            }
                        ]
                    },
                    {
                        className: 'name',
                        begin: /[a-zA-Z\-]\w*/,
                    },
                    {
                        className: 'attr',
                        begin: /[a-zA-Z:][\w-]*/,
                    }
                ]
            },

            // Script 块
            {
                className: 'script-tag',
                begin: /<script\b[^>]*>/, end: /<\/script>/,
                subLanguage: 'javascript',
                // 添加一个自定义的属性来标识需要后处理的块
                postProcess: true
            },

            // Style 块
            {
                className: 'style-tag',
                begin: /<style\b[^>]*>/, end: /<\/style>/,
                subLanguage: 'css'
            },

            // Comments
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.COMMENT(
                '/\\*\\*',
                '\\*/',
                {
                    relevance: 0,
                    contains: [
                        {
                            className: 'doctag',
                            begin: '@[A-Za-z]+'
                        }
                    ]
                }
            ),

            // Vue 指令
            {
                className: 'attr',
                begin: /v-[a-zA-Z-]+|@[a-zA-Z-]+|:[a-zA-Z-]+/
            },

            // 字符串
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,

            // 数字
            hljs.C_NUMBER_MODE,
            {
                className: 'number',
                begin: '\\b(0[bB][01]+)n?|\\b(0[oO][0-7]+)n?|\\b(0[xX][0-9a-fA-F]+)n?|\\b([1-9]\\d*|0)n?',
                relevance: 0
            },

            // 函数
            {
                className: 'function',
                beginKeywords: 'function', end: /\{/,
                excludeEnd: true,
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {
                        begin: /[A-Za-z$_][0-9A-Za-z$_]*/
                    }),
                    {
                        className: 'params',
                        begin: /\(/, end: /\)/,
                        excludeBegin: true,
                        excludeEnd: true,
                        contains: [
                            hljs.C_LINE_COMMENT_MODE,
                            hljs.C_BLOCK_COMMENT_MODE,
                            hljs.APOS_STRING_MODE,
                            hljs.QUOTE_STRING_MODE,
                            hljs.C_NUMBER_MODE
                        ]
                    }
                ]
            }
        ]
    };
}

// 注册语言
$(document).ready(function() {
    hljs.registerLanguage('vue', hljsDefineVue);
});
