from sqlmodel import Session, select

from ..models.tracked_item import TrackedItem


DEFAULT_TRACKED_ITEMS = [
    {
        "name": "Sleep",
        "question": "How did you sleep today?",
        "default_text_if_empty": "No sleep note recorded.",
        "is_active": True,
        "sort_order": 1,
    },
    {
        "name": "Exercise",
        "question": "What exercise did you do today?",
        "default_text_if_empty": "No exercise recorded.",
        "is_active": True,
        "sort_order": 2,
    },
    {
        "name": "Study",
        "question": "What did you study today?",
        "default_text_if_empty": "No study session recorded.",
        "is_active": True,
        "sort_order": 3,
    },
    {
        "name": "Project Progress",
        "question": "What progress did you make on your project today?",
        "default_text_if_empty": "No project progress recorded.",
        "is_active": True,
        "sort_order": 4,
    },
    {
        "name": "Job Applications",
        "question": "Did you work on any job applications today?",
        "default_text_if_empty": "No job application activity recorded.",
        "is_active": True,
        "sort_order": 5,
    },
]


def seed_default_tracked_items(session: Session) -> None:
    existing_item = session.exec(select(TrackedItem.id).limit(1)).first()
    if existing_item is not None:
        return

    for item_data in DEFAULT_TRACKED_ITEMS:
        session.add(TrackedItem(**item_data))

    session.commit()
