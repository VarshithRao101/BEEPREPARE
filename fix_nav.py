import os
import re

def get_standard_sidebar(active_marker=""):
    # Generate the standard sidebar with optionally an "active" class on the correct link
    return f"""            <nav class="sidebar-nav">
                <a href="teacher-home.html" class="sidebar-link{' active' if active_marker == 'teacher-home.html' else ''}">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
                    <span>Dashboard</span>
                </a>
                <a href="question-bank.html" class="sidebar-link{' active' if active_marker == 'question-bank.html' else ''}">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z" /></svg>
                    <span>Bank Inventory</span>
                </a>
                <a href="generate-paper.html" class="sidebar-link{' active' if active_marker == 'generate-paper.html' else ''}">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
                    <span>Generate Paper</span>
                </a>
                <a href="../ai-chat.html" class="sidebar-link{' active' if active_marker == '../ai-chat.html' else ''}">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-13.04 8.5 8.5 0 0 1 8.5 8.54c0 .24 0 .44-.05.7zM17.5 11a5.5 5.5 0 1 0-11 0 5.5 5.5 0 0 0 11 0z" /></svg>
                    <span>BEE AI Assistant</span>
                </a>
                <a href="teacher-profile.html" class="sidebar-link{' active' if active_marker == 'teacher-profile.html' else ''}">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                    <span>My Profile</span>
                </a>
            </nav>"""

def get_standard_bottom(active_marker=""):
    if not active_marker:
        pass
    return f"""    <nav class="nav-bottom">
        <a href="teacher-home.html" class="nav-item{' active' if active_marker == 'teacher-home.html' else ''}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
            <span>Home</span>
        </a>
        <a href="question-bank.html" class="nav-item{' active' if active_marker == 'question-bank.html' else ''}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z" /></svg>
            <span>Bank</span>
        </a>
        <a href="generate-paper.html" class="nav-item{' active' if active_marker == 'generate-paper.html' else ''}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
            <span>Paper</span>
        </a>
        <a href="../ai-chat.html" class="nav-item{' active' if active_marker == '../ai-chat.html' else ''}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-13.04 8.5 8.5 0 0 1 8.5 8.54c0 .24 0 .44-.05.7zM17.5 11a5.5 5.5 0 1 0-11 0 5.5 5.5 0 0 0 11 0z" /></svg>
            <span>AI</span>
        </a>
        <a href="teacher-profile.html" class="nav-item{' active' if active_marker == 'teacher-profile.html' else ''}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
            <span>Profile</span>
        </a>
    </nav>"""

dir_path = "beginners/teacher/"
for fn in os.listdir(dir_path):
    if not fn.endswith(".html"): continue
    
    filepath = os.path.join(dir_path, fn)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # regex to find nav blocks and determine active link
    sidebar_pattern = re.compile(r"([ \t]*)<nav class=\"sidebar-nav\">.*?</nav>", re.DOTALL)
    bottom_pattern = re.compile(r"([ \t]*)<nav class=\"nav-bottom\">.*?</nav>", re.DOTALL)

    sb_match = sidebar_pattern.search(content)
    bm_match = bottom_pattern.search(content)
    
    active_marker = ""
    # find which href had "active"
    if sb_match:
        active_link = re.search(r'href="(.*?)"[^>]*?class="[^"]*active[^"]*"', sb_match.group(0))
        if active_link:
            active_marker = active_link.group(1)

    if sb_match:
        replacement = get_standard_sidebar(active_marker)
        content = sidebar_pattern.sub(replacement, content, count=1)
    
    if bm_match:
        replacement = get_standard_bottom(active_marker)
        content = bottom_pattern.sub(replacement, content, count=1)

    with open(filepath, "w", encoding="utf-8", newline='\\n') as f:
        f.write(content)

print("Nav standardisation complete.")
