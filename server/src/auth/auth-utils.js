import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 horas
const TOKEN_TTL_REMEMBER_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

const authSecret =
  process.env.AUTH_SECRET || 'vox-script-salux-dev-secret-defina-AUTH_SECRET-em-producao';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = String(storedHash ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, 'hex');

  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(payloadEncoded) {
  return crypto.createHmac('sha256', authSecret).update(payloadEncoded).digest('base64url');
}

export function createToken(user, rememberMe = false) {
  const payload = {
    sub: user.id,
    username: user.username,
    name: user.displayName,
    role: user.role,
    exp: Date.now() + (rememberMe ? TOKEN_TTL_REMEMBER_MS : TOKEN_TTL_MS)
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  return `${payloadEncoded}.${sign(payloadEncoded)}`;
}

export function verifyToken(token) {
  const [payloadEncoded, signature] = String(token ?? '').split('.');
  if (!payloadEncoded || !signature) {
    return null;
  }

  const expectedSignature = sign(payloadEncoded);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
    if (!payload?.sub || !payload?.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
