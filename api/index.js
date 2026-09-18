"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const app_js_1 = require("../packages/api/src/app.js");
const app = (0, app_js_1.buildApp)();
async function handler(req, res) {
    await app.ready();
    app.server.emit('request', req, res);
}
//# sourceMappingURL=index.js.map