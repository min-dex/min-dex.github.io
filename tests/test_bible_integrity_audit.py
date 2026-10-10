import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

spec=importlib.util.spec_from_file_location('audit',Path(__file__).resolve().parents[1]/'scripts/audit_bible_integrity.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

class BibleAuditTest(unittest.TestCase):
    def test_raw_xml_and_invalid_number_are_accounted_for(self):
        xml='''<XMLBIBLE><title>쉬운성경</title><BIBLEBOOK bnumber="19"><CHAPTER cnumber="1">
        <VERS vnumber="1">[제1권] &lt;제목&gt; 본문</VERS><VERS vnumber=""></VERS>
        </CHAPTER></BIBLEBOOK></XMLBIBLE>'''
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'source.zip'
            with zipfile.ZipFile(p,'w') as z:z.writestr('source.xml',xml)
            data=audit.parse_archive(p)['쉬운성경']
        self.assertEqual(len(data['invalid_verses']),1)
        row=audit.expected_row('쉬운성경',data['rows'][0])
        self.assertEqual(row['section_title'],'제1권 · 제목')
        self.assertEqual(row['text'],'본문')

    def test_approved_scope_preserves_scripture_brackets(self):
        row=dict(book_code='JHN',chapter=7,verse=53,text='[그들은 집으로 돌아갔다.]',section_title='기존 제목')
        for name in ['우리말','바른성경','표준새번역','NIV','한글KJV']:
            self.assertEqual(audit.expected_row(name,row),row)
        psalm={**row,'book_code':'PSA','chapter':42,'verse':1,'text':'[고라의 시] 본문 [주석]','section_title':'제2권'}
        split=audit.expected_row('우리말',psalm)
        self.assertEqual(split['section_title'],'제2권 · 고라의 시')
        self.assertEqual(split['text'],'본문 [주석]')

    def test_scan_reports_differences_and_address_anomalies(self):
        source_rows=[dict(book_code='GEN',chapter=1,verse=i,text='본문',section_title='') for i in [1,2,3]]
        live=[dict(source_rows[0],id='1',text='달라짐',verse_end=None,is_active=True),
              dict(source_rows[1],id='2',verse_end=None,is_active=True),
              dict(source_rows[1],id='3',verse_end=None,is_active=True),
              dict(source_rows[2],id='4',verse=4,verse_end=None,is_active=True)]
        class Api:
            def get(self,*args):return live,len(live)
        source={'rows':source_rows,'source_sha256':'fixture','books':1,'chapters':1,'duplicate_books':0,'duplicate_chapters':0,'invalid_verses':[]}
        with tempfile.TemporaryDirectory() as tmp:
            r=audit.audit_one(Api(),{'name':'fixture','id':'x','translation_key':'fixture','is_active':True},source,Path(tmp))
        self.assertEqual(r['missing'],[('GEN',1,3)])
        self.assertEqual(r['extra'],[('GEN',1,4)])
        self.assertEqual(r['live_duplicate_addresses'],[('GEN',1,2)])
        self.assertEqual(r['differences'][0]['field'],'text')

if __name__=='__main__':unittest.main()
