from __future__ import annotations

import re

from ..models.item_entry import EntryStatus
from ..models.topic import Topic


STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "about",
    "today",
    "into",
    "your",
    "just",
    "have",
    "been",
}


def default_text_for_topic(topic: Topic) -> str:
    return topic.default_text_if_empty or f"No update recorded for {topic.title} today."


def build_topic_entry(answer: str, topic: Topic) -> tuple[EntryStatus, str | None, str]:
    cleaned = answer.strip()
    if cleaned == "":
        return EntryStatus.empty, None, default_text_for_topic(topic)
    return EntryStatus.recorded, cleaned, cleaned


def should_follow_up(answer: str) -> bool:
    cleaned = answer.strip()
    return cleaned != "" and len(cleaned) < 28 and "." not in cleaned


def summarize_topic_update(raw_answer: str | None, follow_up_answer: str | None, final_text: str) -> str:
    if raw_answer and follow_up_answer:
        return f"{raw_answer.strip()} | {follow_up_answer.strip()}"
    if raw_answer:
        return raw_answer.strip()
    return final_text.strip()


def detect_new_topic_candidates(extra_note: str) -> list[tuple[str, str]]:
    candidates: list[tuple[str, str]] = []
    for fragment in re.split(r"[.\n;]+", extra_note):
        cleaned = fragment.strip()
        if len(cleaned) < 18:
            continue
        segments = [cleaned]
        spent_match = re.search(r"(?:spent time on|worked on|focused on)\s+(.+)", cleaned, flags=re.IGNORECASE)
        if spent_match:
            segments = [segment.strip() for segment in re.split(r"\band\b|,", spent_match.group(1)) if segment.strip()]

        for segment in segments:
            words = [word for word in re.findall(r"[A-Za-z0-9']+", segment) if word.lower() not in STOPWORDS]
            if len(words) < 2:
                continue
            title = " ".join(word.capitalize() for word in words[:4])
            candidates.append((title, cleaned))
            if len(candidates) >= 2:
                return candidates
        if len(candidates) >= 2:
            break
    return candidates
