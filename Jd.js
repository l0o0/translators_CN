{
	"translatorID": "30ad4aab-a919-49fc-82ac-58b9d45eceb8",
	"label": "Jd",
	"creator": "018, jiaojiaodubai",
	"target": "^https?://(search|item)\\.jd\\.com/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-08-22 05:52:43"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 018<lyb018@gmail.com>, 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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


function detectWeb(doc, _url) {
	if (doc.querySelector('.book-detail-item')) {
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('#J_goodsList > ul > li.gl-item');
	for (const row of rows) {
		const name = row.querySelector('.p-name > a');
		const isBook = !!row.querySelector('p-bookdetails');
		if (!name || !isBook) continue;
		const href = name.href;
		const title = ZU.trimInternal(name.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc);
	}
}

async function scrape(doc) {
	const newItem = new Z.Item('book');
	const labels = new Labels(doc, '#detail .p-parameter > ul >li');
	newItem.title = ZU.trimInternal(text(doc, '.product-intro > .itemInfo-wrap > .sku-name'));
	newItem.abstractNote = ZU.trimInternal(text(doc, 'div[text="内容简介"] > .item-mc'));
	newItem.edition = labels.get('版次');
	newItem.publisher = labels.get('出版社');
	newItem.date = ZU.strToISO(labels.get('出版时间'));
	newItem.numPages = labels.get('页数');
	newItem.ISBN = labels.get('ISBN');
	newItem.url = attr(doc, 'link[rel="canonical"]', 'href').replace(/^\/\//, 'https://');
	// 这里要么使用script[charset="gbk"]获取完整作者并丢失，要么使用
	try {
		tryMatch(text(doc, 'head > script[charset="gbk"]'), /^\s*authors: \[([^\]]*)\]/m, 1)
			.slice(1, -1)
			.split(/","/)
			.forEach((creator) => {
				creator = ZU.cleanAuthor(creator, 'author');
				if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
					creator.fieldMode = 1;
				}
				newItem.creators.push(creator);
			});
	}
	catch (error) {
		Z.debug(error);
	}
	const contents = innerText(doc, 'div[text="目录"] > .item-mc > div');
	if (contents) {
		newItem.notes.push({
			title: '目录',
			note: contents
		});
	}
	newItem.complete();
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				const elmCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elmCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elmCopy.removeChild(elmCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elmCopy.childNodes.length > 1) {
					const key = elmCopy.removeChild(elmCopy.firstChild).textContent.replace(/\s/g, '');
					this.data.push([key, elmCopy]);
				}
				else {
					const text = ZU.trimInternal(elmCopy.textContent);
					const key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elmCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.data.push([key, elmCopy]);
				}
			});
	}

	get(label, element = false) {
		if (Array.isArray(label)) {
			const results = label
				.map(aLabel => this.get(aLabel, element));
			const keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElm
					: '';
		}
		const pattern = new RegExp(label, 'i');
		const keyVal = this.data.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElm
				: '';
	}
}

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
		"type": "web",
		"url": "https://search.jd.com/Search?keyword=9787300256535&shop=1&click=1",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://item.jd.com/12445113.html",
		"items": [
			{
				"itemType": "book",
				"title": "计算机组成与设计：硬件/软件接口（原书第5版·ARM版）",
				"creators": [
					{
						"firstName": "",
						"lastName": "戴维·A.帕特森",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "约翰·L.亨尼斯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈微",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018-10-01",
				"ISBN": "9787111608943",
				"abstractNote": "本书由2017年图灵奖得主Patterson和Hennessy共同撰写，是计算机体系结构领域的经典教材，强调软硬件协同设计及其对性能的影响。本书采用ARMv8体系结构,讲解硬件技术、汇编语言、计算机算术运算、流水线、存储器层次结构以及I/O的基本原理。新内容涵盖平板电脑、云基础设施、ARM（移动计算设备）以及x86（云计算）体系结构，新实例包括IntelCorei7、ARMCortex-A53以及NVIDIAFermiGPU。本书适合作为高等院校计算机专业的教材，也适合广大专业技术人员参考。",
				"edition": "1",
				"libraryCatalog": "Jd",
				"numPages": "501",
				"publisher": "机械工业出版社",
				"url": "https://item.jd.com/12445113.html",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"title": "目录",
						"note": "出版者的话\n赞誉\n译者序\n前言\n作者简介\n第1章　计算机的抽象与技术 1\n1.1　引言 1\n1.1.1　计算机应用的分类和特点 2\n1.1.2　欢迎来到后PC时代 3\n1.1.3　你能从本书中学到什么 4\n1.2　计算机体系结构中的8个伟大思想 6\n1.2.1　面向摩尔定律的设计 6\n1.2.2　使用抽象简化设计 7\n1.2.3　加速大概率事件 7\n1.2.4　通过并行提高性能 7\n1.2.5　通过流水线提高性能 7\n1.2.6　通过预测提高性能 7\n1.2.7　存储器层次结构 7\n1.2.8　通过冗余提高可靠性 7\n1.3　程序表象之下 8\n1.4　硬件包装之下 10\n1.4.1　显示器 11\n1.4.2　触摸屏 12\n1.4.3　打开机箱 13\n1.4.4　数据的安全存储 15\n1.4.5　与其他计算机通信 16\n1.5　处理器和存储器制造技术 17\n1.6　性能 20\n1.6.1　性能的定义 20\n1.6.2　性能的度量 22\n1.6.3　CPU的性能及其度量因素 24\n1.6.4　指令的性能 24\n1.6.5　经典的CPU性能公式 25\n1.7　功耗墙 28\n1.8　沧海巨变：从单处理器向多处理器转变 29\n1.9　实例：Intel Core i7基准测试 32\n1.9.1　SPEC CPU基准测试程序 32\n1.9.2　SPEC功耗基准测试程序 34\n1.10　谬误与陷阱 34\n1.11　本章小结 36\n1.12　历史观点与拓展阅读 37\n1.13　练习题 38\n第2章　指令：计算机的语言 42\n2.1　引言 42\n2.2　计算机硬件的操作 44\n2.3　计算机硬件的操作数 46\n2.3.1　存储器操作数 47\n2.3.2　常数或立即数操作数 50\n2.4　有符号数和无符号数 51\n2.5　计算机中指令的表示 56\n2.6　逻辑操作 61\n2.7　决策指令 64\n2.7.1　循环 65\n2.7.2　边界检查的简便方法 67\n2.7.3　case/switch语句 67\n2.8　计算机硬件对过程的支持 68\n2.8.1　使用更多的寄存器 69\n2.8.2　过程嵌套 71\n2.8.3　在栈中为新数据分配空间 73\n2.8.4　在堆中为新数据分配空间 74\n2.9　人机交互 76\n2.10　LEGv8中的宽立即数和地址的寻址 79\n2.10.1　宽立即数 79\n2.10.2　分支中的寻址 80\n2.10.3　LEGv8寻址模式总结 82\n2.10.4　机器语言解码 82\n2.11　并行与指令：同步 86\n2.12　翻译并启动程序 88\n2.12.1　编译器 88\n2.12.2　汇编器 89\n2.12.3　链接器 90\n2.12.4　加载器 92\n2.12.5　动态链接库 92\n2.12.6　启动Java程序 94\n2.13　综合实例：C排序程序 95\n2.13.1　swap过程 95\n2.13.2　sort过程 97\n2.14　数组和指针 101\n2.14.1　用数组实现clear 102\n2.14.2　用指针实现clear 102\n2.14.3　比较两个版本的clear 103\n2.15　高级主题：编译C和解释Java 104\n2.16　实例：MIPS指令集 104\n2.17　实例：ARMv7（32位）指令集 105\n2.18　实例：x86指令集 106\n2.18.1　Intel x86的演进 107\n2.18.2　x86寄存器和数据寻址模式 108\n2.18.3　x86整数操作 110\n2.18.4　x86指令编码 112\n2.18.5　x86总结 112\n2.19　实例：ARMv8指令集的其他部分 113\n2.19.1　完整的ARMv8整数算术逻辑指令 114\n2.19.2　完整的ARMv8整数数据传输指令 116\n2.19.3　完整的ARMv8分支指令 117\n2.20　谬误与陷阱 118\n2.21　本章小结 119\n2.22　历史观点与拓展阅读 121\n2.23　练习题 121\n第3章　计算机的算术运算 128\n3.1　引言 128\n3.2　加法和减法 128\n3.3　乘法 131\n3.3.1　顺序乘法算法及硬件 131\n3.3.2　有符号乘法 134\n3.3.3　更快速的乘法 134\n3.3.4　LEGv8中的乘法 134\n3.3.5　小结 135\n3.4　除法 135\n3.4.1　除法算法及硬件 135\n3.4.2　有符号除法 137\n3.4.3　更快速的除法 138\n3.4.4　LEGv8中的除法 138\n3.4.5　小结 139\n3.5　浮点运算 140\n3.5.1　浮点表示 141\n3.5.2　异常和中断 142\n3.5.3　IEEE 754浮点标准 142\n3.5.4　浮点加法 145\n3.5.5　浮点乘法 148\n3.5.6　LEGv8中的浮点指令 150\n3.5.7　算术精确性 154\n3.5.8　小结 156\n3.6　并行与计算机算术：子字并行 157\n3.7　实例：x86中的流处理SIMD扩展和高级向量扩展 158\n3.8　实例：其他的ARMv8算术指令 160\n3.8.1　完整的ARMv8整数和浮点算术指令 160\n3.8.2　完整的ARMv8 SIMD指令 161\n3.9　加速：子字并行和矩阵乘法 163\n3.10　谬误与陷阱 166\n3.11　本章小结 168\n3.12　历史观点与拓展阅读 171\n3.13　练习题 171\n第4章　处理器 175\n4.1　引言 175\n4.1.1　一种基本的LEGv8实现 176\n4.1.2　实现概述 176\n4.2　逻辑设计的一般方法 178\n4.3　建立数据通路 180\n4.4　一种简单的实现机制 187\n4.4.1　ALU控制 187\n4.4.2　主控制单元的设计 188\n4.4.3　数据通路的操作 191\n4.4.4　完成控制单元 194\n4.4.5　为什么不使用单周期实现 195\n4.5　流水线概述 197\n4.5.1　面向流水线的指令集设计 200\n4.5.2　流水线冒险 200\n4.5.3　流水线概述小结 206\n4.6　流水线数据通路及其控制 207\n4.6.1　图形化表示的流水线 215\n4.6.2　流水线控制 218\n4.7　数据冒险：旁路与阻塞 221\n4.8　控制冒险 231\n4.8.1　假定分支不发生 231\n4.8.2　减少分支延迟 232\n4.8.3　动态分支预测 234\n4.8.4　流水线小结 236\n4.9　异常 236\n4.9.1　LEGv8体系结构中的异常处理 237\n4.9.2　流水线实现中的异常 238\n4.10　指令级并行 241\n4.10.1　推测的概念 242\n4.10.2　静态多发射 243\n4.10.3　动态多发射 246\n4.10.4　动态流水线调度 247\n4.10.5　能耗效率与高级流水线 249\n4.11　实例：ARM Cortex-A53和Intel Core i7流水线 250\n4.11.1　ARM Cortex-A53 251\n4.11.2　Intel Core i7 920 253\n4.11.3　Intel Core i7 920的性能 255\n4.12　加速：指令级并行和矩阵乘法 256\n4.13　高级主题：采用硬件设计语言描述和建模流水线的数字设计技术以及更多流水线示例 258\n4.14　谬误与陷阱 258\n4.15　本章小结 259\n4.16　历史观点与拓展阅读 260\n4.17　练习题 260\n第5章　大容量和高速度：开发存储器层次结构 271\n5.1　引言 271\n5.2　存储器技术 275\n5.2.1　SRAM技术 275\n5.2.2　DRAM技术 275\n5.2.3　闪存 277\n5.2.4　磁盘存储器 277\n5.3　cache的基本原理 279\n5.3.1　cache访问 280\n5.3.2　cache缺失处理 285\n5.3.3　写操作处理 285\n5.3.4　cache实例：Intrinsity FastMATH处理器 287\n5.3.5　小结 289\n5.4　cache性能的评估和改进 289\n5.4.1　通过更灵活的块放置策略来减少cache缺失 292\n5.4.2　在cache中查找块 295\n5.4.3　替换块的选择 296\n5.4.4　使用多级cache减少缺失代价 297\n5.4.5　通过分块进行软件优化 299\n5.4.6　小结 303\n5.5　可信存储器层次结构 303\n5.5.1　失效的定义 303\n5.5.2　纠1检2汉明码（SEC/DED） 305\n5.6　虚拟机 308\n5.6.1　虚拟机监视器的要求 309\n5.6.2　指令集体系结构（缺乏）对虚拟机的支持 309\n5.6.3　保护和指令集体系结构 310\n5.7　虚拟存储器 310\n5.7.1　页的存放和查找 313\n5.7.2　缺页故障 315\n5.7.3　用于大型虚拟地址的虚拟内存 316\n5.7.4　关于写 318\n5.7.5　加快地址转换：TLB 318\n5.7.6　Intrinsity FastMATH TLB 319\n5.7.7　集成虚拟存储器、TLB和cache 322\n5.7.8　虚拟存储器中的保护 323\n5.7.9　处理TLB缺失和缺页 324\n5.7.10　小结 326\n5.8　存储器层次结构的一般框架 328\n5.8.1　问题1：块放在何处 328\n5.8.2　问题2：如何找到块 329\n5.8.3　问题3：cache缺失时替换哪一块 330\n5.8.4　问题4：写操作如何处理 330\n5.8.5　3C：一种理解存储器层次结构行为的直观模型 331\n5.9　使用有限状态机控制简单的cache 332\n5.9.1　一个简单的cache 333\n5.9.2　有限状态机 333\n5.9.3　一个简单cache控制器的有限状态机 335\n5.10　并行与存储器层次结构：cache一致性 336\n5.10.1　实现一致性的基本方案 337\n5.10.2　监听协议 337\n5.11　并行与存储器层次结构：廉价冗余磁盘阵列 339\n5.12　高级主题：实现cache控制器 339\n5.13　实例：ARM Cortex-A53和Intel Core i7的存储器层次结构 339\n5.14　实例：ARMv8系统的剩余部分以及特殊指令 343\n5.15　加速：cache分块和矩阵乘法 345\n5.16　谬误与陷阱 346\n5.17　本章小结 349\n5.18　历史观点与拓展阅读 350\n5.19　练习题 350\n第6章　并行处理器：从客户端到云 362\n6.1　引言 362\n6.2　创建并行处理程序的难点 364\n6.3　SISD、MIMD、SIMD、SPMD和向量 367\n6.3.1　x86中的SIMD：多媒体扩展 368\n6.3.2　向量 368\n6.3.3　向量与标量 370\n6.3.4　向量与多媒体扩展 370\n6.4　硬件多线程 372\n6.5　多核和其他共享内存多处理器 375\n6.6　图形处理单元 378\n6.6.1　NVIDIA GPU体系结构简介 379\n6.6.2　NVIDIA GPU存储结构 380\n6.6.3　正确理解GPU 381\n6.7　集群、仓储式计算机和其他消息传递多处理器 383\n6.8　多处理器网络拓扑简介 386\n6.9　与外界通信：集群网络 389\n6.10　多处理器基准测试程序和性能模型 389\n6.10.1　性能模型 391\n6.10.2　Roof?line模型 392\n6.10.3　两代Opteron的比较 393\n6.11　实例：Intel Core i7 960\n　和NVIDIA Tesla GPU的评测及Roof?line模型 396\n6.12　加速：多处理器和矩阵乘法 399\n6.13　谬误与陷阱 402\n6.14　本章小结 403\n6.15　历史观点与拓展阅读 405\n6.16　练习题 405\n附录A　逻辑设计基础 414\n索引 470\n网络内容\n附录B　图形处理单元\n附录C　控制器的硬件实现\n附录D　RISC指令集体系结构\n术语表\n扩展阅读"
					}
				],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
