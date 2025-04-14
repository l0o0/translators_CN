{
	"translatorID": "7b6b135a-ed39-4d90-8e38-65516671c5bc",
	"label": "CNKI Refer",
	"creator": "jiaojiaodubai",
	"target": "txt",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 99,
	"inRepository": true,
	"translatorType": 1,
	"lastUpdated": "2025-03-24 05:24:12"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero. If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/

function detectImport() {
	let line;
	let title = false;
	let cnki = false;
	while ((line = Zotero.read()) !== false) {
		line = line.replace(/^\s+/, '');
		if (/^%T ./.test(line)) {
			title = true;
		}
		else if (/^%W CNKI/.test(line)) {
			cnki = true;
		}
		if (title && cnki) {
			return true;
		}
	}
	return false;
}

async function doImport() {
	let record = '';
	let line;
	const translator = Zotero.loadTranslator('import');
	// Refer/BibIX
	translator.setTranslator('881f60f2-0802-411a-9228-ce5f47b64c7d');
	translator.setHandler('itemDone', (_obj, item) => {
		const extra = new Extra();
		if (/年鉴|年鑒/.test(item.type)) {
			item.itemType = 'bookSection';
			item.date = ZU.strToISO(item.date);
			delete item.type;
			item.ISBN = ZU.cleanISBN(item.volume);
			delete item.volume;
		}
		else if (/科技成果/.test(item.type)) {
			item.itemType = 'report';
			item.reportType = '科技报告';
			delete item.type;
		}
		item.language = detectLanguage(record);
		switch (item.itemType) {
			case 'conferencePaper':
				if (item.abstractNote) {
					item.abstractNote = item.abstractNote.replace(/^[〈⟨<＜]正[＞>⟩〉]/, '');
				}
				item.conferenceName = item.publicationTitle;
				delete item.publicationTitle;
				extra.set('organizer', tryMatch(record, /^%\? (.*)/m, 1), true);
				break;
			case 'newspaperArticle':
				item.publicationTitle = item.publisher;
				delete item.publisher;
				delete item.callNumber;
				item.ISSN = item.ISBN;
				delete item.ISBN;
				break;
			case 'journalArticle':
				if (item.publicationTitle) {
					item.publicationTitle = item.publicationTitle.replace(/\(([\u4e00-\u9fff]*)\)$/, '（$1）');
				}
				delete item.callNumber;
				item.ISSN = item.ISBN;
				delete item.ISBN;
				break;
			case 'patent':
				item.issueDate = item.date;
				delete item.date;
				item.patentNumber = item.ISBN;
				delete item.ISBN;
				if (item.type && !item.type.includes('海外专利')) {
					extra.set('Genre', item.type, true);
				}
				delete item.type;
				item.place = patentCountry(item.patentNumber, item.language);
				item.country = item.place;
				break;
			case 'statute':
				item.itemType = 'standard';
				item.creators = [];
				item.numPages = item.pages;
				delete item.pages;
				if (item.volume) {
					item.number = item.volume.replace('-', '—');
				}
				delete item.volume;
				if (item.number.startsWith('GB')) {
					item.number = item.number.replace('-', '——');
					item.title = item.title.replace(/([\u4e00-\u9fff]) ([\u4e00-\u9fff])/, '$1　$2');
				}
				delete item.publisher;
				delete item.type;
				break;
			case 'thesis':
				item.numPages = item.pages;
				delete item.pages;
				item.university = item.publisher || item.publicationTitle;
				if (item.university) {
					item.university = item.university.replace(/\(([\u4e00-\u9fff]*)\)$/, '（$1）');
				}
				delete item.publisher;
				delete item.publicationTitle;
				if (item.type) {
					// The degree theses included in CNKI are all in Chinese.
					item.thesisType = item.language == 'zh-CN'
						? `${item.type}学位论文`
						: `${item.type}學位論文`;
					delete item.type;
				}
				item.creators.forEach((creator) => {
					if (creator.creatorType == 'translator') {
						creator.creatorType = 'contributor';
					}
				});
				break;
		}
		let doi = tryMatch(record, /%O (.*)/, 1);
		if (doi) {
			if (ZU.fieldIsValidForType('DOI', item.itemType)) {
				item.DOI = doi;
			}
			else {
				extra.set('DOI', doi, true);
			}
			if (!item.url || /kcms2/i.test(item.url)) {
				item.url = 'https://doi.org/' + doi;
			}
		}
		if (ZU.fieldIsValidForType('pages', item.itemType) && item.pages) {
			item.pages = item.pages
				.replace(/\d+/g, match => match.replace(/0*(\d+)/, '$1'))
				.replace(/~/g, '-').replace(/\+/g, ', ');
		}
		delete item.archiveLocation;
		item.creators.forEach((creator) => {
			if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
				creator.lastName = creator.firstName + creator.lastName;
				creator.firstName = '';
				creator.fieldMode = 1;
			}
		});
		item.extra = extra.toString();
		item.complete();
	});
	while ((line = Zotero.read()) !== false) {
		line = line.replace(/^\s+/, '');
		record += '\n' + line;
		if (line == '%W CNKI') {
			record = record
				// If a non-empty line does not contain a tag, it is considered a continuation of the previous line.
				.replace(/\n([^%].+?\n)/g, '$1')
				// Sometimes, authors, contributors, or keywords have their tags, but do not wrap before the tags.
				.replace(/([^\r\n])(%[KAYI]) /gm, '$1\n$2 ')
				// Sometimes, tags of keywords are not following a sapace.
				.replace(/^%K(\S)/gm, '%K $1')
				// Sometimes, authors, contributors, or keywords may be mistakenly placed in the same tag.
				.replace(/^%([KAYI]) .*/gm, (fuuMatch, tag) => {
					return fuuMatch.replace(/,\s?([\u4e00-\u9fff])/g, `\n%${tag} $1`).replace(/[;，；]\s?/g, `\n%${tag} `);
				})
				.replace(/^%R /m, '%O ')
				// Custom tag "9" corresponds to the degree of the graduation thesis,
				//and tag "~" corresponds standard type (national standard or industry standard).
				.replace(/^%[9~] /m, '%R ')
				.replace(/^%V 0*/m, '%V ')
				.replace(/^%N 0*/m, '%N ')
				.replace(/^%P .+/, match => '%P ' + match.replace(/~/g, '-').replace(/\+/g, ', '))
				// \t in abstract
				.replace(/\t/g, '')
				.replace(/(\n\s*)+/g, '\n');
			translator.setString(record);
			await translator.translate();
			record = '';
		}
	}
}

class Extra {
	constructor() {
		this.fields = [];
	}

	push(key, val, csl = false) {
		this.fields.push({ key: key, val: val, csl: csl });
	}

	set(key, val, csl = false) {
		let target = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		if (target) {
			target.val = val;
		}
		else {
			this.push(key, val, csl);
		}
	}

	get(key) {
		let result = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		return result
			? result.val
			: '';
	}

