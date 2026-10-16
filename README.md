# CaptionCraft AI — 100% Free AI Automatic Video Captioning

> **Turn Any Video Into a Captioned Video.**  
> Generate AI-powered English and Hinglish captions, customize subtitle styles with real-time preview, and export MP4 videos with permanently embedded subtitles — 100% locally and free on Windows 11.

---

## ⚡ Key Highlights

- **Strictly Two Output Languages**: **English** and **Romanized Hinglish** ONLY. No other languages or foreign scripts.
- **Local AI Speech Recognition**: Runs locally using **Faster-Whisper (CTranslate2)** on CPU or optional GPU.
- **Zero Paid Subscriptions or APIs**: No OpenAI API key required, no cloud transcription fees, no watermarks.
- **Permanent Subtitle Embedding**: Uses FFmpeg and libass to burn styled captions permanently into the MP4 video stream.
- **Real-time Video Player**: Interactive HTML5 player with word-by-word karaoke highlighting, seek synchronization, and subtitle preview.
- **Full Caption Timeline Editor**: Edit segment timestamps, modify text, split captions, merge adjacent rows, search, and undo/redo.
- **Multiple Export Options**:
  - Permanently captioned MP4 video (customizable quality and resolution).
  - Standalone **SRT** (SubRip Subtitles).
  - Standalone **WebVTT** (.vtt).
  - Plain Text Transcript (.txt, with or without timestamps).
- **Local Project Management**: Built-in SQLite database stores projects, timestamps, and caption edits with no login or cloud account required.
- **One-Click Windows 11 Scripts**: Automated setup, dependency check, startup, and clean shutdown batch scripts.

---

## 🌐 Strict Language Requirements & Behavior

CaptionCraft AI is specifically engineered with a strict two-language allowlist:

| Language Option | Behavior & Pipeline | Examples |
|---|---|---|
| **English** | Recognizes speech and outputs clear, grammatically sound English captions with natural punctuation and exact timestamps. | Spoken: *"Hello everyone, welcome to my channel. Today we are going to create something amazing."*<br>Caption: **"Hello everyone, welcome to my channel. Today we are going to create something amazing."** |
| **Hinglish** | Recognizes Hindi, English, and mixed speech. Converts Devanagari Hindi into **natural Romanized Hindi (English letters)** while preserving authentic English loanwords (e.g. *video*, *game*, *AI*, *editing*, *download*, *subscribe*). **Zero Devanagari output in final captions.** | Spoken: *"नमस्ते दोस्तों, आज हम एक नई वीडियो बनाने वाले हैं।"*<br>Caption: **"Namaste dosto, aaj hum ek nayi video banane wale hain."**<br><br>Spoken: *"आज हम एक नया गेम बनाएंगे और उसमें AI फीचर ऐड करेंगे।"*<br>Caption: **"Aaj hum ek naya game banayenge aur usmein AI feature add karenge."** |

---

## 🛠 System Requirements

- **Operating System**: Windows 11 (64-bit) or Windows 10
- **Python**: Version 3.10, 3.11, or 3.12 (Python 3.11.17 tested and verified)
- **Node.js**: v18.0.0 or newer (Node v24.20.0 and npm 11.19.0 verified)
- **FFmpeg & FFprobe**: Required for media inspection and permanent subtitle burning. (FFmpeg 6.1.1 with libass verified)
- **Memory (RAM)**: 4 GB minimum (8 GB recommended for `base` and `small` Whisper models)
- **Disk Space**: ~1 GB for virtual environment, npm packages, and model weights

---

## 🚀 One-Click Windows 11 Setup

Four batch scripts are provided in the `scripts/` directory for zero-friction management:

### 1. Verify Dependencies
Run `scripts\check_dependencies.bat` to test your system environment:
```cmd
scripts\check_dependencies.bat
```
This checks Python, Node.js, npm, FFmpeg, and FFprobe, displaying instructions if anything is missing.

