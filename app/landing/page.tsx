"use client";

import { motion } from "framer-motion";
import { Sparkles, Shield, Zap, Globe, ChevronRight, ArrowRight, Database, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Shield,
    title: "Privacy First",
    description: "End-to-End Encryption ensures only you can read your journal. Not even we can see your data."
  },
  {
    icon: Sparkles,
    title: "AI Wisdom",
    description: "Gemini-powered insights help you summarize your days and polish your emotional flow."
  },
  {
    icon: Zap,
    title: "Mind Palace",
    description: "A beautifully animated overview of your consistency and journey through time."
  },
  {
    icon: Database,
    title: "The Vault",
    description: "Secure, searchable, and organized. Your entire history, perfectly preserved."
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-amber-200 dark:selection:bg-amber-900 selection:text-amber-900 dark:selection:text-amber-100">
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/50 dark:bg-black/50 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-900">
        <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
              <span className="text-white dark:text-black font-black text-lg">D</span>
            </div>
            <span className="text-sm font-bold tracking-[0.3em] uppercase">Dainiki</span>
          </div>
          <Link href="/">
            <Button variant="ghost" className="rounded-xl text-xs font-bold uppercase tracking-widest">Enter Vault</Button>
          </Link>
        </nav>
      </header>

      <main className="pt-20">
        {/* Hero Section */}
        <section className="px-6 py-24 lg:py-40 max-w-7xl mx-auto text-center relative overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mb-8 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              <Globe className="h-3 w-3" /> Built for your private world
            </div>
            <h1 className="text-6xl lg:text-8xl font-black tracking-tighter mb-8 leading-[0.9]">
              The majestic home for <br />
              <span className="bg-gradient-to-r from-amber-500 to-rose-500 bg-clip-text text-transparent italic">your inner voice.</span>
            </h1>
            <p className="text-lg lg:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed font-serif italic">
              Experience journaling reimagined with End-to-End Encryption, AI-powered reflections, and an aesthetic Mind Palace.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/">
                <Button className="h-14 px-8 rounded-xl text-sm font-bold uppercase tracking-widest bg-zinc-900 dark:bg-white text-white dark:text-black hover:scale-105 transition-transform">
                  Start Journaling Free
                </Button>
              </Link>
              <Button variant="ghost" className="h-14 px-8 rounded-xl text-sm font-bold uppercase tracking-widest group">
                Learn Privacy <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>

          {/* Decorative gradients */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 blur-[120px] opacity-20 pointer-events-none">
             <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-amber-500 rounded-full" />
             <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-rose-500 rounded-full" />
          </div>
        </section>

        {/* Features Grid */}
        <section className="px-6 py-24 bg-zinc-50 dark:bg-zinc-900/30">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((feature, i) => (
              <motion.div 
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-white dark:bg-black p-8 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6 text-zinc-900 dark:text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Call to Action */}
        <section className="px-6 py-40 max-w-5xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-zinc-900 dark:bg-white p-12 lg:p-24 rounded-[3rem] text-white dark:text-black relative overflow-hidden"
          >
            <h2 className="text-4xl lg:text-6xl font-black tracking-tight mb-8">Ready to enter your sanctuary?</h2>
            <Link href="/">
              <Button className="h-16 px-12 rounded-xl text-sm font-bold uppercase tracking-widest bg-white dark:bg-zinc-900 text-black dark:text-white hover:scale-105 transition-transform">
                Open My Vault
              </Button>
            </Link>
            
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          </motion.div>
        </section>
      </main>

      <footer className="px-6 py-20 border-t border-zinc-100 dark:border-zinc-900 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-400 mb-4">© 2026 Dainiki</p>
        <p className="text-xs text-zinc-500">The most aesthetic, private, and intelligent journaling experience on the web.</p>
      </footer>
    </div>
  );
}
