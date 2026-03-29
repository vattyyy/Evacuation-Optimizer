import { execSync } from 'child_process';
try {
  console.log(execSync('gcc --version').toString());
} catch (e) {
  console.error(e.message);
}
try {
  console.log(execSync('clang --version').toString());
} catch (e) {
  console.error(e.message);
}
