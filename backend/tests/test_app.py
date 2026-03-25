import csv


def test_tracked_item_crud(client):
    test_client, _ = client

    initial_response = test_client.get("/tracked-items")
    assert initial_response.status_code == 200
    assert len(initial_response.json()) == 5

    create_response = test_client.post(
        "/tracked-items",
        json={
            "name": "Reading",
            "question": "What did you read today?",
            "default_text_if_empty": "No reading recorded.",
            "is_active": True,
            "sort_order": 6,
        },
    )
    assert create_response.status_code == 201
    created_item = create_response.json()
    assert created_item["name"] == "Reading"

    update_response = test_client.patch(
        f"/tracked-items/{created_item['id']}",
        json={"question": "What reading did you do today?", "is_active": False},
    )
    assert update_response.status_code == 200
    updated_item = update_response.json()
    assert updated_item["question"] == "What reading did you do today?"
    assert updated_item["is_active"] is False

    delete_response = test_client.delete(f"/tracked-items/{created_item['id']}")
    assert delete_response.status_code == 204

    final_response = test_client.get("/tracked-items")
    assert final_response.status_code == 200
    assert len(final_response.json()) == 5


def test_daily_checkin_completion_uses_default_text_for_blank_answers(client):
    test_client, _ = client

    tracked_items = test_client.get("/tracked-items?active_only=true").json()
    start_response = test_client.post("/daily-checkin/start", json={"log_date": "2026-03-25"})
    assert start_response.status_code == 200
    start_payload = start_response.json()
    assert start_payload["total_items"] == 5

    answers = {
        tracked_items[0]["id"]: "",
        tracked_items[1]["id"]: "30 minute walk",
        tracked_items[2]["id"]: "",
        tracked_items[3]["id"]: "Finished API refactor",
        tracked_items[4]["id"]: "Applied to two roles",
    }

    current_step = start_payload["current_step"]
    for _ in range(start_payload["total_items"]):
        tracked_item_id = current_step["tracked_item"]["id"]
        answer_response = test_client.post(
            "/daily-checkin/answer",
            json={
                "session_id": start_payload["session_id"],
                "tracked_item_id": tracked_item_id,
                "answer": answers[tracked_item_id],
            },
        )
        assert answer_response.status_code == 200
        current_step = answer_response.json()["current_step"]

    complete_response = test_client.post(
        "/daily-checkin/complete",
        json={"session_id": start_payload["session_id"], "extra_note": "Quiet day overall."},
    )
    assert complete_response.status_code == 200
    payload = complete_response.json()

    assert payload["log_date"] == "2026-03-25"
    assert payload["extra_note"] == "Quiet day overall."
    assert len(payload["entries"]) == 5

    first_entry = payload["entries"][0]
    assert first_entry["status"] == "empty"
    assert first_entry["final_text"] == tracked_items[0]["default_text_if_empty"]
    assert first_entry["raw_answer"] is None

    archive_response = test_client.get("/daily-logs/2026-03-25")
    assert archive_response.status_code == 200
    archive_payload = archive_response.json()
    assert archive_payload["entries"][2]["status"] == "empty"
    assert archive_payload["entries"][2]["final_text"] == tracked_items[2]["default_text_if_empty"]


def test_markdown_export_written_for_completed_checkin(client):
    test_client, export_root = client

    tracked_items = test_client.get("/tracked-items?active_only=true").json()
    start_response = test_client.post("/daily-checkin/start", json={"log_date": "2026-03-26"})
    session_id = start_response.json()["session_id"]

    for item in tracked_items:
        test_client.post(
            "/daily-checkin/answer",
            json={
                "session_id": session_id,
                "tracked_item_id": item["id"],
                "answer": "",
            },
        )

    complete_response = test_client.post(
        "/daily-checkin/complete",
        json={"session_id": session_id, "extra_note": "Export check"},
    )
    markdown_path = complete_response.json()["markdown_path"]

    expected_markdown_path = export_root / "markdown" / "2026-03-26.md"
    assert markdown_path == str(expected_markdown_path.resolve())
    assert expected_markdown_path.exists()

    markdown_text = expected_markdown_path.read_text(encoding="utf-8")
    assert "# 2026-03-26" in markdown_text
    assert "## Fixed Items" in markdown_text
    assert "- Sleep: No sleep note recorded." in markdown_text
    assert "## Extra Note" in markdown_text
    assert "- Export check" in markdown_text


def test_csv_export_written_for_completed_checkin(client):
    test_client, export_root = client

    tracked_items = test_client.get("/tracked-items?active_only=true").json()
    start_response = test_client.post("/daily-checkin/start", json={"log_date": "2026-03-27"})
    session_id = start_response.json()["session_id"]

    for index, item in enumerate(tracked_items, start=1):
        test_client.post(
            "/daily-checkin/answer",
            json={
                "session_id": session_id,
                "tracked_item_id": item["id"],
                "answer": f"Answer {index}",
            },
        )

    complete_response = test_client.post(
        "/daily-checkin/complete",
        json={"session_id": session_id, "extra_note": ""},
    )
    assert complete_response.status_code == 200

    csv_path = export_root / "daily_entries.csv"
    assert csv_path.exists()
    assert csv_path.resolve().is_absolute()

    with csv_path.open("r", encoding="utf-8", newline="") as csv_file:
        rows = list(csv.reader(csv_file))

    assert rows[0] == ["date", "item_name", "status", "raw_answer", "final_text"]
    assert len(rows) == 6
    assert rows[1][0] == "2026-03-27"
    assert rows[1][1] == "Sleep"
    assert rows[1][2] == "recorded"
    assert rows[1][3] == "Answer 1"
    assert rows[1][4] == "Answer 1"
