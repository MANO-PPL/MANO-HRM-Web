import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

const LoadingScreen = ({
    message = "Securing connection...",
    isSuperAdmin = false,
    fullScreen = true,
    brandSubtitle = isSuperAdmin ? 'INTERNAL' : 'ATTENDANCE',
    size = 'default'
}) => {
    const isSmall = size === 'sm';

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={
                fullScreen 
                    ? "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 dark:bg-[#010404] transition-colors duration-500 font-poppins select-none"
                    : `w-full h-full ${isSmall ? 'min-h-[160px] py-6' : 'min-h-[220px] py-10'} flex flex-col items-center justify-center bg-transparent transition-colors duration-500 font-poppins select-none px-4`
            }
        >
            {/* Background Blurs - Only for fullScreen or as a soft inline effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div 
                    animate={{ 
                        scale: [1, 1.15, 1],
                        opacity: [0.3, 0.45, 0.3]
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className={
                        fullScreen 
                            ? "absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"
                            : "absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[60px] rounded-full"
                    }
                />
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.4, 0.3]
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2
                    }}
                    className={
                        fullScreen 
                            ? "absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/5 dark:bg-violet-600/10 blur-[100px] rounded-full"
                            : "absolute bottom-[10%] right-[10%] w-[35%] h-[35%] bg-violet-600/5 dark:bg-violet-600/10 blur-[50px] rounded-full"
                    }
                />
                {fullScreen && <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.01] dark:opacity-[0.02] pointer-events-none" />}
            </div>

            {/* Core Loading Container */}
            <div className={`relative z-10 flex flex-col items-center ${isSmall ? 'gap-2.5' : 'gap-3.5'} text-center px-4 max-w-sm`}>
                {/* Brand Icon Outer Container */}
                <div className="relative flex items-center justify-center">
                    {/* Pulsing Outer Gradient Ring */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.2, 0.4, 0.2]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className={`absolute ${isSmall ? 'w-14 h-14 rounded-2xl' : 'w-20 h-20 rounded-[1.5rem]'} bg-gradient-to-tr from-indigo-500 to-violet-500 opacity-20 dark:opacity-30 blur-md`} 
                    />
                    
                    {/* Rotating Spinner Border */}
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className={`absolute ${isSmall ? 'w-11 h-11 rounded-lg' : 'w-16 h-16 rounded-[1rem]'} border-2 border-indigo-500/15 border-t-indigo-500 dark:border-indigo-400/15 dark:border-t-indigo-400`} 
                    />
                    
                    {/* Central Icon Box */}
                    <motion.div 
                        initial={{ scale: 0.8, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 100, damping: 15 }}
                        className={`${isSmall ? 'w-9 h-9 rounded-lg' : 'w-12 h-12 rounded-xl'} bg-white dark:bg-[#0d1117] flex items-center justify-center border border-slate-200/80 dark:border-[#30363d] shadow-xl relative`}
                    >
                        {isSuperAdmin ? (
                            <ShieldAlert className={`${isSmall ? 'w-4.5 h-4.5' : 'w-6 h-6'} text-amber-500 dark:text-amber-400`} />
                        ) : (
                            <img src="/mano-logo.svg" alt="MANO" className={`${isSmall ? 'w-4.5 h-4.5' : 'w-6 h-6'}`} />
                        )}
                    </motion.div>
                </div>

                {/* Loading Status Information */}
                <div className="space-y-1 mt-1">
                    <motion.h2 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className={`${isSmall ? 'text-[10px]' : 'text-xs'} font-semibold text-slate-800 dark:text-[#f0f6fc] uppercase tracking-[0.3em]`}
                    >
                        MANO <span className="text-indigo-600 dark:text-indigo-400 font-medium">{brandSubtitle}</span>
                    </motion.h2>
                    <motion.p 
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className={`${isSmall ? 'text-[8.5px]' : 'text-[9.5px]'} text-slate-500 dark:text-[#8b949e] font-medium tracking-wider uppercase`}
                    >
                        {message}
                    </motion.p>
                </div>
            </div>
        </motion.div>
    );
};

export default LoadingScreen;
