/**
 * KubekOS Sandboxed Web Browser Application
 * Supports multiple tabs, address bar, navigation history, bookmarks,
 * built-in KubekOS documentation portal pages, and safe external link launching.
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ExternalLink,
  Globe,
  Plus,
  RotateCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS } from '@/theme/tokens';

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  history: string[];
  historyIndex: number;
}

interface BookmarkEntry {
  title: string;
  url: string;
}

const DEFAULT_BOOKMARKS: BookmarkEntry[] = [
  { title: 'KubekOS Portal', url: 'kubek://home' },
  { title: 'Kernel Docs', url: 'kubek://docs' },
  { title: 'Security Model', url: 'kubek://security' },
  { title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
  { title: 'React Documentation', url: 'https://react.dev' },
];

export const BrowserApp: React.FC = () => {
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: 'tab-1',
      title: 'KubekOS Portal',
      url: 'kubek://home',
      history: ['kubek://home'],
      historyIndex: 0,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [addressInput, setAddressInput] = useState('kubek://home');
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(DEFAULT_BOOKMARKS);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]!;

  const navigateTo = (rawUrl: string) => {
    let formatted = rawUrl.trim();
    if (!formatted) return;
    if (
      !formatted.startsWith('kubek://') &&
      !formatted.startsWith('http://') &&
      !formatted.startsWith('https://')
    ) {
      formatted = `https://${formatted}`;
    }

    const title = formatted.startsWith('kubek://')
      ? `KubekOS: ${formatted.replace('kubek://', '').toUpperCase()}`
      : formatted.replace(/^https?:\/\//, '').split('/')[0] ?? 'Web Page';

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTab.id) return t;
        const nextHistory = [...t.history.slice(0, t.historyIndex + 1), formatted];
        return {
          ...t,
          url: formatted,
          title,
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
        };
      })
    );
    setAddressInput(formatted);
  };

  const goBack = () => {
    if (activeTab.historyIndex <= 0) return;
    const nextIdx = activeTab.historyIndex - 1;
    const targetUrl = activeTab.history[nextIdx] ?? 'kubek://home';
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, url: targetUrl, historyIndex: nextIdx } : t
      )
    );
    setAddressInput(targetUrl);
  };

  const goForward = () => {
    if (activeTab.historyIndex + 1 >= activeTab.history.length) return;
    const nextIdx = activeTab.historyIndex + 1;
    const targetUrl = activeTab.history[nextIdx] ?? 'kubek://home';
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, url: targetUrl, historyIndex: nextIdx } : t
      )
    );
    setAddressInput(targetUrl);
  };

  const addTab = () => {
    const id = `tab_${Date.now()}`;
    const newTab: BrowserTab = {
      id,
      title: 'KubekOS Portal',
      url: 'kubek://home',
      history: ['kubek://home'],
      historyIndex: 0,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    setAddressInput('kubek://home');
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id && remaining[0]) {
      setActiveTabId(remaining[0].id);
      setAddressInput(remaining[0].url);
    }
  };

  const toggleBookmarkCurrent = () => {
    const exists = bookmarks.some((b) => b.url === activeTab.url);
    if (exists) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeTab.url));
    } else {
      setBookmarks((prev) => [
        ...prev,
        { title: activeTab.title, url: activeTab.url },
      ]);
    }
  };

  return (
    <div data-testid="app-browser" className="h-full flex flex-col text-xs select-none">
      {/* Tab Strip */}
      <div className="flex items-center gap-1 bg-slate-900 px-2 pt-1.5 border-b border-slate-800 overflow-x-auto">
        {tabs.map((tab) => {
          const isCurrent = tab.id === activeTab.id;
          return (
            <div
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id);
                setAddressInput(tab.url);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-t border-x cursor-pointer max-w-[180px] ${
                isCurrent
                  ? 'bg-slate-950 border-slate-700 text-white'
                  : 'bg-slate-900/50 border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className={`w-3.5 h-3.5 shrink-0 ${accent.textClass}`} />
              <span className="truncate">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => closeTab(tab.id, e)}
                  className="text-slate-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={addTab}
          className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
          title="New Browser Tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Navigation & Address Bar */}
      <div className="p-2 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          disabled={activeTab.historyIndex <= 0}
          className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-35 text-slate-300 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={goForward}
          disabled={activeTab.historyIndex + 1 >= activeTab.history.length}
          className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-35 text-slate-300 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => navigateTo(activeTab.url)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigateTo(addressInput);
          }}
          className="flex-1 flex items-center bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 gap-2"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <input
            type="text"
            data-testid="browser-address-input"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            className="w-full bg-transparent text-white focus:outline-none font-mono text-xs"
          />
        </form>

        <button
          type="button"
          onClick={toggleBookmarkCurrent}
          title="Bookmark Page"
          className={`p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer ${
            bookmarks.some((b) => b.url === activeTab.url)
              ? accent.textClass
              : 'text-slate-400'
          }`}
        >
          <Bookmark className="w-4 h-4" />
        </button>
      </div>

      {/* Bookmarks Bar */}
      <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
        {bookmarks.map((bm) => (
          <button
            key={bm.url}
            type="button"
            onClick={() => navigateTo(bm.url)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 shrink-0 cursor-pointer"
          >
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>{bm.title}</span>
          </button>
        ))}
      </div>

      {/* Viewport */}
      <div className="flex-1 bg-slate-950 overflow-y-auto p-6">
        {activeTab.url === 'kubek://home' && (
          <div className="max-w-2xl mx-auto space-y-6 py-6">
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs">
                KubekOS Intranet & Web Gateway
              </div>
              <h1 className="text-2xl font-bold text-white">
                KubekOS Sandboxed Browser
              </h1>
              <p className="text-slate-400">
                Explore internal system documentation or navigate to external web resources safely.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {bookmarks.map((bm) => (
                <button
                  key={bm.url}
                  type="button"
                  onClick={() => navigateTo(bm.url)}
                  className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer"
                >
                  <div className="font-semibold text-white">{bm.title}</div>
                  <div className="text-[10px] font-mono text-slate-400 truncate mt-1">
                    {bm.url}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab.url === 'kubek://docs' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-semibold text-white">
              KubekOS Kernel & Architecture Documentation
            </h2>
            <p className="text-slate-300 leading-relaxed">
              KubekOS is structured into 8 decoupled subsystems: Kernel Core, Desktop Environment, Window Manager, Application Runtime, Virtual Filesystem (Dexie IndexedDB), User System, Notification Center, and Theme Engine.
            </p>
          </div>
        )}

        {activeTab.url === 'kubek://security' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-semibold text-white">
              KubekOS Security & Isolation Policy
            </h2>
            <p className="text-slate-300 leading-relaxed">
              Third-party plugins execute through ControlledPluginApi with explicit permission verification. Unsafe HTML rendering and dynamic code evaluation (eval) are strictly prohibited.
            </p>
          </div>
        )}

        {!activeTab.url.startsWith('kubek://') && (
          <div className="h-full flex flex-col gap-3">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="text-slate-300">
                External resource: <span className="font-mono text-white">{activeTab.url}</span>
              </div>
              <a
                href={activeTab.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${accent.bgClass} text-slate-950 font-semibold`}
              >
                <span>Open in Host Browser Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <iframe
              title={activeTab.title}
              src={activeTab.url}
              sandbox="allow-scripts allow-same-origin"
              className="flex-1 w-full rounded-xl border border-slate-800 bg-white"
            />
          </div>
        )}
      </div>
    </div>
  );
};
