import json
import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from ..core.config import settings
from ..core.db import get_session
from ..models.agent_setting import AgentSetting
from ..models.conversation_plan import ConversationPlan
from ..models.daily_log import DailyLog
from ..models.daily_session import DailySession, DailySessionStatus
from ..models.item_entry import EntryStatus, ItemEntry
from ..models.topic import Topic
from ..models.topic_memory import TopicMemory
from ..models.topic_update import TopicUpdate
from ..models.tracked_item import TrackedItem
from ..schemas.daily_checkin import (
    DailyCheckInAnswerRequest,
    DailyCheckInAnswerResponse,
    DailyCheckInCompleteRequest,
    DailyCheckInStartRequest,
    DailyCheckInStartResponse,
    DailyLogRead,
    DailyLogSummary,
    ExportMetaRead,
    QuestionStep,
    SavedEntryRead,
)
from ..schemas.daily_conversation import (
    ConversationMessageRead,
    DailyConversationCompleteResponse,
    DailyConversationCompleteRequest,
    DailyConversationMessageRequest,
    DailyConversationMessageResponse,
    DailyConversationPlanRequest,
    DailyConversationPlanResponse,
    DailyConversationStartRequest,
    DailyConversationStartResponse,
    DailySessionRead,
    DailySessionSummary,
    PlannedTopicRead,
    TopicUpdateRead,
)
from ..schemas.settings import (
    AgentSettingRead,
    AgentSettingSave,
    AgentSettingTestRequest,
    AgentSettingTestResponse,
    GeminiModelRead,
)
from ..schemas.topics import TopicCreate, TopicOnboardingRequest, TopicRead, TopicUpdatePayload
from ..schemas.tracked_item import TrackedItemCreate, TrackedItemRead, TrackedItemUpdate
from ..services.checkin import PendingEntry, checkin_store
from ..services.conversation_planner import build_daily_plan
from ..services.exports import build_topic_csv_rows, write_conversation_markdown, write_csv_rows, write_markdown
from ..services.gemini_client import GeminiClientError, list_models, test_connection
from ..services.question_designer import design_follow_up_question
from ..services.topic_extractor import build_topic_entry, should_follow_up, summarize_topic_update
from ..services.topic_manager import apply_completed_session, create_topics_from_extra_note, sync_topics_from_tracked_items

router = APIRouter()
logger = logging.getLogger("diary.api")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def build_step(items: list[TrackedItem], index: int) -> QuestionStep | None:
    if index >= len(items):
        return None
    item = items[index]
    return QuestionStep(index=index + 1, total=len(items), tracked_item=TrackedItemRead.model_validate(item))


def get_agent_setting_record(session: Session) -> AgentSetting | None:
    return session.exec(select(AgentSetting).order_by(AgentSetting.id.desc())).first()


def get_or_create_agent_setting(session: Session) -> AgentSetting:
    setting = get_agent_setting_record(session)
    if setting:
        return setting
    setting = AgentSetting(provider="gemini")
    session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting


def parse_json(value: str, default):
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def build_planned_topic_read(payload: dict) -> PlannedTopicRead:
    return PlannedTopicRead(
        topic_id=payload["topic_id"],
        title=payload["title"],
        status=payload["status"],
        question=payload["question"],
        rationale=payload["rationale"],
        importance_score=payload["importance_score"],
        recency_score=payload["recency_score"],
    )


def build_transcript_read(transcript_payload: list[dict]) -> list[ConversationMessageRead]:
    return [ConversationMessageRead(**message) for message in transcript_payload]


def build_daily_session_read(daily_session: DailySession, updates: list[TopicUpdate]) -> DailySessionRead:
    return DailySessionRead(
        id=daily_session.id,
        session_date=daily_session.session_date,
        status=daily_session.status,
        extra_note=daily_session.extra_note,
        markdown_path=daily_session.markdown_path,
        selected_topic_ids=parse_json(daily_session.selected_topic_ids_json, []),
        archive_candidate_ids=parse_json(daily_session.archive_candidate_ids_json, []),
        transcript=build_transcript_read(parse_json(daily_session.transcript_json, [])),
        updates=build_topic_update_reads(updates),
        created_at=daily_session.created_at,
        completed_at=daily_session.completed_at,
    )


