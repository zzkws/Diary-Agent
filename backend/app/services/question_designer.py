from ..models.agent_setting import AgentSetting
from ..models.topic import Topic
from .gemini_client import GeminiClientError, extract_text, generate_content, has_valid_llm_settings


def design_topic_question(topic: Topic, revival: bool = False) -> str:
    title = topic.title.strip()
    if topic.source_question:
        base = topic.source_question.strip().rstrip("?")
        if revival:
            return f"It's been a little while since we checked in on {title}. {base} today?"
        return f"For {title}, {base[:1].lower()}{base[1:]} today?"

    if revival:
        return f"It's been a little while since we checked in on {title}. What's the latest there today?"

    return f"How is {title} going today?"


def design_follow_up_question(topic: Topic) -> str:
    return f"Anything a little more specific you want me to keep about {topic.title}?"


def design_topic_question_with_llm(topic: Topic, setting: AgentSetting | None, revival: bool = False) -> str:
    fallback = design_topic_question(topic, revival=revival)
    if not has_valid_llm_settings(setting):
        return fallback

    prompt = (
        "Rewrite this diary topic check-in prompt in a caring, natural, concrete tone. "
        "Keep it short, not therapy-like, not coaching, not reflective. "
        f"Topic title: {topic.title}\n"
        f"Existing question: {topic.source_question or fallback}\n"
        f"Revival topic: {'yes' if revival else 'no'}\n"
        "Return only the rewritten question."
    )
    try:
        payload = generate_content(
            setting.api_key,
            setting.model_name,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            system_instruction=setting.system_prompt or "You are a calm local-first diary agent.",
        )
        text = extract_text(payload).strip()
        return text or fallback
    except GeminiClientError:
        return fallback
