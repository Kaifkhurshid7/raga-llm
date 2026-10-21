def send(client, message, session_id=None):
    return client.post("/api/chat", json={"message": message, "session_id": session_id}).json()["session_id"]


def test_health_reports_status(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_list_is_empty_before_any_conversation(client):
    assert client.get("/api/sessions").json() == []


def test_list_is_newest_activity_first(client, recorder):
    first = send(client, "older topic")
    second = send(client, "newer topic")
    send(client, "follow up", first)  # touches the first conversation again

    ids = [s["id"] for s in client.get("/api/sessions").json()]
    assert ids == [first, second]


def test_search_matches_titles_and_message_content(client, recorder):
    send(client, "Tell me about Bhairav")
    send(client, "Explain taal Teentaal")

    assert [s["title"] for s in client.get("/api/sessions?q=teentaal").json()] == ["Explain taal Teentaal"]
    # The mock reply echoes the question, so reply text is searchable too.
    assert len(client.get("/api/sessions?q=bhairav").json()) == 1
    assert client.get("/api/sessions?q=nothing-matches").json() == []


def test_rename(client, recorder):
    sid = send(client, "a question")
    r = client.patch(f"/api/sessions/{sid}", json={"title": "  Better title  "})
    assert r.status_code == 200
    assert r.json()["title"] == "Better title"


def test_rename_rejects_blank_titles(client, recorder):
    sid = send(client, "a question")
    assert client.patch(f"/api/sessions/{sid}", json={"title": "   "}).status_code == 422


def test_delete_removes_the_conversation_and_its_turns(client, recorder):
    sid = send(client, "a question")
    assert client.delete(f"/api/sessions/{sid}").status_code == 204
    assert client.get(f"/api/sessions/{sid}").status_code == 404
    assert client.get("/api/sessions").json() == []


def test_unknown_session_returns_404(client):
    assert client.get("/api/sessions/nope").status_code == 404
    assert client.patch("/api/sessions/nope", json={"title": "x"}).status_code == 404
    assert client.delete("/api/sessions/nope").status_code == 404


def test_pinned_conversations_are_listed_first_and_keep_their_place(client, recorder):
    older = send(client, "older topic")
    newer = send(client, "newer topic")
    assert [s["id"] for s in client.get("/api/sessions").json()] == [newer, older]

    r = client.patch(f"/api/sessions/{older}", json={"pinned": True})
    assert r.status_code == 200
    assert r.json()["pinned"] is True
    assert [s["id"] for s in client.get("/api/sessions").json()] == [older, newer]

    send(client, "more activity", newer)  # newer is still below the pinned one
    assert [s["id"] for s in client.get("/api/sessions").json()] == [older, newer]

    client.patch(f"/api/sessions/{older}", json={"pinned": False})
    assert [s["id"] for s in client.get("/api/sessions").json()] == [newer, older]


def test_pinning_does_not_change_activity_time_or_title(client, recorder):
    sid = send(client, "a question")
    before = client.get(f"/api/sessions/{sid}").json()
    after = client.patch(f"/api/sessions/{sid}", json={"pinned": True}).json()
    assert after["updated_at"] == before["updated_at"]
    assert after["title"] == before["title"]


def test_title_and_pin_can_be_changed_together(client, recorder):
    sid = send(client, "a question")
    r = client.patch(f"/api/sessions/{sid}", json={"title": "Renamed", "pinned": True}).json()
    assert (r["title"], r["pinned"]) == ("Renamed", True)


def test_update_needs_at_least_one_field(client, recorder):
    sid = send(client, "a question")
    assert client.patch(f"/api/sessions/{sid}", json={}).status_code == 422


def test_new_conversations_are_not_pinned(client, recorder):
    send(client, "a question")
    assert client.get("/api/sessions").json()[0]["pinned"] is False
