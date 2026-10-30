# Changelog

All notable changes to the **KubekOS** project are documented in this file.

## [1.0.0] - 2026-10-30

### Added
- **Kernel Core**: Staged boot sequence, `KernelEventBus`, `KernelLogger`, and `KernelServiceRegistry`.
- **Desktop Environment**: Draggable desktop icon grid, right-click context menus, desktop telemetry widgets, Start menu with category filtering, taskbar, and `Ctrl + K` global Command Palette.
- **Window Manager**: Multi-window creation, dragging, edge snapping, 8-way resizing, minimize/maximize/restore, Snap Layouts menu, and `Alt + Tab` switcher.
- **Virtual Filesystem (VFS)**: IndexedDB persistence via Dexie.js with full `/KubekOS` directory hierarchy, CRUD operations, copy/move, Trash recovery, full-text search, and JSON import/export.
- **14 Built-in Applications**: File Explorer, Terminal, Code Studio, Notes, Calculator, Settings, Web Browser, Media Player, Calendar, System Monitor, Task Manager, Image Viewer, App Center, and About KubekOS.
- **Plugin System**: `ControlledPluginApi` with explicit permission enforcement and installable verified plugins (`Focus Timer Pro`, `JSON Inspector & Validator`).
