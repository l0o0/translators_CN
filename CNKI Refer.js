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
	"lastUpdated": "2024-02-03 19:26:08"
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
	var line;
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
	var record = '';
	var line;
	var translator = Zotero.loadTranslator("import");
	// Refer/BibIX
	translator.setTranslator('881f60f2-0802-411a-9228-ce5f47b64c7d');
	translator.setHandler('itemDone', (_obj, item) => {
		Z.debug(item.itemType);
		// Record the yearbook as journal article.
		if (item.type == '年鉴') {
			item.itemType = 'journalArticle';
		}
		switch (item.itemType) {
			case 'conferencePaper':
				item.conferenceName = item.publicationTitle;
				delete item.publicationTitle;
				extra.add('organizer', tryMatch(record, /^%\? (.*)/m, 1));
				break;
			case 'newspaperArticle':
			case 'journalArticle':
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
					extra.add('Genre', item.type, true);
				}
				delete item.type;
				item.place = tryMatch(record, /^%~ (.*)/m, 1).replace(/专利$/, '');
				item.country = item.place;
				break;
			case 'statute':
				item.itemType = 'standard';
				item.creators = [];
				delete item.pages;
				if (item.volume) {
					item.number = item.volume.replace('-', '—');
				}
				delete item.volume;
				delete item.publisher;
				break;
			case 'thesis':
				item.numPages = item.pages;
				delete item.pages;
				item.university = item.publicationTitle;
				delete item.publicationTitle;
				if (item.type) {
					item.thesisType = `${item.type}学位论文`;
					delete item.type;
				}
				item.creators.forEach((creator) => {
					if (creator.creatorType == 'translator') {
						creator.creatorType = 'contributor';
					}
				});
				break;
		}
		if (ZU.fieldIsValidForType('DOI', item.itemType)) {
			item.DOI = tryMatch(record, /%O (.*)/, 1);
		}
		else {
			extra.add('DOI', tryMatch(record, /%O (.*)/, 1), true);
		}
		if (ZU.fieldIsValidForType('pages', item.itemType) && item.pages) {
			item.pages = item.pages.replace(/~/g, '-').replace(/\+/g, ', ');
		}
		delete item.archiveLocation;
		item.extra = extra.toString();
		item.creators.forEach((creator) => {
			if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
				creator.lastName = creator.firstName + creator.lastName;
				creator.firstName = '';
				creator.fieldMode = 1;
			}
		});
		item.complete();
	});
	while ((line = Zotero.read()) !== false) {
		line = line.replace(/^\s+/, '');
		record += '\n' + line;
		if (line == '%W CNKI') {
			record = record
				// breakline
				.replace(/<br>\s*|\r/g, '\n')
				// If a non-empty line does not contain a tag, it is considered a continuation of the previous line.
				.replace(/\n([^%].+?\n)/g, '$1')
				// Sometimes, authors, contributors, or keywords have their tags, but do not wrap before the tags.
				.replace(/^(.+)(%[KAYI]) /gm, '$1\n$2 ')
				// Sometimes, authors, contributors, or keywords may be mistakenly placed in the same tag.
				.replace(/^%([KAYI]) .*/gm, (match) => {
					return match.replace(/[;，；]\s?/g, `\n%${match[1]} `);
				})
				.replace(/^%R /m, '%O ')
				// Custom tag "9" corresponds to the degree of the graduation thesis,
				//and tag "~" corresponds standard type (national standard or industry standard).
				.replace(/^%[9~] /m, '%R ')
				.replace(/^%V 0*/m, '%V ')
				.replace(/^%N 0*/m, '%N ')
				.replace(/^%P (.+)/, match => '%P ' + match.replace(/~/g, '-').replace(/\+/g, ', '))
				// \t in abstract
				.replace(/\t/g, '')
				.replace(/(\n\s*)+/g, '\n');
			Z.debug(record);
			translator.setString(record);
			await translator.translate();
			record = '';
		}
	}
}

const extra = {
	clsFields: [],
	elseFields: [],
	add: function (key, value, cls = false) {
		if (value && cls) {
			this.clsFields.push([key, value]);
		}
		else if (value) {
			this.elseFields.push([key, value]);
		}
	},
	toString: function () {
		return [...this.clsFields, ...this.elseFields]
			.map(entry => `${entry[0]}: ${entry[1]}`)
			.join('\n');
	}
};

/**
 * Attempts to get the part of the pattern described from the character,
 * and returns an empty string if not match.
 * @param {String} string
 * @param {RegExp} pattern
 * @param {Number} index
 * @returns
 */
function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

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
				"patentNumber": "US11651140",
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
				"number": "GB/T 43109—2023",
				"type": "国家标准",
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
	}
]
/** END TEST CASES **/
