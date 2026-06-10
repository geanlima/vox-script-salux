import { verifyToken } from './auth-utils.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    return res.status(401).json({ message: 'Sessão inválida ou expirada. Faça login novamente.' });
  }

  req.user = {
    id: Number(payload.sub),
    username: payload.username,
    name: payload.name,
    role: payload.role
  };

  next();
}

export function isMaster(user) {
  return user?.role === 'master';
}
