from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from ..core.db import get_session
from ..models.daily_log import DailyLog
from ..models.item_entry import EntryStatus, ItemEntry
from ..models.tracked_item import TrackedItem
from ..schemas.daily_checkin import (
    DailyCheckInAnswerRequest,
    DailyCheckInAnswerResponse,
    DailyCheckInCompleteRequest,
    DailyCheckInStartRequest,
    DailyCheckInStartResponse,
    DailyLogRead,
    QuestionStep,
    SavedEntryRead,
)
from ..schemas.tracked_item import TrackedItemCreate, TrackedItemRead, TrackedItemUpdate
from ..services.checkin import PendingEntry, checkin_store
from ..services.exports import write_csv_rows, write_markdown

router = APIRouter()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def build_step(items: list[TrackedItem], index: int) -> QuestionStep | None:
    if index >= len(items):
        return None
    item = items[index]
    return QuestionStep(index=index + 1, total=len(items), tracked_item=TrackedItemRead.model_validate(item))


@router.post("/tracked-items", response_model=TrackedItemRead, status_code=status.HTTP_201_CREATED)
def create_tracked_item(payload: TrackedItemCreate, session: Session = Depends(get_session)) -> TrackedItem:
    tracked_item = TrackedItem.model_validate(payload)
    session.add(tracked_item)
    session.commit()
    session.refresh(tracked_item)
    return tracked_item


