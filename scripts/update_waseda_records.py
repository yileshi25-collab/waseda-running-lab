#!/usr/bin/env python3
"""Import Waseda's complete Hakone Ekiden historical team totals.

Official pages: https://waseda-ac.jp/record/detail/{22,21,...,13,23}
No unpublished API or privileged credentials required.
Guards prevent destructive/partial updates when official HTML changes.
"""
from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "waseda-records-data.js"
DETAIL_IDS = [22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 23]
SOURCE = "https://waseda-ac.jp/record/detail/{}"
HEAD = "window.WSD_OFFICIAL_RECORDS="

EDITION = re.compile(r"第\s*(\d{1,3})\s*回\s*[\(（]\s*(\d{4})\s*年\s*[\)）]")
TIME_RANK = {
    key: re.compile(rf"{key}\s*[：:]\s*(.+?)\s*[\(（]\s*(\d{{1,2}})\s*位[\)）]", re.S)
    for key in ("往路成績", "復路成績", "総合成績")
}


def fetch_page(detail_id: int) -> str:
    url = SOURCE.format(detail_id)
    for retry in range(3):
        try:
            req = Request(url, headers={"User-Agent": "WasedaRunningLabArchiveBot/1.0 (+public academic fan archive)", "Accept-Language": "ja"})
            with urlopen(req, timeout=25) as resp:
                return resp.read().decode("utf-8", "replace")
        except (URLError, HTTPError, TimeoutError) as exc:
            print(f"Failed page {detail_id} attempt {retry + 1}: {exc}", file=sys.stderr)
            if retry == 2:
                raise
            time.sleep(2 + retry)
    raise RuntimeError("unreachable")


def parse_time(value: str) -> str | None:
    v = unicodedata.normalize("NFKC", value)
    v = re.sub(r"\s+", "", v)
    # Three official pages print "11時間58分秒39" instead of
    # "11時間58分39秒"; preserve the intended order and label it.
    m = re.search(r"(\d{1,2})時間(\d{1,2})分秒(\d{1,2})", v)
    if m:
        return f"{int(m[1])}:{int(m[2]):02}:{int(m[3]):02}"
    m = re.search(r"(\d{1,2})時間(\d{1,2})分(\d{1,2})秒", v)
    if m:
        return f"{int(m[1])}:{int(m[2]):02}:{int(m[3]):02}"
    m = re.search(r"(?<!時間)(\d{1,3})分(\d{1,2})秒", v)
    if m:
        return f"0:{int(m[1]):02}:{int(m[2]):02}"
    m = re.search(r"\d{1,2}:\d{2}:\d{2}", v)
    return m.group(0) if m else None



LEG_RE = re.compile(
    r"(?<!\d)(?P<leg>10|[1-9])区\s*(?:[\(（]\s*(?P<km>\d+(?:\.\d+)?)\s*km\s*[\)）])?\s*"
    r"(?P<name>.{2,65}?)\s+"
    r"(?P<time>\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)\s*"
    r"(?:[◎○]\s*)?区間\s*(?P<rank>\d{1,2})\s*位",
    re.S
)


def extract_legs(segment: str) -> list[dict]:
    # Per-race segment begins after the numbered edition heading.
    # 10 validated leg numbers are required; never fabricate a missing leg.
    if "個人成績" not in segment:
        return []
    personal = segment.split("個人成績", 1)[1]
    found = []
    for match in LEG_RE.finditer(personal):
        leg = int(match["leg"])
        name = re.sub(r"\s+", " ", match["name"]).strip()
        if not (1 <= leg <= 10 and 2 <= len(name) <= 40):
            continue
        time = match["time"]
        km = float(match["km"]) if match["km"] else None
        found.append({
            "leg": leg, "name": name, "time": time,
            "rank": int(match["rank"]), "km": km,
        })
    # Ignore accidental duplicate captures and malformed editions.
    if len(found) != 10 or [x["leg"] for x in found] != list(range(1, 11)):
        return []
    return found


