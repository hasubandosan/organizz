import bcrypt from 'bcryptjs';

const ROUNDS = 10; // баланс скорости/надёжности для free-тира CPU

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
