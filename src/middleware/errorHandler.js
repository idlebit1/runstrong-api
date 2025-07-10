const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not found';
  } else if (err.name === 'RateLimitError') {
    statusCode = 429;
    message = 'Too many requests';
  }

  // In development, send full error details
  if (process.env.NODE_ENV === 'development') {
    res.status(statusCode).json({
      error: message,
      details: err.message,
      stack: err.stack
    });
  } else {
    // In production, send minimal error info
    res.status(statusCode).json({
      error: message
    });
  }
};

module.exports = errorHandler;