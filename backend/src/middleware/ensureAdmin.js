import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

const ensureAdmin = catchAsync((req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
        throw new AppError("Authentication required", 401);
    }

    // Check if user is admin or HR
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError("Access denied. Admins or HR only.", 403);
    }

    next();
});

// Exposed for route introspection (route-policy test, route inventory)
ensureAdmin.allowedRoles = ['admin', 'hr'];

export default ensureAdmin;
