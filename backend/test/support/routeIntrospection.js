// Builds a flat list of every HTTP route in the Express app, with the guard
// middleware that protects it. Used by the route-policy test and the
// route-inventory tool. Express 5 (router@2) does not keep mount paths on its
// layers, so Router.prototype.use is wrapped *before* the app is imported to
// record them.

import { METHODS } from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Router = require('router');

let patched = false;

function patchRouterUse() {
    if (patched) return;
    patched = true;
    const originalUse = Router.prototype.use;
    Router.prototype.use = function use(...args) {
        const before = this.stack.length;
        const result = originalUse.apply(this, args);
        let mountPath = '/';
        let first = args[0];
        while (Array.isArray(first) && first.length) first = first[0];
        if (typeof first !== 'function') mountPath = String(first);
        for (let i = before; i < this.stack.length; i++) {
            this.stack[i].__mountPath = mountPath;
        }
        return result;
    };
}

function joinPaths(a, b) {
    const joined = `${a}/${b}`.replace(/\/+/g, '/');
    return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}

function isRouter(fn) {
    return typeof fn === 'function' && Array.isArray(fn.stack);
}

function walk(stack, prefix, inherited, out) {
    const chain = [...inherited];
    for (const layer of stack) {
        if (layer.route) {
            const handlers = layer.route.stack.map((l) => l.handle);
            const methods = Object.keys(layer.route.methods)
                .filter((m) => m !== '_all')
                .map((m) => m.toUpperCase());
            // app.all()/route.all() registers every HTTP verb; report it as ALL
            const isAll = layer.route.methods._all || methods.length >= METHODS.length;
            const paths = [].concat(layer.route.path).map((p) => joinPaths(prefix, String(p)));
            for (const path of paths) {
                out.push({
                    methods: isAll || !methods.length ? ['ALL'] : methods,
                    path,
                    middleware: [...chain, ...handlers],
                });
            }
        } else if (isRouter(layer.handle)) {
            walk(layer.handle.stack, joinPaths(prefix, layer.__mountPath ?? '/'), chain, out);
        } else if ((layer.__mountPath ?? '/') === '/') {
            // Router-level middleware (e.g. router.use(authenticateJWT)) applies to
            // every route registered after it in the same router.
            chain.push(layer.handle);
        }
    }
    return out;
}

/**
 * Imports the app (with Router patched) and returns
 * [{ methods, path, middleware: Function[] }].
 */
export async function collectRoutes() {
    patchRouterUse();
    const { default: app } = await import('../../src/app.js');
    return walk(app.router.stack, '/', [], []);
}

/**
 * Describes the guards on one route using the markers the auth middleware
 * exposes (identity for authenticateJWT/requireActiveOrg, `allowedRoles` on
 * authorize()/ensureAdmin).
 */
export async function describeGuards(route) {
    const auth = await import('../../src/middleware/auth.js');
    const roles = route.middleware
        .filter((fn) => Array.isArray(fn.allowedRoles))
        .map((fn) => fn.allowedRoles);
    return {
        authenticated: route.middleware.includes(auth.authenticateJWT),
        activeOrg: route.middleware.includes(auth.requireActiveOrg),
        // Every role gate must pass, so the effective set is the intersection.
        roles: roles.length
            ? roles.reduce((acc, r) => acc.filter((x) => r.includes(x)))
            : null,
    };
}
