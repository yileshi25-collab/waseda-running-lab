import importlib.util
import json
from datetime import date
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('diaries', ROOT/'scripts/import_official_diaries.py')
diaries = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diaries)

def card(stamp='2026.01.15', category=1, title='测试作者：测试标题', identifier=123):
    return f'<article><time datetime="{stamp}">{stamp}</time><a href="/diary/category/{category}">分类</a><h1><a href="/diary/detail/{identifier}">{title}</a></h1></article>'

class ImportTests(unittest.TestCase):
    def test_previous_academic_year_includes_calendar_january(self):
        rows, count = diaries.parse_page(card()+card('2025.12.31',identifier=122),2026,date(2026,11,17))
        self.assertEqual(count,2)
        self.assertEqual([r['published_at'] for r in rows],['2026-01-15'])
    def test_excludes_thanks_and_future_posts(self):
        rows, count = diaries.parse_page(card(category=2)+card('2026.12.01'),2026,date(2026,11,17))
        self.assertEqual(count,2)
        self.assertEqual(rows,[])
    def test_decodes_title_and_normalizes_author(self):
        rows,_ = diaries.parse_page(card(title='测试　作者: A &amp; B'),2026,date(2026,11,17))
        self.assertEqual(rows[0]['author'],'测试 作者')
        self.assertEqual(rows[0]['title'],'测试　作者: A & B')
    def test_unidentifiable_author_fails_instead_of_fabricating(self):
        with self.assertRaises(ValueError):
            diaries.parse_page(card(title='没有作者分隔符'),2026,date(2026,11,17))
    def test_import_snapshot_integrity_and_coverage(self):
        data=json.loads((ROOT/'data/official-diaries-2026.json').read_text())
        rows=data['entries']
        self.assertEqual(data['total'],97)
        self.assertTrue(data['long_distance_only'])
        self.assertEqual(data['source_archive_total'],319)
        self.assertEqual(data['excluded_other_groups'],222)
        self.assertNotIn('official-diary-1684',{r['id'] for r in rows})
        self.assertNotIn('official-diary-1194',{r['id'] for r in rows})
        self.assertIn('official-diary-1248',{r['id'] for r in rows})
        roster=json.loads((ROOT/'data/official-diary-eligible-authors-2026.json').read_text())
        allowed={diaries.normalize_author(n) for n in roster['current']+roster['graduates_2026']}
        self.assertEqual(set(data['allowed_authors']),set(roster['current']+roster['graduates_2026']))
        self.assertTrue(all(diaries.normalize_author(r['author']) in allowed for r in rows))
        self.assertEqual(len(rows),len({r['source_url'] for r in rows}))
        self.assertEqual(len(rows),len({r['id'] for r in rows}))
        self.assertEqual(len({r['author'] for r in rows}),45)
        self.assertEqual(data['author_count'],44)
        self.assertEqual(rows[0]['published_at'],'2026-11-17')
        self.assertEqual(rows[-1]['published_at'],'2026-01-04')
        self.assertEqual(rows,sorted(rows,key=lambda r:(r['published_at'],int(r['id'].rsplit('-',1)[1])),reverse=True))
        for row in rows:
            self.assertRegex(row['source_url'],r'^https://waseda-ac\.jp/diary/detail/\d+$')
            self.assertLessEqual(date.fromisoformat(row['published_at']),date(2026,11,17))
            self.assertEqual(set(row),{'id','author','title','published_at','source_url'})
        self.assertEqual({p['source_year'] for p in data['pages']},{2025,2026})
        self.assertEqual(data['pages'][15]['cards'],0)
        self.assertEqual(data['pages'][-1]['diaries'],13)

if __name__=='__main__':
    unittest.main()
