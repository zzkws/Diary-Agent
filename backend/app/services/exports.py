import csv
from datetime import date
from pathlib import Path

from ..core.config import settings
from ..models.item_entry import ItemEntry
from ..models.tracked_item import TrackedItem


def write_markdown(log_date: date, item_rows: list[tuple[TrackedItem, ItemEntry]], extra_note: str | None) -> Path:
    markdown_path = settings.markdown_root / f"{log_date.isoformat()}.md"
    lines = [f"# {log_date.isoformat()}", "", "## Fixed Items"]

    for tracked_item, entry in item_rows:
        lines.append(f"- {tracked_item.name}: {entry.final_text}")

    lines.extend(["", "## Extra Note"])
    lines.append(f"- {extra_note.strip()}" if extra_note and extra_note.strip() else "-")

    markdown_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return markdown_path.resolve()


def write_csv_rows(rows: list[list[str]]) -> Path:
    csv_path = settings.csv_path.resolve()
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(["date", "item_name", "status", "raw_answer", "final_text"])
        writer.writerows(rows)

    return csv_path
