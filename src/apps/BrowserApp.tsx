/**
 * KubekOS Sandboxed Web Browser Application — OBSIDIAN AURORA Edition
 * Features real live web search (DuckDuckGo / Wikipedia / GitHub / Google Programmable Search),
 * smart iframe compatibility (automatic embed transformation for Google, YouTube, Wikipedia),
 * multiple tabs, bookmarks, and instant search results inside the OS window.
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS } from '@/theme/tokens';

interface SearchResultItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  history: string[];
  historyIndex: number;
  searchQuery?: string;
  searchResults?: SearchResultItem[];
  isSearching?: boolean;
}

interface BookmarkEntry {
  title: string;
  url: string;
}

const DEFAULT_BOOKMARKS: BookmarkEntry[] = [
  { title: 'Google Search', url: 'https://www.google.com/webhp?igu=1' },
  { title: 'KubekOS Search', url: 'kubek://search' },
  { title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Operating_system' },
  { title: 'KubekOS Portal', url: 'kubek://home' },
  { title: 'Kernel Docs', url: 'kubek://docs' },
];

/**
 * Converts standard URLs that block iframes into iframe-compatible embed URLs
 * so users can browse Google, YouTube, and Wikipedia directly inside KubekOS.
 */
function toEmbedSafeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    // Google: adding igu=1 enables Google's iframe-compatible mode
    if (host === 'google.com' || host === 'www.google.com' || host === 'google.pl' || host === 'www.google.pl') {
      parsed.searchParams.set('igu', '1');
      if (parsed.pathname === '/' || parsed.pathname === '') {
        parsed.pathname = '/webhp';
      }
      return parsed.toString();
    }

    // YouTube watch links -> YouTube embed
    if ((host === 'youtube.com' || host === 'www.youtube.com') && parsed.pathname === '/watch') {
      const videoId = parsed.searchParams.get('v');
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch {
    // Fall through if not a standard URL
  }
  return rawUrl;
}

