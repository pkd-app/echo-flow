# EchoFlow

**Your frictionless AI Voice Companion for Desktop.**

EchoFlow bridges the gap between your thoughts and your digital workspace. It allows you to capture, transcribe, and process voice notes instantly using advanced AI, and magically paste the results into any application.

## 1. Problem Description (Das Problem)
Capturing fleeting thoughts or summarizing meetings often creates friction. Switching context to a web-based AI tool, typing out prompts, and copying usage results breaks flow.
**EchoFlow** solves this by living in your system tray. A single global hotkey opens a recording interface. Your voice is instantly transcribed, processed by AI (e.g., cleaned up, summarized as meeting notes), and typed directly into your active window (Slack, Notion, VS Code) via "Magic Paste".

## 2. Architecture Overview (Architektur)
EchoFlow is built on a modern, high-performance stack:

- **Frontend**: 
  - **Next.js 16**: React framework for a responsive, component-based UI.
  - **Tailwind CSS**: Utility-first styling for a sleek, dark-mode "Raycast-like" aesthetic.
  - **Framer Motion**: For fluid animations and transitions.

- **Desktop Shell**:
  - **Tauri v2 (Rust)**: Provides a lightweight, secure container. It handles system-level integrations that web apps can't reach:
    - **Global Hotkeys**: (`Alt+Shift+S` to toggle, `Alt+Shift+R` to record).
    - **System Tray**: Keeps the app running in the background.
    - **Magic Paste**: Uses `Enigo` (Rust crate) to simulate keystrokes, injecting text into any active window.
    - **Window Management**: Custom frameless window with drag support.

- **AI Backend**:
  - **Groq API**: 
    - **STT**: `whisper-large-v3` for lightning-fast transcription.
    - **LLM**: `llama-3.3-70b-versatile` for intelligent text processing.
  - **Client-Side Logic**: API keys are stored in `localStorage`. No intermediate backend server is required, ensuring data stays private and latency remains minimal.

## 3. Setup Instructions (Anleitung)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust & Cargo](https://www.rust-lang.org/tools/install)
- [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (required for Tauri on Windows)

### Installation

**Option A: Pre-built Installer (Windows)**
If you are looking for the ready-to-use application, navigate to:
`src-tauri/target/release/bundle/nsis/echoflow_0.1.0_x64-setup.exe`
Double-click this file to install EchoFlow on your machine.

**Option B: Build from Source**
1. **Clone the repository:**
   ```bash
   git clone https://github.com/pkd-app/echo-flow.git
   cd echo-flow
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in Development Mode:**
   ```bash
   npm run tauri dev
   ```
   *The app will launch. Use `Alt+Shift+S` to bring it to front.*

4. **Build for Production (.exe):**
   ```bash
   npm run tauri build
   ```
   *The installer will be generated in `src-tauri/target/release/bundle/nsis/`.*

## 5. Configuration (API Key)

## 5. Configuration (API Key) (WICHTIG / IMPORTANT)

**EchoFlow requires a valid Groq API Key to function.**

### Method: Get your own FREE Key (Recommended)
To ensure reliable, unlimited access, we recommend generating your own key (it takes 30 seconds and is currently free).

1.  Go to [console.groq.com/keys](https://console.groq.com/keys) and log in.
2.  Click **"Create API Key"**.
3.  Copy the key (starts with `gsk_...`).
4.  Open **EchoFlow** -> **Settings (Gear Icon)**.
5.  Paste your key and save.

## 4. Design Decisions (Design-Entscheidungen)

- **Speed is a Feature**: We chose **Groq** over OpenAI because the LPU (Language Processing Unit) inference speed allows for a near-instant "Voice-to-Text" experience. The latency is low enough to feel like a native OS feature.
- **Toggle-First UX**: The app mimics tools like Spotlight or Raycast. It is not meant to be a permanent window taking up screen space, but a utility that appears, executes, and disappears.
- **Magic Paste**: Standard clipboard operations (`Ctrl+V`) require user action. By simulating keystrokes at the OS level, EchoFlow can "type" for you, allowing for a hands-free workflow (e.g., dictating code while leaning back).
- **Manual "Close" vs. "Hide"**: We explicitly separated the "Hide" (`-`) and "Quit" (`X`) actions to prevent accidental termination. The app is designed to stay resident in the System Tray.

---
*Built with ❤️ by Antigravity*
