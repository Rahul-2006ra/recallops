import React from 'react'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 text-center">
      <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-4">
          Project Initialized
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">
          RecallOps
        </h1>
        <p className="text-slate-400 text-lg mb-6">
          The Self-Learning Industrial Maintenance Agent
        </p>
        <div className="grid grid-cols-2 gap-3 text-left bg-slate-950 p-4 rounded-lg border border-slate-800 text-sm">
          <div>
            <span className="text-slate-500 block">Frontend Stack:</span>
            <span className="text-slate-200 font-mono">React + Vite + Tailwind</span>
          </div>
          <div>
            <span className="text-slate-500 block">Backend Stack:</span>
            <span className="text-slate-200 font-mono">Python + FastAPI</span>
          </div>
          <div>
            <span className="text-slate-500 block">AI Engine:</span>
            <span className="text-slate-200 font-mono">Groq (openai/gpt-oss-120b)</span>
          </div>
          <div>
            <span className="text-slate-500 block">Persistent Memory:</span>
            <span className="text-slate-200 font-mono">Hindsight Cloud</span>
          </div>
        </div>
      </div>
    </div>
  )
}
