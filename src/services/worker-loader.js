import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parentPort } from 'node:worker_threads';

async function main() {
  try {
    // Đăng ký loader tsx cho worker thread
    register('tsx', pathToFileURL('./'));
    
    // Nạp file worker thực tế
    await import('./sysWorker.ts');
  } catch (err) {
    // Nếu có lỗi, gửi ngay về luồng chính để hiển thị lên UI
    if (parentPort) {
      parentPort.postMessage({ 
        error: `Worker Bootstrap Error: ${err.message}`,
        stack: err.stack 
      });
    }
    process.exit(1);
  }
}

main();
