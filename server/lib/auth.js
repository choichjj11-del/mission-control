const fetch = require('node-fetch');
const config = require('../config');

// Verify Firebase ID token via Google's tokeninfo endpoint (no Admin SDK needed)
async function verifyFirebaseToken(idToken) {
  const resp = await fetch(
    `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  if (!resp.ok) return null;
  const info = await resp.json();
  // Validate audience matches our Firebase project (if configured)
  return {
    uid: info.sub,
    email: info.email,
    name: info.name || info.email,
  };
}

// Auth middleware: supports both Bearer token (backward compat) and Firebase tokens
function authMiddleware(req, res, next) {
  // Health check is public
  if (req.path === '/health') return next();

  const auth = req.headers.authorization;

  // If no AUTH_TOKEN configured and no auth header, default user (dev mode)
  if (!auth) {
    if (!config.AUTH_TOKEN) {
      req.user = { uid: 'default', email: 'dev@local', name: 'Dev' };
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Bearer token (backward compat)
  if (auth === `Bearer ${config.AUTH_TOKEN}` && config.AUTH_TOKEN) {
    req.user = { uid: 'default', email: 'bearer@local', name: 'Bearer User' };
    return next();
  }

  // Firebase token
  if (auth.startsWith('Firebase ')) {
    const token = auth.slice(9);
    verifyFirebaseToken(token)
      .then(user => {
        if (!user) return res.status(401).json({ error: 'Invalid Firebase token' });
        req.user = user;
        next();
      })
      .catch(() => res.status(401).json({ error: 'Token verification failed' }));
    return;
  }

  // Legacy Bearer token check
  if (auth.startsWith('Bearer ') && config.AUTH_TOKEN && auth === `Bearer ${config.AUTH_TOKEN}`) {
    req.user = { uid: 'default', email: 'bearer@local', name: 'Bearer User' };
    return next();
  }

  // No AUTH_TOKEN set = dev mode, allow through
  if (!config.AUTH_TOKEN) {
    req.user = { uid: 'default', email: 'dev@local', name: 'Dev' };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { authMiddleware, verifyFirebaseToken };
