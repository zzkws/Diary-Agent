def test_llm_settings_can_be_saved_locally(client):
    test_client, _ = client

    get_response = test_client.get("/settings/llm")
    assert get_response.status_code == 200
    assert get_response.json()["provider"] == "gemini"

    save_response = test_client.post(
        "/settings/llm",
        json={
            "provider": "gemini",
            "api_key": "test-key",
            "model_name": "models/gemini-2.5-flash",
            "system_prompt": "Be calm and concrete.",
        },
    )
    assert save_response.status_code == 200
    payload = save_response.json()
    assert payload["api_key"] == "test-key"
    assert payload["model_name"] == "models/gemini-2.5-flash"


def test_onboarding_topics_create_pure_topic_starting_state(client):
    test_client, _ = client

    response = test_client.post(
        "/topics/onboarding",
        json={"focus_areas": ["guitar practice", "family plans", "weekend runs"]},
    )
    assert response.status_code == 201
    payload = response.json()
    assert len(payload) == 3
    assert payload[0]["title"] == "guitar practice"


def test_llm_models_and_test_endpoints_use_saved_settings(client, monkeypatch):
    test_client, _ = client

    test_client.post(
        "/settings/llm",
        json={
            "provider": "gemini",
            "api_key": "saved-key",
            "model_name": "models/gemini-test",
            "system_prompt": None,
        },
    )

    monkeypatch.setattr(
        "backend.app.api.routes.list_models",
        lambda api_key: [
            {
                "name": "models/gemini-test",
                "displayName": "Gemini Test",
                "description": "Test model",
                "supportedGenerationMethods": ["generateContent"],
            }
        ],
    )
    monkeypatch.setattr("backend.app.api.routes.test_connection", lambda api_key, model_name: "ok")

    models_response = test_client.get("/settings/llm/models")
    assert models_response.status_code == 200
    assert models_response.json()[0]["name"] == "models/gemini-test"

    test_response = test_client.post("/settings/llm/test", json={})
    assert test_response.status_code == 200
    assert test_response.json()["message"] == "ok"
