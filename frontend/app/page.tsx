'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { 
  Paperclip, 
  Palette, 
  MessageSquare, 
  ArrowUp,
  ChevronRight,
  Sparkles,
  Zap,
  Shield,
  Activity
} from 'lucide-react';

export default function Home() {
  const templates = [
    {
      title: "Ecommerce store",
      description: "Premium design for webstore",
      image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80",
    },
    {
      title: "Architect portfolio",
      description: "Firm website & showcase",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
    },
    {
      title: "Personal blog",
      description: "Muted, intimate design",
      image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80",
    },
    {
      title: "Fashion blog",
      description: "Minimal, playful design",
      image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
    }
  ];

  return (
    <div className="relative w-full">
      {/* Hero Section */}
      <section className="relative flex w-full flex-col items-center justify-center min-h-[85vh] overflow-hidden px-6 pt-20 pb-32">
        {/* Vibrant Gradient Background */}
        <div className="absolute inset-0 z-0 bg-[#fcfaef]">
          <div 
            className="absolute top-0 left-0 w-full h-[70vh] opacity-90 blur-[100px] animate-gradient-pulse"
            style={{
              background: 'radial-gradient(circle at 50% 0%, #ff2d55 0%, #ff9500 50%, #ffcc00 100%)',
              transform: 'scale(1.5)',
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-4xl flex flex-col items-center text-center">
          {/* Top Pill Link */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link 
              href="/workflows/create"
              className="flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-[13px] font-medium text-white hover:bg-white/20 transition-colors"
            >
              <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-[#ff2d55]" />
              </div>
              Build with AI Agent
              <ChevronRight className="w-3 h-3 ml-1" />
            </Link>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-5xl md:text-7xl font-semibold text-white tracking-tight leading-[1.1] mb-6"
          >
            Build something <br /> <span className="text-white/90">HyperAgent</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xl md:text-2xl text-white/80 max-w-2xl mb-12 font-medium"
          >
            Create smart contracts and workflows by chatting with AI
          </motion.p>

          {/* Action Bar / Search Input */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full max-w-3xl"
          >
            <div className="relative group bg-white/95 backdrop-blur-xl p-2 rounded-[28px] shadow-2xl ring-1 ring-black/5 flex flex-col gap-2 transition-all focus-within:ring-black/10">
              <textarea 
                placeholder="What would you like to build?"
                className="w-full bg-transparent border-none resize-none px-4 pt-4 pb-2 text-[17px] focus:ring-0 placeholder:text-gray-400 min-h-[60px]"
              />
              
              <div className="flex items-center gap-2 px-2 pb-2">
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" className="h-9 px-3 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 gap-2">
                    <Paperclip className="w-4 h-4" />
                    <span className="hidden md:inline font-medium text-[13px]">Attach</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 px-3 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 gap-2">
                    <Palette className="w-4 h-4" />
                    <span className="hidden md:inline font-medium text-[13px]">Theme</span>
                  </Button>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-9 px-4 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 gap-2 font-medium text-[13px]">
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </Button>
                  <Button size="icon" className="h-9 w-9 bg-gray-900 hover:bg-gray-800 text-white rounded-full">
                    <ArrowUp className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Templates Section */}
      <section className="max-w-[1440px] mx-auto px-6 py-24">
        <div className="flex flex-col gap-12">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-gray-900 mb-2">Discover templates</h2>
              <p className="text-lg text-gray-500">Start your next project with a template</p>
            </div>
            <Link href="/templates" className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {templates.map((template, i) => (
              <motion.div
                key={template.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group cursor-pointer"
              >
                <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 bg-gray-100 ring-1 ring-black/5">
                  <img 
                    src={template.image} 
                    alt={template.title}
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                </div>
                <h3 className="text-[15px] font-semibold text-gray-900 mb-0.5">{template.title}</h3>
                <p className="text-[13px] text-gray-500">{template.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Subtle Platform Features */}
      <section className="bg-gray-50/50 py-24">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {[
              { icon: Zap, label: "Fast Deployment", desc: "One-click deployment to multiple chains" },
              { icon: Shield, label: "Security Audit", desc: "Automated AI-driven vulnerability detection" },
              { icon: Activity, label: "Monitoring", desc: "Real-time health and performance metrics" },
              { icon: Sparkles, label: "AI Reasoning", desc: "Advanced ROMA planner for complex tasks" },
            ].map((feature) => (
              <div key={feature.label} className="flex flex-col gap-4">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm ring-1 ring-black/5 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">{feature.label}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
