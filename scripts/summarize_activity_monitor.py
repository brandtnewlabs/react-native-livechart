#!/usr/bin/env python3
"""Summarize physical-footprint phases from an xctrace Activity Monitor export."""

from __future__ import annotations

import argparse
import statistics
import xml.etree.ElementTree as ET
from pathlib import Path

MIB = 1024 * 1024


def parse_phase(value: str) -> tuple[str, float, float]:
    try:
        name, start, end = value.split(":", 2)
        return name, float(start), float(end)
    except ValueError as error:
        raise argparse.ArgumentTypeError(
            "phase must be NAME:START_SECONDS:END_SECONDS"
        ) from error


def load_samples(path: Path) -> list[tuple[float, float]]:
    root = ET.parse(path).getroot()
    referenced_values: dict[str, str | None] = {}
    samples: list[tuple[float, float]] = []

    for row in root.findall(".//row"):
        values: list[str | None] = []
        for element in list(row):
            if reference := element.get("ref"):
                value = referenced_values.get(reference)
            else:
                value = element.text
                if identifier := element.get("id"):
                    referenced_values[identifier] = value
            values.append(value)

        # activity-monitor-process-live column 0 is start time and column 10 is
        # physical footprint. Values are nanoseconds and bytes respectively.
        if len(values) > 10 and values[0] is not None and values[10] is not None:
            samples.append((int(values[0]) / 1_000_000_000, int(values[10]) / MIB))

    if not samples:
        raise ValueError(f"no Activity Monitor samples found in {path}")
    return samples


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xml", type=Path, help="XML produced by xctrace export")
    parser.add_argument(
        "--phase",
        action="append",
        type=parse_phase,
        default=[],
        help="NAME:START_SECONDS:END_SECONDS (repeat for each phase)",
    )
    args = parser.parse_args()
    phases = args.phase or [
        ("baseline", 5.0, 15.0),
        ("mounted", 20.0, 44.0),
        ("unmounted", 50.0, 64.0),
    ]
    samples = load_samples(args.xml)

    print("| Phase | Samples | Mean | Min | Max | Last |")
    print("| --- | ---: | ---: | ---: | ---: | ---: |")
    for name, start, end in phases:
        footprints = [value for time, value in samples if start <= time <= end]
        if not footprints:
            raise ValueError(f"phase {name!r} has no samples between {start}s and {end}s")
        print(
            f"| {name} | {len(footprints)} | {statistics.fmean(footprints):.2f} MiB "
            f"| {min(footprints):.2f} MiB | {max(footprints):.2f} MiB "
            f"| {footprints[-1]:.2f} MiB |"
        )


if __name__ == "__main__":
    main()
