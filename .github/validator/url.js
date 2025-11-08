import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 兼容 ES Module 环境下的 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function validate(inputUrl) {
  if (!inputUrl) {
    return '请输入 URL';
  }
  if (/\.(edu|vpn)(\/|\.|$)/.test(inputUrl)) {
    return '请勿提交机构代理的 URL';
  }
  if (/\.cnki\./.test(inputUrl)) {
    return '该 url 已通过 CNKI.js 适配。';
  }

  const rootDir = path.resolve(__dirname, '../../..');
  let files;
  try {
    files = fs.readdirSync(rootDir).filter(f => f.endsWith('.js'));
  } catch (e) {
    return '读取仓库文件失败';
  }

  for (const file of files) {
    const filePath = path.join(rootDir, file);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    const metaMatch = content.match(/^\{[\s\S]*?\}/);
    if (!metaMatch) continue;

    let meta;
    try {
      meta = JSON.parse(metaMatch[0]);
    } catch {
      continue;
    }
    if (!meta?.target || !meta?.label) continue;

    let re;
    try {
      re = new RegExp(meta.target);
    } catch {
      continue;
    }
    if (re.test(inputUrl)) {
      return `该 url 已通过 ${meta.label}.js 适配。`;
    }
  }

  return 'success';
}