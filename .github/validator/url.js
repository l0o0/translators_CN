import fs from 'fs';
import path from 'path';
import { json } from 'stream/consumers';

export default (inputUrl) => {
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
    const files = fs.readdirSync(rootDir).filter(f => f.endsWith('.js'));
    let matched = false;

    for (const file of files) {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const meta = content.match(/^\{[\s\S]*?\}/);
        if (meta) {
            try {
                const json = JSON.parse(meta);
                if (json.target && new RegExp(json.target).test(inputUrl)) {
                    return `该 url 已通过 ${json.label}.js 适配。`;
                }
            } catch (e) {
                console.error(`Error parsing JSON in ${file}:`, e);
                continue;
            }
        }
    }
    return 'success';
}