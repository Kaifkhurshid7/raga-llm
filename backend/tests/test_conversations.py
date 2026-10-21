"""Search, pagination, archive, feedback and public sharing."""
import pytest

from app.api.sessions import share_admin_limiter, shared_limiter


@pytest.fixture(autouse=True)
def _reset_limits():
    shared_limiter.reset()
    share_admin_limiter.reset()


def send(client, message, session_id=None):
    return client.post("/api/chat", json={"message": message, "session_id": session_id}).json()["session_id"]


# --- search -----------------------------------------------------------------------------------

def test_search_returns_a_snippet_only_for_content_matches(client, recorder):
    send(client, "Tell me about Bhairav")
    send(client, "Explain " + "word " * 40 + "Teentaal in depth")

    by_title = client.get("/api/sessions?q=bhairav").json()
    assert by_title[0]["snippet"] is None  # matched the title

    by_content = client.get("/api/sessions?q=TEENTAAL").json()  # case-insensitive
    assert len(by_content) == 1
    assert "Teentaal" in by_content[0]["snippet"]
    assert len(by_content[0]["snippet"]) < 200


def test_search_treats_wildcards_literally(client, recorder):
    send(client, "plain question")
    send(client, "100% pure")
    assert [s["title"] for s in client.get("/api/sessions?q=%25").json()] == ["100% pure"]
    assert client.get("/api/sessions?q=_").json() == []


def test_pagination(client, recorder):
    for i in range(5):
        send(client, f"question {i}")
    first = client.get("/api/sessions?limit=2").json()
    second = client.get("/api/sessions?limit=2&offset=2").json()
    third = client.get("/api/sessions?limit=2&offset=4").json()
    ids = [s["id"] for s in first + second + third]
    assert len(ids) == 5 and len(set(ids)) == 5
    assert client.get("/api/sessions?limit=0").status_code == 422
    assert client.get("/api/sessions?limit=101").status_code == 422


# --- archive ----------------------------------------------------------------------------------

def test_archive_hides_from_history_and_restore_brings_it_back_in_place(client, recorder):
    old = send(client, "older topic")
    new = send(client, "newer topic")
    before = client.get(f"/api/sessions/{old}").json()["updated_at"]

    r = client.patch(f"/api/sessions/{old}", json={"archived": True})
    assert r.status_code == 200 and r.json()["archived"] is True

    assert [s["id"] for s in client.get("/api/sessions").json()] == [new]
    archived = client.get("/api/sessions?archived=true").json()
    assert [s["id"] for s in archived] == [old]
    # Messages are preserved and the conversation is still readable.
    assert len(client.get(f"/api/sessions/{old}").json()["turns"]) == 1

    client.patch(f"/api/sessions/{old}", json={"archived": False})
    assert [s["id"] for s in client.get("/api/sessions").json()] == [new, old]
    assert client.get(f"/api/sessions/{old}").json()["updated_at"] == before


def test_archive_is_not_delete(client, recorder):
    sid = send(client, "keep me")
    client.patch(f"/api/sessions/{sid}", json={"archived": True})
    assert client.get(f"/api/sessions/{sid}").status_code == 200
    assert client.delete(f"/api/sessions/{sid}").status_code == 204
    assert client.get(f"/api/sessions/{sid}").status_code == 404


# --- feedback ---------------------------------------------------------------------------------

def test_feedback_is_stored_changed_and_cleared(client, recorder):
    sid = send(client, "rate me")
    turn_id = client.get(f"/api/sessions/{sid}").json()["turns"][0]["id"]
    url = f"/api/sessions/{sid}/turns/{turn_id}/feedback"

    assert client.put(url, json={"rating": "up"}).json() == {"turn_id": turn_id, "rating": "up"}
    assert client.get(f"/api/sessions/{sid}").json()["turns"][0]["feedback"] == "up"
    client.put(url, json={"rating": "down"})
    assert client.get(f"/api/sessions/{sid}").json()["turns"][0]["feedback"] == "down"
    client.put(url, json={"rating": None})
    assert client.get(f"/api/sessions/{sid}").json()["turns"][0]["feedback"] is None


def test_feedback_rejects_bad_ratings_and_wrong_session(client, recorder):
    a = send(client, "first")
    b = send(client, "second")
    turn_a = client.get(f"/api/sessions/{a}").json()["turns"][0]["id"]
    assert client.put(f"/api/sessions/{a}/turns/{turn_a}/feedback", json={"rating": "meh"}).status_code == 422
    # A turn id from another conversation must not be writable through this one.
    assert client.put(f"/api/sessions/{b}/turns/{turn_a}/feedback", json={"rating": "up"}).status_code == 404
    assert client.put(f"/api/sessions/{a}/turns/nope/feedback", json={"rating": "up"}).status_code == 404


# --- sharing ----------------------------------------------------------------------------------

