import React from 'react';

export default function MacWindow({ children, src, alt, className = "" }) {
    return (
        <div className={`rounded-xl border border-white/10 bg-black/60 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden ${className}`}>
            {/* Window Title Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/5 select-none">
                {/* Window Controls */}
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]" />
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
                    <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]" />
                </div>
                {/* Browser Address Bar (Fake) */}
                <div className="flex-1 max-w-sm sm:max-w-md mx-auto h-6 bg-white/5 border border-white/5 rounded-md flex items-center justify-center text-[10px] text-gray-500 font-mono tracking-wide">
                    attendance.mano.co.in
                </div>
                {/* Right Spacer (to balance buttons) */}
                <div className="w-12" />
            </div>
            {/* Window Content */}
            <div className="relative overflow-hidden bg-black/20">
                {children ? children : (
                    <img 
                        src={src} 
                        alt={alt} 
                        className="w-full h-auto block object-cover object-top" 
                        loading="lazy"
                    />
                )}
            </div>
        </div>
    );
}
