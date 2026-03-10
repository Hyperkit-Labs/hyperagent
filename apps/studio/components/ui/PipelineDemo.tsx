"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, ShieldCheck, Rocket, Code2, CheckCircle2 } from "lucide-react";

export function PipelineDemo() {
  const [step, setStep] = useState(0); // 0: spec, 1: codegen, 2: audit, 3: deploy
  const [typing, setTyping] = useState("");
  const fullText = "Build a secure vault contract";
  const [cursorPos, setCursorPos] = useState({ x: 30, y: 120 });
  const [cursorClick, setCursorClick] = useState(false);

  useEffect(() => {
    let active = true;

    const loop = async () => {
      while (active) {
        // Step 0: Spec - Typing
        setStep(0);
        setCursorPos({ x: 250, y: 120 });
        setTyping("");
        for (let i = 0; i <= fullText.length; i++) {
          if (!active) return;
          setTyping(fullText.slice(0, i));
          await new Promise(r => setTimeout(r, 40));
        }
        await new Promise(r => setTimeout(r, 400));
        
        // Move to generate
        if (!active) return;
        setCursorPos({ x: 370, y: 45 });
        await new Promise(r => setTimeout(r, 600));
        setCursorClick(true);
        await new Promise(r => setTimeout(r, 200));
        setCursorClick(false);
        
        // Step 1: Codegen
        if (!active) return;
        setStep(1);
        setCursorPos({ x: 280, y: 100 }); // move out of way
        await new Promise(r => setTimeout(r, 1500)); // simulate generating
        
        // Move to audit
        if (!active) return;
        setCursorPos({ x: 370, y: 45 });
        await new Promise(r => setTimeout(r, 600));
        setCursorClick(true);
        await new Promise(r => setTimeout(r, 200));
        setCursorClick(false);
        
        // Step 2: Audit
        if (!active) return;
        setStep(2);
        setCursorPos({ x: 250, y: 110 });
        await new Promise(r => setTimeout(r, 1500)); // simulate auditing
        
        // Move to deploy
        if (!active) return;
        setCursorPos({ x: 370, y: 45 });
        await new Promise(r => setTimeout(r, 600));
        setCursorClick(true);
        await new Promise(r => setTimeout(r, 200));
        setCursorClick(false);
        
        // Step 3: Deploy
        if (!active) return;
        setStep(3);
        setCursorPos({ x: 180, y: 130 });
        await new Promise(r => setTimeout(r, 2000));
        
        // Reset
      }
    };
    
    loop();
    
    return () => { active = false; };
  }, []);

  return (
    <div className="relative w-full max-w-[445px] h-[160px] rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] overflow-hidden shadow-[10px_10px_30px_#000000,-10px_-10px_30px_#1a1a24] transition-all">
      {/* macOS dots */}
      <div className="absolute top-0 inset-x-0 h-8 bg-transparent flex items-center px-3 gap-1.5 z-10">
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-semantic-error)]/60 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.2),1px_1px_2px_rgba(0,0,0,0.5)]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-semantic-warning)]/60 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.2),1px_1px_2px_rgba(0,0,0,0.5)]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-semantic-success)]/60 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.2),1px_1px_2px_rgba(0,0,0,0.5)]" />
        <div className="ml-auto text-[10px] font-mono text-[var(--color-text-muted)] tracking-wider opacity-60">hyperagent.exe</div>
      </div>
      
      {/* Content Area */}
      <div className="absolute inset-0 pt-8 p-5">
        <div className="absolute inset-x-4 inset-y-10 rounded-lg shadow-[inset_4px_4px_10px_#000000,inset_-4px_-4px_10px_#1a1a24] pointer-events-none" />
        <div className="relative h-full w-full px-2">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col justify-center relative">
              <div className="flex items-center gap-2 text-[var(--color-primary-light)] mb-2">
                <Terminal className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Specification</span>
              </div>
              <div className="text-sm text-[var(--color-text-secondary)] font-mono drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                <span className="text-emerald-400">❯</span> {typing}
                <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-2 h-4 bg-[var(--color-primary)] ml-1 align-middle shadow-[0_0_8px_var(--color-primary)]" />
              </div>
              <div className="absolute -top-1 right-0">
                <div className="px-3 py-1 rounded-md bg-[var(--color-bg-base)] text-[var(--color-primary-light)] text-[10px] font-semibold shadow-[3px_3px_6px_#000000,-3px_-3px_6px_#1a1a24] border border-white/5">Generate</div>
              </div>
            </motion.div>
          )}
          
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col relative">
              <div className="flex items-center gap-2 text-[var(--color-semantic-info)] mb-2 mt-1">
                <Code2 className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider drop-shadow-md">Codegen</span>
              </div>
              <div className="text-[10px] font-mono text-[var(--color-text-secondary)] space-y-1 mt-1">
                <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} className="overflow-hidden whitespace-nowrap text-[var(--color-primary-light)] drop-shadow-[0_0_2px_var(--color-primary-alpha-50)]">contract Vault {'{'}</motion.div>
                <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ delay: 0.2 }} className="overflow-hidden whitespace-nowrap pl-4 opacity-80">mapping(address ={'>'} uint256) balances;</motion.div>
                <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ delay: 0.4 }} className="overflow-hidden whitespace-nowrap pl-4 text-[var(--color-semantic-info)]">function deposit() public payable {'{'}</motion.div>
                <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ delay: 0.6 }} className="overflow-hidden whitespace-nowrap pl-8">balances[msg.sender] += msg.value;</motion.div>
                <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ delay: 0.8 }} className="overflow-hidden whitespace-nowrap pl-4 text-[var(--color-semantic-info)]">{'}'}</motion.div>
              </div>
              <div className="absolute -top-1 right-0">
                <div className="px-3 py-1 rounded-md bg-[var(--color-bg-base)] text-[var(--color-semantic-info)] text-[10px] font-semibold shadow-[3px_3px_6px_#000000,-3px_-3px_6px_#1a1a24] border border-white/5">Audit</div>
              </div>
            </motion.div>
          )}
          
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col justify-center relative">
              <div className="flex items-center gap-2 text-[var(--color-semantic-warning)] mb-3">
                <ShieldCheck className="w-4 h-4 drop-shadow-[0_0_4px_var(--color-semantic-warning)]" />
                <span className="text-xs font-semibold uppercase tracking-wider">Security Audit</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] font-mono">
                  <div className="w-3 h-3 rounded-full bg-[var(--color-bg-base)] shadow-[inset_1px_1px_3px_#000000,inset_-1px_-1px_3px_#1a1a24] flex items-center justify-center">
                    <CheckCircle2 className="w-2.5 h-2.5 text-[var(--color-semantic-success)]" />
                  </div>
                   Slither analysis passed
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] font-mono">
                  <div className="w-3 h-3 rounded-full bg-[var(--color-bg-base)] shadow-[inset_1px_1px_3px_#000000,inset_-1px_-1px_3px_#1a1a24] flex items-center justify-center">
                    <CheckCircle2 className="w-2.5 h-2.5 text-[var(--color-semantic-success)]" />
                  </div>
                   Reentrancy guards verified
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--color-semantic-success)] font-mono font-medium mt-1 drop-shadow-md">
                  0 vulnerabilities found.
                </div>
              </div>
              <div className="absolute -top-1 right-0">
                <div className="px-3 py-1 rounded-md bg-[var(--color-bg-base)] text-[var(--color-semantic-warning)] text-[10px] font-semibold shadow-[3px_3px_6px_#000000,-3px_-3px_6px_#1a1a24] border border-white/5">Deploy</div>
              </div>
            </motion.div>
          )}
          
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col justify-center items-center text-center">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                transition={{ type: "spring" }}
                className="w-12 h-12 rounded-full bg-[var(--color-bg-base)] shadow-[5px_5px_10px_#000000,-5px_-5px_10px_#1a1a24] flex items-center justify-center mb-3 text-[var(--color-semantic-success)] border border-white/5"
              >
                <Rocket className="w-5 h-5 drop-shadow-[0_0_8px_var(--color-semantic-success)]" />
              </motion.div>
              <div className="text-sm font-medium text-[var(--color-semantic-success)] mb-1 drop-shadow-md">Successfully Deployed</div>
              <div className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-base)] shadow-[inset_2px_2px_5px_#000000,inset_-2px_-2px_5px_#1a1a24] px-3 py-1.5 rounded-md">
                0x71C...9731
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* Scripted Cursor */}
      <motion.div
        className="absolute z-50 pointer-events-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] origin-top-left"
        animate={{ 
          x: cursorPos.x, 
          y: cursorPos.y,
          scale: cursorClick ? 0.8 : 1
        }}
        transition={{ 
          x: { type: "spring", stiffness: 80, damping: 20 },
          y: { type: "spring", stiffness: 80, damping: 20 },
          scale: { duration: 0.1 }
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="filter drop-shadow-md">
          <path d="M5.5 3L19.5 12L12 13.5L8.5 21L5.5 3Z" fill="#a78bfa" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </motion.div>
    </div>
  );
}