"use client";

import { motion } from 'framer-motion';
import { useWorkflowProgress } from '@/hooks/useWorkflowProgress';
import Brain from 'lucide-react/dist/esm/icons/brain'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Shield from 'lucide-react/dist/esm/icons/shield'
import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical'
import Link2 from 'lucide-react/dist/esm/icons/link-2'

interface DynamicIslandProps {
  workflowId: string;
}

const STAGE_CONFIG = {
  planning: { 
    label: "AI is Architecting", 
    icon: Brain,
    color: "bg-blue-500" 
  },
  generation: { 
    label: "Generating Code", 
    icon: Zap,
    color: "bg-purple-500" 
  },
  audit: { 
    label: "Security Scrutiny", 
    icon: Shield,
    color: "bg-green-500" 
  },
  testing: { 
    label: "Running Tests", 
    icon: FlaskConical,
    color: "bg-yellow-500" 
  },
  deployment: { 
    label: "Finalizing", 
    icon: Link2,
    color: "bg-indigo-500" 
  }
};

export function DynamicIsland({ workflowId }: DynamicIslandProps) {
  const { progress, stage, status, isConnected } = useWorkflowProgress(workflowId);
  
  const currentStage = STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG] || STAGE_CONFIG.planning;
  const Icon = currentStage.icon;
  
  if (status === 'completed') {
    return null;
  }
  
  return (
    <motion.div
      className={`fixed top-4 right-4 rounded-full px-6 py-3 ${currentStage.color} text-white shadow-lg z-50`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      layout
    >
      <div className="flex items-center gap-3">
        <motion.div
          key={stage}
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Icon className="w-5 h-5" />
        </motion.div>
        
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{currentStage.label}</span>
          <div className="w-32 h-1 bg-white/30 rounded-full overflow-hidden mt-1">
            <motion.div
              className="h-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
        
        <span className="text-sm font-mono">{Math.round(progress)}%</span>
        
        {!isConnected && (
          <span className="text-xs opacity-70">Reconnecting...</span>
        )}
      </div>
    </motion.div>
  );
}