	toString(history = '') {
		this.fields = this.fields.filter(obj => obj.val);
		return [
			this.fields.filter(obj => obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n'),
			history,
			this.fields.filter(obj => !obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n')
		].filter(obj => obj).join('\n');
	}
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function patentCountry(idNumber, lang = 'zh-CN') {
	/* eslint-disable camelcase */
	const country = {
		AD: { 'zh-CN': '安道尔', 'en-US': 'Andorra', 'zh-TW': '安道爾' },
		AE: { 'zh-CN': '阿拉伯联合酋长国', 'en-US': 'United Arab Emirates', 'zh-TW': '阿拉伯聯合酋長國' },
		AF: { 'zh-CN': '阿富汗', 'en-US': 'Afghanistan', 'zh-TW': '阿富汗' },
		AG: { 'zh-CN': '安提瓜和巴布达', 'en-US': 'Antigua and Barbuda', 'zh-TW': '安提瓜和巴布達' },
		AI: { 'zh-CN': '安圭拉', 'en-US': 'Anguilla', 'zh-TW': '安圭拉' },
		AL: { 'zh-CN': '阿尔巴尼亚', 'en-US': 'Albania', 'zh-TW': '阿爾巴尼亞' },
		AM: { 'zh-CN': '亚美尼亚', 'en-US': 'Armenia', 'zh-TW': '亞美尼亞' },
		AN: { 'zh-CN': '荷属安的列斯群岛', 'en-US': 'Netherlands Antilles', 'zh-TW': '荷屬安的列斯群島' },
		AO: { 'zh-CN': '安哥拉', 'en-US': 'Angola', 'zh-TW': '安哥拉' },
		AR: { 'zh-CN': '阿根廷', 'en-US': 'Argentina', 'zh-TW': '阿根廷' },
		AT: { 'zh-CN': '奥地利', 'en-US': 'Austria', 'zh-TW': '奧地利' },
		AU: { 'zh-CN': '澳大利亚', 'en-US': 'Australia', 'zh-TW': '澳大利亞' },
		AW: { 'zh-CN': '阿鲁巴', 'en-US': 'Aruba', 'zh-TW': '阿魯巴' },
		AZ: { 'zh-CN': '阿塞拜疆', 'en-US': 'Azerbaijan', 'zh-TW': '亞塞拜然' },
		BB: { 'zh-CN': '巴巴多斯', 'en-US': 'Barbados', 'zh-TW': '巴貝多' },
		BD: { 'zh-CN': '孟加拉国', 'en-US': 'Bangladesh', 'zh-TW': '孟加拉' },
		BE: { 'zh-CN': '比利时', 'en-US': 'Belgium', 'zh-TW': '比利時' },
		BF: { 'zh-CN': '布基纳法索', 'en-US': 'Burkina Faso', 'zh-TW': '布基納法索' },
		BG: { 'zh-CN': '保加利亚', 'en-US': 'Bulgaria', 'zh-TW': '保加利亞' },
		BH: { 'zh-CN': '巴林', 'en-US': 'Bahrain', 'zh-TW': '巴林' },
		BI: { 'zh-CN': '布隆迪', 'en-US': 'Burundi', 'zh-TW': '布隆迪' },
		BJ: { 'zh-CN': '贝宁', 'en-US': 'Benin', 'zh-TW': '貝寧' },
		BM: { 'zh-CN': '百慕大', 'en-US': 'Bermuda', 'zh-TW': '百慕達' },
		BN: { 'zh-CN': '文莱', 'en-US': 'Brunei', 'zh-TW': '汶萊' },
		BO: { 'zh-CN': '玻利维亚', 'en-US': 'Bolivia', 'zh-TW': '玻利維亞' },
		BR: { 'zh-CN': '巴西', 'en-US': 'Brazil', 'zh-TW': '巴西' },
		BS: { 'zh-CN': '巴哈马', 'en-US': 'Bahamas', 'zh-TW': '巴哈馬' },
		BT: { 'zh-CN': '不丹', 'en-US': 'Bhutan', 'zh-TW': '不丹' },
		BW: { 'zh-CN': '博茨瓦纳', 'en-US': 'Botswana', 'zh-TW': '波札那' },
		BY: { 'zh-CN': '白俄罗斯', 'en-US': 'Belarus', 'zh-TW': '白俄羅斯' },
		BZ: { 'zh-CN': '伯利兹', 'en-US': 'Belize', 'zh-TW': '貝里斯' },
		CA: { 'zh-CN': '加拿大', 'en-US': 'Canada', 'zh-TW': '加拿大' },
		CF: { 'zh-CN': '中非共和国', 'en-US': 'Central African Republic', 'zh-TW': '中非共和國' },
		CG: { 'zh-CN': '刚果', 'en-US': 'Congo', 'zh-TW': '剛果' },
		CH: { 'zh-CN': '瑞士', 'en-US': 'Switzerland', 'zh-TW': '瑞士' },
		CI: { 'zh-CN': '科特迪瓦', 'en-US': "Côte d'Ivoire", 'zh-TW': '科特迪瓦' },
		CL: { 'zh-CN': '智利', 'en-US': 'Chile', 'zh-TW': '智利' },
		CM: { 'zh-CN': '喀麦隆', 'en-US': 'Cameroon', 'zh-TW': '喀麥隆' },
		CN: { 'zh-CN': '中国', 'en-US': 'China', 'zh-TW': '中國' },
		CO: { 'zh-CN': '哥伦比亚', 'en-US': 'Colombia', 'zh-TW': '哥倫比亞' },
		CR: { 'zh-CN': '哥斯达黎加', 'en-US': 'Costa Rica', 'zh-TW': '哥斯達黎加' },
		CU: { 'zh-CN': '古巴', 'en-US': 'Cuba', 'zh-TW': '古巴' },
		CV: { 'zh-CN': '佛得角', 'en-US': 'Cape Verde', 'zh-TW': '佛得角' },
		CY: { 'zh-CN': '塞浦路斯', 'en-US': 'Cyprus', 'zh-TW': '塞浦路斯' },
		DE: { 'zh-CN': '德国', 'en-US': 'Germany', 'zh-TW': '德國' },
		DJ: { 'zh-CN': '吉布提', 'en-US': 'Djibouti', 'zh-TW': '吉布提' },
		DK: { 'zh-CN': '丹麦', 'en-US': 'Denmark', 'zh-TW': '丹麥' },
		DM: { 'zh-CN': '多米尼克', 'en-US': 'Dominica', 'zh-TW': '多米尼克' },
		DO: { 'zh-CN': '多米尼加共和国', 'en-US': 'Dominican Republic', 'zh-TW': '多明尼加共和國' },
		DZ: { 'zh-CN': '阿尔及利亚', 'en-US': 'Algeria', 'zh-TW': '阿爾及利亞' },
		EC: { 'zh-CN': '厄瓜多尔', 'en-US': 'Ecuador', 'zh-TW': '厄瓜多爾' },
		EE: { 'zh-CN': '爱沙尼亚', 'en-US': 'Estonia', 'zh-TW': '愛沙尼亞' },
		EG: { 'zh-CN': '埃及', 'en-US': 'Egypt', 'zh-TW': '埃及' },
		EP: { 'zh-CN': '欧洲专利局', 'en-US': 'European Patent Office', 'zh-TW': '歐洲專利局' },
		ES: { 'zh-CN': '西班牙', 'en-US': 'Spain', 'zh-TW': '西班牙' },
		ET: { 'zh-CN': '埃塞俄比亚', 'en-US': 'Ethiopia', 'zh-TW': '衣索比亞' },
		FI: { 'zh-CN': '芬兰', 'en-US': 'Finland', 'zh-TW': '芬蘭' },
		FJ: { 'zh-CN': '斐济', 'en-US': 'Fiji', 'zh-TW': '斐濟' },
		FK: { 'zh-CN': '福克兰群岛', 'en-US': 'Falkland Islands', 'zh-TW': '福克蘭群島' },
		FR: { 'zh-CN': '法国', 'en-US': 'France', 'zh-TW': '法國' },
		GA: { 'zh-CN': '加蓬', 'en-US': 'Gabon', 'zh-TW': '加彭' },
		GB: { 'zh-CN': '英国', 'en-US': 'United Kingdom', 'zh-TW': '英國' },
		GD: { 'zh-CN': '格林纳达', 'en-US': 'Grenada', 'zh-TW': '格林納達' },
		GE: { 'zh-CN': '格鲁吉亚', 'en-US': 'Georgia', 'zh-TW': '格魯吉亞' },
		GH: { 'zh-CN': '加纳', 'en-US': 'Ghana', 'zh-TW': '迦納' },
		GI: { 'zh-CN': '直布罗陀', 'en-US': 'Gibraltar', 'zh-TW': '直布羅陀' },
		GM: { 'zh-CN': '冈比亚', 'en-US': 'Gambia', 'zh-TW': '甘比亞' },
		GN: { 'zh-CN': '几内亚', 'en-US': 'Guinea', 'zh-TW': '幾內亞' },
		GQ: { 'zh-CN': '赤道几内亚', 'en-US': 'Equatorial Guinea', 'zh-TW': '赤道幾內亞' },
		GR: { 'zh-CN': '希腊', 'en-US': 'Greece', 'zh-TW': '希臘' },
		GT: { 'zh-CN': '危地马拉', 'en-US': 'Guatemala', 'zh-TW': '瓜地馬拉' },
		GW: { 'zh-CN': '几内亚比绍', 'en-US': 'Guinea-Bissau', 'zh-TW': '幾內亞比索' },
		GY: { 'zh-CN': '圭亚那', 'en-US': 'Guyana', 'zh-TW': '蓋亞那' },
		HK: { 'zh-CN': '香港特别行政区', 'en-US': 'Hong Kong', 'zh-TW': '香港' },
		HN: { 'zh-CN': '洪都拉斯', 'en-US': 'Honduras', 'zh-TW': '宏都拉斯' },
		HR: { 'zh-CN': '克罗地亚', 'en-US': 'Croatia', 'zh-TW': '克羅埃西亞' },
		HT: { 'zh-CN': '海地', 'en-US': 'Haiti', 'zh-TW': '海地' },
		HU: { 'zh-CN': '匈牙利', 'en-US': 'Hungary', 'zh-TW': '匈牙利' },
		ID: { 'zh-CN': '印度尼西亚', 'en-US': 'Indonesia', 'zh-TW': '印尼' },
		IE: { 'zh-CN': '爱尔兰', 'en-US': 'Ireland', 'zh-TW': '愛爾蘭' },
		IL: { 'zh-CN': '以色列', 'en-US': 'Israel', 'zh-TW': '以色列' },
		IN: { 'zh-CN': '印度', 'en-US': 'India', 'zh-TW': '印度' },
		IQ: { 'zh-CN': '伊拉克', 'en-US': 'Iraq', 'zh-TW': '伊拉克' },
		IR: { 'zh-CN': '伊朗', 'en-US': 'Iran', 'zh-TW': '伊朗' },
		IS: { 'zh-CN': '冰岛', 'en-US': 'Iceland', 'zh-TW': '冰島' },
		IT: { 'zh-CN': '意大利', 'en-US': 'Italy', 'zh-TW': '義大利' },
		JM: { 'zh-CN': '牙买加', 'en-US': 'Jamaica', 'zh-TW': '牙買加' },
		JO: { 'zh-CN': '约旦', 'en-US': 'Jordan', 'zh-TW': '約旦' },
		JP: { 'zh-CN': '日本', 'en-US': 'Japan', 'zh-TW': '日本' },
		KE: { 'zh-CN': '肯尼亚', 'en-US': 'Kenya', 'zh-TW': '肯亞' },
		KG: { 'zh-CN': '吉尔吉斯斯坦', 'en-US': 'Kyrgyzstan', 'zh-TW': '吉爾吉斯' },
		KH: { 'zh-CN': '柬埔寨', 'en-US': 'Cambodia', 'zh-TW': '柬埔寨' },
		KI: { 'zh-CN': '基里巴斯', 'en-US': 'Kiribati', 'zh-TW': '基里巴斯' },
		KM: { 'zh-CN': '科摩罗', 'en-US': 'Comoros', 'zh-TW': '科摩羅' },
		KN: { 'zh-CN': '圣基茨和尼维斯', 'en-US': 'Saint Kitts and Nevis', 'zh-TW': '聖克里斯多福及尼維斯' },
		KP: { 'zh-CN': '朝鲜', 'en-US': 'North Korea', 'zh-TW': '朝鮮' },
		KR: { 'zh-CN': '韩国', 'en-US': 'South Korea', 'zh-TW': '韓國' },
		KW: { 'zh-CN': '科威特', 'en-US': 'Kuwait', 'zh-TW': '科威特' },
		KY: { 'zh-CN': '开曼群岛', 'en-US': 'Cayman Islands', 'zh-TW': '開曼群島' },
		KZ: { 'zh-CN': '哈萨克斯坦', 'en-US': 'Kazakhstan', 'zh-TW': '哈薩克' },
		LA: { 'zh-CN': '老挝', 'en-US': 'Laos', 'zh-TW': '寮國' },
		LB: { 'zh-CN': '黎巴嫩', 'en-US': 'Lebanon', 'zh-TW': '黎巴嫩' },
		LC: { 'zh-CN': '圣卢西亚', 'en-US': 'Saint Lucia', 'zh-TW': '聖露西亞' },
		LI: { 'zh-CN': '列支敦士登', 'en-US': 'Liechtenstein', 'zh-TW': '列支敦斯登' },
		LK: { 'zh-CN': '斯里兰卡', 'en-US': 'Sri Lanka', 'zh-TW': '斯里蘭卡' },
		LR: { 'zh-CN': '利比里亚', 'en-US': 'Liberia', 'zh-TW': '賴比瑞亞' },
		LS: { 'zh-CN': '莱索托', 'en-US': 'Lesotho', 'zh-TW': '賴索托' },
		LT: { 'zh-CN': '立陶宛', 'en-US': 'Lithuania', 'zh-TW': '立陶宛' },
		LU: { 'zh-CN': '卢森堡', 'en-US': 'Luxembourg', 'zh-TW': '盧森堡' },
		LV: { 'zh-CN': '拉脱维亚', 'en-US': 'Latvia', 'zh-TW': '拉脫維亞' },
		LY: { 'zh-CN': '利比亚', 'en-US': 'Libya', 'zh-TW': '利比亞' },
		MA: { 'zh-CN': '摩洛哥', 'en-US': 'Morocco', 'zh-TW': '摩洛哥' },
		MC: { 'zh-CN': '摩纳哥', 'en-US': 'Monaco', 'zh-TW': '摩納哥' },
		MD: { 'zh-CN': '摩尔多瓦', 'en-US': 'Moldova', 'zh-TW': '摩爾多瓦' },
		MG: { 'zh-CN': '马达加斯加', 'en-US': 'Madagascar', 'zh-TW': '馬達加斯加' },
		ML: { 'zh-CN': '马里', 'en-US': 'Mali', 'zh-TW': '馬里' },
		MN: { 'zh-CN': '蒙古', 'en-US': 'Mongolia', 'zh-TW': '蒙古' },
		MO: { 'zh-CN': '澳门特别行政区', 'en-US': 'Macau', 'zh-TW': '澳門' },
		MR: { 'zh-CN': '毛里塔尼亚', 'en-US': 'Mauritania', 'zh-TW': '毛里塔尼亞' },
		MS: { 'zh-CN': '蒙特塞拉特', 'en-US': 'Montserrat', 'zh-TW': '蒙特塞拉特' },
		MT: { 'zh-CN': '马耳他', 'en-US': 'Malta', 'zh-TW': '馬爾他' },
		MU: { 'zh-CN': '毛里求斯', 'en-US': 'Mauritius', 'zh-TW': '毛里求斯' },
		MV: { 'zh-CN': '马尔代夫', 'en-US': 'Maldives', 'zh-TW': '馬爾地夫' },
		MW: { 'zh-CN': '马拉维', 'en-US': 'Malawi', 'zh-TW': '馬拉維' },
		MX: { 'zh-CN': '墨西哥', 'en-US': 'Mexico', 'zh-TW': '墨西哥' },
		MY: { 'zh-CN': '马来西亚', 'en-US': 'Malaysia', 'zh-TW': '馬來西亞' },
		MZ: { 'zh-CN': '莫桑比克', 'en-US': 'Mozambique', 'zh-TW': '莫桑比克' },
		NA: { 'zh-CN': '纳米比亚', 'en-US': 'Namibia', 'zh-TW': '納米比亞' },
		NE: { 'zh-CN': '尼日尔', 'en-US': 'Niger', 'zh-TW': '尼日' },
		NG: { 'zh-CN': '尼日利亚', 'en-US': 'Nigeria', 'zh-TW': '奈及利亞' },
		NI: { 'zh-CN': '尼加拉瓜', 'en-US': 'Nicaragua', 'zh-TW': '尼加拉瓜' },
		NL: { 'zh-CN': '荷兰', 'en-US': 'Netherlands', 'zh-TW': '荷蘭' },
		NO: { 'zh-CN': '挪威', 'en-US': 'Norway', 'zh-TW': '挪威' },
		NP: { 'zh-CN': '尼泊尔', 'en-US': 'Nepal', 'zh-TW': '尼泊爾' },
		NR: { 'zh-CN': '瑙鲁', 'en-US': 'Nauru', 'zh-TW': '諾魯' },
		NZ: { 'zh-CN': '新西兰', 'en-US': 'New Zealand', 'zh-TW': '紐西蘭' },
		OM: { 'zh-CN': '阿曼', 'en-US': 'Oman', 'zh-TW': '阿曼' },
		PA: { 'zh-CN': '巴拿马', 'en-US': 'Panama', 'zh-TW': '巴拿馬' },
		PE: { 'zh-CN': '秘鲁', 'en-US': 'Peru', 'zh-TW': '秘魯' },
		PG: { 'zh-CN': '巴布亚新几内亚', 'en-US': 'Papua New Guinea', 'zh-TW': '巴布亞紐幾內亞' },
		PH: { 'zh-CN': '菲律宾', 'en-US': 'Philippines', 'zh-TW': '菲律賓' },
		PK: { 'zh-CN': '巴基斯坦', 'en-US': 'Pakistan', 'zh-TW': '巴基斯坦' },
		PL: { 'zh-CN': '波兰', 'en-US': 'Poland', 'zh-TW': '波蘭' },
		PT: { 'zh-CN': '葡萄牙', 'en-US': 'Portugal', 'zh-TW': '葡萄牙' },
		PY: { 'zh-CN': '巴拉圭', 'en-US': 'Paraguay', 'zh-TW': '巴拉圭' },
		QA: { 'zh-CN': '卡塔尔', 'en-US': 'Qatar', 'zh-TW': '卡達' },
		RO: { 'zh-CN': '罗马尼亚', 'en-US': 'Romania', 'zh-TW': '羅馬尼亞' },
		RU: { 'zh-CN': '俄罗斯', 'en-US': 'Russia', 'zh-TW': '俄羅斯聯邦' },
		RW: { 'zh-CN': '卢旺达', 'en-US': 'Rwanda', 'zh-TW': '盧安達' },
		SA: { 'zh-CN': '沙特阿拉伯', 'en-US': 'Saudi Arabia', 'zh-TW': '沙烏地阿拉伯' },
		SB: { 'zh-CN': '所罗门群岛', 'en-US': 'Solomon Islands', 'zh-TW': '索羅門群島' },
		SC: { 'zh-CN': '塞舌尔', 'en-US': 'Seychelles', 'zh-TW': '塞席爾' },
		SD: { 'zh-CN': '苏丹', 'en-US': 'Sudan', 'zh-TW': '蘇丹' },
		SE: { 'zh-CN': '瑞典', 'en-US': 'Sweden', 'zh-TW': '瑞典' },
		SG: { 'zh-CN': '新加坡', 'en-US': 'Singapore', 'zh-TW': '新加坡' },
		SH: { 'zh-CN': '圣赫勒拿', 'en-US': 'Saint Helena', 'zh-TW': '聖赫勒拿島' },
		SI: { 'zh-CN': '斯洛文尼亚', 'en-US': 'Slovenia', 'zh-TW': '斯洛維尼亞' },
		SL: { 'zh-CN': '塞拉利昂', 'en-US': 'Sierra Leone', 'zh-TW': '塞拉利昂' },
		SM: { 'zh-CN': '圣马力诺', 'en-US': 'San Marino', 'zh-TW': '聖馬利諾' },
		SN: { 'zh-CN': '塞内加尔', 'en-US': 'Senegal', 'zh-TW': '塞內加爾' },
		SO: { 'zh-CN': '索马里', 'en-US': 'Somalia', 'zh-TW': '索馬利亞' },
		SR: { 'zh-CN': '苏里南', 'en-US': 'Suriname', 'zh-TW': '蘇里南' },
		ST: { 'zh-CN': '圣多美和普林西比', 'en-US': 'São Tomé and Príncipe', 'zh-TW': '聖多美和普林西比' },
		SV: { 'zh-CN': '萨尔瓦多', 'en-US': 'El Salvador', 'zh-TW': '薩爾瓦多' },
		SY: { 'zh-CN': '叙利亚', 'en-US': 'Syria', 'zh-TW': '敘利亞' },
		SZ: { 'zh-CN': '斯威士兰', 'en-US': 'Eswatini', 'zh-TW': '史瓦濟蘭' },
		TD: { 'zh-CN': '乍得', 'en-US': 'Chad', 'zh-TW': '查德' },
		TG: { 'zh-CN': '多哥', 'en-US': 'Togo', 'zh-TW': '多哥' },
		TH: { 'zh-CN': '泰国', 'en-US': 'Thailand', 'zh-TW': '泰國' },
		TJ: { 'zh-CN': '塔吉克斯坦', 'en-US': 'Tajikistan', 'zh-TW': '塔吉克' },
		TM: { 'zh-CN': '土库曼斯坦', 'en-US': 'Turkmenistan', 'zh-TW': '土庫曼' },
		TN: { 'zh-CN': '突尼斯', 'en-US': 'Tunisia', 'zh-TW': '突尼西亞' },
		TO: { 'zh-CN': '汤加', 'en-US': 'Tonga', 'zh-TW': '東加' },
		TR: { 'zh-CN': '土耳其', 'en-US': 'Turkey', 'zh-TW': '土耳其' },
		TT: { 'zh-CN': '特立尼达和多巴哥', 'en-US': 'Trinidad and Tobago', 'zh-TW': '千里達及托巴哥' },
		TV: { 'zh-CN': '图瓦卢', 'en-US': 'Tuvalu', 'zh-TW': '圖瓦盧' },
		TZ: { 'zh-CN': '坦桑尼亚', 'en-US': 'Tanzania', 'zh-TW': '坦尚尼亞' },
		UA: { 'zh-CN': '乌克兰', 'en-US': 'Ukraine', 'zh-TW': '烏克蘭' },
		UG: { 'zh-CN': '乌干达', 'en-US': 'Uganda', 'zh-TW': '烏干達' },
		US: { 'zh-CN': '美国', 'en-US': 'United States', 'zh-TW': '美國' },
		UY: { 'zh-CN': '乌拉圭', 'en-US': 'Uruguay', 'zh-TW': '烏拉圭' },
		UZ: { 'zh-CN': '乌兹别克斯坦', 'en-US': 'Uzbekistan', 'zh-TW': '烏茲別克' }
	}[idNumber.substring(0, 2).toUpperCase()];
	/* eslint-enable camelcase */
	return country
		? country[lang]
		: '';
}

function detectLanguage(text) {
	// this list is compiled from cdtym's work, see https://github.com/cdtym/digital-table-of-general-standard-chinese-characters
	const traCharList = '廠兒虧與億個廣門義衛飛習馬鄉開無專藝廳區車貝岡見氣長幣僅從侖倉風烏鳳爲憶計訂認譏隊辦鄧勸雙書擊撲節厲龍滅軋東盧業舊帥歸電號嘰嘆們儀叢爾樂處鳥務馮閃蘭頭漢寧討寫讓禮訓議訊記遼邊聖對糾絲動鞏執擴掃場揚亞機權過協壓厭頁奪達夾軌堯邁畢貞師塵嚇蟲嗎嶼歲豈則剛網遷喬偉傳優傷價倫華僞會殺衆爺傘創雜負壯妝莊慶劉齊産閉問闖關燈湯興講諱軍訝許訛論訟農諷設訪訣尋導孫陣陽階陰婦媽戲觀歡買紅馱馴約級紀馳紉壽麥瑪進遠違韌運撫壞摳擾貢掄搶墳護殻塊聲報擬蕪葦蒼嚴蘆勞極楊兩麗醫勵還殲來連軒堅時縣嘔園曠圍噸郵員聽嗆嗚嶇崗帳財針釘亂體傭徹鄰腸龜猶狽條島飯飲凍狀畝庫療應這廬閏閑間悶竈燦瀝淪滄溝滬懷憂窮證啓評補識詐訴診詞譯靈層遲張際陸陳墜勁鷄緯驅純紗綱納駁縱紛紙紋紡驢紐環責現規攏揀擔頂擁勢攔擰撥擇莖樞櫃槍楓構喪畫棗賣礬礦碼厠奮態歐毆壟轟頃轉斬輪軟齒虜腎賢國暢嚨鳴羅幟嶺凱敗賬販貶購貯圖釣俠僥偵側憑僑貨質徑覓貪貧膚腫脹骯脅魚獰備飾飽飼變龐廟瘧劑廢閘鬧鄭單爐淺濘瀉潑澤憐學寶寵審實試詩誠襯視話誕詭詢該詳肅録隸陝駕參艱綫練組紳細駛織駒終駐絆駝紹繹經貫貳幫項挾撓趙擋墊擠揮薦帶繭蕩榮葷熒蔭藥標棧棟欄檸樹磚硯牽鷗殘軸輕鴉戰點臨覽竪嘗啞顯貴蝦蟻螞雖駡勛嘩響喲峽罰賤貼貽鈣鈍鈔鋼鈉鑰欽鈞鈎鈕氈氫選適倆貸順儉劍朧膽勝狹獅獨獄貿餌饒蝕餃餅巒彎將奬瘡瘋親閨聞閩閥閣養類婁總煉爍爛窪潔灑澆濁測瀏濟渾濃惱舉覺憲竊誡誣語襖誤誘誨説誦墾晝費遜隕險嬌賀壘綁絨結繞驕繪給絢駱絡絶絞駭統艷蠶頑盞撈載趕鹽損撿摯熱搗壺聶萊蓮瑩鶯檔橋樺樁樣賈礫礎顧轎較頓斃慮監緊曬曉嘮鴨暈鴦罷圓賊賄賂贜錢鉗鑽鉀鐵鈴鉛犧敵積稱筆債傾賃艦艙聳愛頒頌臍膠腦膿鴕鴛皺餓餒戀槳漿齋離資競閲煩燒燭遞濤澇渦滌潤澗漲燙澀憫寬賓竅請諸諾讀誹襪課誰調諒諄談誼懇劇難預絹綉驗繼駿瑣擲摻職蘿螢營蕭薩夢檢醖碩聾襲輔輛顱懸躍囉嘯嶄邏嬰銬鐺鋁銅銘鏟銀矯穢籠償軀釁銜盤鴿斂領臉獵餡館癢閻闡蓋斷獸鴻漸淵漁滲慚懼驚慘慣謀諜謊諧禱禍謂諺謎彈墮隨隱嬸頗頸績緒續騎綽繩維綿綳綢綜綻緑綴瓊趨攬攙擱摟攪聯蔣韓橢確頰靂暫翹輩鑿輝賞睞噴疇踐遺鵑賦賭贖賜賠鑄鋪鏈銷鎖鋤鍋銹鋒鋅鋭鵝篩儲懲釋臘魯憊饋饞裝蠻闊糞滯濕潰濺灣憤竄窩褲禪謝謡謗謙屬屢緬纜緝緞緩締縷騙編騷緣鵡攝攤鵲藍獻欖樓賴礙尷霧輻輯輸頻齡鑒蹺蝸錯錨錫鑼錘錐錦鍵鋸錳辭頽籌簡膩鵬騰鮑穎觸雛饃餾醬謄糧數滿濾濫濱灘譽窺寢謹謬縛縫纏繽贅墻藹檻釀願轄輾顆踴蠟蠅蟬賺鍬鍛鍍穩籮簫輿鮮饅瀟賽譚譜騾縮攆聰藴櫻飄黴瞞題囑鎮鎬鎊簍鯉鯽癟癱顔鯊瀾額譴鶴繚顛轍鸚贈鏡贊籃鯨癮辯瀕懶繮繳矚贍鰐辮贏驟囂鐮鰭鷹巔顫癬鱉鬢鱗躪贛鑲韋閂訃勱芻鄺訐訌訕訖馭璣壙捫薌厙釔傴倀傖獷獁鳬鄔餳懺謳詎訥紆紂紇紈璵摶塢㩳藶莧萇蓯磯奩歟軔鄴嘸囈嚦暘唄幃峴嵐圇釗釙釕僉鳩鄒飩餼飪飫飭廡癤闈閎閔煬灃漚渢潙憮慪愾悵愴詁訶詛詆謅詔詒隴陘嫵嫗嬀剄紜紕紝綸紓瑋匭壚擓蘢蔦塋煢櫪梘棖樅碭甌郟軛鳶曇蟣黽嚀噝巋劌剴嶧釷釺釧釩釹釵儈儕儂劊慫糴戧膞邇梟餞飴癘瘍煒熰熗瀧瀘濼涇㥮懌誆誄詿詰詼鄆禕誅詵詬詮詣諍詫諢詡駑紺紲紱駟駙縐絀驛駘瓏頇埡撾撻賁壋撏莢貰蓽蕎薈薺堊滎犖蕁藎蓀蕒葤櫛櫳櫨櫟檉酈硨碸殤軲軻轤軼軫蠆覘瞘嘵嗶噦剮鄖噲噥嶢幀嶠貺鈈鈦鋇鈑鈐鎢鈁鈀篤儔儼儷腖臚脛鴇獪颮猻餉餄餎孿孌癧瘲颯闥閭闓閡熾烴浹澮滸潯濜慟懨愷惻惲誚禰誥誑鴆婭嬈懟絝驍驊絎絳駢頊璫琿塒塤堝贄蒔萵蕕鴣蒓橈楨榿檜邐礪礱軾輊輅鶇躉齔鸕矓嘜鴞蜆嗩嶗崍覬賅鈺鉦鈷鉢鈸鉞鉭鉬鈿鈾鉑鑠鉚鈰鉉鉈鉍鈮鈹鏺鐸氬筧頎徠膾鴟璽鴝獫裊餑欒攣癰痙頏閫鬮誾閬鄲燁燴燼淶漣潿慳諏諑禎諉諛諗諂誶媧嫻綆驪綃騁綏縧綈駸鷥燾璉麩擄摑鷙撣慤摜縈槤覡欞嗇匱硤磽鴯龔殞殮賚輒塹嘖囀嚙蹌蠣蠱蟶幘幗賕賑賒銠鉺鋏鐃銦鎧鍘銖銑鋌鏵銓鎩鉿銚鉻錚銫鉸銥銃銨銣鴰穠箋籩僨僂皚鴴艫龕玀獼餜餛鸞闍閾閹閶鬩閽閼羥糲燜漬瀆澠愜憚諶諫皸謔襠謁諤諭諼讒諳諦諞糶嬋綾騏綺緋緔騍緄騅綬綹綣綰驂緇靚輦黿頡撳蟄壪蔞櫝欏賫鵓鸝殫輥輞槧輟輜瞼躒蛺蟯螄蠐嘍嶸嶁賧鋙錸鏗鋥鋰鋯鋨銼鐧銻鋃鋦錒犢鵠篳牘儻儐儺嬃頜鵒魷魨魴潁颶觴熲餷餿褻臠癆癇賡頦鷳闌闃闋鵜憒嚳謨褳襇讜謖謚謐騭巰翬騖緙緗緘緹緲緦緱縋緡饗耮驁韞攄擯轂驀鶓薊蘺鎣頤櫚櫸磧磣鵪輳齟齙韙囁躂蹕躚躋噯鍺錛錡鍀錁錕錮鍁錈錠錙覦頷鮁鮃鮎鱸穌鮒鮐鵮颼饈鶉瘮闔闐闕灧瀅潷灤澦懾鱟騫竇謾謫嬡嬪縉縝縟轡騮縞縭縊縑騸覯韜靉攖薔藺鶘檳櫧釅殯霽轅齜齦瞜曖躊蟈鶚嚶羆賻罌鶻鍥鍇鍶鍔鍤鏘鎂鏤簀篋簞籙臏鮭鮪鱭鮫鱘饉鑾瘻闞鮝糝鷀瀲濰譖褸譙讕譎鶥嬙鶩驃縹縵縲纓驄繆繅耬瓔擷擼攛聵覲韃鞽蘄賾檣靨魘饜轆齬齪覷顒躓躑蠑螻顎嚕顓鑷鎘鎸鎳鎦鎰鎵鑌簣鷂鯁鱺鰱鰹鰣鯀鯇觶饊饌齏讞襤譫屨纈繕繒驏擻顳顢藪櫓櫞贋飆鏨轔蟎鐯鏢鏜鏝鏰鏞鏑鏃鏐氌穡魎鯪鯡鯤鯧鯝鯢鯛鯔獺鷓贇癭斕瀨顙繾繰繯蘚鷯齲齷躡蹣羈鐔鐝鐐鐓鑭鑹鏹鐙籪鷦鱝鰈鯷鰓鰍鰉鯿鷲懣鷸鰲韉顥鷺䴉髏鑊鐳鐲讎鰨鰥鰩癩攢靄躥髖髕鑔籟鰳鰾鱈鰻鱅讖驥纘瓚鼉黷黲鑣鑞臢鱖鱔鱒驤顰鱧癲灝鸛鑱趲顴躦饢戇戔訏訒釓俔閆澫訢訩詝紃纊瑒剗塸壢埨撝蔿榪軑軏咼㠣覎㑳颺閌潕湋澐浿諓禡詗詘詖屓彄紘馹馼紵紞駃紖瑲棡軝暐晛崬釴釤鍆鍚鄶獮飿嶨詷詪鄩鳲隑隮娙逕駓駔駉絅騶䮄紼紿瓅韍墶塏薘蕘蔄葒鳾龑軹軤轢軺睍曨噠鈃鈇鉅鋹釿錀鈧鈥鈄倈艤鶬颭餏湞溮滻褘絰駰絪駪綎綖驫勣璕𡑍䓣薟藭椏梜頍硜輄輈輇貲嗊曄暉鄳幬輋嶮贐鉥鉕鑪鉮鉊鉧僤鴒魛餗燖溳礐窵襏駼絺綌騂綄璡墠壼聹蘀勩罃檮棶厴䃮磑礄鴷齕頔蝀嘽鉶銈鉷銪鐽鋮鋣銍銱銩鐋鵂鵃貙腡魢廎鵁閿漍璗諲諴褌諟謏諝隤嫿綪綝騑騊綯綡綧驌騄縶塿蕆蕢櫍鵐鵏醱覿讋輗輬齗齘嵽嶔翽顗贔賙䥑鐒𨧀鋱銶鋗鋝鋶鐦鋐鋟頲簹頫膕頠䰾鵟餶廞闉燀濆濚漊斆襝毿騞騠緼線騤鶄赬蕷櫬醲磾輼輶輮齠鵾賵錆錤鍩鍈鑕鍃錞錇錟𨨏穇篢篔鵯鮋鮓鮊鮣鮈鮀鮍颸膢饁癉鶊闒闑灄襀謭鷫頵騵騱縗璊璦蘞檟欓鶠釃𥗽鮆鶪鶡鎝鎪鍠鍭鍰鎄鎡鐨鎇鶖籜鮚鮞鰤鮦鰂鮜鱠鮡鮠鮟飀鸑瘞鮺瀠窶譓縯麴靆鷊憖螮鏌鎛钂鎿鎓鎔鷉鶲鮸鰷鮶鯒鶹鶺鷁鶼瀂鶱譞驎豶䡵齮齯鹺巘鏏鐄䥕籛鯖鯕鯫鯴鰺饘嚲鷟黌鷚繶瓛蠨㘚𨭎鏷𨭆鐇鑥鐠鏻鐏鐩鐍鷭鰆鯻鰏鰊鱨鰛鰃鰁鱂襴鱀繻纁鬹虉鸏黶鐶鐿酇鰧鰟鰜鸌鸇囅鸊纆鰵鰶鱇䲁鰼彠顬鱚驦纕齼鱯鱤鱣鸘䲘鱲蔔幾幹纔萬韆豐雲歷曆僕鬥醜術葉衹隻鼕饑飢匯彙齣發髮臺颱檯樸誇劃當噹籲麯團糰迴硃嚮後閤衝盡儘纖縴壇罎壩垻摺蘇囌滷鹵裏睏彆餘穀係繫瀋錶範闆鬆鬱製颳捨捲簾彌瀰鬍鹹麵鐘鍾種鞦復複須鬚薑獲穫惡噁緻黨臟髒準癥塗傢據纍鏇澱築禦擺襬濛懞矇簽籤灕闢衊籬蕓蘋薴';
	let traCount = 0;
	for (const char of text) {
		if (traCharList.includes(char)) traCount++;
	}
	return /[\u4e00-\u9fff]/.test(text)
		// conservative estimation
		? traCount / (text.match(/[\u4e00-\u9fff]/g) || []).length > 0.05
			? 'zh-TW'
			: 'zh-CN'
		: 'en-US';
}

var exports = {
	patentCountry,
	detectLanguage
};

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "import",
		"input": "%0 Journal Article\r\n%A 张会佳\r\n%A 侯相竹\r\n%A 张涵\r\n%A 殷澳\r\n%A 高阳\r\n%A 徐多多\r\n%+ 长春中医药大学人参科学研究院;长春中医药大学药学院;\r\n%T 黄芪多糖复合酶提取工艺优化及其α-葡萄糖苷酶抑制活性\r\n%J 食品工业科技\r\n%K 黄芪多糖;复合酶;提取工艺;响应面;α-葡萄糖苷酶活性\r\n%X 目的：以黄芪为原料，采用复合酶法（木瓜蛋白酶、果胶酶、纤维素酶）提取黄芪多糖（Astragalus polysaccharides， APS），并分析工艺条件对多糖提取的影响。方法：在正交实验确定复合酶比例的基础上，采用响应面法对复合酶提取APS的提取条件进行优化，得到最优工艺条件，采用pNPG法评价其α-葡萄糖苷酶抑制活性。结果：得到最佳复合酶配比为：木瓜蛋白酶17 600 U/g、果胶酶13 000 U/g、纤维素酶1 200 U/g；最佳酶解提取条件为：酶解处理时间、温度、pH值、料液比和分别为2.5 h、60 ℃、5.0和1∶35 g/mL，APS的得率最高可达23.59%±0.14%；APS对α-葡萄糖苷酶的半数抑制浓度（IC_(50)）为7.42 μg/mL。结论：复合酶提取APS的得率较单酶得率显著提高，APS对α-葡萄糖苷酶表现出较强的抑制作用。\r\n%P 1-15\r\n%@ 1002-0306\r\n%U https://link.cnki.net/doi/10.13386/j.issn1002-0306.2023090315\r\n%R 10.13386/j.issn1002-0306.2023090315\r\n%W CNKI",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "黄芪多糖复合酶提取工艺优化及其α-葡萄糖苷酶抑制活性",
				"creators": [
					{
						"firstName": "",
						"lastName": "张会佳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "侯相竹",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张涵",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "殷澳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "高阳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "徐多多",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"DOI": "10.13386/j.issn1002-0306.2023090315",
				"ISSN": "1002-0306",
				"abstractNote": "目的：以黄芪为原料，采用复合酶法（木瓜蛋白酶、果胶酶、纤维素酶）提取黄芪多糖（Astragalus polysaccharides， APS），并分析工艺条件对多糖提取的影响。方法：在正交实验确定复合酶比例的基础上，采用响应面法对复合酶提取APS的提取条件进行优化，得到最优工艺条件，采用pNPG法评价其α-葡萄糖苷酶抑制活性。结果：得到最佳复合酶配比为：木瓜蛋白酶17 600 U/g、果胶酶13 000 U/g、纤维素酶1 200 U/g；最佳酶解提取条件为：酶解处理时间、温度、pH值、料液比和分别为2.5 h、60 ℃、5.0和1∶35 g/mL，APS的得率最高可达23.59%±0.14%；APS对α-葡萄糖苷酶的半数抑制浓度（IC_(50)）为7.42 μg/mL。结论：复合酶提取APS的得率较单酶得率显著提高，APS对α-葡萄糖苷酶表现出较强的抑制作用。",
				"language": "zh-CN",
				"pages": "1-15",
				"publicationTitle": "食品工业科技",
				"url": "https://link.cnki.net/doi/10.13386/j.issn1002-0306.2023090315",
				"attachments": [],
				"tags": [
					{
						"tag": "α-葡萄糖苷酶活性"
					},
					{
						"tag": "响应面"
					},
					{
						"tag": "复合酶"
					},
					{
						"tag": "提取工艺"
					},
					{
						"tag": "黄芪多糖"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "%0 Thesis\r\n%A 胡婕伦\r\n%T 大粒车前子多糖体内外消化与酵解特征体系构建及其促进肠道健康的作用\r\n%Y 谢明勇;聂少平\r\n%J 南昌大学\r\n%9 博士\r\n%D 2014\r\n%K 大粒车前子;多糖;体内;体外;消化;酵解;肠道功能;肠道菌群;结肠炎\r\n%X 车前子定义为车前（Plantago asiatica L.，又称大粒车前）或平车前（Plantagodepressa Willd.）的干燥成熟种子，是传统中医用药之一。本文以江西吉安产大粒车前子为研究对象，研究车前子多糖体内外消化过程和酵解方式，及其对肠道功能的提升作用。首先通过体外研究，建立人体胃肠道消化酵解模拟系统，研究大粒车前子多糖在口腔及胃肠道中的消化过程和在人体粪便菌群中的酵解方式；模拟和探讨大粒车前子多糖肠道功能。再利用体内实验，研究车前子多糖在小鼠体内的酵解方式及其对结肠功能指标的影响，以及物理加工方式对车前子多糖肠道生理活性的影响；与此同时分析车前子多糖对小鼠体内相关肠道生理指标及菌群的影响，最后进一步通过结肠炎小鼠模型探讨车前子多糖对模型小鼠肠道功能的作用。主要研究结论如下： 1.通过体外模拟口腔唾液，胃部和小肠消化实验研究车前子多糖的消化过程，结果发现唾液淀粉酶对车前子多糖相对分子质量没有影响，而在胃肠道消化过程中多糖受到影响。在模拟的胃、小肠消化体系中，多糖的相对分子质量发生改变，从(1,903.1±93.0) x103降低为(4.7±0.2) x103，还原糖含量从0.157±0.009mM增加为0.622±0.026mM，这表明车前子多糖相对分子质量的降低是由于糖苷键的断裂。同时，在整个模拟的消化过程中，没有检测到游离单糖，表明车前子多糖在模拟胃肠消化过程中没有产生游离单糖。这些结果能为车前子多糖的体外消化提供一些信息，并能其他多糖的消化提供参考。 2.探讨了大粒车前子多糖体外酵解及其碳水化合物对酵解发挥的作用。车前子多糖在体外由人体粪便培养物进行酵解24h。在酵解过程中，粪便培养物的pH由6.1降为5.1，总短链脂肪酸（SCFA）、乙酸、丙酸和正丁酸的含量均显著增加。车前子多糖主要由木糖，阿拉伯糖及半乳糖醛酸组成，因此在酵解过程中，木聚糖酶、阿拉伯呋喃糖酶、木糖苷酶和葡萄糖醛酸酶的活性也都增加。酵解24h后，多糖中47.2±1.6%总碳水化合物被消耗，这其中包括阿拉伯糖（消耗42.9±1.5%）、木糖（消耗53.2±1.6%）和葡萄糖醛酸（消耗76.4±1.2%）。同时，探讨了多糖中碳水化合物的消耗与SCFA的产量间的关系。研究发现，乙酸和正丁酸的增加主要是由于多糖中葡萄糖醛酸和木糖的发酵，而丙酸的增加则主要是由于阿拉伯糖和木糖的酵解。这些结果提示车前子多糖对大肠健康的...\r\n%U https://kns.cnki.net/kcms2/article/abstract?v=4j1cDaxzFAmdwuJtF5GSSwTOh5DKQ-XggUo-CCpRcTPMhoiSAivy3RnBKYbaqRTkr4-d_IUr08W2aLDa-BQRYeJ24AF2aHeXN6NIm5fNtC__q9M2RmhG37On8MDDm4Cr0-9hk46u0EdKeUVLUcR6qw==&uniplatform=NZKPT&language=CHS\r\n%W CNKI",
		"items": [
			{
				"itemType": "thesis",
				"title": "大粒车前子多糖体内外消化与酵解特征体系构建及其促进肠道健康的作用",
				"creators": [
					{
						"firstName": "",
						"lastName": "胡婕伦",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "谢明勇",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "聂少平",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2014",
				"abstractNote": "车前子定义为车前（Plantago asiatica L.，又称大粒车前）或平车前（Plantagodepressa Willd.）的干燥成熟种子，是传统中医用药之一。本文以江西吉安产大粒车前子为研究对象，研究车前子多糖体内外消化过程和酵解方式，及其对肠道功能的提升作用。首先通过体外研究，建立人体胃肠道消化酵解模拟系统，研究大粒车前子多糖在口腔及胃肠道中的消化过程和在人体粪便菌群中的酵解方式；模拟和探讨大粒车前子多糖肠道功能。再利用体内实验，研究车前子多糖在小鼠体内的酵解方式及其对结肠功能指标的影响，以及物理加工方式对车前子多糖肠道生理活性的影响；与此同时分析车前子多糖对小鼠体内相关肠道生理指标及菌群的影响，最后进一步通过结肠炎小鼠模型探讨车前子多糖对模型小鼠肠道功能的作用。主要研究结论如下： 1.通过体外模拟口腔唾液，胃部和小肠消化实验研究车前子多糖的消化过程，结果发现唾液淀粉酶对车前子多糖相对分子质量没有影响，而在胃肠道消化过程中多糖受到影响。在模拟的胃、小肠消化体系中，多糖的相对分子质量发生改变，从(1,903.1±93.0) x103降低为(4.7±0.2) x103，还原糖含量从0.157±0.009mM增加为0.622±0.026mM，这表明车前子多糖相对分子质量的降低是由于糖苷键的断裂。同时，在整个模拟的消化过程中，没有检测到游离单糖，表明车前子多糖在模拟胃肠消化过程中没有产生游离单糖。这些结果能为车前子多糖的体外消化提供一些信息，并能其他多糖的消化提供参考。 2.探讨了大粒车前子多糖体外酵解及其碳水化合物对酵解发挥的作用。车前子多糖在体外由人体粪便培养物进行酵解24h。在酵解过程中，粪便培养物的pH由6.1降为5.1，总短链脂肪酸（SCFA）、乙酸、丙酸和正丁酸的含量均显著增加。车前子多糖主要由木糖，阿拉伯糖及半乳糖醛酸组成，因此在酵解过程中，木聚糖酶、阿拉伯呋喃糖酶、木糖苷酶和葡萄糖醛酸酶的活性也都增加。酵解24h后，多糖中47.2±1.6%总碳水化合物被消耗，这其中包括阿拉伯糖（消耗42.9±1.5%）、木糖（消耗53.2±1.6%）和葡萄糖醛酸（消耗76.4±1.2%）。同时，探讨了多糖中碳水化合物的消耗与SCFA的产量间的关系。研究发现，乙酸和正丁酸的增加主要是由于多糖中葡萄糖醛酸和木糖的发酵，而丙酸的增加则主要是由于阿拉伯糖和木糖的酵解。这些结果提示车前子多糖对大肠健康的...",
				"language": "zh-CN",
				"thesisType": "博士学位论文",
				"university": "南昌大学",
				"url": "https://kns.cnki.net/kcms2/article/abstract?v=4j1cDaxzFAmdwuJtF5GSSwTOh5DKQ-XggUo-CCpRcTPMhoiSAivy3RnBKYbaqRTkr4-d_IUr08W2aLDa-BQRYeJ24AF2aHeXN6NIm5fNtC__q9M2RmhG37On8MDDm4Cr0-9hk46u0EdKeUVLUcR6qw==&uniplatform=NZKPT&language=CHS",
				"attachments": [],
				"tags": [
					{
						"tag": "体内"
					},
					{
						"tag": "体外"
					},
					{
						"tag": "多糖"
					},
					{
						"tag": "大粒车前子"
					},
					{
						"tag": "消化"
					},
					{
						"tag": "结肠炎"
					},
					{
						"tag": "肠道功能"
					},
					{
						"tag": "肠道菌群"
					},
					{
						"tag": "酵解"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "%0 Conference Proceedings\r\n%A 王海霞\r\n%A 罗耀群\r\n%+ 内蒙古包头市中心医院药剂科;\r\n%T 中医理论与现代药理学中的黄芪药理作用研究进展\r\n%B 2013年中国药学大会暨第十三届中国药师周\r\n%C 中国广西南宁\r\n%? 中国药学会\r\n%D 2013\r\n%P 5\r\n%K 黄芪;药理作用;研究进展\r\n%X 黄芪作为传统中药,具有广泛的药用价值,有\"补药之长\"之称。国内外学者对黄芪的主要成分物质做了大量药学研究工作。本文通过查阅大量文献资料,综述黄芪的主要成分中的黄芪皂苷、多糖、黄酮、微量元素等主要成分与其在机体各个系统中的药理作用。\r\n%P 269-273\r\n%U https://kns.cnki.net/kcms2/article/abstract?v=4j1cDaxzFAkMiAqWOVcpkQSu-qVXhwVyhTfACjn3pLUOszWG3nZTLCFArFj5jtkbXHb5JPSODn-hWuOi9Y4U-tyyQ2jmyseCnWcvIAA9YNZ0R3OrcVWIGLIrJWHAiH4lM-pZr7YS1PAOEvXXmfrUnA==&uniplatform=NZKPT&language=CHS\r\n%W CNKI",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "中医理论与现代药理学中的黄芪药理作用研究进展",
				"creators": [
					{
						"firstName": "",
						"lastName": "王海霞",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "罗耀群",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2013",
				"abstractNote": "黄芪作为传统中药,具有广泛的药用价值,有\"补药之长\"之称。国内外学者对黄芪的主要成分物质做了大量药学研究工作。本文通过查阅大量文献资料,综述黄芪的主要成分中的黄芪皂苷、多糖、黄酮、微量元素等主要成分与其在机体各个系统中的药理作用。",
				"conferenceName": "2013年中国药学大会暨第十三届中国药师周",
				"extra": "organizer: 中国药学会",
				"language": "zh-CN",
				"pages": "5, 269-273",
				"place": "中国广西南宁",
				"url": "https://kns.cnki.net/kcms2/article/abstract?v=4j1cDaxzFAkMiAqWOVcpkQSu-qVXhwVyhTfACjn3pLUOszWG3nZTLCFArFj5jtkbXHb5JPSODn-hWuOi9Y4U-tyyQ2jmyseCnWcvIAA9YNZ0R3OrcVWIGLIrJWHAiH4lM-pZr7YS1PAOEvXXmfrUnA==&uniplatform=NZKPT&language=CHS",
				"attachments": [],
				"tags": [
					{
						"tag": "研究进展"
					},
					{
						"tag": "药理作用"
					},
					{
						"tag": "黄芪"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "%0 Patent\r\n%T Font generating device and method for changing partial character style\r\n%A Jaeyoung Choi;Geunho Jeong\r\n%+ Seoul KR\r\n%8 2023-05-16\r\n%@ US11651140\r\n%X Provided is a font generating method including generating an intermediate code by adding attributes for METAFONT to code of an outline font, generating a font in the METAFONT by parsing the intermediate code, hierarchizing the font into a whole set representing a whole of a character and a partial set representing a part of the character, and changing a style of the font according to a relational equation representing a relationship between the whole set and the partial set.\r\n%~ 海外专利\r\nPageCount-页码 0\r\n%W CNKI\r\n",
		"items": [
			{
				"itemType": "patent",
				"title": "Font generating device and method for changing partial character style",
				"creators": [
					{
						"firstName": "Jaeyoung",
						"lastName": "Choi",
						"creatorType": "author"
					},
					{
						"firstName": "Geunho",
						"lastName": "Jeong",
						"creatorType": "author"
					}
				],
				"issueDate": "2023-05-16",
				"abstractNote": "Provided is a font generating method including generating an intermediate code by adding attributes for METAFONT to code of an outline font, generating a font in the METAFONT by parsing the intermediate code, hierarchizing the font into a whole set representing a whole of a character and a partial set representing a part of the character, and changing a style of the font according to a relational equation representing a relationship between the whole set and the partial set.",
				"country": "美国",
				"language": "zh-CN",
				"patentNumber": "US11651140",
				"place": "美国",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "%0 Legal Rule or Regulation\r\n%T 船舶及海洋工程用不锈钢复合钢板\r\n%A 南京钢铁股份有限公司;冶金工业信息标准研究院;张家港宏昌钢板有限公司;湖南华菱湘潭钢铁有限公司;武汉科技大学;青岛钢研纳克检测防护技术有限公司;中海油(天津)管道工程技术有限公司;招商局金陵鼎衡船舶(扬州)有限公司\r\n%I 国家市场监督管理总局;国家标准化管理委员会\r\n%D 2023-09-07\r\n%V GB/T 43109-2023\r\n%K 不锈钢复合钢板\r\n%~ 国家标准\r\n%P 12\r\n%U https://kns.cnki.net/kcms2/article/abstract?v=4j1cDaxzFAkUKsKELQcXk35ZPv_FR6EQU9GhJgKt5MR1sJc3EaGeSopmhS9vO3xi9S3AFOQO3Xu9nnSXHay_VmuFMZyVXGEWwfvPLpIq_bH75z4-MZuOvehDd7XuulOVmkprVcTe494=&uniplatform=NZKPT&language=CHS\r\n%W CNKI",
		"items": [
			{
				"itemType": "standard",
				"title": "船舶及海洋工程用不锈钢复合钢板",
				"creators": [],
				"date": "2023-09-07",
				"language": "zh-CN",
				"numPages": "12",
				"number": "GB/T 43109—2023",
				"url": "https://kns.cnki.net/kcms2/article/abstract?v=4j1cDaxzFAkUKsKELQcXk35ZPv_FR6EQU9GhJgKt5MR1sJc3EaGeSopmhS9vO3xi9S3AFOQO3Xu9nnSXHay_VmuFMZyVXGEWwfvPLpIq_bH75z4-MZuOvehDd7XuulOVmkprVcTe494=&uniplatform=NZKPT&language=CHS",
				"attachments": [],
				"tags": [
					{
						"tag": "不锈钢复合钢板"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "%0 Newspaper Article\r\n%A 刘霞\r\n%T 灭绝物种RNA首次分离测序\r\n%J 科技日报\r\n%8 2023-09-21\r\n%P 004\r\n%I 科技日报\r\n%L 11-0315\r\n%R 10.28502/n.cnki.nkjrb.2023.005521\r\n%W CNKI",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "灭绝物种RNA首次分离测序",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘霞",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-09-21",
				"extra": "DOI: 10.28502/n.cnki.nkjrb.2023.005521",
				"language": "zh-CN",
				"pages": "4",
				"publicationTitle": "科技日报",
				"url": "https://doi.org/10.28502/n.cnki.nkjrb.2023.005521",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "%0 Legal Rule or Regulation\r\n%T 国家统配煤炭工业煤炭外调量\r\n%D 1995/01/01\r\n%V 7-203-03520-4\r\n%K 煤炭外调量\r\n%~ 年鉴\r\n%P 156\r\n%U https://kns.cnki.net/kcms2/article/abstract?v=-0THPtffOh3X1yaBBkMCatOnpdIbXJHtXHguzwTx01Y6HcO47AM_4NtZTLG5xc3LMzdrpeqNtRpqXaU4SJjePUAmSn1Qn5RzEMWSZ3-X2m2Z_rZhKom6PuDEwAyQQGSUjNIdjX8RAmr4PlceakIM7Q==&uniplatform=NZKPT&language=CHS\r\n%W CNKI\r\n",
		"items": [
			{
				"itemType": "bookSection",
				"title": "国家统配煤炭工业煤炭外调量",
				"creators": [],
				"date": "1995-01-01",
				"ISBN": "7203035204",
				"language": "zh-CN",
				"pages": "156",
				"url": "https://kns.cnki.net/kcms2/article/abstract?v=-0THPtffOh3X1yaBBkMCatOnpdIbXJHtXHguzwTx01Y6HcO47AM_4NtZTLG5xc3LMzdrpeqNtRpqXaU4SJjePUAmSn1Qn5RzEMWSZ3-X2m2Z_rZhKom6PuDEwAyQQGSUjNIdjX8RAmr4PlceakIM7Q==&uniplatform=NZKPT&language=CHS",
				"attachments": [],
				"tags": [
					{
						"tag": "煤炭外调量"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "%0 Thesis\r\n%A 潘福妮\r\n%T 中西方高校人文教育的比較研究\r\n%Y 董鋒\r\n%I 大連理工大學\r\n%9 碩士\r\n%D 2006\r\n%K 中西方高校;人文教育;比較\r\n%X 隨著上個世紀70年代中期西方大學興起人文教育的“復歸”,人文教育逐漸成為當今世界高等教育改革與發展一個熱點。中國高校在人文教育的諸多方面,尤其是在人文教育的理念和方式方法等方面已經落后,并與西方高校形成了較為明顯的差距。論文以此為切入點,闡述了中西方高校人文教育各自發展的情況,并通過相互比較,找出中西方高校人文教育中存在的共性和差異,去其糟粕,取其精華,為構建有中國特色的人文教育體系提供有益的啟示與借鑒。\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n    論文第一部分說明了研究的目的,研究的理論意義與實踐意義,介紹了論文的大致內容和文獻法、資料處理法、比較法、社會調查法等研究方法。論文第二部分對人文教育的基本理論做了一個概述,通過對人文教育的內涵、特點與價值的界定,為本研究打下理論基礎。論文第三部分也是最重要的部分,通過各種研究方法對中西方高校人文教育在教育背景、教育目標、教育內容、人文課程、教育途徑與方法進行比較,指出中國高校人文教育在這幾方面的差距,主要包括人文教育的環境不夠成熟;對人文教育目標的理解不夠明確;德育教育進行得不夠到位:人文學科課程在全部課程中所占的比重不夠,在內容設置上比較隨意,人文性與科學性結合程度不夠,人文教育與專業教育的結合程度不夠;教學方法需要改進等等。論文的最后部分是結論部分,針對上述種種不足,西方國家高校人文教育的一些做法與經驗為中國高校提供了有益的啟示,如政府出臺支持性的政策與文件;在追求個性發展的同時實現個人價值與社會價值的統一;要加強德育教育;人文課程注重民族性與國際性相結合,注重科學性與人文性相結合,同時人文課程應與其它專業相互融合;改進教學方法等。\r\n%W CNKI\r\n\r\n",
		"items": [
			{
				"itemType": "thesis",
				"title": "中西方高校人文教育的比較研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "潘福妮",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "董鋒",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2006",
				"abstractNote": "隨著上個世紀70年代中期西方大學興起人文教育的“復歸”,人文教育逐漸成為當今世界高等教育改革與發展一個熱點。中國高校在人文教育的諸多方面,尤其是在人文教育的理念和方式方法等方面已經落后,并與西方高校形成了較為明顯的差距。論文以此為切入點,闡述了中西方高校人文教育各自發展的情況,并通過相互比較,找出中西方高校人文教育中存在的共性和差異,去其糟粕,取其精華,為構建有中國特色的人文教育體系提供有益的啟示與借鑒。\n論文第一部分說明了研究的目的,研究的理論意義與實踐意義,介紹了論文的大致內容和文獻法、資料處理法、比較法、社會調查法等研究方法。論文第二部分對人文教育的基本理論做了一個概述,通過對人文教育的內涵、特點與價值的界定,為本研究打下理論基礎。論文第三部分也是最重要的部分,通過各種研究方法對中西方高校人文教育在教育背景、教育目標、教育內容、人文課程、教育途徑與方法進行比較,指出中國高校人文教育在這幾方面的差距,主要包括人文教育的環境不夠成熟;對人文教育目標的理解不夠明確;德育教育進行得不夠到位:人文學科課程在全部課程中所占的比重不夠,在內容設置上比較隨意,人文性與科學性結合程度不夠,人文教育與專業教育的結合程度不夠;教學方法需要改進等等。論文的最后部分是結論部分,針對上述種種不足,西方國家高校人文教育的一些做法與經驗為中國高校提供了有益的啟示,如政府出臺支持性的政策與文件;在追求個性發展的同時實現個人價值與社會價值的統一;要加強德育教育;人文課程注重民族性與國際性相結合,注重科學性與人文性相結合,同時人文課程應與其它專業相互融合;改進教學方法等。",
				"language": "zh-TW",
				"thesisType": "碩士學位論文",
				"university": "大連理工大學",
				"attachments": [],
				"tags": [
					{
						"tag": "中西方高校"
					},
					{
						"tag": "人文教育"
					},
					{
						"tag": "比較"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
