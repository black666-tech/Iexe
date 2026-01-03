import React, { useState, useRef, useEffect } from 'react';
import { 
  AppStep, 
  BuildContext, 
  initialMetadata, 
  initialConfig, 
  ExeMetadata, 
  ExeConfig, 
  TargetArch, 
  OutputType 
} from './types';
import { convertToCSharp, validateAndOptimize } from './services/geminiService';
import { generateSelfCompilingScript, downloadArtifact } from './utils/fileGenerator';

// --- Icons ---
const IconCpu = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>;
const IconCode = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>;
const IconCheck = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const IconDownload = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const IconTerminal = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>;

// --- Components ---

const InputField = ({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (val: string) => void, placeholder?: string }) => (
  <div className="mb-4">
    <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2 font-mono">{label}</label>
    <input 
      type="text" 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-forge-panel border border-gray-800 focus:border-forge-accent text-white p-3 rounded outline-none transition-colors font-mono"
    />
  </div>
);

const SelectField = ({ label, value, options, onChange }: { label: string, value: string, options: {label: string, value: string}[], onChange: (val: string) => void }) => (
  <div className="mb-4">
    <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2 font-mono">{label}</label>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-forge-panel border border-gray-800 focus:border-forge-accent text-white p-3 rounded outline-none transition-colors font-mono appearance-none"
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const Button = ({ children, onClick, variant = 'primary', disabled = false, className = '' }: { children: React.ReactNode, onClick: () => void, variant?: 'primary' | 'secondary' | 'danger', disabled?: boolean, className?: string }) => {
  const baseStyle = "px-6 py-3 rounded font-bold uppercase tracking-wider text-sm transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-forge-accent text-black hover:bg-white hover:shadow-[0_0_15px_rgba(0,255,157,0.5)]",
    secondary: "bg-gray-800 text-white hover:bg-gray-700",
    danger: "bg-red-900/50 text-red-200 border border-red-800 hover:bg-red-900"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [metadata, setMetadata] = useState<ExeMetadata>(initialMetadata);
  const [config, setConfig] = useState<ExeConfig>(initialConfig);
  const [rawInput, setRawInput] = useState<string>("");
  const [sourceCode, setSourceCode] = useState<string>(`using System;
using System.Windows.Forms;

namespace MyApp {
    class Program {
        [STAThread]
        static void Main() {
            Console.WriteLine("Hello from ExeForge!");
            // MessageBox.Show("Hello from ExeForge!"); 
            Console.ReadLine();
        }
    }
}`);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // --- Handlers ---

  const handleAiConversion = async () => {
    if (!rawInput.trim()) return;
    setIsProcessing(true);
    addLog("Sende Anfrage an Neural-Link (Gemini AI)...");
    try {
      const code = await convertToCSharp(rawInput, config.outputType === OutputType.CONSOLE);
      setSourceCode(code);
      addLog("Code erfolgreich transpiliert.");
    } catch (e) {
      addLog("Fehler bei der Transpilierung.");
    }
    setIsProcessing(false);
  };

  const handleValidation = async () => {
    setIsProcessing(true);
    addLog("Validiere Syntax und Sicherheit...");
    try {
      const result = await validateAndOptimize(sourceCode);
      setSourceCode(result.correctedCode);
      addLog(`Validierung abgeschlossen: ${result.analysis}`);
    } catch (e) {
      addLog("Validierung fehlgeschlagen.");
    }
    setIsProcessing(false);
  };

  const handleBuild = () => {
    setStep(AppStep.GENERATION);
    addLog("Initialisiere Build-Sequenz...");
    
    setTimeout(() => {
      addLog("Erstelle PE-Header Konfiguration...");
    }, 800);

    setTimeout(() => {
      addLog("Generiere Bootstrapper...");
    }, 1600);

    setTimeout(() => {
      const script = generateSelfCompilingScript({
        metadata,
        config,
        sourceCode,
        buildLogs: logs
      });
      addLog("Build Artifact bereit.");
      downloadArtifact(script, `${metadata.projectName}_Installer.cmd`);
      addLog("Download gestartet.");
    }, 3000);
  };

  // --- Step Renderers ---

  const renderWelcome = () => (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-fade-in p-8">
      <div className="w-24 h-24 bg-forge-panel border-2 border-forge-accent rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,255,157,0.2)]">
        <IconTerminal />
      </div>
      <div>
        <h1 className="text-5xl font-black font-sans tracking-tighter text-white mb-4">
          EXE<span className="text-forge-accent">FORGE</span>
        </h1>
        <p className="text-gray-400 max-w-lg mx-auto text-lg">
          Der professionelle Standard für client-seitige Executable-Erstellung.
          Erzeuge echte .exe Dateien ohne Simulation.
        </p>
      </div>
      <Button onClick={() => setStep(AppStep.METADATA)}>
        Neues Projekt Initialisieren
      </Button>
    </div>
  );

  const renderMetadata = () => (
    <div className="max-w-2xl mx-auto w-full p-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-800 pb-4 flex items-center gap-3">
        <span className="text-forge-accent">01.</span> Projekt Metadaten
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="Name" value={metadata.projectName} onChange={v => setMetadata({...metadata, projectName: v})} />
        <InputField label="Version" value={metadata.version} onChange={v => setMetadata({...metadata, version: v})} />
        <InputField label="Author" value={metadata.author} onChange={v => setMetadata({...metadata, author: v})} />
        <InputField label="Copyright" value={metadata.copyright} onChange={v => setMetadata({...metadata, copyright: v})} />
        <div className="md:col-span-2">
          <InputField label="Beschreibung" value={metadata.description} onChange={v => setMetadata({...metadata, description: v})} />
        </div>
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={() => setStep(AppStep.WELCOME)}>Zurück</Button>
        <Button onClick={() => setStep(AppStep.CONFIGURATION)}>Weiter</Button>
      </div>
    </div>
  );

  const renderConfig = () => (
    <div className="max-w-2xl mx-auto w-full p-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-800 pb-4 flex items-center gap-3">
        <span className="text-forge-accent">02.</span> System Konfiguration
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField 
          label="Ziel Architektur" 
          value={config.architecture} 
          options={[
            {label: "Any CPU (Empfohlen)", value: TargetArch.ANYCPU},
            {label: "x64 (64-bit)", value: TargetArch.X64},
            {label: "x86 (32-bit)", value: TargetArch.X86}
          ]} 
          onChange={v => setConfig({...config, architecture: v as TargetArch})} 
        />
        <SelectField 
          label="Ausgabe Typ" 
          value={config.outputType} 
          options={[
            {label: "Console Application (.exe)", value: OutputType.CONSOLE},
            {label: "Windows GUI (.exe)", value: OutputType.WINDOWED}
          ]} 
          onChange={v => setConfig({...config, outputType: v as OutputType})} 
        />
        
        <div className="md:col-span-2 bg-forge-panel border border-gray-800 p-4 rounded">
          <label className="flex items-center gap-3 cursor-pointer mb-3">
            <input 
              type="checkbox" 
              checked={config.enableOptimization} 
              onChange={e => setConfig({...config, enableOptimization: e.target.checked})}
              className="accent-forge-accent w-5 h-5"
            />
            <span className="text-gray-300">Code Optimierung aktivieren (/optimize+)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={config.allowUnsafe} 
              onChange={e => setConfig({...config, allowUnsafe: e.target.checked})}
              className="accent-forge-accent w-5 h-5"
            />
            <span className="text-gray-300">Unsafe Code erlauben (/unsafe)</span>
          </label>
        </div>
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={() => setStep(AppStep.METADATA)}>Zurück</Button>
        <Button onClick={() => setStep(AppStep.CODE_INPUT)}>Code Umgebung</Button>
      </div>
    </div>
  );

  const renderCodeInput = () => (
    <div className="max-w-4xl mx-auto w-full p-6 h-full flex flex-col animate-fade-in">
      <h2 className="text-2xl font-bold text-white mb-4 border-b border-gray-800 pb-4 flex items-center justify-between">
        <div className="flex gap-3 items-center">
            <span className="text-forge-accent">03.</span> Source Injection
        </div>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={handleValidation} disabled={isProcessing} className="py-1 text-xs">
                 {isProcessing ? 'Working...' : 'Validieren'}
            </Button>
        </div>
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow overflow-hidden">
        {/* Input Assistant */}
        <div className="col-span-1 flex flex-col gap-4">
            <div className="bg-forge-panel p-4 rounded border border-gray-800 flex-grow flex flex-col">
                <label className="text-forge-accent font-bold text-xs uppercase mb-2 flex items-center gap-2">
                    <IconCode /> AI Prompt / Code Input
                </label>
                <textarea 
                    className="flex-grow bg-black/50 text-gray-300 p-3 text-sm font-mono outline-none resize-none border border-gray-700 focus:border-forge-accent rounded"
                    placeholder="Beschreibe was die .exe tun soll (z.B. 'Ein Taschenrechner') oder füge Python/Pseudo-Code ein..."
                    value={rawInput}
                    onChange={e => setRawInput(e.target.value)}
                />
                <button 
                    onClick={handleAiConversion}
                    disabled={isProcessing}
                    className="mt-3 bg-blue-600/20 text-blue-400 border border-blue-600 hover:bg-blue-600 hover:text-white p-2 text-xs font-bold uppercase rounded transition-colors"
                >
                    {isProcessing ? 'Verarbeite...' : 'In C# Konvertieren'}
                </button>
            </div>
            
            <div className="bg-yellow-900/10 border border-yellow-700/50 p-4 rounded text-xs text-yellow-500 font-mono">
                HINWEIS: Für eine echte .exe wird nativer C# Code benötigt. Nutzen Sie den Konverter oben oder fügen Sie eigenen C# Code rechts ein.
            </div>
        </div>

        {/* Code Editor */}
        <div className="col-span-1 lg:col-span-2 bg-forge-panel rounded border border-gray-800 flex flex-col overflow-hidden relative">
             <div className="absolute top-0 right-0 p-2 bg-black/50 text-xs text-gray-500 font-mono">Program.cs</div>
             <textarea 
                className="flex-grow w-full h-full bg-[#1e1e1e] text-[#d4d4d4] p-4 font-mono text-sm outline-none resize-none"
                spellCheck="false"
                value={sourceCode}
                onChange={e => setSourceCode(e.target.value)}
             />
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={() => setStep(AppStep.CONFIGURATION)}>Zurück</Button>
        <Button onClick={() => setStep(AppStep.REVIEW)}>Zur Review</Button>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="max-w-2xl mx-auto w-full p-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-800 pb-4 flex items-center gap-3">
            <span className="text-forge-accent">04.</span> Finalisierung
        </h2>
        
        <div className="bg-forge-panel border border-gray-800 p-6 rounded space-y-4 mb-8">
            <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-400">Project</span>
                <span className="text-white font-mono">{metadata.projectName}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-400">Target</span>
                <span className="text-white font-mono">{config.architecture} / {config.outputType}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-400">Compiler</span>
                <span className="text-forge-accent font-mono">MS .NET Framework v4.0+ (Native)</span>
            </div>
            <div className="mt-4 p-4 bg-black/30 rounded border border-gray-800">
                <p className="text-xs text-gray-400 leading-relaxed">
                    <strong className="text-white">Build Methode:</strong> Aufgrund von Browser-Sicherheitsrichtlinien (Sandbox) generieren wir einen 
                    <span className="text-forge-accent"> Self-Compiling Hybrid Artifact</span>. 
                    Wenn Sie die heruntergeladene Datei starten, nutzt sie den in Windows integrierten Compiler (csc.exe), um die <span className="text-white">100% echte .exe</span> lokal auf Ihrem System zu erzeugen.
                    Das ist der einzige Weg, echten Maschinencode ohne Server-Backend zu erzeugen.
                </p>
            </div>
        </div>

        <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(AppStep.CODE_INPUT)}>Zurück</Button>
            <Button onClick={handleBuild} className="w-full ml-4">GENERATE .EXE ARTIFACT</Button>
        </div>
    </div>
  );

  const renderGeneration = () => (
    <div className="max-w-3xl mx-auto w-full p-6 flex flex-col h-full animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-3 h-3 bg-forge-accent rounded-full animate-pulse"></div>
            <h2 className="text-xl font-mono text-forge-accent">SYSTEM OUTPUT STREAM</h2>
        </div>

        <div className="flex-grow bg-black border border-gray-800 rounded p-4 font-mono text-sm overflow-y-auto mb-6 shadow-inner relative">
            {logs.map((log, i) => (
                <div key={i} className="mb-1 text-green-500/80 border-b border-gray-900/50 pb-1">
                    <span className="text-gray-600 mr-2">{log.split(']')[0]}]</span>
                    {log.split(']')[1]}
                </div>
            ))}
            <div className="animate-pulse text-forge-accent mt-2">_</div>
        </div>

        <div className="flex justify-center">
            <Button variant="secondary" onClick={() => {
                setStep(AppStep.WELCOME);
                setLogs([]);
            }}>Neues Projekt</Button>
        </div>
    </div>
  );

  return (
    <div className="bg-[#050505] min-h-screen text-gray-200 font-sans flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-gray-900 flex items-center px-6 justify-between bg-[#0a0a0c]">
            <div className="font-mono font-bold text-lg tracking-widest text-white flex items-center gap-2">
                <div className="w-2 h-2 bg-forge-accent"></div>
                EXEFORGE
            </div>
            <div className="text-xs text-gray-600 font-mono">
                BUILD V.2.0.4 // REACT // TAILWIND
            </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow flex flex-col relative overflow-hidden">
            {/* Background Grid Effect */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
                 style={{backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px'}}>
            </div>
            
            <div className="z-10 w-full h-full flex flex-col">
                {step === AppStep.WELCOME && renderWelcome()}
                {step === AppStep.METADATA && renderMetadata()}
                {step === AppStep.CONFIGURATION && renderConfig()}
                {step === AppStep.CODE_INPUT && renderCodeInput()}
                {step === AppStep.REVIEW && renderReview()}
                {step === AppStep.GENERATION && renderGeneration()}
            </div>
        </main>
    </div>
  );
}
