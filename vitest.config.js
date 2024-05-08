/**
 * @type {import('vitest/config').UserConfigExport}
 */
const config = {
    test: {
        globals: true,
        typecheck: true,
        coverage: {
            enabled: true,
            reporter: ["json", "html", "json-summary", "lcov"],
        }
    }
}

export default config;
