#!/usr/bin/env python3
"""Build and capture the fixed-phase iOS live-renderer experiment matrix."""

from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MATRIX_PATH = ROOT / "profiling" / "live-renderer-matrix.json"
BUNDLE_ID = "com.brandtnewlabs.react-native-livechart"
ACTIVITY_XPATH = (
    "/trace-toc/run[@number=\"1\"]/data/"
    "table[@schema=\"activity-monitor-process-live\"]"
)


def command_text(command: list[str], env: dict[str, str] | None = None) -> str:
    prefix = ""
    if env:
        prefix = " ".join(f"{key}={shlex.quote(value)}" for key, value in env.items())
        prefix += " "
    return prefix + shlex.join(command)


def run_command(
    command: list[str],
    *,
    extra_env: dict[str, str] | None = None,
    dry_run: bool,
    capture_output: bool = False,
) -> str:
    print(f"$ {command_text(command, extra_env)}", flush=True)
    if dry_run:
        return ""
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    result = subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        check=True,
        text=True,
        capture_output=capture_output,
    )
    return result.stdout if capture_output else ""


def load_runs() -> list[dict[str, Any]]:
    matrix = json.loads(MATRIX_PATH.read_text())
    defaults = matrix["defaults"]
    return [{**defaults, **run} for run in matrix["runs"]]


def select_runs(
    runs: list[dict[str, Any]], selected_ids: list[str]
) -> list[dict[str, Any]]:
    if not selected_ids:
        return runs
    by_id = {run["id"]: run for run in runs}
    missing = [run_id for run_id in selected_ids if run_id not in by_id]
    if missing:
        raise ValueError(f"unknown matrix run(s): {', '.join(missing)}")
    return [by_id[run_id] for run_id in selected_ids]


def trace_path(
    output_dir: Path, run_id: str, template: str, worklets_mode: str | None
) -> Path:
    suffix = "activity" if template == "Activity Monitor" else "allocations"
    mode_suffix = f".{worklets_mode}" if worklets_mode else ""
    return output_dir / f"{run_id}{mode_suffix}.{suffix}.trace"


def remove_output(path: Path) -> None:
    if not path.exists():
        return
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()


def capture_run(
    run: dict[str, Any],
    *,
    args: argparse.Namespace,
    worklets_mode: str | None,
) -> None:
    run_id = run["id"]
    profile_env = {"EXPO_PUBLIC_MEMORY_PROFILE_RUN": run_id}
    if worklets_mode:
        profile_env["WORKLETS_BUNDLE_MODE"] = (
            "1" if worklets_mode == "bundle" else "0"
        )
    mode_label = f" [{worklets_mode}]" if worklets_mode else ""
    print(f"\n## {run_id}{mode_label}: {run['description']}", flush=True)

    if not args.skip_build:
        run_command(
            [
                "npx",
                "expo",
                "run:ios",
                "--device",
                args.device,
                "--configuration",
                "Release",
                "--no-bundler",
            ],
            extra_env=profile_env,
            dry_run=args.dry_run,
        )

    templates = []
    if args.capture in ("activity", "both"):
        templates.append("Activity Monitor")
    if args.capture in ("allocations", "both"):
        templates.append("Allocations")

    for template in templates:
        trace = trace_path(args.output_dir, run_id, template, worklets_mode)
        if trace.exists() and not args.force and not args.dry_run:
            raise FileExistsError(f"refusing to overwrite existing trace: {trace}")
        if trace.exists() and args.force and not args.dry_run:
            remove_output(trace)
        run_command(
            [
                "xcrun",
                "xctrace",
                "record",
                "--template",
                template,
                "--device",
                args.udid,
                "--time-limit",
                "65s",
                "--output",
                str(trace),
                "--launch",
                BUNDLE_ID,
            ],
            dry_run=args.dry_run,
        )

        if template != "Activity Monitor":
            continue
        mode_suffix = f".{worklets_mode}" if worklets_mode else ""
        xml = args.output_dir / f"{run_id}{mode_suffix}.activity.xml"
        summary = args.output_dir / f"{run_id}{mode_suffix}.activity.md"
        if args.force and not args.dry_run:
            remove_output(xml)
            remove_output(summary)
        run_command(
            [
                "xcrun",
                "xctrace",
                "export",
                "--input",
                str(trace),
                "--xpath",
                ACTIVITY_XPATH,
                "--output",
                str(xml),
            ],
            dry_run=args.dry_run,
        )
        markdown = run_command(
            [
                sys.executable,
                "scripts/summarize_activity_monitor.py",
                str(xml),
            ],
            dry_run=args.dry_run,
            capture_output=True,
        )
        if not args.dry_run:
            summary.write_text(markdown)
            print(markdown, end="")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", default="Trooper", help="Expo device name")
    parser.add_argument("--udid", help="xctrace device identifier")
    parser.add_argument(
        "--run",
        action="append",
        default=[],
        help="matrix run id; repeat to select multiple (default: all)",
    )
    parser.add_argument(
        "--capture",
        choices=("activity", "allocations", "both"),
        default="activity",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("/tmp/livechart-renderer-matrix"),
    )
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument(
        "--worklets-mode",
        action="append",
        choices=("legacy", "bundle"),
        default=[],
        help=(
            "Worklets runtime mode; repeat with legacy and bundle for an A/B "
            "capture. Omit to preserve the historical runner behavior."
        ),
    )
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--list", action="store_true")
    args = parser.parse_args()

    runs = load_runs()
    if args.list:
        for run in runs:
            print(f"{run['id']}: {run['description']}")
        return
    if not args.udid:
        parser.error("--udid is required unless --list is used")

    selected = select_runs(runs, args.run)
    worklets_modes: list[str | None] = args.worklets_mode or [None]
    if args.skip_build and (len(selected) != 1 or len(worklets_modes) != 1):
        parser.error(
            "--skip-build requires exactly one --run and one Worklets mode"
        )
    if not args.dry_run:
        args.output_dir.mkdir(parents=True, exist_ok=True)
    for worklets_mode in worklets_modes:
        for run in selected:
            capture_run(run, args=args, worklets_mode=worklets_mode)


if __name__ == "__main__":
    main()