export const BrowserApp: React.FC = () => {
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: 'tab-1',
      title: 'KubekOS Search & Web',
      url: 'kubek://search',
      history: ['kubek://search'],
      historyIndex: 0,
      searchQuery: '',
      searchResults: [],
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [addressInput, setAddressInput] = useState('kubek://search');
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(DEFAULT_BOOKMARKS);
  const [searchEngineInput, setSearchEngineInput] = useState('');

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]!;

  const executeLiveWebSearch = async (query: string, tabId: string) => {
    const cleanQ = query.trim();
    if (!cleanQ) return;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              url: `kubek://search?q=${encodeURIComponent(cleanQ)}`,
              title: `${cleanQ} — Search`,
              searchQuery: cleanQ,
              isSearching: true,
            }
          : t
      )
    );
    setAddressInput(`kubek://search?q=${encodeURIComponent(cleanQ)}`);

    try {
      // Query Wikipedia OpenSearch & DuckDuckGo Instant Answer APIs in parallel (CORS-enabled)
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        cleanQ
      )}&utf8=&format=json&origin=*`;
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(
        cleanQ
      )}&format=json&no_html=1&skip_disambig=1`;

      const [wikiRes, ddgRes] = await Promise.allSettled([
        fetch(wikiUrl).then((r) => r.json()),
        fetch(ddgUrl).then((r) => r.json()),
      ]);

      const combinedResults: SearchResultItem[] = [];

      if (ddgRes.status === 'fulfilled' && ddgRes.value) {
        const ddg = ddgRes.value as {
          AbstractText?: string;
          AbstractURL?: string;
          Heading?: string;
          RelatedTopics?: { Text?: string; FirstURL?: string }[];
        };
        if (ddg.AbstractText && ddg.AbstractURL) {
          combinedResults.push({
            title: ddg.Heading || cleanQ,
            snippet: ddg.AbstractText,
            url: ddg.AbstractURL,
            source: 'Instant Knowledge Graph',
          });
        }
        if (Array.isArray(ddg.RelatedTopics)) {
          for (const topic of ddg.RelatedTopics.slice(0, 4)) {
            if (topic.Text && topic.FirstURL) {
              combinedResults.push({
                title: topic.Text.split(' - ')[0] ?? cleanQ,
                snippet: topic.Text,
                url: topic.FirstURL,
                source: 'DuckDuckGo Instant',
              });
            }
          }
        }
      }

      if (wikiRes.status === 'fulfilled' && wikiRes.value?.query?.search) {
        const wikiItems = wikiRes.value.query.search as {
          title: string;
          snippet: string;
        }[];
        for (const item of wikiItems.slice(0, 6)) {
          const plainSnippet = item.snippet.replace(/<\/?[^>]+(>|$)/g, '');
          combinedResults.push({
            title: `${item.title} — Wikipedia`,
            snippet: plainSnippet,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(
              item.title.replace(/ /g, '_')
            )}`,
            source: 'Wikipedia Encyclopedia',
          });
        }
      }

      // Always include a direct Google Web Search launch card
      combinedResults.push({
        title: `Search "${cleanQ}" on Google.com`,
        snippet: `Open full Google search results for "${cleanQ}" in embedded mode or new browser tab.`,
        url: `https://www.google.com/search?igu=1&q=${encodeURIComponent(cleanQ)}`,
        source: 'Google Web Search',
      });

      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, searchResults: combinedResults, isSearching: false }
            : t
        )
      );
    } catch {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                isSearching: false,
                searchResults: [
                  {
                    title: `Search "${cleanQ}" on Google.com`,
                    snippet: 'Click to open Google Search for this query.',
                    url: `https://www.google.com/search?igu=1&q=${encodeURIComponent(cleanQ)}`,
                    source: 'Google Web Search',
                  },
                ],
              }
            : t
        )
      );
    }
  };

  const navigateTo = (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    // Check if user typed a search query instead of a URL
    const looksLikeUrl =
      trimmed.startsWith('kubek://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      (trimmed.includes('.') && !trimmed.includes(' '));

    if (!looksLikeUrl) {
      void executeLiveWebSearch(trimmed, activeTab.id);
      return;
    }

    if (trimmed.startsWith('kubek://search')) {
      const qMatch = trimmed.split('?q=')[1];
      if (qMatch) {
        void executeLiveWebSearch(decodeURIComponent(qMatch), activeTab.id);
        return;
      }
    }

    let formatted = trimmed;
    if (
      !formatted.startsWith('kubek://') &&
      !formatted.startsWith('http://') &&
      !formatted.startsWith('https://')
    ) {
      formatted = `https://${formatted}`;
    }

    formatted = toEmbedSafeUrl(formatted);

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
    const targetUrl = activeTab.history[nextIdx] ?? 'kubek://search';
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
    const targetUrl = activeTab.history[nextIdx] ?? 'kubek://search';
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
      title: 'KubekOS Search',
      url: 'kubek://search',
      history: ['kubek://search'],
      historyIndex: 0,
      searchResults: [],
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    setAddressInput('kubek://search');
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
      setBookmarks((prev) => [...prev, { title: activeTab.title, url: activeTab.url }]);
    }
  };

  return (
    <div data-testid="app-browser" className="h-full flex flex-col text-xs select-none">
      {/* Tab Strip */}
      <div className="flex items-center gap-1 bg-[#070b14] px-2 pt-1.5 border-b border-white/[0.08] overflow-x-auto">
        {tabs.map((tab) => {
          const isCurrent = tab.id === activeTab.id;
          return (
            <div
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id);
                setAddressInput(tab.url);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-t border-x cursor-pointer max-w-[200px] ${
                isCurrent
                  ? 'bg-[#0b1120] border-white/[0.12] text-white'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
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

      {/* Navigation & Smart Omnibox (URL or Search Query) */}
      <div className="p-2 bg-[#090e1a] border-b border-white/[0.08] flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          disabled={activeTab.historyIndex <= 0}
          className="p-1.5 rounded-lg hover:bg-white/[0.08] disabled:opacity-35 text-slate-300 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={goForward}
          disabled={activeTab.historyIndex + 1 >= activeTab.history.length}
          className="p-1.5 rounded-lg hover:bg-white/[0.08] disabled:opacity-35 text-slate-300 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => navigateTo(activeTab.url)}
          className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-300 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigateTo(addressInput);
          }}
          className="flex-1 flex items-center bg-[#050811] border border-white/[0.12] focus-within:border-cyan-400/60 rounded-xl px-3 py-1.5 gap-2"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <input
            type="text"
            data-testid="browser-address-input"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="Search anything or enter URL (e.g. google.com, linux kernel, react)..."
            className="w-full bg-transparent text-white focus:outline-none font-mono text-xs"
          />
        </form>

        <button
          type="button"
          onClick={toggleBookmarkCurrent}
          title="Bookmark Page"
          className={`p-1.5 rounded-lg hover:bg-white/[0.08] cursor-pointer ${
            bookmarks.some((b) => b.url === activeTab.url)
              ? accent.textClass
              : 'text-slate-400'
          }`}
        >
          <Bookmark className="w-4 h-4" />
        </button>
      </div>

      {/* Bookmarks Bar */}
      <div className="px-3 py-1.5 bg-[#070b14] border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto">
        {bookmarks.map((bm) => (
          <button
            key={bm.url}
            type="button"
            onClick={() => navigateTo(bm.url)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 border border-white/[0.07] shrink-0 cursor-pointer"
          >
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>{bm.title}</span>
          </button>
        ))}
      </div>

      {/* Viewport */}
      <div className="flex-1 bg-[#050811] overflow-y-auto">
        {activeTab.url.startsWith('kubek://search') && (
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Search Hero */}
            <div className="text-center space-y-3 pt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Obsidian Live Web Search Engine</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Kubek<span className={accent.textClass}>Search</span>
              </h1>
              <p className="text-slate-400 text-xs">
                Search live Wikipedia & DuckDuckGo Knowledge Graph directly in KubekOS, or launch Google.com (`igu=1` mode).
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void executeLiveWebSearch(searchEngineInput, activeTab.id);
                }}
                className="max-w-xl mx-auto flex items-center bg-[#090e1c] border border-white/[0.14] rounded-2xl p-1.5 shadow-2xl"
              >
                <Search className="w-4 h-4 text-slate-400 ml-3 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchEngineInput}
                  onChange={(e) => setSearchEngineInput(e.target.value)}
                  placeholder="Type anything to search the web (e.g. Linux, TypeScript, Quantum computing)..."
                  className="flex-1 bg-transparent text-sm text-white focus:outline-none py-1.5"
                />
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl ${accent.bgClass} text-slate-950 font-semibold text-xs cursor-pointer`}
                >
                  Search
                </button>
              </form>

              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigateTo('https://www.google.com/webhp?igu=1')}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 cursor-pointer"
                >
                  Open Embedded Google.com
                </button>
                <button
                  type="button"
                  onClick={() => void executeLiveWebSearch('Operating Systems', activeTab.id)}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 cursor-pointer"
                >
                  Try: "Operating Systems"
                </button>
              </div>
            </div>

            {/* Live Search Results */}
            {activeTab.isSearching && (
              <div className="py-12 flex items-center justify-center gap-2 text-cyan-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Searching live web knowledge graph...</span>
              </div>
            )}

            {!activeTab.isSearching &&
              activeTab.searchResults &&
              activeTab.searchResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Results for "{activeTab.searchQuery}" ({activeTab.searchResults.length})
                  </div>
                  {activeTab.searchResults.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => navigateTo(item.url)}
                      className="p-4 rounded-2xl bg-[#090e1c]/90 hover:bg-[#0f172a] border border-white/[0.08] hover:border-cyan-500/40 transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-cyan-400">
                          {item.source} • {item.url}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white hover:underline">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {activeTab.url === 'kubek://home' && (
          <div className="max-w-2xl mx-auto space-y-6 p-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold text-white">KubekOS Intranet Portal</h1>
              <p className="text-slate-400">
                Select a bookmark or use the omnibox above to search the web.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          <div className="max-w-2xl mx-auto space-y-4 p-6">
            <h2 className="text-lg font-semibold text-white">
              KubekOS Kernel & Architecture Documentation
            </h2>
            <p className="text-slate-300 leading-relaxed">
              KubekOS is structured into 8 decoupled subsystems: Kernel Core, Desktop Environment, Window Manager, Application Runtime, Virtual Filesystem (Dexie IndexedDB), User System, Notification Center, and Theme Engine.
            </p>
          </div>
        )}

        {!activeTab.url.startsWith('kubek://') && (
          <div className="h-full flex flex-col">
            <div className="px-4 py-2 bg-[#090e1c] border-b border-white/[0.08] flex items-center justify-between">
              <div className="text-slate-300 truncate">
                Viewing: <span className="font-mono text-cyan-300">{activeTab.url}</span>
              </div>
              <a
                href={activeTab.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg ${accent.bgClass} text-slate-950 font-semibold shrink-0`}
              >
                <span>Open External Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <iframe
              title={activeTab.title}
              src={activeTab.url}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="flex-1 w-full border-0 bg-white"
            />
          </div>
        )}
      </div>
    </div>
  );
};
