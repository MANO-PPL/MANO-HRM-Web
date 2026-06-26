/**
 * Password Generator & Bcrypt Hasher Utility
 * 
 * Description:
 * A tool for developers to generate a secure random password and its bcrypt hash,
 * or to generate the bcrypt hash for a custom password.
 * 
 * How to Run:
 * 1. To generate a random 16-character password and its bcrypt hash:
 * 
 *      node backend/scripts/tools/generate_password.js
 * 
 * 2. To generate the bcrypt hash for a specific custom password:
 * 
 *      node backend/scripts/tools/generate_password.js "your_custom_password"
 * 
 * Outputs:
 * - Plaintext password (generated or custom input)
 * - Bcrypt hash (rounds: 10)
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';

/**
 * Generates a secure random password of specified length.
 */
function generateRandomPassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  return password;
}

async function main() {
  const args = process.argv.slice(2);
  let password = args[0];
  let isGenerated = false;

  if (!password) {
    password = generateRandomPassword(16);
    isGenerated = true;
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    console.log('\n🔑 Password Generator / Hasher Utility');
    console.log('======================================');
    if (isGenerated) {
      console.log(`Generated Password :  ${password}`);
    } else {
      console.log(`Input Password     :  ${password}`);
    }
    console.log(`Bcrypt Hash (rounds:${saltRounds}):  ${hash}`);
    console.log('======================================\n');
  } catch (err) {
    console.error('❌ Failed to generate password hash:', err);
    process.exit(1);
  }
}

main();
