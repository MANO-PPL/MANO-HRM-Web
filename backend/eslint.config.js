import globals from 'globals';

// Correctness-only rules: each one flags code that crashes or silently does
// nothing at runtime (undefined variables, unreachable code, ...). Style rules
// are deliberately left out.
export default [
    {
        ignores: ['node_modules/**', 'services/**', 'scripts/tools/simulate_*.js'],
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.node },
        },
        rules: {
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-dupe-keys': 'error',
            'no-const-assign': 'error',
            'no-import-assign': 'error',
            'no-self-assign': 'error',
            'no-unsafe-finally': 'error',
        },
    },
];
