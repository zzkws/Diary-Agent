from dataclasses import dataclass, field
from datetime import date
from threading import Lock
from uuid import uuid4

from ..models.item_entry import EntryStatus
from ..models.tracked_item import TrackedItem


@dataclass
class PendingEntry:
    tracked_item_id: int
    raw_answer: str | None
    final_text: str
    status: EntryStatus


@dataclass
class CheckInSession:
    session_id: str
    log_date: date
    items: list[TrackedItem]
    current_index: int = 0
    entries: list[PendingEntry] = field(default_factory=list)


class CheckInSessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, CheckInSession] = {}
        self._lock = Lock()

    def create(self, log_date: date, items: list[TrackedItem]) -> CheckInSession:
        session = CheckInSession(session_id=str(uuid4()), log_date=log_date, items=items)
        with self._lock:
            self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> CheckInSession | None:
        with self._lock:
            return self._sessions.get(session_id)

    def pop(self, session_id: str) -> CheckInSession | None:
        with self._lock:
            return self._sessions.pop(session_id, None)


checkin_store = CheckInSessionStore()