def test_sharing_is_off_by_default_and_public_read_is_refused(client, recorder):
    sid = send(client, "private")
    assert client.get(f"/api/sessions/{sid}/share").json() == {"enabled": False, "token": None, "shared_at": None}
    assert client.get(f"/api/shared/{sid}").status_code == 404  # the session id is not a credential
    assert client.get("/api/shared/not-a-token").status_code == 404
    assert client.get("/api/sessions").json()[0]["shared"] is False


def test_share_lifecycle_enable_read_rotate_revoke(client, recorder):
    sid = send(client, "share me")
    state = client.post(f"/api/sessions/{sid}/share").json()
    token = state["token"]
    assert state["enabled"] and len(token) >= 32 and sid not in token
    assert client.post(f"/api/sessions/{sid}/share").json()["token"] == token  # idempotent

    r = client.get(f"/api/shared/{token}")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    assert "noindex" in r.headers["x-robots-tag"]
    body = r.json()
    assert body["title"] == "share me"
    assert body["turns"][0]["user_message"] == "share me"

    rotated = client.post(f"/api/sessions/{sid}/share", json={"rotate": True}).json()["token"]
    assert rotated != token
    assert client.get(f"/api/shared/{token}").status_code == 404
    assert client.get(f"/api/shared/{rotated}").status_code == 200

    assert client.delete(f"/api/sessions/{sid}/share").status_code == 204
    assert client.get(f"/api/shared/{rotated}").status_code == 404
    assert client.get(f"/api/sessions/{sid}/share").json()["enabled"] is False


def test_public_payload_leaks_no_internal_fields(client, recorder):
    sid = send(client, "inspect payload")
    token = client.post(f"/api/sessions/{sid}/share").json()["token"]
    turn_id = client.get(f"/api/sessions/{sid}").json()["turns"][0]["id"]
    client.put(f"/api/sessions/{sid}/turns/{turn_id}/feedback", json={"rating": "up"})

    raw = client.get(f"/api/shared/{token}").text
    for secret in (sid, turn_id, "test-model", "decoding", "baseline", "prompt_tokens", "feedback", "RAGA, an assistant"):
        assert secret not in raw
    assert set(client.get(f"/api/shared/{token}").json()["turns"][0]) == {
        "user_message", "model_response", "created_at"
    }


def test_summaries_never_expose_the_token(client, recorder):
    sid = send(client, "x")
    token = client.post(f"/api/sessions/{sid}/share").json()["token"]
    assert token not in client.get("/api/sessions").text
    assert token not in client.get(f"/api/sessions/{sid}").text
    assert client.get("/api/sessions").json()[0]["shared"] is True


def test_deleting_a_conversation_revokes_its_link(client, recorder):
    sid = send(client, "doomed")
    token = client.post(f"/api/sessions/{sid}/share").json()["token"]
    client.delete(f"/api/sessions/{sid}")
    assert client.get(f"/api/shared/{token}").status_code == 404


def test_share_endpoints_404_for_unknown_session(client):
    assert client.get("/api/sessions/nope/share").status_code == 404
    assert client.post("/api/sessions/nope/share").status_code == 404
    assert client.delete("/api/sessions/nope/share").status_code == 404


def test_public_endpoint_is_rate_limited(client, recorder):
    for _ in range(30):
        assert client.get("/api/shared/guess").status_code == 404
    assert client.get("/api/shared/guess").status_code == 429


def test_chat_returns_the_turn_id_so_a_new_answer_can_be_rated(client, recorder):
    r = client.post("/api/chat", json={"message": "hello"}).json()
    turns = client.get(f"/api/sessions/{r['session_id']}").json()["turns"]
    assert r["turn_id"] == turns[0]["id"]
    ok = client.put(f"/api/sessions/{r['session_id']}/turns/{r['turn_id']}/feedback", json={"rating": "up"})
    assert ok.status_code == 200


# --- creating a conversation before its first message ------------------------------------------

def test_empty_conversation_can_be_created_shared_and_stays_out_of_history(client, recorder):
    created = client.post("/api/sessions")
    assert created.status_code == 201
    sid = created.json()["id"]

    assert client.get("/api/sessions").json() == []  # no clutter in the sidebar
    token = client.post(f"/api/sessions/{sid}/share").json()["token"]
    assert client.get(f"/api/shared/{token}").json()["turns"] == []

    send(client, "first question", sid)
    assert [s["id"] for s in client.get("/api/sessions").json()] == [sid]
    assert len(client.get(f"/api/shared/{token}").json()["turns"]) == 1  # same link keeps working


def test_a_title_chosen_before_the_first_message_is_kept(client, recorder):
    sid = client.post("/api/sessions").json()["id"]
    client.patch(f"/api/sessions/{sid}", json={"title": "My Bhairav study"})
    send(client, "tell me something", sid)
    assert client.get(f"/api/sessions/{sid}").json()["title"] == "My Bhairav study"


def test_untitled_conversation_is_named_from_its_first_message(client, recorder):
    sid = client.post("/api/sessions").json()["id"]
    send(client, "What is the vadi of Yaman?", sid)
    assert client.get(f"/api/sessions/{sid}").json()["title"] == "What is the vadi of Yaman?"
