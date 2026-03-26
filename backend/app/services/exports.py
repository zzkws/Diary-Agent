import csv
from datetime import date
from pathlib import Path

from ..core.config import settings
from ..models.item_entry import ItemEntry
from ..models.topic_update import TopicUpdate
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


def write_conversation_markdown(
    session_date: date,
    selected_topics: list[str],
    updates: list[TopicUpdate],
    extra_note: str | None,
) -> Path:
    markdown_path = settings.markdown_root / f"{session_date.isoformat()}.md"
    lines = [f"# {session_date.isoformat()}", "", "## Selected Topics"]
    lines.extend(f"- {topic_title}" for topic_title in selected_topics)
    lines.extend(["", "## Conversation"])

    for update in updates:
        lines.append(f"### {update.topic_title_snapshot}")
        lines.append(f"- Question: {update.question_text}")
        lines.append(f"- Answer: {update.raw_answer or '-'}")
        if update.follow_up_question:
            lines.append(f"- Follow-up: {update.follow_up_question}")
            lines.append(f"- Follow-up Answer: {update.follow_up_answer or '-'}")
        lines.append(f"- Saved Update: {update.final_text}")
        lines.append(f"- Extracted Update: {update.update_summary}")
        lines.append("")

    lines.extend(["## Extra Note", f"- {extra_note.strip()}" if extra_note and extra_note.strip() else "-"])
    markdown_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return markdown_path.resolve()


def build_topic_csv_rows(session_date: date, updates: list[TopicUpdate]) -> list[list[str]]:
    return [
        [
            session_date.isoformat(),
            update.topic_title_snapshot,
            update.status.value,
            update.raw_answer or "",
            update.final_text,
        ]
        for update in updates
    ]
