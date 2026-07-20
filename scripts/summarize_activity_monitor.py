#!/usr/bin/env python3
"""Summarize physical-footprint and CPU phases from Activity Monitor XML."""

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


def load_samples(path: Path) -> list[tuple[float, float, float]]:
    root = ET.parse(path).getroot()
    referenced_values: dict[str, str | None] = {}
    samples: list[tuple[float, float, float]] = []

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

        # activity-monitor-process-live columns 0, 6, and 10 are start time,
        # CPU percentage, and physical footprint. The first sample has no CPU
        # percentage, so omit it; measured phases begin after the warmup.
        if (
            len(values) > 10
            and values[0] is not None
            and values[6] is not None
            and values[10] is not None
        ):
            samples.append(
                (
                    int(values[0]) / 1_000_000_000,
                    int(values[10]) / MIB,
                    float(values[6]),
                )
            )

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

    print(
        "| Phase | Samples | Footprint mean | Footprint min | Footprint max "
        "| Footprint last | CPU mean | CPU max |"
    )
    print("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    for name, start, end in phases:
        phase_samples = [sample for sample in samples if start <= sample[0] <= end]
        if not phase_samples:
            raise ValueError(f"phase {name!r} has no samples between {start}s and {end}s")
        footprints = [sample[1] for sample in phase_samples]
        cpu_percentages = [sample[2] for sample in phase_samples]
        print(
            f"| {name} | {len(phase_samples)} | {statistics.fmean(footprints):.2f} MiB "
            f"| {min(footprints):.2f} MiB | {max(footprints):.2f} MiB "
            f"| {footprints[-1]:.2f} MiB "
            f"| {statistics.fmean(cpu_percentages):.2f}% "
            f"| {max(cpu_percentages):.2f}% |"
        )


if __name__ == "__main__":
    main()
