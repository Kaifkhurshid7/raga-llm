import httpx


def send(client, message, session_id=None, replace_from_turn=None):
    body = {"message": message, "session_id": session_id}
    if replace_from_turn is not None:
        body["replace_from_turn"] = replace_from_turn
    return client.post("/api/chat", json=body)


def turns(client, session_id):
    return client.get(f"/api/sessions/{session_id}").json()["turns"]


def test_new_conversation_gets_a_session_and_a_title(client, recorder):
    r = send(client, "What is the vadi of Raag Yaman today please")
    assert r.status_code == 200
    detail = client.get(f"/api/sessions/{r.json()['session_id']}").json()
    assert detail["title"] == "What is the vadi of Raag…"
    assert detail["turns"][0]["model_response"] == "answer to: What is the vadi of Raag Yaman today please"


def test_history_grows_with_each_turn(client, recorder):
    sid = send(client, "first").json()["session_id"]
    send(client, "second", sid)
    roles = [m["role"] for m in recorder.histories[-1]]
    assert roles == ["system", "user", "assistant"]


def test_blank_message_is_rejected(client, recorder):
    assert send(client, "   ").status_code == 422


def test_replace_from_turn_replaces_that_turn_and_everything_after(client, recorder):
    sid = send(client, "one").json()["session_id"]
    send(client, "two", sid)
    send(client, "three", sid)

    r = send(client, "two, edited", sid, replace_from_turn=1)

    assert r.status_code == 200
    assert [t["user_message"] for t in turns(client, sid)] == ["one", "two, edited"]
    # The model saw only the turn before the replaced one.
    assert [m["content"] for m in recorder.histories[-1][1:]] == ["one", "answer to: one"]


def test_replacing_the_first_turn_retitles_the_conversation(client, recorder):
    sid = send(client, "original topic").json()["session_id"]
    send(client, "replacement topic", sid, replace_from_turn=0)
    assert client.get(f"/api/sessions/{sid}").json()["title"] == "replacement topic"


def test_replace_from_turn_beyond_the_end_is_rejected(client, recorder):
    sid = send(client, "one").json()["session_id"]
    r = send(client, "x", sid, replace_from_turn=5)
    assert r.status_code == 422
    assert len(turns(client, sid)) == 1


def test_failed_replacement_leaves_the_conversation_untouched(client, recorder, use_failing_client):
    sid = send(client, "one").json()["session_id"]
    send(client, "two", sid)

    use_failing_client(httpx.ConnectError("refused"))
    r = send(client, "two, edited", sid, replace_from_turn=1)

    assert r.status_code == 502
    assert [t["user_message"] for t in turns(client, sid)] == ["one", "two"]


def test_inference_timeout_maps_to_504(client, use_failing_client):
    use_failing_client(httpx.ReadTimeout("slow"))
    r = send(client, "hello")
    assert r.status_code == 504
    assert r.json()["detail"] == "Inference service timed out."


def test_inference_unavailable_maps_to_502(client, use_failing_client):
    use_failing_client(httpx.ConnectError("refused"))
    r = send(client, "hello")
    assert r.status_code == 502
    assert r.json()["detail"] == "Inference service unavailable."


def test_malformed_inference_response_maps_to_502(client, use_failing_client):
    use_failing_client(KeyError("text"))
    r = send(client, "hello")
    assert r.status_code == 502
    assert "unexpected response" in r.json()["detail"]
