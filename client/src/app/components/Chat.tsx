import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Code, FileText, Loader2, Sparkles, UserCircle, Brain } from "lucide-react";
import { useRepo } from "../context/RepoContext";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  codeSnippet?: string;
  sources?: string[];
  mode?: string;
};

export function Chat() {
  const { owner, repo, apiBase } = useRepo();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatMode, setChatMode] = useState<'basic' | 'expert'>('basic');

  useEffect(() => {
    setMessages([{
      id: "welcome",
      role: "ai",
      content: `Hi there! I'm Luna, your codebase AI assistant. I've analyzed \`${owner}/${repo}\` and I'm ready to answer any questions about the architecture, dependencies, or specific functions.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
  }, [owner, repo]);

  const handleClearContext = () => {
    setMessages([{
      id: "welcome",
      role: "ai",
      content: `Hi there! I'm Luna, your codebase AI assistant. I've analyzed \`${owner}/${repo}\` and I'm ready to answer any questions about the architecture, dependencies, or specific functions.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
  };
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo,
          question: input,
          mode: chatMode
        })
      });

      const data = await response.json();
      setIsTyping(false);

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: data.answer || "I'm sorry, I couldn't process that request.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: data.sources,
        mode: data.mode
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (err) {
      setIsTyping(false);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: "I'm having trouble connecting to the analysis service. Please make sure the repository has been indexed first.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorResponse]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">Luna AI</h2>
            <p className="text-xs text-slate-400">Context: {owner}/{repo} (Main branch)</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Mode Toggle */}
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => {
                if (chatMode !== 'basic') {
                  setChatMode('basic');
                  handleClearContext();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                chatMode === 'basic'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCircle className="w-3.5 h-3.5" />
              Basic
            </button>
            <button
              onClick={() => {
                if (chatMode !== 'expert') {
                  setChatMode('expert');
                  handleClearContext();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                chatMode === 'expert'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Expert
            </button>
          </div>
          <button onClick={handleClearContext} className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
            <FileText className="w-4 h-4" />
            Clear Context
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
              msg.role === "user" ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400"
            }`}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            
            <div className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-xs font-medium text-slate-400">{msg.role === "user" ? "You" : "Luna"}</span>
                <span className="text-[10px] text-slate-600">{msg.timestamp}</span>
              </div>
              
              <div className={`px-5 py-3.5 rounded-2xl max-w-2xl text-[15px] leading-relaxed shadow-sm ${
                msg.role === "user" 
                  ? "bg-indigo-600 text-white rounded-tr-sm" 
                  : "bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-sm"
              }`}>
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-a:text-indigo-400 prose-strong:text-slate-100 prose-code:text-indigo-300 prose-code:bg-slate-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-700">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match;
                          return isInline ? (
                            <code className={className} {...props}>{children}</code>
                          ) : (
                            <div className="mt-3 rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                              <div className="flex items-center px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-medium text-slate-400 gap-2">
                                <Code className="w-3.5 h-3.5" />
                                {match[1]}
                              </div>
                              <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto">
                                <code {...props}>{children}</code>
                              </pre>
                            </div>
                          );
                        },
                        pre({ children }) {
                          return <>{children}</>;
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
                
                {msg.codeSnippet && (
                  <div className="mt-4 rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                    <div className="flex items-center px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-medium text-slate-400 gap-2">
                      <Code className="w-3.5 h-3.5" />
                      src/services/auth.ts
                    </div>
                    <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto">
                      <code>{msg.codeSnippet}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex gap-4 max-w-4xl mx-auto">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mt-1">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-xs font-medium text-slate-400">Luna</span>
              </div>
              <div className="px-5 py-4 rounded-2xl bg-slate-800 border border-slate-700/50 rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="text-sm text-slate-400 animate-pulse">Analyzing codebase...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-slate-900/80 border-t border-slate-800">
        <div className="max-w-4xl mx-auto relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about components, auth flow, performance issues, or specific files..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-5 pr-14 py-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none shadow-sm"
            rows={1}
            style={{ minHeight: "60px", maxHeight: "200px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="absolute right-3 bottom-3 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-[11px] text-slate-500 mt-3 font-medium">
          Luna AI can make mistakes. Consider verifying codebase facts.
        </p>
      </div>
    </div>
  );
}
