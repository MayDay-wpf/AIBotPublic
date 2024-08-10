function hljsDefineDart(hljs) {
    return {
        name: 'Dart',
        keywords: 'abstract as assert async await break case catch class const continue default deferred do dynamic else enum export extends external factory false final finally for Function get hide if implements import in inferface is late library mixin new null on operator part required rethrow return set static super switch sync this throw true try typedef var void while with yield',
        contains: [
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
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.inherit(hljs.QUOTE_STRING_MODE, {begin: 'r?\'\'\'', end: '\'\'\''}),
            hljs.inherit(hljs.QUOTE_STRING_MODE, {begin: 'r?"""', end: '"""'}),
            hljs.inherit(hljs.QUOTE_STRING_MODE, {begin: 'r?\'', end: '\''}),
            hljs.inherit(hljs.QUOTE_STRING_MODE, {begin: 'r?"', end: '"'}),
            {
                className: 'string',
                begin: 'r\'\'\'', end: '\'\'\''
            },
            {
                className: 'string',
                begin: 'r"""', end: '"""'
            },
            {
                className: 'string',
                begin: 'r\'', end: '\''
            },
            {
                className: 'string',
                begin: 'r"', end: '"'
            },
            {
                className: 'string',
                begin: '\'\'\'', end: '\'\'\'',
                contains: [hljs.BACKSLASH_ESCAPE]
            },
            {
                className: 'string',
                begin: '"""', end: '"""',
                contains: [hljs.BACKSLASH_ESCAPE]
            },
            {
                className: 'string',
                begin: '\'', end: '\'',
                contains: [hljs.BACKSLASH_ESCAPE]
            },
            {
                className: 'string',
                begin: '"', end: '"',
                contains: [hljs.BACKSLASH_ESCAPE]
            },
            {
                className: 'number',
                begin: '\\b(0[bB][01]+)n?|\\b(0[oO][0-7]+)n?|\\b(0[xX][0-9a-fA-F]+)n?|\\b([1-9]\\d*|0)n?',
                relevance: 0
            },
            {
                className: 'function',
                beginKeywords: 'function', end: '[{;]',
                excludeEnd: true,
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {begin: '[A-Za-z_$][0-9A-Za-z_$]*'}),
                    {
                        className: 'params',
                        begin: '\\(', end: '\\)',
                        excludeEnd: true,
                        contains: [
                            hljs.C_LINE_COMMENT_MODE,
                            hljs.C_BLOCK_COMMENT_MODE
                        ]
                    }
                ]
            },
            hljs.C_NUMBER_MODE,
            hljs.BINARY_NUMBER_MODE
        ]
    };
}

$(document).ready(function () {
    hljs.registerLanguage('dart', hljsDefineDart);
})