@router.get("/tracked-items", response_model=list[TrackedItemRead])
def list_tracked_items(
    active_only: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> list[TrackedItem]:
    statement = select(TrackedItem).order_by(TrackedItem.sort_order, TrackedItem.created_at)
    if active_only:
        statement = statement.where(TrackedItem.is_active == True)  # noqa: E712
    return list(session.exec(statement))


@router.patch("/tracked-items/{tracked_item_id}", response_model=TrackedItemRead)
def update_tracked_item(
    tracked_item_id: int,
    payload: TrackedItemUpdate,
    session: Session = Depends(get_session),
) -> TrackedItem:
    tracked_item = session.get(TrackedItem, tracked_item_id)
    if not tracked_item:
        raise HTTPException(status_code=404, detail="Tracked item not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(tracked_item, key, value)
    tracked_item.updated_at = utc_now()

    session.add(tracked_item)
    session.commit()
    session.refresh(tracked_item)
    return tracked_item


@router.delete("/tracked-items/{tracked_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tracked_item(tracked_item_id: int, session: Session = Depends(get_session)) -> None:
    tracked_item = session.get(TrackedItem, tracked_item_id)
    if not tracked_item:
        raise HTTPException(status_code=404, detail="Tracked item not found")
    session.delete(tracked_item)
    session.commit()


@router.post("/daily-checkin/start", response_model=DailyCheckInStartResponse)
def start_daily_checkin(
    payload: DailyCheckInStartRequest,
    session: Session = Depends(get_session),
) -> DailyCheckInStartResponse:
    log_date = payload.log_date or date.today()
    items = list(
        session.exec(
            select(TrackedItem)
            .where(TrackedItem.is_active == True)  # noqa: E712
            .order_by(TrackedItem.sort_order, TrackedItem.created_at)
        )
    )
    checkin_session = checkin_store.create(log_date=log_date, items=items)
    current_step = build_step(items, 0)
    return DailyCheckInStartResponse(
        session_id=checkin_session.session_id,
        log_date=log_date,
        total_items=len(items),
        current_step=current_step,
        is_complete=current_step is None,
    )


@router.post("/daily-checkin/answer", response_model=DailyCheckInAnswerResponse)
def answer_daily_checkin(
    payload: DailyCheckInAnswerRequest,
    session: Session = Depends(get_session),
) -> DailyCheckInAnswerResponse:
    checkin_session = checkin_store.get(payload.session_id)
    if not checkin_session:
        raise HTTPException(status_code=404, detail="Check-in session not found")

    if checkin_session.current_index >= len(checkin_session.items):
        raise HTTPException(status_code=400, detail="Check-in session already completed")

    current_item = checkin_session.items[checkin_session.current_index]
    if current_item.id != payload.tracked_item_id:
        raise HTTPException(status_code=400, detail="Tracked item does not match current question")

    raw_answer = (payload.answer or "").strip()
    if payload.skipped:
        status_value = EntryStatus.skipped
        final_text = current_item.default_text_if_empty
        stored_raw = raw_answer or None
    elif raw_answer == "":
        status_value = EntryStatus.empty
        final_text = current_item.default_text_if_empty
        stored_raw = None
    else:
        status_value = EntryStatus.recorded
        final_text = raw_answer
        stored_raw = raw_answer

    checkin_session.entries.append(
        PendingEntry(
            tracked_item_id=current_item.id,
            raw_answer=stored_raw,
            final_text=final_text,
            status=status_value,
        )
    )
    checkin_session.current_index += 1

    return DailyCheckInAnswerResponse(
        accepted_entry_status=status_value,
        current_step=build_step(checkin_session.items, checkin_session.current_index),
        is_complete=checkin_session.current_index >= len(checkin_session.items),
    )


@router.post("/daily-checkin/complete", response_model=DailyLogRead)
def complete_daily_checkin(
    payload: DailyCheckInCompleteRequest,
    session: Session = Depends(get_session),
) -> DailyLogRead:
    checkin_session = checkin_store.get(payload.session_id)
    if not checkin_session:
        raise HTTPException(status_code=404, detail="Check-in session not found")
    if len(checkin_session.entries) != len(checkin_session.items):
        raise HTTPException(status_code=400, detail="Not all tracked items have been answered")

    existing_log = session.exec(select(DailyLog).where(DailyLog.log_date == checkin_session.log_date)).first()
    if existing_log:
        existing_entries = session.exec(
            select(ItemEntry).where(ItemEntry.daily_log_id == existing_log.id)
        ).all()
        for entry in existing_entries:
            session.delete(entry)
        daily_log = existing_log
        daily_log.extra_note = payload.extra_note.strip() if payload.extra_note else None
    else:
        daily_log = DailyLog(
            log_date=checkin_session.log_date,
            extra_note=payload.extra_note.strip() if payload.extra_note else None,
        )
        session.add(daily_log)
        session.commit()
        session.refresh(daily_log)

    saved_entries: list[ItemEntry] = []
    item_rows: list[tuple[TrackedItem, ItemEntry]] = []

    tracked_items = {item.id: item for item in checkin_session.items if item.id is not None}

    for pending_entry in checkin_session.entries:
        entry = ItemEntry(
            daily_log_id=daily_log.id,
            tracked_item_id=pending_entry.tracked_item_id,
            raw_answer=pending_entry.raw_answer,
            final_text=pending_entry.final_text,
            status=pending_entry.status,
        )
        session.add(entry)
        saved_entries.append(entry)

    session.commit()

    for entry in saved_entries:
        session.refresh(entry)
        item_rows.append((tracked_items[entry.tracked_item_id], entry))

    markdown_path = write_markdown(checkin_session.log_date, item_rows, daily_log.extra_note)
    csv_rows = [
        [
            log_row.log_date.isoformat(),
            tracked_item.name,
            item_entry.status.value,
            item_entry.raw_answer or "",
            item_entry.final_text,
        ]
        for log_row, item_entry, tracked_item in session.exec(
            select(DailyLog, ItemEntry, TrackedItem)
            .join(ItemEntry, ItemEntry.daily_log_id == DailyLog.id)
            .join(TrackedItem, TrackedItem.id == ItemEntry.tracked_item_id)
            .order_by(DailyLog.log_date, TrackedItem.sort_order, ItemEntry.created_at)
        )
    ]
    write_csv_rows(csv_rows)

    daily_log.markdown_path = str(markdown_path)
    session.add(daily_log)
    session.commit()
    session.refresh(daily_log)
    checkin_store.pop(payload.session_id)

    return DailyLogRead(
        id=daily_log.id,
        log_date=daily_log.log_date,
        extra_note=daily_log.extra_note,
        markdown_path=daily_log.markdown_path,
        created_at=daily_log.created_at,
        entries=[
            SavedEntryRead(
                id=entry.id,
                tracked_item_id=entry.tracked_item_id,
                item_name=tracked_items[entry.tracked_item_id].name,
                raw_answer=entry.raw_answer,
                final_text=entry.final_text,
                status=entry.status,
                created_at=entry.created_at,
            )
            for entry in saved_entries
        ],
    )


@router.get("/daily-logs/{log_date}", response_model=DailyLogRead)
def get_daily_log(log_date: date, session: Session = Depends(get_session)) -> DailyLogRead:
    daily_log = session.exec(select(DailyLog).where(DailyLog.log_date == log_date)).first()
    if not daily_log:
        raise HTTPException(status_code=404, detail="Daily log not found")

    entries = list(
        session.exec(
            select(ItemEntry, TrackedItem)
            .join(TrackedItem, TrackedItem.id == ItemEntry.tracked_item_id)
            .where(ItemEntry.daily_log_id == daily_log.id)
            .order_by(TrackedItem.sort_order, ItemEntry.created_at)
        )
    )

    return DailyLogRead(
        id=daily_log.id,
        log_date=daily_log.log_date,
        extra_note=daily_log.extra_note,
        markdown_path=daily_log.markdown_path,
        created_at=daily_log.created_at,
        entries=[
            SavedEntryRead(
                id=item_entry.id,
                tracked_item_id=item_entry.tracked_item_id,
                item_name=tracked_item.name,
                raw_answer=item_entry.raw_answer,
                final_text=item_entry.final_text,
                status=item_entry.status,
                created_at=item_entry.created_at,
            )
            for item_entry, tracked_item in entries
        ],
    )
