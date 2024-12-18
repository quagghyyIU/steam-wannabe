function isAuthenticated(req, res, next) {
    if (req.session.user) return next();
    return res.redirect('/login');
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') return next();
    return res.status(403).send('Access denied');
}

function isDeveloper(req, res, next) {
    if (req.session.user && req.session.user.role === 'developer') return next();
    return res.status(403).send('Access denied');
}

module.exports = { isAuthenticated, isAdmin, isDeveloper };