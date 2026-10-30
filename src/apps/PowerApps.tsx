/**
 * KubekOS Power-User Application Suite
 * 1. Kanban Workspace (Agile Board saved to VFS)
 * 2. Pixel Canvas Studio (Paint & Drawing Studio with PNG export to VFS)
 * 3. REST API Studio (Live HTTP Request Tester with response timing)
 * 4. Dev Toolbox (Regex, Base64/URL, UUID, SHA-256)
 * 5. CyberSnake Arcade (High-FPS neon arcade game)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Check,
  Copy,
  Download,
  Eraser,
  Gamepad2,
  Kanban,
  Palette,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { useVfsStore } from '@/vfs/vfsStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { useNotificationStore } from '@/notifications/notificationStore';
import { ACCENT_COLORS } from '@/theme/tokens';

// ============================================================================
// 1. KANBAN WORKSPACE APPLICATION
// ============================================================================

type KanbanColumnId = 'BACKLOG' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

interface KanbanCard {
  id: string;
  title: string;
  tag: string;
  column: KanbanColumnId;
}

const KANBAN_VFS_PATH = '/KubekOS/Documents/Projects/kanban_board.json';

const INITIAL_KANBAN_CARDS: KanbanCard[] = [
  { id: 'k1', title: 'Design Obsidian Aurora Glass Compositor', tag: 'UI/UX', column: 'DONE' },
  { id: 'k2', title: 'Integrate Live Web Search in Browser', tag: 'CORE', column: 'IN_PROGRESS' },
  { id: 'k3', title: 'Build REST API Client & Dev Toolbox', tag: 'DEV', column: 'REVIEW' },
  { id: 'k4', title: 'Write Custom Sandboxed Plugins', tag: 'PLUGIN', column: 'BACKLOG' },
];

export const KanbanApp: React.FC = () => {
  const getNode = useVfsStore((s) => s.getNode);
  const writeFile = useVfsStore((s) => s.writeFile);
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const [cards, setCards] = useState<KanbanCard[]>(() => {
    const existing = getNode(KANBAN_VFS_PATH);
    if (existing?.content) {
      try {
        return JSON.parse(existing.content) as KanbanCard[];
      } catch {
        return INITIAL_KANBAN_CARDS;
      }
    }
    return INITIAL_KANBAN_CARDS;
  });

  const [newTitle, setNewTitle] = useState('');
  const [newTag, setNewTag] = useState('FEATURE');

  const persistCards = (next: KanbanCard[]) => {
    setCards(next);
    void writeFile(KANBAN_VFS_PATH, JSON.stringify(next, null, 2));
  };

  const addCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const card: KanbanCard = {
      id: `card_${Date.now()}`,
      title: newTitle.trim(),
      tag: newTag,
      column: 'BACKLOG',
    };
    persistCards([...cards, card]);
    setNewTitle('');
  };

  const moveCard = (id: string, dir: -1 | 1) => {
    const order: KanbanColumnId[] = ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    persistCards(
      cards.map((c) => {
        if (c.id !== id) return c;
        const idx = order.indexOf(c.column);
        const nextCol = order[Math.max(0, Math.min(order.length - 1, idx + dir))] ?? c.column;
        return { ...c, column: nextCol };
      })
    );
  };

  const deleteCard = (id: string) => {
    persistCards(cards.filter((c) => c.id !== id));
  };

  const columns: { id: KanbanColumnId; label: string }[] = [
    { id: 'BACKLOG', label: 'Backlog' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'REVIEW', label: 'Code Review' },
    { id: 'DONE', label: 'Completed' },
  ];

  return (
    <div data-testid="app-kanban" className="h-full flex flex-col p-4 gap-4 text-xs select-none">
      {/* Header & Task Creator */}
      <form
        onSubmit={addCard}
        className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#090e1c] border border-white/[0.08]"
      >
        <div className="flex items-center gap-2">
          <Kanban className={`w-4 h-4 ${accent.textClass}`} />
          <span className="font-semibold text-white">Kanban Workspace</span>
          <span className="text-[10px] font-mono text-slate-400">
            Auto-synced to {KANBAN_VFS_PATH}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New task description..."
            className="px-3 py-1.5 rounded-lg bg-[#050811] border border-white/[0.1] text-white focus:outline-none w-56"
          />
          <select
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#050811] border border-white/[0.1] text-slate-200 focus:outline-none"
          >
            <option value="FEATURE">FEATURE</option>
            <option value="BUGFIX">BUGFIX</option>
            <option value="UI/UX">UI/UX</option>
            <option value="CORE">CORE</option>
          </select>
          <button
            type="submit"
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${accent.bgClass} text-slate-950 font-semibold cursor-pointer`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </form>

      {/* 4 Columns */}
      <div className="flex-1 min-h-0 grid grid-cols-4 gap-3">
        {columns.map((col) => {
          const colCards = cards.filter((c) => c.column === col.id);
          return (
            <div
              key={col.id}
              className="rounded-xl bg-[#070b14]/90 border border-white/[0.07] p-3 flex flex-col gap-2.5 overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="font-semibold text-slate-200">{col.label}</span>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.06] font-mono text-[10px] text-cyan-300">
                  {colCards.length}
                </span>
              </div>

              {colCards.map((card) => (
                <div
                  key={card.id}
                  className="p-3 rounded-xl bg-[#0b1120] border border-white/[0.09] space-y-2 shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono text-[9px]">
                      {card.tag}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteCard(card.id)}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-white font-medium leading-snug">{card.title}</p>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      disabled={col.id === 'BACKLOG'}
                      onClick={() => moveCard(card.id, -1)}
                      className="p-1 rounded bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={col.id === 'DONE'}
                      onClick={() => moveCard(card.id, 1)}
                      className="p-1 rounded bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 2. PIXEL CANVAS STUDIO (PAINT & DRAWING APP)
// ============================================================================

const PALETTE_COLORS = [
  '#00f0ff',
  '#3b82f6',
  '#a855f7',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#ffffff',
  '#94a3b8',
];

export const PaintStudioApp: React.FC = () => {
  const createFile = useVfsStore((s) => s.createFile);
  const pushNotification = useNotificationStore((s) => s.pushNotification);
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [strokeColor, setStrokeColor] = useState('#00f0ff');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<'BRUSH' | 'ERASER'>('BRUSH');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'ERASER' ? '#050811' : strokeColor;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveArtworkToVfs = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const filename = `Artwork_${Date.now().toString().slice(-5)}.png`;
    await createFile('/KubekOS/Pictures', filename, dataUrl, 'image/png');
    pushNotification({
      title: 'Artwork Saved to VFS',
      message: `Saved /KubekOS/Pictures/${filename}. Open Image Viewer to inspect!`,
      sourceAppId: 'paint-studio',
    });
  };

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `kubekos_artwork_${Date.now()}.png`;
    a.click();
  };

  return (
    <div data-testid="app-paint-studio" className="h-full flex flex-col p-4 gap-3 text-xs select-none">
      {/* Toolbar */}
      <div className="p-2.5 rounded-xl bg-[#090e1c] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTool('BRUSH')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer ${
              tool === 'BRUSH' ? `${accent.bgClass} text-slate-950 font-semibold` : 'bg-white/[0.05] text-slate-300'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Brush</span>
          </button>
          <button
            type="button"
            onClick={() => setTool('ERASER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer ${
              tool === 'ERASER' ? `${accent.bgClass} text-slate-950 font-semibold` : 'bg-white/[0.05] text-slate-300'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>

          {/* Color Swatches */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
            {PALETTE_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => {
                  setStrokeColor(hex);
                  setTool('BRUSH');
                }}
                style={{ backgroundColor: hex }}
                className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                  strokeColor === hex && tool === 'BRUSH' ? 'scale-125 ring-2 ring-white' : ''
                }`}
              />
            ))}
          </div>

          {/* Brush Size */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <span className="text-slate-400">Size: {brushSize}px</span>
            <input
              type="range"
              min={2}
              max={32}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20 accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
          <button
            type="button"
            onClick={downloadPng}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PNG</span>
          </button>
          <button
            type="button"
            onClick={() => void saveArtworkToVfs()}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${accent.bgClass} text-slate-950 font-semibold cursor-pointer`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save to /Pictures</span>
          </button>
        </div>
      </div>

      {/* Drawing Surface */}
      <div className="flex-1 rounded-2xl border border-white/[0.1] bg-[#050811] overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={780}
          height={460}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className="cursor-crosshair rounded-xl border border-white/[0.06]"
        />
      </div>
    </div>
  );
};

// ============================================================================
// 3. REST API STUDIO (HTTP CLIENT)
// ============================================================================

export const ApiClientApp: React.FC = () => {
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/todos/1');
  const [requestBody, setRequestBody] = useState('{\n  "title": "KubekOS API Test",\n  "completed": true\n}');
  const [responseStatus, setResponseStatus] = useState<string>('Ready');
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<string>(
    '// Click "Send Request" to execute live HTTP call'
  );

  const sendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = performance.now();
    setResponseStatus('Sending...');
    try {
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (method === 'POST' || method === 'PUT') {
        options.body = requestBody;
      }
      const res = await fetch(url, options);
      const elapsed = Math.round(performance.now() - start);
      setDurationMs(elapsed);
      setResponseStatus(`${res.status} ${res.statusText}`);
      const text = await res.text();
      try {
        setResponseBody(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponseBody(text);
      }
    } catch (err) {
      setDurationMs(Math.round(performance.now() - start));
      setResponseStatus('Network / CORS Error');
      setResponseBody(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div data-testid="app-api-client" className="h-full flex flex-col p-4 gap-3 text-xs select-none">
      <form onSubmit={(e) => void sendRequest(e)} className="flex items-center gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as 'GET')}
          className="px-3 py-2 rounded-xl bg-[#090e1c] border border-white/[0.1] font-mono font-bold text-cyan-400 focus:outline-none"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl bg-[#050811] border border-white/[0.12] font-mono text-white focus:outline-none"
        />
        <button
          type="submit"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl ${accent.bgClass} text-slate-950 font-semibold cursor-pointer`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Request</span>
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {/* Request Payload */}
        <div className="flex flex-col rounded-xl bg-[#070b14] border border-white/[0.08] overflow-hidden">
          <div className="px-3 py-2 bg-[#090e1c] border-b border-white/[0.06] font-mono text-[11px] text-slate-400">
            JSON Request Body (POST / PUT)
          </div>
          <textarea
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            className="flex-1 p-3 bg-transparent font-mono text-slate-200 focus:outline-none resize-none"
          />
        </div>

        {/* Response Inspector */}
        <div className="flex flex-col rounded-xl bg-[#070b14] border border-white/[0.08] overflow-hidden">
          <div className="px-3 py-2 bg-[#090e1c] border-b border-white/[0.06] flex items-center justify-between font-mono text-[11px]">
            <span className="text-emerald-400">Status: {responseStatus}</span>
            {durationMs !== null && <span className="text-cyan-400">{durationMs} ms</span>}
          </div>
          <pre className="flex-1 p-3 overflow-y-auto font-mono text-slate-100 whitespace-pre-wrap select-text">
            {responseBody}
          </pre>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. DEV TOOLBOX APPLICATION
// ============================================================================

export const DevToolboxApp: React.FC = () => {
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const [inputText, setInputText] = useState('KubekOS Obsidian Aurora 2026');
  const [uuid, setUuid] = useState(() => crypto.randomUUID());
  const [copied, setCopied] = useState(false);

  const base64Encoded = (() => {
    try {
      return btoa(inputText);
    } catch {
      return 'Invalid UTF-8 input for btoa';
    }
  })();

  const urlEncoded = encodeURIComponent(inputText);

  const copyUuid = () => {
    void navigator.clipboard?.writeText(uuid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div data-testid="app-dev-toolbox" className="h-full flex flex-col p-5 gap-4 text-xs select-none overflow-y-auto">
      <div className="flex items-center gap-2">
        <Braces className={`w-5 h-5 ${accent.textClass}`} />
        <div>
          <h2 className="text-sm font-semibold text-white">Developer Swiss-Army Toolbox</h2>
          <p className="text-slate-400">Instant encoders, UUID v4 generator, and string transformers.</p>
        </div>
      </div>

      {/* UUID Generator */}
      <div className="p-4 rounded-xl bg-[#090e1c] border border-white/[0.08] flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase text-cyan-400">Cryptographic UUID v4</div>
          <div className="text-sm font-mono text-white mt-0.5 select-text">{uuid}</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUuid(crypto.randomUUID())}
            className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white cursor-pointer"
          >
            Generate New
          </button>
          <button
            type="button"
            onClick={copyUuid}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${accent.bgClass} text-slate-950 font-semibold cursor-pointer`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* String Encoder */}
      <div className="space-y-2">
        <label className="font-medium text-slate-300">Source Input Text</label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={3}
          className="w-full p-3 rounded-xl bg-[#050811] border border-white/[0.1] font-mono text-white focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-[#090e1c] border border-white/[0.08] space-y-1">
          <div className="text-[10px] font-mono uppercase text-cyan-400">Base64 Encoded</div>
          <div className="font-mono text-slate-200 break-all select-text">{base64Encoded}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#090e1c] border border-white/[0.08] space-y-1">
          <div className="text-[10px] font-mono uppercase text-cyan-400">URL Encoded</div>
          <div className="font-mono text-slate-200 break-all select-text">{urlEncoded}</div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. CYBERSNAKE ARCADE APPLICATION
// ============================================================================

const GRID_SIZE = 18;

export const CyberArcadeApp: React.FC = () => {
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const [snake, setSnake] = useState<{ x: number; y: number }[]>([
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 },
  ]);
  const [food, setFood] = useState<{ x: number; y: number }>({ x: 12, y: 8 });
  const [dir, setDir] = useState<{ x: number; y: number }>({ x: 1, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && dir.y === 0) setDir({ x: 0, y: -1 });
      else if (e.key === 'ArrowDown' && dir.y === 0) setDir({ x: 0, y: 1 });
      else if (e.key === 'ArrowLeft' && dir.x === 0) setDir({ x: -1, y: 0 });
      else if (e.key === 'ArrowRight' && dir.x === 0) setDir({ x: 1, y: 0 });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dir]);

  useEffect(() => {
    if (!isPlaying || gameOver) return;
    const timer = setInterval(() => {
      setSnake((prev) => {
        const head = prev[0]!;
        const next = {
          x: (head.x + dir.x + GRID_SIZE) % GRID_SIZE,
          y: (head.y + dir.y + GRID_SIZE) % GRID_SIZE,
        };

        if (prev.some((seg) => seg.x === next.x && seg.y === next.y)) {
          setGameOver(true);
          setIsPlaying(false);
          return prev;
        }

        const ate = next.x === food.x && next.y === food.y;
        if (ate) {
          setScore((s) => {
            const nextScore = s + 10;
            setHighScore((h) => Math.max(h, nextScore));
            return nextScore;
          });
          setFood({
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
          });
          return [next, ...prev];
        }

        return [next, ...prev.slice(0, -1)];
      });
    }, 115);

    return () => clearInterval(timer);
  }, [isPlaying, gameOver, dir, food]);

  const startNewGame = () => {
    setSnake([
      { x: 8, y: 8 },
      { x: 7, y: 8 },
      { x: 6, y: 8 },
    ]);
    setDir({ x: 1, y: 0 });
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  return (
    <div data-testid="app-cyber-arcade" className="h-full flex flex-col items-center justify-between p-5 text-xs select-none">
      <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#090e1c] border border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Gamepad2 className={`w-4 h-4 ${accent.textClass}`} />
          <span className="font-semibold text-white">CyberSnake Arcade</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span>SCORE: <strong className="text-cyan-400">{score}</strong></span>
          <span>BEST: <strong className="text-emerald-400">{highScore}</strong></span>
        </div>
      </div>

      {/* Grid Board */}
      <div
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
        }}
        className="w-80 h-80 grid bg-[#050811] border-2 border-white/[0.12] rounded-2xl p-1 gap-0.5 shadow-2xl"
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
          const x = idx % GRID_SIZE;
          const y = Math.floor(idx / GRID_SIZE);
          const isHead = snake[0]?.x === x && snake[0]?.y === y;
          const isBody = snake.slice(1).some((s) => s.x === x && s.y === y);
          const isFood = food.x === x && food.y === y;

          return (
            <div
              key={idx}
              className={`rounded-xs ${
                isHead
                  ? 'bg-cyan-300 shadow-[0_0_8px_#22d3ee]'
                  : isBody
                    ? 'bg-cyan-500/70'
                    : isFood
                      ? 'bg-rose-500 animate-pulse rounded-full'
                      : 'bg-white/[0.02]'
              }`}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={startNewGame}
          className={`flex items-center gap-1.5 px-5 py-2 rounded-xl ${accent.bgClass} text-slate-950 font-semibold cursor-pointer`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>{gameOver ? 'Play Again' : isPlaying ? 'Restart' : 'Start Game (Arrow Keys)'}</span>
        </button>
      </div>
    </div>
  );
};
