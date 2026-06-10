import { Router } from 'express';
import { requireAuth } from '../auth/auth-middleware.js';
import { createToken, verifyPassword } from '../auth/auth-utils.js';
import {
  createUser,
  findUserById,
  findUserByUsername,
  initUserSchema,
  updateUserPassword
} from '../db/oracle-users.js';
import { isOracleConfigured, waitForOraclePool } from '../oracle-validator.js';

const router = Router();

const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role
  };
}

async function ensureAuthStorageReady(_req, res, next) {
  if (!isOracleConfigured()) {
    return res.status(503).json({
      message: 'Banco indisponível. Configure ORACLE_USER, ORACLE_PASSWORD e ORACLE_CONNECT_STRING.'
    });
  }

  try {
    await waitForOraclePool();
    await initUserSchema();
    next();
  } catch (error) {
    return res.status(503).json({
      message: error?.message ?? 'Oracle indisponível para autenticação.'
    });
  }
}

router.post('/login', ensureAuthStorageReady, async (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const rememberMe = Boolean(req.body?.rememberMe);

  if (!username || !password) {
    return res.status(400).json({ message: 'Informe usuário e senha.' });
  }

  try {
    const user = await findUserByUsername(username);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
    }

    res.json({ token: createToken(user, rememberMe), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: error?.message ?? 'Falha ao realizar login.' });
  }
});

router.post('/register', ensureAuthStorageReady, async (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const displayName = String(req.body?.displayName ?? '').trim();
  const password = String(req.body?.password ?? '');

  const errors = [];

  if (!USERNAME_PATTERN.test(username)) {
    errors.push('Usuário deve ter de 3 a 50 caracteres (letras minúsculas, números, ".", "_" ou "-").');
  }
  if (!displayName) {
    errors.push('Nome é obrigatório.');
  }
  if (password.length < 6) {
    errors.push('Senha deve ter pelo menos 6 caracteres.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join(' ') });
  }

  try {
    const existing = await findUserByUsername(username);
    if (existing) {
      return res.status(409).json({ message: 'Este usuário já está cadastrado.' });
    }

    const user = await createUser({ username, displayName, password });
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: error?.message ?? 'Falha ao cadastrar usuário.' });
  }
});

router.post('/change-password', ensureAuthStorageReady, async (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');

  if (!username || !currentPassword) {
    return res.status(400).json({ message: 'Informe usuário e senha atual.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Nova senha deve ter pelo menos 6 caracteres.' });
  }

  if (newPassword === currentPassword) {
    return res.status(400).json({ message: 'A nova senha deve ser diferente da senha atual.' });
  }

  try {
    const user = await findUserByUsername(username);

    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ message: 'Usuário ou senha atual inválidos.' });
    }

    await updateUserPassword(user.id, newPassword);

    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (error) {
    res.status(500).json({ message: error?.message ?? 'Falha ao alterar senha.' });
  }
});

router.get('/me', ensureAuthStorageReady, requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(401).json({ message: 'Usuário não encontrado.' });
    }

    res.json(publicUser(user));
  } catch (error) {
    res.status(500).json({ message: error?.message ?? 'Falha ao buscar usuário.' });
  }
});

export default router;
