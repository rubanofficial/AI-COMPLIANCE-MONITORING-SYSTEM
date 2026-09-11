/**
 * Wrap an async Express handler so rejected promises reach the error middleware
 * instead of becoming unhandled rejections.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
