import fs from 'fs';
import path from 'path';
import { json } from 'stream/consumers';

export function url(inputUrl) {
    const rootDir = path.resolve(__dirname, '../../..');
    const files = fs.readdirSync(rootDir).filter(f => f.endsWith('.js'));
    let matched = false;

    for (const file of files) {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const jsonMatch = content.match(/^\{[\s\S]*?\}/);
        if (jsonMatch) {
            try {
                const json = JSON.parse(jsonMatch);
                if (json.target && new RegExp(json.target).test(inputUrl)) {
                    matched = true;
                }
            } catch (e) {
                // 忽略解析错误
            }
        }
        if (matched) {
            throw new Error(`该 url 已通过 ${json.label}.js 适配。`);
        }
    }
    return 'success';
}