import json
import os

from datetime import datetime

mapDict = {
    "Baidu Scholar" : "百度学术",
    "BiliBili": "Bilibili视频",
    "CNKI": "中国知网",
    "Dangdang": "当当图书",
    "Douban": "豆瓣",
    "Duxiu": "读秀",
    "GFSOSO": "谷粉搜搜",
    "Jd": "京东",
    "National Public Service Platform for Standards Information - China": "全国标准信息公共服务平台",
    "National Standards Open System - China": "国家标准全文公开系统",
    "Ncpssd": "国家哲学社会科学文献中心",
    "nlc.cn": "国图-中国标准在线服务网",
    "PatentStar": "专利之星",
    "ProQuestCN Thesis": "ProQuest学位论文(中国)",
    "Soopat": "Soopat专利",
    "Spc.org.cn": "Spc.org.cn",
    "SuperLib": "全国图书馆联盟",
    "Wanfang Data": "万方",
    "WeiPu": "维普",
    "Weixin": "微信",
    "Wenjin": "国图-文津",
    "Zhihu": "知乎",
    "dpaper": "中国科学院文献情报中心",
    "xiaoyuzhouFM": "小宇宙FM"
}

def read_metadata(filename):
    with open(filename, encoding='utf-8') as handle:
        headers = [next(handle) for x in range(13)]
    return json.loads(''.join(headers))

translators = os.listdir("translators")
translators = [t for t in translators if t.endswith('js') and t not in ['RefWorks Tagged.js', 'BibTeX.js']]
translators = sorted(translators)

translator_metadata = {}
for t in translators:
    metadata = read_metadata("translators/" + t)
    translator_metadata[t] = {
        'label': mapDict.get(metadata['label'], metadata['label']),
        'lastUpdated': metadata['lastUpdated']
    }

with open("data/translators.json", 'w', encoding='utf-8') as handle:
    print(translator_metadata)
    json.dump(translator_metadata, handle, ensure_ascii=False, indent=4)
