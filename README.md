http://localhost:5173/# KubekOS

**KubekOS** is a modular, browser-based operating system simulation engineered with a dark-first glassmorphic desktop interface, a multi-window compositor, an IndexedDB-backed Virtual Filesystem (`/KubekOS`), and a permission-isolated plugin runtime.

> **Important Note:** KubekOS is a web-based http://localhost:5173/operating system simulation running inside a browser sandbox, not a hardware operating system kernel.

---

## Key Features & Architecture

KubekOS is architected into **8 decoupled core subsystems**:

1. **Kernel Core (`src/kernel/`)**
   - Real-time staged boot sequence (`SystemBootPhase`), service lifecycle registry (`KernelServiceRegistry`), type-safe publish-subscribe event bus (`KernelEventBus`), and a ring-buffer diagnostic logger (`KernelLogger`).
2. **Desktop Environment (`src/desktop/`)**
   - Draggable desktop shortcut grid, right-click context menus, Start menu with category filtering and search, desktop telemetry widgets, taskbar with running/focused window indicators, and a global **Command Palette (`Ctrl + K`)**.
3. **Window Manager (`src/wm/`)**
   - Multi-window stacking (`z-index`), focus management, titlebar dragging with edge-snap detection, 8-way resizing, minimize/maximize/restore, **Snap Layouts** (halves, quadrants, full screen), and **`Alt + Tab`** window switching.
4. **Virtual Filesystem (`src/vfs/`)**
   - Persistent hierarchical storage powered by **Dexie.js (IndexedDB)** mounted at `/KubekOS` (`Desktop`, `Documents/Projects`, `Documents/Notes`, `Downloads`, `Pictures`, `Music`, `Applications`, `System`).
   - Supports file/folder creation, reading, editing, renaming, copy/paste, cut/move, Trash & recovery, full-text search, and JSON subtree import/export.
5. **Application Runtime & 14 Built-in Applications (`src/apps/`)**
   - **File Explorer**: Full VFS file manager with Trash and import/export.
   - **Terminal**: Interactive shell (`help`, `ls`, `cd`, `pwd`, `mkdir`, `touch`, `write`, `cat`, `rm`, `whoami`, `uname`, `uptime`, `apps`, `open`, `clear`) and custom command registration.
   - **Code Studio**: Multi-tab code editor with line numbers, language detection, dirty indicators, and direct VFS saving.
   - **Notes**: Markdown note-taking studio with instant VFS auto-save and search.
   - **Calculator**: Safe arithmetic parser (zero `eval()`) with keyboard support and history tape.
   - **Settings**: Personalization, theme mode (`dark`/`light`), 7 accent colors, 6 wallpapers, audio mixer, user profile editor, VFS storage metrics, and privacy overview.
   - **Web Browser**: Multi-tab sandboxed browser with bookmarks, history navigation, and safe external link handling.
   - **Media Player**: Web Audio API harmonic ambient synthesizer and local audio file importer (`.mp3`, `.wav`, `.ogg`).
   - **Calendar**: Monthly planner with persistent IndexedDB event scheduling.
   - **System Monitor**: Live VFS storage metrics, running window count, session uptime, and real-time kernel log stream.
   - **Task Manager**: Active window/process inspector and task terminator.
   - **Image Viewer**: Vector/raster previewer with zoom controls.
   - **App Center (App Store)**: Manage built-in apps and install/uninstall verified sandboxed plugins.
   - **About KubekOS**: System specifications and security overview.
6. **User System (`src/kernel/kernelStore.ts`)**
   - Local user profiles (`Kubek Architect` & `Guest Workspace`), login screen, session lock screen, and customizable profile attributes.
7. **Notification Center & Quick Settings (`src/notifications/`)**
   - Slide-out drawer with quick toggles (Theme, Focus Mode / Do Not Disturb, Audio, Desktop Widgets, Volume slider) and notification history.
8. **Sandboxed Plugin System (`src/plugins/`)**
   - Manifest-driven third-party plugin architecture enforcing explicit permission checks (`vfs.read`, `vfs.write`, `vfs.system`, `notifications.send`, `system.metrics`) via `ControlledPluginApi`.

---

## Technology Stack

- **Framework:** React 19 + TypeScript 5.7 (`strict` mode)
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand 5
- **Animations:** Framer Motion 12
- **Persistence:** Dexie.js 4 (IndexedDB)
- **Icons:** Lucide React
- **Testing:** Vitest 3 + React Testing Library + Playwright

---

## Installation & Development Instructions

### Prerequisites
- **Node.js** `>= 20.x`
- **npm** `>= 10.x`

### 1. Clone & Install Dependencies
```bash
git clone <your-repository-url>
cd KubekOS
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Type-Checking & Unit Tests
```bash
npm run lint
npm test
```

### 4. End-to-End (E2E) Tests
```bash
npm run build
npm run test:e2e
```

---

## Production Build & GitHub Pages Deployment

KubekOS is pre-configured with relative asset paths (`base: process.env.VITE_BASE_PATH || './'`) in `vite.config.ts` so it can be deployed directly to **GitHub Pages** at either a root domain or a repository subpath (e.g., `https://<username>.github.io/KubekOS/`).

```bash
# Standard production build (outputs to ./dist)
npm run build

# Or specify an explicit repository base path:
VITE_BASE_PATH=/KubekOS/ npm run build

# Preview production build locally:
npm run preview
```

---

## License

Released under the [MIT License](./LICENSE).
