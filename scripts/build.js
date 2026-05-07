const fs = require('fs');
const { execSync } = require('child_process');

const manifestPath = './manifest.json';
const backupPath = './manifest.backup.json';

console.log('🚀 Starting packaging process...');

try {
  // 1. 備份 manifest.json
  fs.copyFileSync(manifestPath, backupPath);

  // 2. 移除開發用的 key，產生純淨的 manifest.json
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.key) {
    console.log('✂️ Removing dev key from manifest.json...');
    delete manifest.key;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  // 3. 執行 zip 打包指令，排除所有開發文件與無關目錄
  const excludeList = [
    "'node_modules/*'",
    "'tests/*'",
    "'scripts/*'",
    "'docs/*'",
    "'.cursor/*'",
    "'.gemini/*'",
    "'.git/*'",
    "'.*'",
    "'*.md'",
    "'package*.json'",
    "'jest.config.js'",
    "'release.zip'",
    "'manifest.backup.json'"
  ];

  const cmd = `zip -r release.zip . -x ${excludeList.join(' -x ')}`;
  console.log('📦 Zipping files...');
  execSync(cmd, { stdio: 'inherit' });

  console.log('✅ Packaging complete: release.zip created successfully!');

} catch (err) {
  console.error('❌ Build failed:', err.message);
} finally {
  // 4. 無論成功或失敗，皆還原原始的 manifest.json
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, manifestPath);
    fs.unlinkSync(backupPath);
    console.log('♻️ Restored original manifest.json with dev key.');
  }
}