def build_topic_update_reads(updates: list[TopicUpdate]) -> list[TopicUpdateRead]:
    return [
        TopicUpdateRead(
            id=update.id,
            topic_id=update.topic_id,
            topic_title_snapshot=update.topic_title_snapshot,
            question_text=update.question_text,
            raw_answer=update.raw_answer,
            follow_up_question=update.follow_up_question,
            follow_up_answer=update.follow_up_answer,
            final_text=update.final_text,
            update_summary=update.update_summary,
            status=update.status,
            created_at=update.created_at,
        )
        for update in updates
    ]


def load_session_updates(session: Session, session_id: int) -> list[TopicUpdate]:
    return list(
        session.exec(
            select(TopicUpdate)
            .where(TopicUpdate.daily_session_id == session_id)
            .order_by(TopicUpdate.created_at)
        )
    )


def persist_transcript(session: Session, daily_session: DailySession, transcript: list[dict], state_payload: dict) -> DailySession:
    daily_session.transcript_json = json.dumps(transcript)
    daily_session.conversation_state_json = json.dumps(state_payload)
    session.add(daily_session)
    session.commit()
    session.refresh(daily_session)
    return daily_session


def append_message(transcript: list[dict], role: str, content: str, topic_payload: dict | None = None) -> None:
    transcript.append(
        {
            "role": role,
            "content": content,
            "topic_id": topic_payload["topic_id"] if topic_payload else None,
            "topic_title": topic_payload["title"] if topic_payload else None,
        }
    )


def session_status_from_state(state_payload: dict) -> str:
    return "complete" if state_payload.get("stage") == "ready_to_complete" else "active"


def user_wants_to_wrap_up(message: str) -> bool:
    cleaned = message.strip().lower()
    if not cleaned:
        return False
    signals = (
        "that's all",
        "thats all",
        "nothing else",
        "no more",
        "done for today",
        "all good",
        "all set",
        "wrap up",
        "finish for today",
    )
    return any(signal in cleaned for signal in signals)


