import fs from 'fs';
import path from 'path';

export function updateEnv(updates: Record<string, string>) {
  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  const lines = envContent.split('\n');
  const envMap: Record<string, string> = {};

  lines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && key.trim()) {
      envMap[key.trim()] = valueParts.join('=').trim();
    }
  });

  // Apply updates
  Object.entries(updates).forEach(([key, value]) => {
    envMap[key] = value;
    process.env[key] = value;
  });

  const newContent = Object.entries(envMap)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(envPath, newContent, 'utf-8');
}
