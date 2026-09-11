// Generate the two admin secrets for the admin login:
//   npm run admin:hash -- "your admin password"
// Put both printed lines in .env.local AND in Netlify.
// The password itself is never stored anywhere.
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('Usage: npm run admin:hash -- "a password of at least 10 characters"');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);

console.log(`ADMIN_PASSWORD_HASH=scrypt$${salt.toString("hex")}$${hash.toString("hex")}`);
console.log(`ADMIN_SESSION_SECRET=${randomBytes(32).toString("hex")}`);
