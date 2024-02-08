import json
import os

with open('data/data.json', encoding='utf-8') as map_file:
    mapDict = json.load(map_file)

def read_metadata(filename):
    try:
        with open(filename, encoding='utf-8') as file:
            headers = [next(file) for _ in range(13)]
        return json.loads(''.join(headers))
    except json.decoder.JSONDecodeError:
        print('Parsing Error: ' + filename)
        return ''

translators = os.listdir('.')
translators = [t for t in translators if t.endswith('.js') and t not in ['RefWorks Tagged.js', 'BibTeX.js']]
translators = sorted(translators)

translator_metadata = {}
for t in translators:
    metadata = read_metadata('./' + t)
    if metadata['label'] not in mapDict.keys():
        print(f"cant't find {t}'s label in data.json")
        raise KeyError
    if metadata:
        translator_metadata[t] = {
            'label': mapDict.get(metadata['label']),
            'lastUpdated': metadata['lastUpdated']
        }

with open('data/translators.json', 'w', encoding='utf-8') as meta_file:
    print(translator_metadata)
    json.dump(translator_metadata, meta_file, ensure_ascii=False, indent=4)

with open('data/data.json', 'w', encoding='utf-8') as map_file:
    json.dump({k: mapDict[k] for k in sorted(mapDict)}, map_file, ensure_ascii=False, indent=4)