def build_daily_conversation_csv_rows(session: Session) -> list[list[str]]:
    legacy_rows = [
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

    topic_rows = []
    for daily_session, update in session.exec(
        select(DailySession, TopicUpdate)
        .join(TopicUpdate, TopicUpdate.daily_session_id == DailySession.id)
        .order_by(DailySession.session_date, TopicUpdate.created_at)
    ):
        topic_rows.extend(build_topic_csv_rows(daily_session.session_date, [update]))

    return legacy_rows + topic_rows


@router.get("/settings/llm", response_model=AgentSettingRead)
def get_llm_settings(session: Session = Depends(get_session)) -> AgentSetting:
    return get_or_create_agent_setting(session)


@router.post("/settings/llm", response_model=AgentSettingRead)
def save_llm_settings(payload: AgentSettingSave, session: Session = Depends(get_session)) -> AgentSetting:
    setting = get_or_create_agent_setting(session)
    setting.provider = payload.provider
    setting.api_key = payload.api_key
    setting.model_name = payload.model_name
    setting.system_prompt = payload.system_prompt
    setting.updated_at = utc_now()
    session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting


@router.get("/settings/llm/models", response_model=list[GeminiModelRead])
def get_llm_models(session: Session = Depends(get_session)) -> list[GeminiModelRead]:
    setting = get_or_create_agent_setting(session)
    if not setting.api_key:
        raise HTTPException(status_code=400, detail="Save a Gemini API key first.")
    try:
        models = list_models(setting.api_key)
    except GeminiClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return [
        GeminiModelRead(
            name=model.get("name", ""),
            display_name=model.get("displayName"),
            description=model.get("description"),
            supported_generation_methods=model.get("supportedGenerationMethods", []),
        )
        for model in models
        if "generateContent" in model.get("supportedGenerationMethods", [])
    ]


@router.post("/settings/llm/test", response_model=AgentSettingTestResponse)
def test_llm_settings(
    payload: AgentSettingTestRequest,
    session: Session = Depends(get_session),
) -> AgentSettingTestResponse:
    setting = get_or_create_agent_setting(session)
    api_key = payload.api_key or setting.api_key
    model_name = payload.model_name or setting.model_name
    if not api_key or not model_name:
        raise HTTPException(status_code=400, detail="Both API key and model name are required.")
    try:
        message = test_connection(api_key, model_name)
    except GeminiClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AgentSettingTestResponse(
        ok=True,
        provider="gemini",
        model_name=model_name,
        message=message,
    )


@router.post("/tracked-items", response_model=TrackedItemRead, status_code=status.HTTP_201_CREATED)
def create_tracked_item(payload: TrackedItemCreate, session: Session = Depends(get_session)) -> TrackedItem:
    tracked_item = TrackedItem.model_validate(payload)
    session.add(tracked_item)
    session.commit()
    session.refresh(tracked_item)
    sync_topics_from_tracked_items(session)
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
    sync_topics_from_tracked_items(session)
    return tracked_item


@router.delete("/tracked-items/{tracked_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tracked_item(tracked_item_id: int, session: Session = Depends(get_session)) -> None:
    tracked_item = session.get(TrackedItem, tracked_item_id)
    if not tracked_item:
        raise HTTPException(status_code=404, detail="Tracked item not found")
    session.delete(tracked_item)
    session.commit()


@router.get("/topics", response_model=list[TopicRead])
def list_topics(
    status_filter: str | None = Query(default=None, alias="status"),
    session: Session = Depends(get_session),
) -> list[Topic]:
    sync_topics_from_tracked_items(session)
    statement = select(Topic).order_by(Topic.updated_at.desc(), Topic.title)
    if status_filter:
        statement = statement.where(Topic.status == status_filter)
    return list(session.exec(statement))


@router.post("/topics", response_model=TopicRead, status_code=status.HTTP_201_CREATED)
def create_topic(payload: TopicCreate, session: Session = Depends(get_session)) -> Topic:
    topic = Topic(
        title=payload.title,
        description=payload.description,
        status=payload.status,
        importance_score=payload.importance_score,
        recency_score=0.7,
        cadence_hint=payload.cadence_hint,
        default_text_if_empty=payload.default_text_if_empty,
    )
    session.add(topic)
    session.commit()
    session.refresh(topic)
    return topic


@router.post("/topics/onboarding", response_model=list[TopicRead], status_code=status.HTTP_201_CREATED)
def create_onboarding_topics(payload: TopicOnboardingRequest, session: Session = Depends(get_session)) -> list[Topic]:
    created_topics: list[Topic] = []
    existing_titles = {topic.title.lower() for topic in session.exec(select(Topic))}

    for index, focus_area in enumerate(payload.focus_areas[:6], start=1):
        title = focus_area.strip()
        if not title or title.lower() in existing_titles:
            continue
        topic = Topic(
            title=title,
            description="Created from onboarding.",
            importance_score=max(0.45, 0.8 - (index * 0.05)),
            recency_score=0.8,
            cadence_hint="weekly",
            default_text_if_empty=f"No update recorded for {title} today.",
        )
        session.add(topic)
        session.commit()
        session.refresh(topic)
        existing_titles.add(topic.title.lower())
        created_topics.append(topic)

    return created_topics


@router.patch("/topics/{topic_id}", response_model=TopicRead)
def update_topic(topic_id: int, payload: TopicUpdatePayload, session: Session = Depends(get_session)) -> Topic:
    topic = session.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(topic, key, value)
    topic.updated_at = utc_now()
    session.add(topic)
    session.commit()
    session.refresh(topic)
    return topic


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
        existing_entries = session.exec(select(ItemEntry).where(ItemEntry.daily_log_id == existing_log.id)).all()
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
    write_csv_rows(build_daily_conversation_csv_rows(session))

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


@router.post("/daily-conversation/plan", response_model=DailyConversationPlanResponse)
def plan_daily_conversation(
    payload: DailyConversationPlanRequest,
    session: Session = Depends(get_session),
) -> DailyConversationPlanResponse:
    session_date = payload.session_date or date.today()
    llm_setting = get_agent_setting_record(session)
    planned_topics, archive_candidates, _ = build_daily_plan(session, session_date, llm_setting)
    return DailyConversationPlanResponse(
        session_date=session_date,
        topics=[
            PlannedTopicRead(
                topic_id=entry.topic.id,
                title=entry.topic.title,
                status=entry.topic.status,
                question=entry.question,
                rationale=entry.rationale,
                importance_score=entry.topic.importance_score,
                recency_score=entry.topic.recency_score,
            )
            for entry in planned_topics
        ],
        archive_candidates=[topic.id for topic in archive_candidates],
    )


@router.post("/daily-conversation/start", response_model=DailyConversationStartResponse)
def start_daily_conversation(
    payload: DailyConversationStartRequest,
    session: Session = Depends(get_session),
) -> DailyConversationStartResponse:
    logger.info("daily_conversation.start requested for date=%s", payload.session_date or date.today())
    session_date = payload.session_date or date.today()
    llm_setting = get_agent_setting_record(session)
    planned_topics, archive_candidates, conversation_plan = build_daily_plan(session, session_date, llm_setting)
    plan_payload = parse_json(conversation_plan.plan_json, [])

    existing_session = session.exec(select(DailySession).where(DailySession.session_date == session_date)).first()
    if existing_session:
        existing_updates = session.exec(
            select(TopicUpdate).where(TopicUpdate.daily_session_id == existing_session.id)
        ).all()
        for update in existing_updates:
            session.delete(update)
        daily_session = existing_session
    else:
        daily_session = DailySession(session_date=session_date)

    opening_message = (
        plan_payload[0]["question"]
        if plan_payload
        else "Anything else from today you want me to keep?"
    )
    stage = "topic" if plan_payload else "extra_note"
    transcript = []
    append_message(transcript, "assistant", opening_message, plan_payload[0] if plan_payload else None)
    state_payload = {
        "stage": stage,
        "current_index": 0,
        "pending_follow_up": False,
        "initial_answer": None,
        "follow_up_question": None,
        "planned_topics": plan_payload,
    }

    daily_session.status = DailySessionStatus.in_progress
    daily_session.extra_note = None
    daily_session.markdown_path = None
    daily_session.selected_topic_ids_json = json.dumps([entry["topic_id"] for entry in plan_payload])
    daily_session.archive_candidate_ids_json = json.dumps([topic.id for topic in archive_candidates])
    session.add(daily_session)
    session.commit()
    session.refresh(daily_session)
    persist_transcript(session, daily_session, transcript, state_payload)
    updates = load_session_updates(session, daily_session.id)

    return DailyConversationStartResponse(
        session_id=daily_session.id,
        session_date=daily_session.session_date,
        assistant_message=opening_message,
        session_status=session_status_from_state(state_payload),
        transcript=build_transcript_read(transcript),
        topic_updates=build_topic_update_reads(updates),
    )


@router.post("/daily-conversation/message", response_model=DailyConversationMessageResponse)
def message_daily_conversation(
    payload: DailyConversationMessageRequest,
    session: Session = Depends(get_session),
) -> DailyConversationMessageResponse:
    logger.info("daily_conversation.message requested for session_id=%s", payload.session_id)
    daily_session = session.get(DailySession, payload.session_id)
    if not daily_session:
        raise HTTPException(status_code=404, detail="Daily conversation session not found")

    state_payload = parse_json(daily_session.conversation_state_json, {})
    transcript = parse_json(daily_session.transcript_json, [])
    planned_topics = state_payload.get("planned_topics", [])
    stage = state_payload.get("stage", "topic")
    user_message = payload.message.strip()

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    current_topic_payload = None
    if stage == "topic" and planned_topics:
        current_topic_payload = planned_topics[state_payload.get("current_index", 0)]
    append_message(transcript, "user", user_message, current_topic_payload)

    assistant_message = "Thanks for sharing."

    if stage == "topic":
        if not current_topic_payload:
            raise HTTPException(status_code=400, detail="No current topic available")
        topic = session.get(Topic, current_topic_payload["topic_id"])
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

        if state_payload.get("pending_follow_up"):
            initial_answer = state_payload.get("initial_answer", "")
            follow_up_answer = user_message
            combined_answer = f"{initial_answer.strip()} {follow_up_answer}".strip()
            status_value, stored_raw, final_text = build_topic_entry(combined_answer, topic)
            update = TopicUpdate(
                daily_session_id=daily_session.id,
                topic_id=topic.id,
                topic_title_snapshot=topic.title,
                question_text=current_topic_payload["question"],
                raw_answer=initial_answer.strip() or None,
                follow_up_question=state_payload.get("follow_up_question"),
                follow_up_answer=follow_up_answer or None,
                final_text=final_text,
                update_summary=summarize_topic_update(initial_answer, follow_up_answer, final_text),
                status=status_value,
            )
            session.add(update)
            session.commit()
            state_payload["pending_follow_up"] = False
            state_payload["initial_answer"] = None
            state_payload["follow_up_question"] = None
        else:
            answer_text = user_message
            if should_follow_up(answer_text):
                follow_up_question = design_follow_up_question(topic)
                state_payload["pending_follow_up"] = True
                state_payload["initial_answer"] = answer_text
                state_payload["follow_up_question"] = follow_up_question
                assistant_message = follow_up_question
                append_message(transcript, "assistant", follow_up_question, current_topic_payload)
                persist_transcript(session, daily_session, transcript, state_payload)
                updates = load_session_updates(session, daily_session.id)
                return DailyConversationMessageResponse(
                    session_id=daily_session.id,
                    assistant_message=assistant_message,
                    session_status=session_status_from_state(state_payload),
                    transcript=build_transcript_read(transcript),
                    topic_updates=build_topic_update_reads(updates),
                )

            status_value, stored_raw, final_text = build_topic_entry(answer_text, topic)
            update = TopicUpdate(
                daily_session_id=daily_session.id,
                topic_id=topic.id,
                topic_title_snapshot=topic.title,
                question_text=current_topic_payload["question"],
                raw_answer=stored_raw,
                final_text=final_text,
                update_summary=summarize_topic_update(stored_raw, None, final_text),
                status=status_value,
            )
            session.add(update)
            session.commit()

        coverage_count = state_payload.get("current_index", 0) + 1
        next_index = state_payload.get("current_index", 0) + 1
        state_payload["current_index"] = next_index
        enough_coverage = coverage_count >= min(max(len(planned_topics), 1), 4)

        if enough_coverage and user_wants_to_wrap_up(user_message):
            assistant_message = "Anything else from today you want me to keep before we save this session?"
            append_message(transcript, "assistant", assistant_message, None)
            state_payload["stage"] = "extra_note"
        elif next_index < len(planned_topics):
            next_topic_payload = planned_topics[next_index]
            assistant_message = next_topic_payload["question"]
            append_message(transcript, "assistant", assistant_message, next_topic_payload)
            state_payload["stage"] = "topic"
        else:
            assistant_message = "Anything else from today you want me to keep?"
            append_message(transcript, "assistant", assistant_message, None)
            state_payload["stage"] = "extra_note"

    elif stage == "extra_note":
        daily_session.extra_note = user_message or None
        assistant_message = "Thanks. I have enough for today, and you can save this session whenever you're ready."
        append_message(transcript, "assistant", assistant_message, None)
        state_payload["stage"] = "ready_to_complete"

    else:
        raise HTTPException(status_code=400, detail="This conversation is ready to complete")

    session.add(daily_session)
    session.commit()
    session.refresh(daily_session)
    persist_transcript(session, daily_session, transcript, state_payload)
    updates = load_session_updates(session, daily_session.id)

    return DailyConversationMessageResponse(
        session_id=daily_session.id,
        assistant_message=assistant_message,
        session_status=session_status_from_state(state_payload),
        transcript=build_transcript_read(transcript),
        topic_updates=build_topic_update_reads(updates),
    )


@router.post("/daily-conversation/complete", response_model=DailyConversationCompleteResponse)
def complete_daily_conversation(
    payload: DailyConversationCompleteRequest,
    session: Session = Depends(get_session),
) -> DailyConversationCompleteResponse:
    logger.info("daily_conversation.complete requested for session_id=%s", payload.session_id)
    daily_session = session.get(DailySession, payload.session_id)
    if not daily_session:
        raise HTTPException(status_code=404, detail="Daily conversation session not found")

    state_payload = parse_json(daily_session.conversation_state_json, {})
    if state_payload.get("stage") != "ready_to_complete":
        raise HTTPException(status_code=400, detail="Conversation is not ready to complete")

    updates = load_session_updates(session, daily_session.id)

    apply_completed_session(session, daily_session, updates)
    transcript_payload = parse_json(daily_session.transcript_json, [])
    user_text = "\n".join(
        message.get("content", "")
        for message in transcript_payload
        if message.get("role") == "user" and message.get("content")
    )
    candidate_text = "\n".join(part for part in [daily_session.extra_note or "", user_text] if part.strip())
    create_topics_from_extra_note(session, daily_session, candidate_text)

    planned_topics = state_payload.get("planned_topics", [])
    selected_titles = [entry["title"] for entry in planned_topics]
    markdown_path = write_conversation_markdown(
        daily_session.session_date,
        selected_titles,
        updates,
        daily_session.extra_note,
    )
    write_csv_rows(build_daily_conversation_csv_rows(session))

    daily_session.status = DailySessionStatus.completed
    daily_session.markdown_path = str(markdown_path)
    daily_session.completed_at = utc_now()
    session.add(daily_session)
    session.commit()
    session.refresh(daily_session)

    return DailyConversationCompleteResponse(
        ok=True,
        markdown_path=daily_session.markdown_path,
        csv_path=str(settings.csv_path.resolve()),
    )


@router.get("/daily-sessions/{session_date}", response_model=DailySessionRead)
def get_daily_session(session_date: date, session: Session = Depends(get_session)) -> DailySessionRead:
    daily_session = session.exec(select(DailySession).where(DailySession.session_date == session_date)).first()
    if not daily_session:
        raise HTTPException(status_code=404, detail="Daily conversation session not found")

    updates = list(
        session.exec(
            select(TopicUpdate)
            .where(TopicUpdate.daily_session_id == daily_session.id)
            .order_by(TopicUpdate.created_at)
        )
    )
    return build_daily_session_read(daily_session, updates)


@router.get("/daily-sessions", response_model=list[DailySessionSummary])
def list_daily_sessions(
    limit: int = Query(default=30, ge=1, le=365),
    session: Session = Depends(get_session),
) -> list[DailySessionSummary]:
    daily_sessions = list(
        session.exec(
            select(DailySession).order_by(DailySession.session_date.desc(), DailySession.created_at.desc()).limit(limit)
        )
    )
    return [
        DailySessionSummary(
            id=daily_session.id,
            session_date=daily_session.session_date,
            status=daily_session.status,
            selected_topic_ids=parse_json(daily_session.selected_topic_ids_json, []),
            extra_note=daily_session.extra_note,
            markdown_path=daily_session.markdown_path,
            created_at=daily_session.created_at,
        )
        for daily_session in daily_sessions
    ]


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


@router.get("/daily-logs", response_model=list[DailyLogSummary])
def list_daily_logs(
    limit: int = Query(default=30, ge=1, le=365),
    session: Session = Depends(get_session),
) -> list[DailyLogSummary]:
    daily_logs = list(
        session.exec(select(DailyLog).order_by(DailyLog.log_date.desc(), DailyLog.created_at.desc()).limit(limit))
    )
    summaries: list[DailyLogSummary] = []
    for daily_log in daily_logs:
        entry_count = len(list(session.exec(select(ItemEntry.id).where(ItemEntry.daily_log_id == daily_log.id))))
        summaries.append(
            DailyLogSummary(
                id=daily_log.id,
                log_date=daily_log.log_date,
                extra_note=daily_log.extra_note,
                markdown_path=daily_log.markdown_path,
                created_at=daily_log.created_at,
                entry_count=entry_count,
            )
        )
    return summaries


@router.get("/exports/meta", response_model=ExportMetaRead)
def get_export_meta() -> ExportMetaRead:
    return ExportMetaRead(
        export_root=str(settings.export_root.resolve()),
        markdown_root=str(settings.markdown_root.resolve()),
        csv_path=str(settings.csv_path.resolve()),
    )
