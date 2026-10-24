/**
 * Wrap an async Express handler so rejected promises reach the error middleware
 * instead of becoming unhandled rejections.
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export default { asyncHandler };
