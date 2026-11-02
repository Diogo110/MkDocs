import math
import re

WORDS_PER_MINUTE = 200
MIN_WORDS = 200

CODE_BLOCK = re.compile(r"```.*?```", re.DOTALL)
HTML_TAG = re.compile(r"<[^>]+>")
ATTR_LIST = re.compile(r"\{[^}]*\}")
IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")


def count_words(markdown):
    text = CODE_BLOCK.sub(" ", markdown)
    text = IMAGE.sub(" ", text)
    text = HTML_TAG.sub(" ", text)
    text = ATTR_LIST.sub(" ", text)
    return len(re.findall(r"\w+", text))


def on_page_markdown(markdown, page, config, files):
    if page.meta.get("reading_time") is False:
        return markdown

    words = count_words(markdown)
    if words < MIN_WORDS:
        return markdown

    minutes = max(1, math.ceil(words / WORDS_PER_MINUTE))
    badge = (
        '<p class="reading-time" style="opacity: 0.7; font-size: 0.8rem; margin-top: -0.6rem;">'
        f"⏱ {minutes} min read</p>"
    )

    lines = markdown.splitlines()
    for i, line in enumerate(lines):
        if line.startswith("# "):
            lines.insert(i + 1, "")
            lines.insert(i + 2, badge)
            return "\n".join(lines)

    return badge + "\n\n" + markdown