def extract_one_page(detail_id: int, html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    # Remove navigation/footer so sidebar decade links cannot be mistaken
    # for race results. We still require a numbered edition followed by year.
    for el in soup.select("nav, footer, script, style"):
        el.decompose()
    body = soup.get_text(" ", strip=True)
    body = unicodedata.normalize("NFKC", body)
    matches = list(EDITION.finditer(body))
    found = []
    for i, m in enumerate(matches):
        part = body[m.end():matches[i + 1].start()] if i + 1 < len(matches) else body[m.end():]
        edition, year = int(m[1]), int(m[2])
        if "不参加" in part[:160]:
            # No team time exists for a year Waseda did not enter.
            reason = re.search(r"不参加(?:\s*[\(（]([^\)）]{1,120})[\)）])?", part[:160])
            found.append({
                "year": year, "edition": edition, "rank": None,
                "total": None, "out": None, "back": None,
                "status": "not_participated",
                "reason": "不参加" + ("（" + reason[1].strip() + "）" if reason and reason[1] else ""),
                "source": SOURCE.format(detail_id), "legs": [],
            })
            continue
        parsed = {}
        for label, key in (("往路成績", "out"), ("復路成績", "back"), ("総合成績", "total")):
            result = TIME_RANK[label].search(part)
            if not result:
                break
            normalized = parse_time(result[1])
            if normalized is None:
                break
            parsed[key] = normalized
            parsed[key + "_rank"] = int(result[2])
        if len(parsed) != 6:
            continue
        if not (1 <= edition <= 110 and 1920 <= year <= 2026):
            continue
        found.append({
            "year": year,
            "edition": edition,
            "rank": parsed["total_rank"],
            "total": parsed["total"],
            "out": parsed["out"],
            "back": parsed["back"],
            "out_rank": parsed["out_rank"],
            "back_rank": parsed["back_rank"],
            "source": SOURCE.format(detail_id),
            "legs": extract_legs(part),
            **({"source_format_note": "官网总成绩数字存在「分秒」顺序排版问题，按时分秒规范化"} if "分秒" in TIME_RANK["総合成績"].search(part)[1] else {}),
        })
    return found


def read_existing() -> dict:
    source = TARGET.read_text("utf-8")
    i = source.index(HEAD) + len(HEAD)
    return json.loads(source[i:].strip().rstrip(";"))


def main() -> None:
    old = read_existing()
    old_by_year = {row["year"]: row for row in old.get("hakone", [])}
    results = {}
    failures = []
    for detail_id in DETAIL_IDS:
        try:
            entries = extract_one_page(detail_id, fetch_page(detail_id))
        except Exception as exc:
            failures.append((detail_id, str(exc)))
            continue
        print(f"Record decade {detail_id}: {len(entries)} verified team totals")
        if detail_id != 23 and len(entries) < 6:
            failures.append((detail_id, f"Only {len(entries)} rows parsed"))
        for row in entries:
            year = row["year"]
            prior = results.get(year)
            if prior and prior["edition"] != row["edition"]:
                failures.append((detail_id, f"Duplicate year {year}, different edition"))
            results[year] = row
    # Never overwrite the deployed website with a partial archive.
    if failures or len(results) < 102 or min(results, default=3000) > 1920 or max(results, default=0) < 2026:
        raise RuntimeError(f"Refusing incomplete import: {len(results)} years; failures={failures}")
    # Existing, manually sourced 2024-2026 leg results are retained.
    for year, row in results.items():
        if old_by_year.get(year, {}).get("legs"):
            row["legs"] = old_by_year[year]["legs"]
    nonparticipants = sum(1 for r in results.values() if r.get("status") == "not_participated")
    if nonparticipants != 7:
        raise RuntimeError(f"Expected 7 documented Waseda non-participations, got {nonparticipants}")
    covered_legs = sum(len(r.get("legs", [])) == 10 for r in results.values())
    print(f"Validated 10-leg breakdowns for {covered_legs}/{len(results)-nonparticipants} participating editions")
    old["hakone"] = sorted(results.values(), key=lambda r: r["year"])
    old.setdefault("meta", {})["completeHakone"] = True
    old["meta"]["fetched"] = datetime.now(timezone.utc).date().isoformat()
    old["meta"]["hakoneLegCoverage"] = covered_legs
    old["meta"]["source"] = "https://waseda-ac.jp/record/"
    text = "/* Official Waseda records, imported from publicly available record-room pages. */\n" + HEAD + json.dumps(old, ensure_ascii=False, separators=(",", ":")) + ";\n"
    TARGET.write_text(text, "utf-8")
    print(f"Updated {TARGET.name}: {len(results)} total editions, {len(results)-nonparticipants} team results, {nonparticipants} non-participations.")


if __name__ == "__main__":
    main()
