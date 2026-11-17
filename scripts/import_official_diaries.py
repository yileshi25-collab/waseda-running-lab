#!/usr/bin/env python3
"""Build a dated, deduplicated metadata index from the official annual archive.
Only titles, authors, dates and canonical links are retained; no article bodies/images.
"""
import argparse
from datetime import date
from html import unescape
import json
from pathlib import Path
import re
import time
import unicodedata
from urllib.request import Request, urlopen

BASE = 'https://waseda-ac.jp'

ROSTER_PATH = Path(__file__).resolve().parents[1] / 'data' / 'official-diary-eligible-authors-2026.json'

def normalize_author(name):
    """Normalize spaces and legacy Japanese character variants for name matching."""
    return unicodedata.normalize('NFKC', name).replace('髙', '高').replace('﨑', '崎').translate(
        str.maketrans('', '', ' \u3000\t\n\r'))

def filter_long_distance(index, roster):
    """Keep current long-distance athletes plus those who graduated in March 2026."""
    if roster['year'] != index['year']:
        raise ValueError('Roster year does not match archive year')
    permitted = roster['current'] + roster['graduates_2026']
    lookup = {normalize_author(name) for name in permitted}
    rows = [r for r in index['entries'] if normalize_author(r['author']) in lookup]
    if not rows:
        raise ValueError('Long-distance roster produced no matching diaries')
    result = dict(index)
    result['entries'] = rows
    result['total'] = len(rows)
    result['author_count'] = len({normalize_author(r['author']) for r in rows})
    result['long_distance_only'] = True
    result['source_archive_total'] = index['total']
    result['excluded_other_groups'] = index['total'] - len(rows)
    result['allowed_authors'] = permitted
    result['roster_source_current'] = roster['source_current']
    result['roster_source_graduates_2026'] = roster['source_graduates']
    return result


def plain(value):
    return unescape(re.sub(r'<[^>]*>', '', value)).strip()

def parse_page(html, year, cutoff):
    records = []
    articles = re.findall(r'<article\b[^>]*>(.*?)</article>', html, re.S)
    for article in articles:
        if not re.search(r'href=[\"\']/diary/category/1[\"\']', article):
            continue
        stamp = re.search(r'<time\b[^>]*datetime=[\"\']([^\"\']+)', article)
        link = re.search(r'<h1\b[^>]*>\s*<a\b[^>]*href=[\"\'](/diary/detail/(\d+))[\"\'][^>]*>(.*?)</a>', article, re.S)
        if not stamp or not link:
            raise ValueError('A diary card is missing its publication date or canonical link')
        published = date.fromisoformat(stamp[1].replace('.', '-'))
        if published.year != year or published > cutoff:
            continue
        title = plain(link[3])
        parts = re.split(r'[:：]', title, maxsplit=1)
        if len(parts) != 2 or not parts[0].strip():
            raise ValueError(f'Cannot identify diary author from title: {title}')
        author = unicodedata.normalize('NFKC', parts[0]).strip()
        records.append({'id':'official-diary-'+link[2], 'author':author, 'title':title,
                        'published_at':published.isoformat(), 'source_url':BASE+link[1]})
    return records, len(articles)

def build(year, cutoff, cache_dir):
    records, pages, seen_pages = {}, [], set()
    cache_dir.mkdir(parents=True, exist_ok=True)
    # Official /year/ is an academic year (April–March), not a calendar year.
    # Scan both source years so January–March is not silently omitted.
    for archive_year in (year, year - 1):
        for page in range(1, 101):
            url = f'{BASE}/diary/year/{archive_year}' + (f'/p/{page}' if page > 1 else '')
            request = Request(url, headers={'User-Agent':'WasedaRunningLab-MetadataImporter/1.0'})
            with urlopen(request, timeout=30) as response:
                html = response.read().decode('utf-8')
            (cache_dir/f'{archive_year}-{page}.html').write_text(html)
            rows, card_count = parse_page(html, year, cutoff)
            fingerprint = tuple(re.findall(r'/diary/detail/(\d+)', html))
            if card_count and fingerprint in seen_pages:
                raise ValueError('Repeated pagination result; completeness cannot be established')
            seen_pages.add(fingerprint)
            dates = [date.fromisoformat(v.replace('.', '-')) for v in re.findall(r'<time\b[^>]*datetime=[\"\']([^\"\']+)', html)]
            pages.append({'source_year':archive_year, 'page':page, 'url':url, 'cards':card_count, 'diaries':len(rows)})
            for row in rows:
                existing = records.get(row['source_url'])
                if existing and existing != row:
                    raise ValueError('Conflicting metadata for '+row['source_url'])
                records[row['source_url']] = row
            print(f'archive {archive_year}, page {page}: {card_count} cards, {len(rows)} member diaries', flush=True)
            if card_count == 0 or (dates and min(dates) < date(year, 1, 1)):
                break
            time.sleep(.15)
        else:
            raise ValueError('Safety page limit reached; refusing to label the index complete')
    result = sorted(records.values(), key=lambda row:(row['published_at'],int(row['id'].rsplit('-',1)[1])), reverse=True)
    if not result:
        raise ValueError('No diaries found')
    return {'year':year, 'as_of':cutoff.isoformat(), 'source_index':f'{BASE}/diary/year/{year}',
            'additional_source_index':f'{BASE}/diary/year/{year-1}',
            'source_category':f'{BASE}/diary/category/1', 'metadata_only':True,
            'total':len(result), 'author_count':len({re.sub(r'\s', '', row['author']) for row in result}),
            'pages':pages, 'entries':result}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--year', type=int, default=2026)
    parser.add_argument('--as-of', type=date.fromisoformat, required=True)
    parser.add_argument('--output', type=Path, default=Path('data/official-diaries-2026.json'))
    parser.add_argument('--cache-dir', type=Path, default=Path('work/official-diaries-cache'))
    args = parser.parse_args()
    result = build(args.year, args.as_of, args.cache_dir)
    if args.year == 2026:
        roster = json.loads(ROSTER_PATH.read_text(encoding='utf-8'))
        result = filter_long_distance(result, roster)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(f'Indexed {result["total"]} diaries, {result["author_count"]} authors (whitespace normalized); oldest {result["entries"][-1]["published_at"]}')
