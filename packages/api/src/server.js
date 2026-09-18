"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const app = (0, app_js_1.buildApp)();
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';
app.listen({ port, host }, (err, address) => {
    if (err) {
        console.error('Server failed to start:', err);
        process.exit(1);
    }
    console.log(`GridWise HTTP API listening on ${address}`);
});
//# sourceMappingURL=server.js.map