### 2. Complete Setup
Run `scripts\setup_windows.bat` to initialize the project:
```cmd
scripts\setup_windows.bat
```
This script automatically:
1. Verifies Python, Node.js, and npm.
2. Creates the Python virtual environment (`backend\.venv`).
3. Installs backend dependencies (`fastapi`, `uvicorn`, `faster-whisper`, `av`, etc.).
4. Installs frontend dependencies via npm (`lucide-react`, `tailwindcss`, `vite`).
5. Creates storage directories (`media/uploads`, `media/outputs`, `media/temporary`).

### 3. Launch the Application
Run `scripts\start_windows.bat`:
```cmd
scripts\start_windows.bat
```
This starts:
- **Backend API**: `http://127.0.0.1:8000` (FastAPI + Uvicorn)
- **Frontend Studio**: `http://localhost:5173` (Vite + React)
- Automatically opens your default web browser to the application!

### 4. Stop the Application
Run `scripts\stop_windows.bat` to cleanly terminate background processes on ports 8000 and 5173 without affecting unrelated apps:
```cmd
scripts\stop_windows.bat
```

---

## 🔍 Evaluation: "Markdown Video Audio" Tool

The user requested an evaluation of the "Markdown Video Audio" tool capabilities:
- **What it is**: Tools in the "Markdown Video Audio" ecosystem (such as Microsoft's *MarkItDown* or audio/video markdown converters) convert multimedia assets into static markdown summaries or notes.
- **Suitability for Video Captioning**: While markdown tools are great for document parsing and document-level transcripts, they lack:
  1. Sub-second and word-level millisecond timestamps required for synchronized subtitle display.
  2. Subtitle formatting standards (ASS, SRT, WebVTT).
  3. Video rendering filters needed to permanently burn styled captions into MP4 frames.
- **CaptionCraft AI Architecture**: CaptionCraft AI pairs **Faster-Whisper** (which provides exact millisecond timestamps and word-level alignment) with a custom **Hinglish Transliteration Engine** and **FFmpeg libass** rendering. However, CaptionCraft AI includes plain-text and timestamped markdown/text export (`/api/captions/{id}/export-txt`) to allow full interoperability with markdown document workflows!

---

## 🎨 The Five Premium Caption Styles

CaptionCraft AI includes **exactly five premium caption styles** engineered for modern video content:

1. **Ultra Clear** *(Default)*: Bold white text with a strong 3.5px black outline and subtle shadow. Provides maximum contrast and crisp readability against any video background.
2. **Word-by-Word Highlight**: Modern karaoke-style pacing. The currently spoken word illuminates in vibrant gold/yellow while maintaining context and readability of surrounding words.
3. **Neon Glow**: Modern aesthetic featuring clear, readable typography with a controlled electric cyan ambient glow aura.
4. **Cinematic**: Elegant warm ivory typography with widescreen letterboxed spacing, fine outline, and subtle drop shadows for high-end cinematic videos and documentaries.
5. **Dynamic Pop**: High-energy social media style featuring bouncy pop-in micro-animations, rounded background cards, and hot neon coral/pink accents tailored for Reels, TikTok, and YouTube Shorts.

*Note: All legacy style selections automatically fall back to **Ultra Clear** safely without errors.*

---

## 🧪 Automated Testing

CaptionCraft AI includes a comprehensive automated test suite in `tests/test_backend.py`.

To run the test suite:
```cmd
powershell -Command "$env:PYTHONPATH='backend'; .\backend\.venv\Scripts\python.exe -m pytest tests\test_backend.py -v"
```

### Verified Test Cases (24/24 Passing):
- `test_language_allowlist_valid`: Validates `en`, `english`, `hinglish`.
- `test_language_allowlist_rejects_unauthorized_languages`: Confirms rejection of third languages (Hindi script, Spanish, French, Arabic, etc.).
- `test_hinglish_sentence_1`: Tests *"नमस्ते दोस्तों, आज हम एक नई वीडियो बनाने वाले हैं।"* -> *"Namaste dosto, aaj hum ek nayi video banane wale hain."*
- `test_hinglish_sentence_2`: Tests *"आज हम एक नया गेम बनाएंगे और उसमें AI फीचर ऐड करेंगे।"* -> *"Aaj hum ek naya game banayenge aur usmein AI feature add karenge."*
- `test_hinglish_preserves_english_loanwords`: Confirms tech loanwords (video, game, download, AI, etc.) are kept in English.
- `test_hinglish_handles_pure_english`: Tests that English sentences remain intact.
- `test_caption_segment_validation`: Rejects negative timestamps and end timestamps before start timestamps.
- `test_generate_srt`, `test_generate_vtt`, `test_generate_txt`, `test_generate_ass`: Verifies exact timestamp formatting and subtitle scripts.
- `test_five_premium_caption_styles`: Verifies that Ultra Clear, Word-by-Word Highlight, Neon Glow, Cinematic, and Dynamic Pop all generate valid subtitle streams.
- `test_obsolete_style_fallback`: Confirms safe fallback to Ultra Clear for legacy styles.
- `test_project_crud`: Tests full SQLite database lifecycle (create, fetch, update, delete).
- `test_endpoint_health`, `test_endpoint_settings`, `test_endpoint_export_subtitles`: Validates REST API responses.
- `test_endpoint_binary_status`: Verifies FFmpeg and PyAV detection.

---

## 📁 Project Architecture

```
captioncraft-ai/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py          # FastAPI REST endpoints & background tasks
│   │   ├── services/
│   │   │   ├── transcription.py    # Faster-Whisper speech recognition & caching
│   │   │   ├── hinglish.py         # Romanized Hindi & loanword transliteration
│   │   │   └── video_processor.py  # FFmpeg, PyAV, ASS generator, & MP4 rendering
│   │   ├── schemas/
│   │   │   └── schemas.py          # Pydantic validation & strict language allowlist
│   │   ├── database.py             # SQLite project persistence
│   │   └── main.py                 # FastAPI server entrypoint
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx          # Responsive navigation & system status
│   │   │   ├── HeroSection.tsx     # Landing page with two-language presentation
│   │   │   ├── VideoUploader.tsx   # Drag-and-drop video upload & validation
│   │   │   ├── LanguageSelector.tsx# Strictly English & Hinglish selector
│   │   │   ├── VideoPlayer.tsx     # HTML5 player with live subtitle overlay & karaoke
│   │   │   ├── CaptionEditor.tsx   # Timeline editor with undo/redo & split/merge
│   │   │   ├── CaptionStylePanel.tsx # Font, color, outline, background customizer
│   │   │   ├── CaptionStylesView.tsx # Style preset showroom
│   │   │   ├── ExportModal.tsx     # Permanent MP4 render & download modal
│   │   │   ├── ProjectsView.tsx    # Saved projects gallery
│   │   │   ├── SettingsView.tsx    # System diagnostics & config
│   │   │   └── HelpView.tsx        # User manual & FAQ
│   │   ├── services/
│   │   │   └── api.ts              # Frontend API client
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript interfaces
│   │   ├── App.tsx                 # Master studio layout & state coordinator
│   │   ├── main.tsx                # React 18 mount point
│   │   └── index.css               # Design system & glassmorphism utilities
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── media/
│   ├── uploads/                    # Staged source videos
│   ├── outputs/                    # Exported captioned MP4 videos
│   └── temporary/                  # Audio extraction & ASS files
│
├── scripts/
│   ├── setup_windows.bat           # Automated environment setup
│   ├── start_windows.bat           # Launch backend, frontend, & open browser
│   ├── stop_windows.bat            # Safe process termination
│   └── check_dependencies.bat      # System dependency diagnostics
│
├── tests/
│   └── test_backend.py             # Pytest automated test suite
│
├── .gitignore
└── README.md
```

---

## 🔒 Privacy & Offline Assurance

- All audio extraction, transcription, and video rendering happen **locally on your Windows machine**.
- No audio or video data is ever transmitted to external cloud servers.
- After the initial package and model download, the entire application operates **completely offline**.

---

## 📄 License

CaptionCraft AI is built exclusively with free, open-source technologies under permissible open-source licenses (MIT, Apache 2.0, LGPL/GPL for FFmpeg).
