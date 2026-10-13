import React from "react";
import { Link } from "react-router-dom";
import {
    CheckCircle2,
    Sparkles,
    MapPin,
    Clock,
    ShieldCheck,
    Table2,
    MessageSquare,
    Cpu,
    ArrowRight,
    Workflow,
    Radio,
    FileSpreadsheet,
    CalendarCheck,
    Layers,
    Share2,
    Laptop,
    RotateCcw
} from "lucide-react";

export default function FeaturesBentoGrid() {
    return (
        <div className="bento-showcase-wrapper">
            {/* Main Section Header */}
            <div className="bento-main-header">
                <h2 className="bento-main-headline">
                    One simple app. <span className="bento-accent-green">Everything you need.</span>
                </h2>
                <p className="bento-main-subtext">
                    Core capabilities engineered to reduce attendance errors, enforce zero-proxy compliance, and accelerate payroll readiness.
                </p>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                ROW 1: Simple Time In & Time Out  +  Remix Your Reports
                (Strictly matched in height from top to bottom)
               ══════════════════════════════════════════════════════════════════ */}
            <div className="bento-row">
                {/* CARD 1: Simple Time In & Time Out */}
                <article className="bento-card">
                    <div className="bento-card-info">
                        <h3 className="bento-card-title">Simple Time In & Time Out</h3>
                        <p className="bento-card-desc">
                            Shoot with both facial verification and biometric geofence on your phone at the same time. One-click time logging designed for speed and sub-second sync.
                        </p>
                        <div className="bento-pill-tags">
                            <span className="bento-tag">One-Click Clock-In</span>
                            <span className="bento-tag">Face AI Verification</span>
                            <span className="bento-tag">Instant Sync</span>
                        </div>
                    </div>

                    <div className="bento-card-visual-wrap">
                        <div className="bento-visual-multicam">
                            {/* Layered phone peek behind (left) */}
                            <div className="phone-mockup-backdrop phone-backdrop-left">
                                <img src="/showcase/mobile.png" alt="Mobile preview left" />
                            </div>

                            {/* Layered phone peek behind (right) */}
                            <div className="phone-mockup-backdrop phone-backdrop-right">
                                <img src="/showcase/mobile.png" alt="Mobile preview right" />
                            </div>

                            {/* Center Phone Chassis */}
                            <div className="phone-chassis-main">
                                <div className="phone-island">
                                    <div className="phone-island-cam" />
                                    <div className="phone-island-sensor" />
                                </div>

                                <div className="phone-status-bar">
                                    <span>9:41</span>
                                    <div className="phone-status-icons">
                                        <div className="status-signal">●●●●</div>
                                        <div className="status-battery" />
                                    </div>
                                </div>

                                <div className="phone-screen-inner">
                                    {/* Inline SVG: Mobile Attendance UI */}
                                    <svg viewBox="0 0 180 320" className="phone-screen-img" xmlns="http://www.w3.org/2000/svg">
                                        <rect width="180" height="320" fill="#0F172A" />
                                        {/* Top bar */}
                                        <rect x="0" y="0" width="180" height="44" fill="#1E293B" />
                                        <text x="90" y="28" textAnchor="middle" fill="#94A3B8" fontSize="11" fontFamily="system-ui">Attendance</text>
                                        {/* Avatar */}
                                        <circle cx="90" cy="90" r="32" fill="#6366F1" opacity="0.2" />
                                        <circle cx="90" cy="90" r="22" fill="#6366F1" opacity="0.5" />
                                        <circle cx="90" cy="90" r="14" fill="#6366F1" />
                                        {/* Clock ring */}
                                        <circle cx="90" cy="90" r="36" fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="200 226" />
                                        {/* Punch In button */}
                                        <rect x="24" y="145" width="132" height="38" rx="19" fill="#10B981" />
                                        <text x="90" y="169" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="system-ui">CLOCK IN</text>
                                        {/* Status rows */}
                                        <rect x="16" y="200" width="148" height="22" rx="6" fill="#1E293B" />
                                        <circle cx="30" cy="211" r="5" fill="#10B981" />
                                        <text x="42" y="215" fill="#94A3B8" fontSize="9" fontFamily="system-ui">GPS: Main Office • 12m</text>
                                        <rect x="16" y="228" width="148" height="22" rx="6" fill="#1E293B" />
                                        <circle cx="30" cy="239" r="5" fill="#6366F1" />
                                        <text x="42" y="243" fill="#94A3B8" fontSize="9" fontFamily="system-ui">Face ID: Verified ✓</text>
                                        <rect x="16" y="256" width="148" height="22" rx="6" fill="#1E293B" />
                                        <circle cx="30" cy="267" r="5" fill="#F59E0B" />
                                        <text x="42" y="271" fill="#94A3B8" fontSize="9" fontFamily="system-ui">Shift: 09:00 – 18:00</text>
                                        {/* Bottom nav */}
                                        <rect x="0" y="290" width="180" height="30" fill="#1E293B" />
                                        <circle cx="36" cy="305" r="8" fill="#6366F1" opacity="0.6" />
                                        <circle cx="72" cy="305" r="8" fill="#334155" />
                                        <circle cx="108" cy="305" r="8" fill="#334155" />
                                        <circle cx="144" cy="305" r="8" fill="#334155" />
                                    </svg>
                                    <div className="phone-screen-neon-border" />
                                    <div className="phone-punch-ring">
                                        <div className="punch-ring-outer" />
                                        <div className="punch-ring-core" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bento-card-footer">
                        <Link to="/product/attendance-tracking" className="bento-explore-link">
                            Explore Time Tracking <ArrowRight size={15} />
                        </Link>
                    </div>
                </article>

                {/* CARD 2: Remix Your Reports */}
                <article className="bento-card">
                    <div className="bento-card-info">
                        <h3 className="bento-card-title">Remix Your Reports</h3>
                        <p className="bento-card-desc">
                            Choose from multiple matrix layouts, overtime calculations, and granular punch logs before or after payroll processing.
                        </p>
                        <div className="bento-pill-tags">
                            <span className="bento-tag">Daily/Weekly Matrix</span>
                            <span className="bento-tag">Overtime Calculations</span>
                            <span className="bento-tag">Audit-Proof Punch Logs</span>
                        </div>
                    </div>

                    <div className="bento-card-visual-wrap">
                        <div className="bento-visual-remix-grid">
                            {/* Sub-Card 1: Matrix View */}
                            <div className="remix-card remix-card-1">
                                <div className="remix-card-badge">Matrix View</div>
                                <div className="remix-mini-content">
                                    <div className="mini-grid-row">
                                        <span className="mini-pill present">P</span>
                                        <span className="mini-pill present">P</span>
                                        <span className="mini-pill present">P</span>
                                        <span className="mini-pill present">P</span>
                                    </div>
                                    <div className="mini-grid-row">
                                        <span className="mini-pill present">P</span>
                                        <span className="mini-pill late">L</span>
                                        <span className="mini-pill present">P</span>
                                        <span className="mini-pill present">P</span>
                                    </div>
                                    <div className="mini-stat-text">98.4% On-Time Attendance</div>
                                </div>
                                <div className="remix-card-glow" />
                            </div>

                            {/* Sub-Card 2: Overtime Split */}
                            <div className="remix-card remix-card-2">
                                <div className="remix-card-badge">Payroll Split</div>
                                <div className="remix-mini-content">
                                    <div className="mini-bars-wrap">
                                        <div className="mini-bar-track">
                                            <div className="mini-bar-fill bar-primary" style={{ width: "88%" }} />
                                        </div>
                                        <div className="mini-bar-track">
                                            <div className="mini-bar-fill bar-accent" style={{ width: "42%" }} />
                                        </div>
                                    </div>
                                    <div className="mini-stat-text">42.5 hrs Regular • 1.5x OT</div>
                                </div>
                                <div className="remix-card-glow" />
                            </div>

                            {/* Sub-Card 3: Audit Proof */}
                            <div className="remix-card remix-card-3">
                                <div className="remix-card-badge">Audit Proof</div>
                                <div className="remix-mini-content">
                                    <div className="mini-punch-stamp">
                                        <Clock size={16} className="text-emerald-400" />
                                        <span>09:00 AM • Verified</span>
                                    </div>
                                    <div className="mini-stat-text">GPS & Biometric Validated</div>
                                </div>
                                <div className="remix-card-glow" />
                            </div>
                        </div>
                    </div>

                    <div className="bento-card-footer">
                        <Link to="/features/comprehensive-reports" className="bento-explore-link">
                            Explore Matrix Reports <ArrowRight size={15} />
                        </Link>
                    </div>
                </article>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                ROW 2: Live Command Center  +  Advanced Geofencing
                (Strictly matched in height from top to bottom)
               ══════════════════════════════════════════════════════════════════ */}
            <div className="bento-row">
                {/* CARD 3: Live Command Center */}
                <article className="bento-card">
                    <div className="bento-card-info">
                        <h3 className="bento-card-title">Live Command Center</h3>
                        <p className="bento-card-desc">
                            Monitor your organization's heartbeat in vertical or horizontal orientation. Watch employee sessions pulse as they clock in globally.
                        </p>
                        <div className="bento-pill-tags">
                            <span className="bento-tag">Live Session Pulse</span>
                            <span className="bento-tag">Sub-Meter GPS</span>
                            <span className="bento-tag">Breach Flagging</span>
                        </div>
                    </div>

                    <div className="bento-card-visual-wrap">
                        <div className="bento-visual-landscape">
                            <div className="landscape-device-chassis">
                                <div className="landscape-side-notch">
                                    <div className="side-cam-dot" />
                                </div>

                                <div className="landscape-live-badge">
                                    <Radio size={13} className="live-icon-pulse text-rose-500" />
                                    <span>54 Active On-Site • Live GPS</span>
                                </div>

                                <div className="landscape-screen">
                                    {/* Inline SVG: Live Command Center Dashboard */}
                                    <svg viewBox="0 0 360 200" className="landscape-screen-img" xmlns="http://www.w3.org/2000/svg">
                                        <rect width="360" height="200" fill="#0F172A" />
                                        {/* Sidebar */}
                                        <rect x="0" y="0" width="52" height="200" fill="#1E293B" />
                                        <circle cx="26" cy="24" r="9" fill="#6366F1" />
                                        <rect x="10" y="44" width="32" height="5" rx="2.5" fill="#334155" />
                                        <rect x="10" y="54" width="32" height="5" rx="2.5" fill="#334155" />
                                        <rect x="10" y="64" width="32" height="5" rx="2.5" fill="#334155" />
                                        {/* Header bar */}
                                        <rect x="52" y="0" width="308" height="28" fill="#1E293B" />
                                        <text x="64" y="18" fill="#94A3B8" fontSize="9" fontFamily="system-ui">Live Attendance Dashboard</text>
                                        <circle cx="326" cy="14" r="5" fill="#10B981" />
                                        <circle cx="340" cy="14" r="5" fill="#334155" />
                                        {/* KPI cards */}
                                        <rect x="60" y="36" width="58" height="44" rx="6" fill="#1E293B" />
                                        <text x="89" y="57" textAnchor="middle" fill="#10B981" fontSize="14" fontWeight="bold" fontFamily="system-ui">54</text>
                                        <text x="89" y="71" textAnchor="middle" fill="#64748B" fontSize="7" fontFamily="system-ui">ON-SITE</text>
                                        <rect x="126" y="36" width="58" height="44" rx="6" fill="#1E293B" />
                                        <text x="155" y="57" textAnchor="middle" fill="#EF4444" fontSize="14" fontWeight="bold" fontFamily="system-ui">8</text>
                                        <text x="155" y="71" textAnchor="middle" fill="#64748B" fontSize="7" fontFamily="system-ui">ABSENT</text>
                                        <rect x="192" y="36" width="58" height="44" rx="6" fill="#1E293B" />
                                        <text x="221" y="57" textAnchor="middle" fill="#F59E0B" fontSize="14" fontWeight="bold" fontFamily="system-ui">3</text>
                                        <text x="221" y="71" textAnchor="middle" fill="#64748B" fontSize="7" fontFamily="system-ui">LATE</text>
                                        <rect x="258" y="36" width="58" height="44" rx="6" fill="#1E293B" />
                                        <text x="287" y="57" textAnchor="middle" fill="#8B5CF6" fontSize="14" fontWeight="bold" fontFamily="system-ui">12</text>
                                        <text x="287" y="71" textAnchor="middle" fill="#64748B" fontSize="7" fontFamily="system-ui">OVERTIME</text>
                                        {/* Employee list rows */}
                                        {[0,1,2,3,4,5].map((i) => (
                                            <g key={i}>
                                                <rect x="60" y={90 + i * 17} width="296" height="14" rx="3" fill={i % 2 === 0 ? '#1E293B' : '#172033'} />
                                                <circle cx="72" cy={97 + i * 17} r="4" fill={['#10B981','#10B981','#EF4444','#10B981','#F59E0B','#10B981'][i]} />
                                                <rect x="82" y={94 + i * 17} width="60" height="5" rx="2" fill="#334155" />
                                                <rect x="148" y={94 + i * 17} width="40" height="5" rx="2" fill="#334155" />
                                                <rect x="200" y={94 + i * 17} width="30" height="5" rx="2" fill="#334155" />
                                                <rect x="320" y={93 + i * 17} width="28" height="7" rx="3" fill={['#10B981','#10B981','#EF4444','#10B981','#F59E0B','#10B981'][i]} opacity="0.25" />
                                                <text x="334" y={99 + i * 17} textAnchor="middle" fill={['#10B981','#10B981','#EF4444','#10B981','#F59E0B','#10B981'][i]} fontSize="6" fontFamily="system-ui">{['IN','IN','OUT','IN','LATE','IN'][i]}</text>
                                            </g>
                                        ))}
                                    </svg>
                                    <div className="landscape-neon-border" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bento-card-footer">
                        <Link to="/features/live-attendance" className="bento-explore-link">
                            Explore Live Command Center <ArrowRight size={15} />
                        </Link>
                    </div>
                </article>

                {/* CARD 4: Advanced Geofencing */}
                <article className="bento-card">
                    <div className="bento-card-info">
                        <h3 className="bento-card-title">Advanced Geofencing</h3>
                        <p className="bento-card-desc">
                            Draw authorized zones and radiuses directly on Google Maps. Ensure employees are physically present with dynamic boundary enforcement.
                        </p>
                        <div className="bento-pill-tags">
                            <span className="bento-tag">Google Maps API</span>
                            <span className="bento-tag">Dynamic Multi-Site</span>
                            <span className="bento-tag">100m Radius Lock</span>
                        </div>
                    </div>

                    <div className="bento-card-visual-wrap">
                        <div className="bento-visual-device-map">
                            <div className="device-map-chassis">
                                <div className="device-map-screen">
                                    {/* Inline SVG: Geofencing Map */}
                                    <svg viewBox="0 0 260 220" className="device-map-img" style={{display:'block',width:'100%',height:'100%'}} xmlns="http://www.w3.org/2000/svg">
                                        {/* Map background */}
                                        <rect width="260" height="220" fill="#1A2744" />
                                        {/* Road grid */}
                                        <line x1="0" y1="80" x2="260" y2="80" stroke="#243358" strokeWidth="12" />
                                        <line x1="0" y1="160" x2="260" y2="160" stroke="#243358" strokeWidth="8" />
                                        <line x1="80" y1="0" x2="80" y2="220" stroke="#243358" strokeWidth="10" />
                                        <line x1="180" y1="0" x2="180" y2="220" stroke="#243358" strokeWidth="8" />
                                        {/* Building blocks */}
                                        <rect x="90" y="90" width="70" height="55" rx="4" fill="#243870" />
                                        <rect x="15" y="18" width="50" height="48" rx="3" fill="#243870" />
                                        <rect x="190" y="90" width="50" height="45" rx="3" fill="#243870" />
                                        <rect x="15" y="90" width="50" height="55" rx="3" fill="#1E3A6A" />
                                        <rect x="190" y="15" width="55" height="52" rx="3" fill="#1E3A6A" />
                                        <rect x="15" y="170" width="50" height="38" rx="3" fill="#243870" />
                                        <rect x="190" y="170" width="55" height="38" rx="3" fill="#1E3A6A" />
                                        {/* Geofence rings */}
                                        <circle cx="125" cy="117" r="80" fill="none" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.5" />
                                        <circle cx="125" cy="117" r="56" fill="none" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
                                        <circle cx="125" cy="117" r="32" fill="#6366F1" fillOpacity="0.1" stroke="#6366F1" strokeWidth="2" />
                                        {/* Center pin */}
                                        <circle cx="125" cy="117" r="10" fill="#6366F1" />
                                        <circle cx="125" cy="117" r="5" fill="white" />
                                        <line x1="125" y1="107" x2="125" y2="88" stroke="#6366F1" strokeWidth="1.5" />
                                        {/* User dots */}
                                        <circle cx="108" cy="104" r="5" fill="#10B981" stroke="white" strokeWidth="1.5" />
                                        <circle cx="138" cy="128" r="5" fill="#10B981" stroke="white" strokeWidth="1.5" />
                                        <circle cx="145" cy="105" r="5" fill="#10B981" stroke="white" strokeWidth="1.5" />
                                        <circle cx="108" cy="130" r="5" fill="#EF4444" stroke="white" strokeWidth="1.5" />
                                        {/* Accuracy label */}
                                        <rect x="158" y="50" width="70" height="18" rx="4" fill="#0F172A" opacity="0.85" />
                                        <text x="193" y="62" textAnchor="middle" fill="#10B981" fontSize="8" fontFamily="system-ui">100m Radius</text>
                                    </svg>

                                    <div className="floating-geofence-pill">
                                        <div className="geo-pill-dot" />
                                        <div className="geo-pill-text">
                                            <span className="geo-loc-name">HQ Main Campus • Site A</span>
                                            <span className="geo-loc-radius">Radius: 100m • GPS Verified Inside</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bento-card-footer">
                        <Link to="/features/geo-fencing" className="bento-explore-link">
                            Explore Geofencing <ArrowRight size={15} />
                        </Link>
                    </div>
                </article>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                ROW 3: Ask AI HR Assistant  +  Generative Policy Builder & DAR
                (Strictly matched in height from top to bottom)
               ══════════════════════════════════════════════════════════════════ */}
            <div className="bento-row">
                {/* CARD 5: Ask AI HR Assistant */}
                <article className="bento-card">
                    <div className="bento-card-info">
                        <h3 className="bento-card-title">Ask AI HR Assistant</h3>
                        <p className="bento-card-desc">
                            A conversational AI copilot trained on your internal policies. Employees get instant, cited answers rather than generating HR tickets.
                        </p>
                        <div className="bento-pill-tags">
                            <span className="bento-tag">NLP Policy Query</span>
                            <span className="bento-tag">Handbook § Citations</span>
                            <span className="bento-tag">24/7 Availability</span>
                        </div>
                    </div>

                    <div className="bento-card-visual-wrap">
                        <div className="bento-visual-framed">
                            <div className="bento-window-frame">
                                <div className="window-frame-bar">
                                    <div className="window-dots">
                                        <span className="dot red" />
                                        <span className="dot yellow" />
                                        <span className="dot green" />
                                    </div>
                                    <span className="window-title">MANO AI Assistant • Handbook Citations</span>
                                </div>
                                <div className="window-body">
                                    {/* Inline SVG: AI HR Chat Interface */}
                                    <svg viewBox="0 0 320 200" className="window-img" xmlns="http://www.w3.org/2000/svg">
                                        <rect width="320" height="200" fill="#0F172A" />
                                        {/* Left sidebar */}
                                        <rect x="0" y="0" width="72" height="200" fill="#1E293B" />
                                        <text x="36" y="20" textAnchor="middle" fill="#64748B" fontSize="7" fontFamily="system-ui">HISTORY</text>
                                        {[0,1,2,3].map(i => <rect key={i} x="8" y={28 + i * 16} width="56" height="11" rx="4" fill={i === 0 ? '#6366F1' : '#243058'} />)}
                                        {/* Main chat area */}
                                        <rect x="72" y="0" width="248" height="200" fill="#0F172A" />
                                        {/* AI response bubble */}
                                        <rect x="82" y="14" width="180" height="58" rx="8" fill="#1E293B" />
                                        <circle cx="96" cy="30" r="8" fill="#8B5CF6" />
                                        <text x="108" y="27" fill="#C4B5FD" fontSize="7" fontFamily="system-ui" fontWeight="bold">MANO AI</text>
                                        <rect x="96" y="34" width="156" height="5" rx="2" fill="#334155" />
                                        <rect x="96" y="43" width="130" height="5" rx="2" fill="#334155" />
                                        <rect x="96" y="52" width="100" height="5" rx="2" fill="#334155" />
                                        {/* Citation chip */}
                                        <rect x="96" y="61" width="100" height="8" rx="4" fill="#6366F1" fillOpacity="0.2" />
                                        <text x="102" y="68" fill="#818CF8" fontSize="6" fontFamily="system-ui">📎 Handbook § 4.2</text>
                                        {/* User message */}
                                        <rect x="152" y="84" width="148" height="30" rx="8" fill="#312E81" />
                                        <rect x="160" y="93" width="132" height="5" rx="2" fill="#818CF8" />
                                        <rect x="160" y="102" width="90" height="5" rx="2" fill="#818CF8" />
                                        {/* AI response 2 */}
                                        <rect x="82" y="126" width="180" height="40" rx="8" fill="#1E293B" />
                                        <circle cx="96" cy="138" r="8" fill="#8B5CF6" />
                                        <rect x="110" y="133" width="140" height="5" rx="2" fill="#334155" />
                                        <rect x="110" y="142" width="110" height="5" rx="2" fill="#334155" />
                                        <rect x="110" y="151" width="80" height="5" rx="2" fill="#334155" />
                                        {/* Input bar */}
                                        <rect x="82" y="176" width="228" height="18" rx="9" fill="#1E293B" />
                                        <text x="94" y="188" fill="#475569" fontSize="8" fontFamily="system-ui">Ask a HR question...</text>
                                        <rect x="294" y="179" width="12" height="12" rx="6" fill="#6366F1" />
                                    </svg>

                                    <div className="floating-citation-chip">
                                        <div className="citation-header">
                                            <Sparkles size={14} className="text-purple-400" />
                                            <span>Instant Answer & Handbook Citation</span>
                                        </div>
                                        <p className="citation-quote">
                                            "How many paid leaves can I carry forward to next year?"
                                        </p>
                                        <div className="citation-tag">
                                            <CheckCircle2 size={12} /> Citing Employee Handbook § 4.2
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bento-card-footer">
                        <Link to="/ai/ask-hr-assistant" className="bento-explore-link">
                            Explore AI Assistant <ArrowRight size={15} />
                        </Link>
                    </div>
                </article>

                {/* CARD 6: Generative Policy Builder & DAR */}
                <article className="bento-card">
                    <div className="bento-card-info">
                        <h3 className="bento-card-title">Generative Policy Builder & DAR</h3>
                        <p className="bento-card-desc">
                            Create complex shift rules in seconds using natural language prompts. Synthesize team productivity themes and detect bottlenecks automatically.
                        </p>
                        <div className="bento-pill-tags">
                            <span className="bento-tag">Prompt-to-Form</span>
                            <span className="bento-tag">Weekly DAR Themes</span>
                            <span className="bento-tag">Automated Guardrails</span>
                        </div>
                    </div>

                    <div className="bento-card-visual-wrap">
                        <div className="bento-visual-action-panel">
                            <div className="action-panel-box">
                                <div className="action-panel-row">
                                    <div className="action-row-left">
                                        <div className="action-icon-pill purple">
                                            <Sparkles size={16} />
                                        </div>
                                        <span className="action-label">Generate Shift Policy from Prompt</span>
                                    </div>
                                    <span className="action-badge">AI Draft</span>
                                </div>

                                <div className="action-panel-row">
                                    <div className="action-row-left">
                                        <div className="action-icon-pill blue">
                                            <Cpu size={16} />
                                        </div>
                                        <span className="action-label">Synthesize Daily Activity Reports</span>
                                    </div>
                                    <span className="action-badge">Weekly</span>
                                </div>

                                <div className="action-panel-row">
                                    <div className="action-row-left">
                                        <div className="action-icon-pill emerald">
                                            <FileSpreadsheet size={16} />
                                        </div>
                                        <span className="action-label">Export Payroll Matrix (Excel / PDF)</span>
                                    </div>
                                    <span className="action-badge">One-Click</span>
                                </div>
                            </div>

                            <div className="action-toolbar-dock">
                                <button type="button" className="dock-btn active" title="AI Policies">
                                    <Sparkles size={17} />
                                </button>
                                <button type="button" className="dock-btn" title="Shift Layouts">
                                    <Layers size={17} />
                                </button>
                                <button type="button" className="dock-btn" title="Security & Biometrics">
                                    <ShieldCheck size={17} />
                                </button>
                                <button type="button" className="dock-btn" title="Geofencing">
                                    <MapPin size={17} />
                                </button>
                                <button type="button" className="dock-btn" title="Live Sync">
                                    <RotateCcw size={17} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bento-card-footer">
                        <Link to="/ai/generative-policy-builder" className="bento-explore-link">
                            Explore Policy Builder <ArrowRight size={15} />
                        </Link>
                    </div>
                </article>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                ROW 4: Chat & Collaboration  +  Holiday & Leave Management
                (Strictly matched in height from top to bottom)
               ══════════════════════════════════════════════════════════════════ */}
            <div className="bento-row">
                {/* CARD 7: Chat & Team Collaboration */}
                <article className="bento-card">
                    <div className="bento-card-info">
                        <h3 className="bento-card-title">Chat & Collaboration</h3>
                        <p className="bento-card-desc">
                            Keep your distributed team closely connected. Real-time direct messaging, dedicated department channels, emoji reactions, and instant typing cues.
                        </p>
                        <div className="bento-pill-tags">
                            <span className="bento-tag">1-on-1 Direct Messaging</span>
                            <span className="bento-tag">Department Channels</span>
                            <span className="bento-tag">FCM Push Alerts</span>
                        </div>
                    </div>

                    <div className="bento-card-visual-wrap">
                        <div className="bento-visual-framed">
                            <div className="bento-window-frame">
                                <div className="window-frame-bar">
                                    <div className="window-dots">
                                        <span className="dot red" />
                                        <span className="dot yellow" />
                                        <span className="dot green" />
                                    </div>
                                    <span className="window-title">Team Collaboration • Channels</span>
                                    <div className="presence-live-dot" title="24 Online">
                                        <span className="dot-pulse" />
                                        <span className="dot-text">Active Now</span>
                                    </div>
                                </div>
                                <div className="window-body">
                                    {/* Inline SVG: Team Chat & Collaboration */}
                                    <svg viewBox="0 0 320 180" className="window-img" xmlns="http://www.w3.org/2000/svg">
                                        <rect width="320" height="180" fill="#0F172A" />
                                        {/* Left channel list */}
                                        <rect x="0" y="0" width="80" height="180" fill="#1E293B" />
                                        <text x="8" y="16" fill="#64748B" fontSize="7" fontFamily="system-ui">CHANNELS</text>
                                        {['#general','#dev','#design','#ops','#hr'].map((ch, i) => (
                                            <g key={ch}>
                                                <rect x="4" y={22 + i * 18} width="72" height="14" rx="4" fill={i === 0 ? '#312E81' : 'transparent'} />
                                                <text x="10" y={33 + i * 18} fill={i === 0 ? '#A5B4FC' : '#64748B'} fontSize="7.5" fontFamily="system-ui">{ch}</text>
                                            </g>
                                        ))}
                                        <line x1="0" y1="118" x2="80" y2="118" stroke="#2D3748" strokeWidth="1" />
                                        <text x="8" y="132" fill="#64748B" fontSize="7" fontFamily="system-ui">DIRECT</text>
                                        {['@alice','@bob','@carol'].map((u, i) => (
                                            <g key={u}>
                                                <circle cx="14" cy={146 + i * 13} r="4" fill={['#10B981','#10B981','#F59E0B'][i]} />
                                                <text x="22" y={150 + i * 13} fill="#64748B" fontSize="7" fontFamily="system-ui">{u}</text>
                                            </g>
                                        ))}
                                        {/* Chat area */}
                                        {[{x:88,y:12,w:180,h:30,col:'#1E293B',tc:'#64748B',name:'Alice'},{x:88,y:50,w:140,h:24,col:'#1E293B',tc:'#64748B',name:'Bob'},{x:88,y:82,w:200,h:34,col:'#312E81',tc:'#818CF8',name:'You'}].map((b,i)=>(
                                            <g key={i}>
                                                <circle cx={b.x - 2} cy={b.y + 10} r="7" fill={['#6366F1','#10B981','#6366F1'][i]} />
                                                <rect x={b.x + 10} y={b.y} width={b.w} height={b.h} rx="8" fill={b.col} />
                                                <text x={b.x + 18} y={b.y + 12} fill={b.tc} fontSize="7" fontFamily="system-ui" fontWeight="bold">{b.name}</text>
                                                <rect x={b.x + 18} y={b.y + 18} width={b.w - 24} height="5" rx="2" fill="#334155" />
                                                {b.h > 30 && <rect x={b.x + 18} y={b.y + 27} width={b.w - 60} height="5" rx="2" fill="#334155" />}
                                            </g>
                                        ))}
                                        {/* Emoji reactions */}
                                        <rect x="102" y="124" width="28" height="12" rx="6" fill="#1E293B" />
                                        <text x="116" y="133" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="system-ui">👍 3</text>
                                        <rect x="134" y="124" width="28" height="12" rx="6" fill="#1E293B" />
                                        <text x="148" y="133" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="system-ui">🎉 2</text>
                                        {/* Typing indicator */}
                                        <rect x="88" y="142" width="70" height="18" rx="9" fill="#1E293B" />
                                        <text x="98" y="154" fill="#64748B" fontSize="8" fontFamily="system-ui">Bob is typing</text>
                                        <circle cx="156" cy="151" r="2" fill="#64748B" />
                                        <circle cx="162" cy="151" r="2" fill="#64748B" opacity="0.6" />
                                        <circle cx="168" cy="151" r="2" fill="#64748B" opacity="0.3" />
                                        {/* Input */}
                                        <rect x="88" y="164" width="222" height="12" rx="6" fill="#1E293B" />
                                        <text x="96" y="173" fill="#475569" fontSize="7" fontFamily="system-ui">Message #general...</text>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bento-card-footer">
                        <Link to="/features/chat-collaboration" className="bento-explore-link">
                            Explore Team Chat <ArrowRight size={15} />
                        </Link>
                    </div>
                </article>

                {/* CARD 8: Holiday & Leave Management */}
                <article className="bento-card">
                    <div className="bento-card-info">
                        <h3 className="bento-card-title">Holiday & Leave Management</h3>
                        <p className="bento-card-desc">
                            Simplify time-off requests with unified leave governance. Manage holiday calendars, track accruals, and automate approval workflows effortlessly.
                        </p>
                        <div className="bento-pill-tags">
                            <span className="bento-tag">Self-Service Requests</span>
                            <span className="bento-tag">Multi-Level Approvals</span>
                            <span className="bento-tag">Holiday Calendars</span>
                        </div>
                    </div>

                    <div className="bento-card-visual-wrap">
                        <div className="bento-visual-framed">
                            <div className="bento-window-frame">
                                <div className="window-frame-bar">
                                    <div className="window-dots">
                                        <span className="dot red" />
                                        <span className="dot yellow" />
                                        <span className="dot green" />
                                    </div>
                                    <span className="window-title">Leave Governance • Approvals</span>
                                </div>
                                <div className="window-body">
                                    {/* Inline SVG: Holiday & Leave Management */}
                                    <svg viewBox="0 0 320 190" className="window-img" xmlns="http://www.w3.org/2000/svg">
                                        <rect width="320" height="190" fill="#0F172A" />
                                        {/* Calendar header */}
                                        <rect x="0" y="0" width="320" height="32" fill="#1E293B" />
                                        <text x="16" y="21" fill="#94A3B8" fontSize="11" fontFamily="system-ui" fontWeight="bold">October 2025</text>
                                        <rect x="260" y="8" width="48" height="16" rx="8" fill="#10B981" fillOpacity="0.2" />
                                        <text x="284" y="20" textAnchor="middle" fill="#10B981" fontSize="8" fontFamily="system-ui">+ Request</text>
                                        {/* Weekday header */}
                                        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
                                            <text key={d} x={16 + i * 42} y="50" fill={d === 'Sun' ? '#EF4444' : '#64748B'} fontSize="8" fontFamily="system-ui">{d}</text>
                                        ))}
                                        {/* Calendar grid - rows of day cells */}
                                        {[
                                            ['', '', 1, 2, 3, 4, 5],
                                            [6, 7, 8, 9, 10, 11, 12],
                                            [13, 14, 15, 16, 17, 18, 19],
                                            [20, 21, 22, 23, 24, 25, 26]
                                        ].map((week, ri) => week.map((day, ci) => {
                                            if (!day) return null;
                                            const isLeave = [15,16,17].includes(Number(day));
                                            const isHoliday = [11].includes(Number(day));
                                            const isToday = day === 13;
                                            return (
                                                <g key={`${ri}-${ci}`}>
                                                    <rect
                                                        x={8 + ci * 42} y={56 + ri * 30}
                                                        width="34" height="24" rx="6"
                                                        fill={isToday ? '#6366F1' : isLeave ? '#0EA5E9' : isHoliday ? '#8B5CF6' : 'transparent'}
                                                        fillOpacity={isToday || isLeave || isHoliday ? 0.25 : 0}
                                                    />
                                                    <text
                                                        x={25 + ci * 42} y={72 + ri * 30}
                                                        textAnchor="middle"
                                                        fill={isToday ? '#818CF8' : isLeave ? '#38BDF8' : isHoliday ? '#A78BFA' : ci === 6 ? '#EF4444' : '#94A3B8'}
                                                        fontSize="9" fontFamily="system-ui" fontWeight={isToday ? 'bold' : 'normal'}
                                                    >{day}</text>
                                                </g>
                                            );
                                        }))}
                                        {/* Legend */}
                                        <rect x="8" y="178" width="10" height="6" rx="3" fill="#0EA5E9" />
                                        <text x="22" y="184" fill="#64748B" fontSize="7" fontFamily="system-ui">Annual Leave</text>
                                        <rect x="90" y="178" width="10" height="6" rx="3" fill="#8B5CF6" />
                                        <text x="104" y="184" fill="#64748B" fontSize="7" fontFamily="system-ui">Holiday</text>
                                        <rect x="156" y="178" width="10" height="6" rx="3" fill="#6366F1" />
                                        <text x="170" y="184" fill="#64748B" fontSize="7" fontFamily="system-ui">Today</text>
                                    </svg>

                                    <div className="floating-approval-pill">
                                        <div className="approval-avatar">
                                            <CalendarCheck size={16} className="text-emerald-400" />
                                        </div>
                                        <div className="approval-info">
                                            <span className="approval-status">Annual Leave • 3 Days</span>
                                            <span className="approval-sub">Approved by Manager</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bento-card-footer">
                        <Link to="/product/leave-management" className="bento-explore-link">
                            Explore Leave Management <ArrowRight size={15} />
                        </Link>
                    </div>
                </article>
            </div>
        </div>
    );
}
