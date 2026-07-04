export default [
    {
        ignores: [
            'dist/**',
            'wailsjs/**'
        ]
    },
    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {
                    jsx: true
                }
            },
            globals: {
                AbortController: 'readonly',
                Blob: 'readonly',
                clearTimeout: 'readonly',
                console: 'readonly',
                document: 'readonly',
                fetch: 'readonly',
                FileReader: 'readonly',
                localStorage: 'readonly',
                navigator: 'readonly',
                setTimeout: 'readonly',
                URL: 'readonly',
                window: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error'
        }
    }
];
