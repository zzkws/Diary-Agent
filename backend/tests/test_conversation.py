def test_daily_conversation_flow_creates_session_updates_and_topics(client):
    test_client, _ = client

    onboarding_response = test_client.post(
        "/topics/onboarding",
        json={"focus_areas": ["sleep", "job search", "exercise", "cooking", "reading"]},
    )
    assert onboarding_response.status_code == 201

    topics_response = test_client.get("/topics")
    assert topics_response.status_code == 200
    assert len(topics_response.json()) >= 5

    plan_response = test_client.post("/daily-conversation/plan", json={"session_date": "2026-03-30"})
    assert plan_response.status_code == 200
    plan_payload = plan_response.json()
    assert len(plan_payload["topics"]) >= 1

    start_response = test_client.post("/daily-conversation/start", json={"session_date": "2026-03-30"})
    assert start_response.status_code == 200
    start_payload = start_response.json()
    session_id = start_payload["session_id"]

    payload = start_payload
    while payload["stage"] == "topic":
        payload = test_client.post(
            "/daily-conversation/message",
            json={"session_id": session_id, "content": "Made some progress today"},
        ).json()

    payload = test_client.post(
        "/daily-conversation/message",
        json={
            "session_id": session_id,
            "content": "Also spent time on pottery practice and planning a weekend hike.",
        },
    ).json()
    assert payload["stage"] == "ready_to_complete"

    complete_response = test_client.post("/daily-conversation/complete", json={"session_id": session_id})
    assert complete_response.status_code == 200
    complete_payload = complete_response.json()
    assert complete_payload["status"] == "completed"
    assert len(complete_payload["updates"]) >= 1
    assert complete_payload["markdown_path"]

    archive_response = test_client.get("/daily-sessions/2026-03-30")
    assert archive_response.status_code == 200
    archive_payload = archive_response.json()
    assert archive_payload["id"] == session_id
    assert len(archive_payload["transcript"]) >= 3

    refreshed_topics = test_client.get("/topics").json()
    assert any(topic["title"] == "Pottery Practice" for topic in refreshed_topics)
