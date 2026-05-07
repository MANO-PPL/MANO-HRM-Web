import React, { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { pageContent } from "../siteData";
import { CheckCircle2, ArrowRight, ChevronRight } from "lucide-react";

export default function GenericPage() {
    const { pathname } = useLocation();
    const content = pageContent[pathname];

    if (!content) {
        return (
            <div className="min-h-screen flex items-center justify-center site-bg text-white">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">Page Not Found</h1>
                    <Link to="/" className="text-blue-400 hover:underline">Return Home</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="site-bg min-h-screen pt-24 pb-20 px-6 sm:px-10">
            <div className="max-w-6xl mx-auto">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-8 uppercase tracking-widest">
                    <Link to="/" className="hover:text-blue-400 transition-colors">Home</Link>
                    <ChevronRight size={14} />
                    <span className="text-gray-300">{content.title}</span>
                </nav>

                <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
                            {content.title}
                        </h1>
                        <p className="text-lg text-gray-300 leading-relaxed mb-8">
                            {content.intro}
                        </p>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl mb-8">
                            <p className="text-gray-400 leading-relaxed italic">
                                "{content.body}"
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <Link to="/login" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2">
                                Get Started <ArrowRight size={18} />
                            </Link>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative"
                    >
                        <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full" />
                        <div className="relative bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                            <img 
                                src={content.image || "/showcase/dashboard.png"} 
                                alt={content.title} 
                                className="w-full h-auto block"
                            />
                        </div>
                    </motion.div>
                </div>

                {/* Points / Features */}
                {content.points && (
                    <div className="mb-20">
                        <div className="flex items-center gap-3 mb-10">
                            <div className="h-px flex-1 bg-white/10" />
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest">Key Capabilities</h2>
                            <div className="h-px flex-1 bg-white/10" />
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {content.points.map((point, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-start gap-4 hover:border-blue-500/30 transition-all group"
                                >
                                    <div className="p-1.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                        <CheckCircle2 size={18} className="text-blue-400" />
                                    </div>
                                    <span className="text-gray-300 font-medium">{point}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sections */}
                {content.sections && (
                    <div className="space-y-16">
                        {content.sections.map((section, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/10 rounded-3xl p-8 lg:p-12">
                                <h3 className="text-2xl font-bold text-white mb-4">{section.title}</h3>
                                <p className="text-gray-400 mb-8 max-w-3xl leading-relaxed">{section.body}</p>
                                
                                {section.bullets && (
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {section.bullets.map((bullet, bidx) => (
                                            <div key={bidx} className="flex items-center gap-3 text-gray-300 bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                {bullet}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
