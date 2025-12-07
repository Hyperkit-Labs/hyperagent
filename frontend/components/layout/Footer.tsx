'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Github, ExternalLink, Sparkles } from 'lucide-react';

export function Footer() {
  const footerLinks = {
    resources: [
      { href: 'https://hyperionkit.xyz', label: 'HyperionKit', external: true },
      { href: 'https://github.com/HyperionKit/HyperAgent', label: 'GitHub', external: true },
      { href: '/docs', label: 'Documentation', external: false },
    ],
    quickLinks: [
      { href: '/workflows', label: 'Workflows' },
      { href: '/avax/studio', label: 'Avalanche Studio' },
      { href: '/monitoring', label: 'Monitoring' },
    ],
  };

  return (
    <footer className="bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20 border-t border-gray-200/50 mt-auto">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-8 lg:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <div className="flex items-center space-x-3">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="w-10 h-10 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                HyperAgent
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed max-w-xs font-medium">
              AI Agent Platform for On-Chain Smart Contract Generation. 
              Transform ideas into production-ready contracts.
            </p>
          </motion.div>

          {/* Resources */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-4"
          >
            <h3 className="font-semibold text-gray-900 text-lg">Resources</h3>
            <div className="flex flex-col space-y-3">
              {footerLinks.resources.map((link) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors group font-medium"
                >
                  {link.label}
                  {link.external && (
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            <h3 className="font-semibold text-gray-900 text-lg">Quick Links</h3>
            <div className="flex flex-col space-y-3">
              {footerLinks.quickLinks.map((link) => (
                <motion.div key={link.href} whileHover={{ x: 4 }}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-700 hover:text-blue-600 transition-colors font-medium"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Copyright */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="pt-8 border-t border-gray-200/50"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-700 font-medium">
              © {new Date().getFullYear()} HyperAgent. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/HyperionKit/HyperAgent"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-700 hover:text-gray-900 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
