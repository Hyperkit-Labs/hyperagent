'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { 
  Paperclip, 
  Palette, 
  MessageSquare, 
  ArrowUp,
  ChevronRight,
  Sparkles,
  Zap,
  Shield,
  Activity,
  Code2,
  Globe,
  Lock,
  Cpu
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');

  const handleBuild = () => {
    if (!prompt.trim()) return;
    router.push(`/workflows/create?prompt=${encodeURIComponent(prompt)}`);
  };

    const templates = [
      {
        title: "Mantle Bridge DApp",
        description: "Cross-chain bridge for ERC20/ETH",
        image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80",
        link: "/workflows/create?prompt=Deploy a cross-chain bridge for ERC20 and ETH between Sepolia and Mantle"
      },
      {
        title: "Avalanche DeFi Studio",
        description: "Launch DEX or Liquidity Pools",
        image: "https://images.unsplash.com/photo-1639322537228-f710d846310a?w=800&q=80",
        link: "/avax/studio"
      },
      {
        title: "NFT Marketplace Hub",
        description: "End-to-end NFT minting & sales",
        image: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&q=80",
        link: "/workflows/create?prompt=Create a comprehensive NFT marketplace with minting, bidding, and secondary sales"
      },
      {
        title: "DAO Governance Portal",
        description: "On-chain voting & treasury management",
        image: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&q=80",
        link: "/workflows/create?prompt=Deploy a DAO governance system with treasury management and weighted voting"
      }
    ];


  return (
    <div className="relative w-full bg-[#030712] text-white selection:bg-blue-500/30">
      {/* Hero Section */}
      <section className="relative flex w-full flex-col items-center justify-center min-h-[95vh] overflow-hidden px-6 pt-20 pb-32">
        {/* Animated Web3 Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100" />
        </div>

        <div className="relative z-10 w-full max-w-5xl flex flex-col items-center text-center">
          {/* Top Pill Link */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl text-[13px] font-medium text-blue-400 ring-1 ring-white/10 group cursor-default">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Build End-to-End Web3 Applications
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-6xl md:text-8xl font-bold tracking-tight leading-[1.05] mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40"
          >
            The Intelligent <br /> Web3 Architect
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xl md:text-2xl text-gray-400 max-w-3xl mb-12 font-medium"
          >
            Deploy cross-chain bridges, smart contracts, and full-stack dApps 
            with AI-driven ROMA reasoning and x402 payment security.
          </motion.p>

          {/* Action Bar / Search Input */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full max-w-3xl"
          >
            <div className="relative group bg-gray-900/50 backdrop-blur-2xl p-2 rounded-[32px] shadow-2xl ring-1 ring-white/10 flex flex-col gap-2 transition-all focus-within:ring-blue-500/50 focus-within:bg-gray-900/80">
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleBuild())}
                placeholder="Deploy a bridge from Sepolia to Mantle with USDC support..."
                className="w-full bg-transparent border-none resize-none px-6 pt-5 pb-2 text-[18px] focus:ring-0 placeholder:text-gray-600 min-h-[80px] text-white"
              />
              
              <div className="flex items-center justify-between gap-2 px-3 pb-3">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-10 px-4 rounded-full text-gray-400 hover:text-white hover:bg-white/5 gap-2 border border-white/5">
                    <Code2 className="w-4 h-4" />
                    <span className="hidden md:inline font-medium text-[13px]">Solidity</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-10 px-4 rounded-full text-gray-400 hover:text-white hover:bg-white/5 gap-2 border border-white/5">
                    <Globe className="w-4 h-4" />
                    <span className="hidden md:inline font-medium text-[13px]">Network</span>
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hidden md:block text-[12px] text-gray-600 font-medium px-3 italic">ROMA Reasoning Active</span>
                  <Button 
                    onClick={handleBuild}
                    className="h-10 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 gap-2"
                  >
                    Build
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Templates Section */}
      <section className="max-w-[1440px] mx-auto px-6 py-32 border-t border-white/5">
        <div className="flex flex-col gap-16">
          <div className="flex items-end justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold mb-4 uppercase tracking-wider">
                Blueprints
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">Start from a Template</h2>
              <p className="text-xl text-gray-500">Verified end-to-end architectures for Web3 ecosystems.</p>
            </div>
            <Link href="/templates" className="group flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white transition-colors">
              Explores All Blueprints
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {templates.map((template, i) => (
              <motion.div
                key={template.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                onClick={() => router.push(template.link)}
                className="group cursor-pointer relative"
              >
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden mb-6 bg-gray-900 ring-1 ring-white/10 group-hover:ring-blue-500/50 transition-all">
                  <img 
                    src={template.image} 
                    alt={template.title}
                    className="object-cover w-full h-full opacity-60 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <Button className="w-full bg-white text-black font-bold h-10 rounded-xl">Use Blueprint</Button>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{template.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{template.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Features - Web3 Pillars */}
      <section className="bg-white/[0.02] py-32 border-y border-white/5">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {[
              { 
                icon: Zap, 
                label: "x402 Protocol", 
                desc: "Micro-payment verification for AI reasoning steps, ensuring fair computation exchange.",
                color: "text-blue-400"
              },
              { 
                icon: Lock, 
                label: "TEE Security", 
                desc: "Trusted Execution Environments for secure smart contract auditing and deployment.",
                color: "text-purple-400"
              },
              { 
                icon: Cpu, 
                label: "ROMA Planner", 
                desc: "Advanced multi-step reasoning that handles complex cross-chain logic automatically.",
                color: "text-emerald-400"
              },
              { 
                icon: Shield, 
                label: "Audit Guard", 
                desc: "Real-time vulnerability detection for every smart contract before it hits mainnet.",
                color: "text-red-400"
              },
            ].map((feature) => (
              <div key={feature.label} className="flex flex-col gap-6 p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-all group">
                <div className={`w-12 h-12 bg-gray-900 rounded-2xl shadow-inner flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white mb-3">{feature.label}</h4>
                  <p className="text-gray-500 leading-relaxed text-sm">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-blue-600 to-purple-700 p-16 rounded-[48px] shadow-2xl shadow-blue-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
          <h2 className="text-4xl md:text-5xl font-bold mb-8 relative z-10">Ready to build the <br /> future of Web3?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <Link href="/workflows/create">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-10 h-14 rounded-2xl shadow-xl">
                Start Building Now
              </Button>
            </Link>
            <Link href="/templates">
              <Button size="lg" variant="ghost" className="text-white hover:bg-white/10 font-bold px-10 h-14 rounded-2xl border border-white/20">
                Browse Templates
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
