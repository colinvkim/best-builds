#!/usr/bin/env python3

"""Rename Brawl Stars gadget and star power files to their numeric IDs."""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Iterable


DEFAULT_JSON_URL = "https://api.brawlify.com/v1/brawlers"
FILENAME_RE = re.compile(
    r"^(?P<brawler>.+)_(?P<kind>gadget|starpower)_(?P<number>\d+)$",
    re.IGNORECASE,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Rename files like barley_gadget_01.png or bea_starpower_02.png "
            "to their corresponding numeric Brawlify asset IDs."
        )
    )
    parser.add_argument(
        "folders",
        nargs="+",
        type=Path,
        help="One or more folders to process.",
    )
    parser.add_argument(
        "--json-url",
        default=DEFAULT_JSON_URL,
        help=f"Brawlify API URL to load brawlers from. Default: {DEFAULT_JSON_URL}",
    )
    parser.add_argument(
        "--json-file",
        type=Path,
        help="Use a local JSON file instead of fetching from --json-url.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Process files recursively inside each folder.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be renamed without changing any files.",
    )
    return parser.parse_args()


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def load_brawlers(json_file: Path | None, json_url: str) -> list[dict]:
    if json_file is not None:
        data = json.loads(json_file.read_text(encoding="utf-8"))
    else:
        with urllib.request.urlopen(json_url) as response:
            data = json.load(response)

    if isinstance(data, dict) and "list" in data:
        brawlers = data["list"]
    elif isinstance(data, list):
        brawlers = data
    else:
        raise ValueError("Unsupported JSON format. Expected a list or a {'list': [...]} object.")

    if not isinstance(brawlers, list):
        raise ValueError("Invalid brawler payload: 'list' is not an array.")

    return brawlers


def build_lookup(brawlers: list[dict]) -> dict[str, dict[str, list[int]]]:
    lookup: dict[str, dict[str, list[int]]] = {}

    for brawler in brawlers:
        candidate_names = {
            brawler.get("name", ""),
            brawler.get("path", ""),
            brawler.get("hash", ""),
            brawler.get("fankit", ""),
        }

        gadgets = [item["id"] for item in brawler.get("gadgets", []) if "id" in item]
        starpowers = [item["id"] for item in brawler.get("starPowers", []) if "id" in item]

        entry = {
            "gadget": gadgets,
            "starpower": starpowers,
        }

        for candidate_name in candidate_names:
            normalized = normalize_name(candidate_name)
            if normalized:
                lookup[normalized] = entry

    return lookup


def iter_files(folder: Path, recursive: bool) -> Iterable[Path]:
    return folder.rglob("*") if recursive else folder.iterdir()


def rename_file(path: Path, lookup: dict[str, dict[str, list[int]]], dry_run: bool) -> tuple[bool, str]:
    if not path.is_file():
        return False, f"skip {path} (not a file)"

    match = FILENAME_RE.match(path.stem)
    if not match:
        return False, f"skip {path.name} (name does not match expected pattern)"

    brawler_key = normalize_name(match.group("brawler"))
    kind = match.group("kind").lower()
    index = int(match.group("number")) - 1

    if index < 0:
        return False, f"skip {path.name} (invalid slot number)"

    brawler = lookup.get(brawler_key)
    if brawler is None:
        return False, f"skip {path.name} (could not find brawler '{match.group('brawler')}')"

    asset_ids = brawler[kind]
    if index >= len(asset_ids):
        return False, f"skip {path.name} (no {kind} #{index + 1} for '{match.group('brawler')}')"

    new_path = path.with_name(f"{asset_ids[index]}{path.suffix}")
    if new_path == path:
        return False, f"skip {path.name} (already renamed)"
    if new_path.exists():
        return False, f"skip {path.name} (target already exists: {new_path.name})"

    if not dry_run:
        path.rename(new_path)

    action = "would rename" if dry_run else "renamed"
    return True, f"{action} {path.name} -> {new_path.name}"


def main() -> int:
    args = parse_args()

    try:
        brawlers = load_brawlers(args.json_file, args.json_url)
        lookup = build_lookup(brawlers)
    except Exception as exc:
        print(f"Failed to load brawler data: {exc}", file=sys.stderr)
        return 1

    renamed_count = 0
    skipped_count = 0

    for folder in args.folders:
        if not folder.exists():
            print(f"Missing folder: {folder}", file=sys.stderr)
            skipped_count += 1
            continue
        if not folder.is_dir():
            print(f"Not a folder: {folder}", file=sys.stderr)
            skipped_count += 1
            continue

        for path in sorted(iter_files(folder, args.recursive)):
            changed, message = rename_file(path, lookup, args.dry_run)
            print(message)
            if changed:
                renamed_count += 1
            else:
                skipped_count += 1

    summary = "would rename" if args.dry_run else "renamed"
    print(f"\nDone: {summary} {renamed_count} file(s), skipped {skipped_count} item(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
