"""Publish only measured/exception metadata; never publish lyrics or private paths."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'data/hymn-musical-structure.json').read_text())
records = {}
for row in source['versions']:
    if row['stanzaApproxMeasures'] is None and row['reviewStatus'] != 'recitative_exception':
        continue
    records[row['versionId']] = {key: row[key] for key in ('edition', 'number', 'classification', 'stanzaApproxMeasures', 'reviewStatus', 'parts')}
    if row.get('displayNote'):
        records[row['versionId']]['displayNote'] = row['displayNote']
(ROOT / 'mindex.hymn-structure.runtime.json').write_text(json.dumps({'schemaVersion':1,'records':records},ensure_ascii=False,separators=(',', ':'))+'\n')
print(f'{len(records)} measured/exception versions')
