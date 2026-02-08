import jwt from 'jsonwebtoken';

export function signToken(payload, expiresIn='30d') {
  const secret = process.env.APP_JWT_SECRET;
  if (!secret) throw new Error('APP_JWT_SECRET missing');
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyTokenFromHeaders(headers) {
  const secret = process.env.APP_JWT_SECRET;
  if (!secret) throw new Error('APP_JWT_SECRET missing');

  const auth = headers?.authorization || headers?.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;

  const token = auth.slice('Bearer '.length).trim();
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}
