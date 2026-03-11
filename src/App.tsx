import { useState, useEffect, useRef, useCallback } from "react";

const FREE_LIMIT = 3;
const FILLER_WORDS = ['um','uh','like','you know','literally','basically','right','so','actually','kind of','sort of','i mean','you see','well','okay so','and then','but then'];
const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY || '';

function detectFillers(text: string) {
  const lower = text.toLowerCase();
  const found: Record<string, number> = {};
  FILLER_WORDS.forEach(fw => {
    const regex = new RegExp(`\\b${fw}\\b`, 'gi');
    const m = lower.match(regex);
    if (m && m.length > 0) found[fw] = m.length;
  });
  return found;
}

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const sw = 10;
  const radius = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * radius;
  const color = score >= 8 ? '#22c55e' : score >= 6 ? '#f59e0b' : '#ef4444';
  const offset = circ - (displayed / 10) * circ;

  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1400, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayed(+(score * ease).toFixed(1));
      if (p < 1) requestAnimationFrame(step);
      else setDisplayed(score);
    };
    requestAnimationFrame(step);
  }, [score]);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize: size*0.24, fontWeight:900, color, fontFamily:'"Playfair Display",serif', lineHeight:1 }}>{displayed}</span>
        <span style={{ fontSize: size*0.1, color:'rgba(255,255,255,0.4)', marginTop:2 }}>/10</span>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, [string, string]> = {
    low: ['#22c55e','rgba(34,197,94,0.1)'],
    medium: ['#f59e0b','rgba(245,158,11,0.1)'],
    high: ['#ef4444','rgba(239,68,68,0.1)']
  };
  const [text, bg] = map[severity?.toLowerCase()] || ['#94a3b8','rgba(148,163,184,0.1)'];
  return <span style={{ background:bg, color:text, border:`1px solid ${text}44`, borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{severity}</span>;
}

const G = {
  bg:'#07080f', surface:'#0e1018', card:'#13151f', border:'#1e2235',
  accent:'#6366f1', accentGlow:'rgba(99,102,241,0.25)', accentSoft:'rgba(99,102,241,0.12)',
  text:'#f1f3f9', muted:'#6b7280', gold:'#f59e0b',
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body { width:100%; min-height:100vh; background:${G.bg}; overflow-x:hidden; }
  body { color:${G.text}; font-family:'Outfit',sans-serif; }
  #root { width:100%; min-height:100vh; background:${G.bg}; }
  ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:#1e2235; border-radius:2px; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
  @keyframes recPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 60%{box-shadow:0 0 0 10px rgba(239,68,68,0)} }
  .fadeUp { animation:fadeUp 0.5s ease forwards; }
  .scaleIn { animation:scaleIn 0.25s ease forwards; }
  .btn { cursor:pointer; border:none; outline:none; transition:all 0.18s; font-family:'Outfit',sans-serif; }
  .btn:hover { opacity:0.86; transform:translateY(-1px); }
  .btn:active { transform:translateY(0); }
  input,textarea { outline:none; font-family:'Outfit',sans-serif; }
  textarea:focus, input:focus { border-color:#6366f1 !important; }
`;


const Footer = ({ onPrivacy }: { onPrivacy: () => void }) => (
  <footer style={{ textAlign:'center', padding:'24px 20px', borderTop:`1px solid #1e2235`, marginTop:40 }}>
    <p style={{ fontSize:12, color:'#6b7280' }}>
      © {new Date().getFullYear()} LionMountain Pictures LLC · SpeakCoach AI
      {' · '}
      <button onClick={onPrivacy} style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', fontSize:12, textDecoration:'underline', padding:0 }}>
        Privacy Policy
      </button>
    </p>
  </footer>
);


export default function App() {
  const [screen, setScreen] = useState('home');
  const [user, setUser] = useState<any>(null);
  const [analysesUsed, setAnalysesUsed] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [mode, setMode] = useState('record');

  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [pauses, setPauses] = useState<any[]>([]);
  const [camError, setCamError] = useState<string|null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [apiError, setApiError] = useState<string|null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecRef = useRef<MediaRecorder|null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream|null>(null);
  const timerRef = useRef<any>(null);
  const pauseFrameRef = useRef<any>(null);
  const lastSoundRef = useRef(Date.now());
  const pausesRef = useRef<any[]>([]);

  useEffect(() => {
    const u = localStorage.getItem('sc_user');
    const n = localStorage.getItem('sc_uses');
    if (u) setUser(JSON.parse(u));
    if (n) setAnalysesUsed(parseInt(n) || 0);
  }, []);

  const canAnalyze = user?.isPaid || analysesUsed < FREE_LIMIT;
  const remaining = Math.max(0, FREE_LIMIT - analysesUsed);

  const saveUser = (u: any) => { setUser(u); localStorage.setItem('sc_user', JSON.stringify(u)); };

  const handleAuth = () => {
    if (!authEmail.includes('@')) return;
    saveUser({ email: authEmail, isPaid: false });
    setShowAuth(false);
  };

  const handleUpgrade = (plan: string) => {
    if (!user) { setShowUpgrade(false); setShowAuth(true); return; }
    saveUser({ ...user, isPaid: true, plan });
    setShowUpgrade(false);
  };

  const startRecording = async () => {
    if (!canAnalyze) { setShowUpgrade(true); return; }
    setCamError(null); setTranscript(''); setPauses([]);
    audioChunksRef.current = []; pausesRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; }

      const audioStream = new MediaStream(stream.getAudioTracks());
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(audioStream, { mimeType });
      mediaRecRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(500);

      setRecording(true); setRecTime(0);
      timerRef.current = setInterval(() => {
        setRecTime(t => { if (t >= 59) { stopRecording(); return 60; } return t + 1; });
      }, 1000);

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(audioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      lastSoundRef.current = Date.now();

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
        const now = Date.now();
        if (avg > 8) {
          const gap = now - lastSoundRef.current;
          if (gap > 2000 && pausesRef.current.length < 20) {
            pausesRef.current.push({ duration: gap });
            setPauses([...pausesRef.current]);
          }
          lastSoundRef.current = now;
        }
        pauseFrameRef.current = requestAnimationFrame(checkVolume);
      };
      pauseFrameRef.current = requestAnimationFrame(checkVolume);

    } catch {
      setCamError('No camera/microphone access. Please allow permissions in your browser settings and try again.');
    }
  };

  const stopRecording = useCallback((): Promise<Blob> => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(pauseFrameRef.current);

    return new Promise<Blob>((resolve) => {
      if (!mediaRecRef.current || mediaRecRef.current.state === 'inactive') {
        resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        return;
      }
      mediaRecRef.current.onstop = () => {
        resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
      };
      mediaRecRef.current.stop();
    }).then((blob) => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setRecording(false);
      return blob;
    });
  }, []);

  const handleStopAndTranscribe = async () => {
    setTranscribing(true);
    setApiError(null);
    try {
      const audioBlob = await stopRecording();
      const text = await transcribeWithWhisper(audioBlob);
      setTranscript(text);
    } catch (err: any) {
      setApiError('Transcription failed: ' + (err.message || 'Unknown error'));
    } finally {
      setTranscribing(false);
    }
  };

  const transcribeWithWhisper = async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Transcription error');
    }
    const data = await res.json();
    return data.text || '';
  };

  const runAnalysis = async (text: string, duration: number, pauseData: any[]) => {
    setApiError(null); setAnalysisStep(0); setScreen('analyzing');
    const timers = [1800, 3600, 5400].map((ms, i) => setTimeout(() => setAnalysisStep(i + 1), ms));

    try {
      const fillers = detectFillers(text);
      const fillerStr = Object.entries(fillers).map(([w, c]) => `"${w}"(${c}x)`).join(', ') || 'none detected';
      const words = text.trim().split(/\s+/).length;
      const wpm = Math.round(words / Math.max(duration / 60, 0.5));
      const longPauses = pauseData.filter(p => p.duration > 3000).length;

      const prompt = `You are a world-class rhetoric coach and communication trainer. Analyze this speech transcript with precision and honesty.

TRANSCRIPT:
"${text}"

METRICS:
- Duration: ${duration} seconds
- Total words: ${words}
- Words per minute: ${wpm} (ideal range: 130–160 WPM)
- Filler words detected: ${fillerStr}
- Long pauses (>3s): ${longPauses}
- Total pauses detected: ${pauseData.length}

Respond ONLY with valid JSON. No text before or after, no markdown backticks:

{"overallScore":<integer 1-10>,"summary":"<3 sentences: direct, honest assessment>","categories":[{"name":"Speech Flow","score":<1-10>,"icon":"🗣️","comment":"<1 specific sentence>"},{"name":"Tone & Expression","score":<1-10>,"icon":"🎵","comment":"<1 specific sentence>"},{"name":"Clarity & Structure","score":<1-10>,"icon":"🧩","comment":"<1 specific sentence>"},{"name":"Speaking Pace","score":<1-10>,"icon":"⏱️","comment":"<1 sentence referencing the ${wpm} WPM>"},{"name":"Confidence & Presence","score":<1-10>,"icon":"💪","comment":"<1 specific sentence>"}],"issues":[{"type":"Filler Words","severity":"<low|medium|high>","detail":"<specific assessment>"},{"type":"Pauses & Hesitations","severity":"<low|medium|high>","detail":"<specific assessment>"},{"type":"Sentence Structure","severity":"<low|medium|high>","detail":"<specific observation>"},{"type":"Persuasiveness","severity":"<low|medium|high>","detail":"<honest assessment>"}],"tips":["<Tip 1>","<Tip 2>","<Tip 3>","<Tip 4>","<Tip 5>"]}`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 1500,
          messages: [
            { role: 'system', content: 'You are a world-class rhetoric and communication coach. Always respond with valid JSON only, no markdown, no extra text.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw = data.choices[0].message.content;
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      timers.forEach(clearTimeout);
      setAnalysisStep(4);
      const newCount = analysesUsed + 1;
      setAnalysesUsed(newCount);
      localStorage.setItem('sc_uses', newCount.toString());
      setTimeout(() => { setResults(parsed); setScreen('results'); }, 700);

    } catch (err: any) {
      timers.forEach(clearTimeout);
      setApiError('Analysis failed: ' + (err.message || 'Unknown error'));
      setScreen('record');
    }
  };

  const handleAnalyze = () => {
    if (!transcript || transcript.trim().split(/\s+/).length < 15) {
      setApiError('Not enough speech detected. Please speak for at least 20–30 seconds.');
      return;
    }
    runAnalysis(transcript, recTime, pausesRef.current);
  };

  const reset = () => {
    setScreen('record'); setTranscript(''); setPauses([]);
    audioChunksRef.current = []; pausesRef.current = [];
    setRecTime(0); setResults(null); setApiError(null); setMode('record');
  };

  const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20, backdropFilter:'blur(10px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:22, padding:32, width:'100%', maxWidth:480 }} className="scaleIn">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h3 style={{ fontSize:20, fontFamily:'"Playfair Display",serif', fontWeight:900 }}>{title}</h3>
          <button className="btn" onClick={onClose} style={{ background:G.surface, border:`1px solid ${G.border}`, color:G.muted, width:30, height:30, borderRadius:7, fontSize:14 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );

  const HomeScreen = () => (
    <div style={{ width:'100%', background:G.bg }}>
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 40px', borderBottom:`1px solid ${G.border}`, background:`${G.surface}dd`, backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>🎙️</div>
          <span style={{ fontSize:18, fontWeight:700, fontFamily:'"Playfair Display",serif' }}>SpeakCoach<span style={{ color:G.accent }}>AI</span></span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {user ? (
            <>
              {user.isPaid && <span style={{ background:`linear-gradient(135deg,${G.gold},#d97706)`, color:'#000', fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:20 }}>PRO</span>}
              <span style={{ color:G.muted, fontSize:13 }}>{user.email}</span>
              <button className="btn" onClick={() => { setUser(null); localStorage.removeItem('sc_user'); }} style={{ color:G.muted, background:'none', fontSize:13, padding:'6px 12px', border:`1px solid ${G.border}`, borderRadius:8 }}>Logout</button>
            </>
          ) : (
            <button className="btn" onClick={() => setShowAuth(true)} style={{ color:G.text, background:G.card, fontSize:14, fontWeight:600, padding:'8px 18px', border:`1px solid ${G.border}`, borderRadius:10 }}>Sign In</button>
          )}
          <button className="btn" onClick={() => { if (!canAnalyze) setShowUpgrade(true); else setScreen('record'); }}
            style={{ background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, color:'#fff', fontSize:14, fontWeight:700, padding:'8px 20px', borderRadius:10 }}>
            Try Now →
          </button>
        </div>
      </nav>

      <div style={{ maxWidth:880, margin:'0 auto', padding:'72px 40px 56px', textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:G.accentSoft, border:`1px solid ${G.accent}44`, borderRadius:20, padding:'5px 14px', marginBottom:26, fontSize:13, color:G.accent, fontWeight:600 }}>
          ✨ AI-Powered Speech & Presence Analysis
        </div>
        <h1 style={{ fontSize:'clamp(34px,6vw,68px)', fontFamily:'"Playfair Display",serif', fontWeight:900, lineHeight:1.08, marginBottom:22, background:`linear-gradient(135deg,${G.text} 0%,rgba(241,243,249,0.5) 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          Speak with conviction.<br/>Every single time.
        </h1>
        <p style={{ fontSize:17, color:G.muted, lineHeight:1.75, maxWidth:540, margin:'0 auto 36px' }}>
          Record 60 seconds and instantly discover what to improve. AI analyzes your tone, pauses, filler words, and presence — with personalized, actionable feedback.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn" onClick={() => { if (!canAnalyze) setShowUpgrade(true); else setScreen('record'); }}
            style={{ background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, color:'#fff', fontSize:16, fontWeight:700, padding:'14px 30px', borderRadius:12, boxShadow:`0 8px 28px ${G.accentGlow}` }}>
            🎙️ Start for Free
          </button>
          {!user && <button className="btn" onClick={() => setShowAuth(true)} style={{ background:G.card, color:G.text, fontSize:16, fontWeight:600, padding:'14px 30px', borderRadius:12, border:`1px solid ${G.border}` }}>Sign In</button>}
        </div>
        {!user && <p style={{ color:G.muted, fontSize:13, marginTop:14 }}>No credit card · 3 free analyses</p>}
      </div>

      <div style={{ maxWidth:960, margin:'0 auto', padding:'0 40px 72px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:16 }}>
        {[
          { icon:'🎯', title:'Precise Scoring', text:'1–10 score across 5 categories: Flow, Tone, Clarity, Pace, and Presence.' },
          { icon:'🐛', title:'Catch Your Mistakes', text:'Filler words, long pauses, and hesitations automatically detected and graded.' },
          { icon:'💡', title:'Personal Tips', text:'5 immediately actionable tips tailored to your specific weaknesses.' },
          { icon:'📈', title:'Track Progress', text:'Analyze multiple times and watch your improvement over time.' },
        ].map((f, i) => (
          <div key={i} style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:16, padding:'22px 18px' }}>
            <div style={{ fontSize:26, marginBottom:10 }}>{f.icon}</div>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:7 }}>{f.title}</div>
            <div style={{ fontSize:13, color:G.muted, lineHeight:1.6 }}>{f.text}</div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth:760, margin:'0 auto', padding:'0 40px 90px', textAlign:'center' }}>
        <h2 style={{ fontSize:34, fontFamily:'"Playfair Display",serif', fontWeight:900, marginBottom:10 }}>Simple Pricing</h2>
        <p style={{ color:G.muted, marginBottom:40, fontSize:15 }}>Start free — upgrade when you need more.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:18 }}>
          <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:20, padding:'28px 24px', textAlign:'left' }}>
            <div style={{ fontSize:12, fontWeight:700, color:G.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Free</div>
            <div style={{ fontSize:38, fontWeight:900, fontFamily:'"Playfair Display",serif', marginBottom:3 }}>$0</div>
            <div style={{ color:G.muted, fontSize:13, marginBottom:22 }}>forever</div>
            <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:9, marginBottom:24 }}>
              {['3 full analyses','AI transcription','Complete AI report','Personal action plan'].map(f => (
                <li key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}><span style={{ color:'#22c55e' }}>✓</span>{f}</li>
              ))}
            </ul>
            <button className="btn" onClick={() => setScreen('record')} style={{ width:'100%', background:G.surface, border:`1px solid ${G.border}`, color:G.text, fontWeight:700, padding:'11px', borderRadius:10, fontSize:14 }}>Start Free</button>
          </div>
          <div style={{ background:`linear-gradient(135deg,${G.accentSoft},rgba(139,92,246,0.07))`, border:`1px solid ${G.accent}55`, borderRadius:20, padding:'28px 24px', textAlign:'left', position:'relative' }}>
            <div style={{ position:'absolute', top:14, right:14, background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, color:'#fff', fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:20 }}>RECOMMENDED</div>
            <div style={{ fontSize:12, fontWeight:700, color:G.accent, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Pro</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:3 }}>
              <div style={{ fontSize:38, fontWeight:900, fontFamily:'"Playfair Display",serif' }}>$9</div>
              <div style={{ color:G.muted, fontSize:13 }}>/week</div>
            </div>
            <div style={{ color:G.muted, fontSize:13, marginBottom:22 }}>or $29 one-time</div>
            <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:9, marginBottom:24 }}>
              {['Unlimited analyses','Advanced AI analysis','Video & audio upload','Progress tracking','All Free features'].map(f => (
                <li key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}><span style={{ color:G.accent }}>✓</span>{f}</li>
              ))}
            </ul>
            <button className="btn" onClick={() => setShowUpgrade(true)} style={{ width:'100%', background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, color:'#fff', fontWeight:700, padding:'11px', borderRadius:10, fontSize:14, boxShadow:`0 5px 18px ${G.accentGlow}` }}>Activate Pro →</button>
          </div>
        </div>
      </div>
    </div>
  );

  const RecordScreen = () => {
    const [uploadFile, setUploadFile] = useState<File|null>(null);
    const [uploadDur, setUploadDur] = useState(60);
    const [uTranscript, setUTranscript] = useState('');
    const [drag, setDrag] = useState(false);
    const [uploadTranscribing, setUploadTranscribing] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = (f: File|null) => {
      if (!f) return;
      setUploadFile(f);
      const v = document.createElement('video');
      v.src = URL.createObjectURL(f);
      v.onloadedmetadata = () => setUploadDur(Math.round(v.duration));
    };

    const transcribeUpload = async () => {
      if (!uploadFile) return;
      setUploadTranscribing(true);
      try {
        const formData = new FormData();
        formData.append('file', uploadFile, uploadFile.name);
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
          body: formData,
        });
        if (!res.ok) throw new Error('Transcription failed');
        const data = await res.json();
        setUTranscript(data.text || '');
      } catch (err: any) {
        setApiError('Transcription error: ' + err.message);
      } finally {
        setUploadTranscribing(false);
      }
    };

    const wordCount = transcript.trim().split(/\s+/).filter(w => w).length;
    const tLeft = 60 - recTime;

    return (
      <div style={{ minHeight:'100vh', width:'100%', background:G.bg, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${G.border}` }}>
          <button className="btn" onClick={() => { stopRecording(); setScreen('home'); }} style={{ color:G.muted, background:'none', fontSize:14 }}>← Home</button>
          <span style={{ fontFamily:'"Playfair Display",serif', fontWeight:700, fontSize:16 }}>SpeakCoach<span style={{ color:G.accent }}>AI</span></span>
          {!user?.isPaid && <div style={{ fontSize:13, color:G.muted, background:G.card, padding:'4px 12px', borderRadius:8, border:`1px solid ${G.border}` }}>{remaining} free left</div>}
        </div>

        <div style={{ flex:1, maxWidth:960, margin:'0 auto', width:'100%', padding:'28px 20px', display:'flex', flexDirection:'column', gap:20 }}>
          <div style={{ display:'flex', background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:4, gap:4, width:'fit-content' }}>
            {[['record','🎥 Record'],['upload','📁 Upload']].map(([m, l]) => (
              <button key={m} className="btn" onClick={() => setMode(m)} style={{ background:mode===m?`linear-gradient(135deg,${G.accent},#8b5cf6)`:'none', color:mode===m?'#fff':G.muted, border:'none', fontWeight:600, padding:'7px 18px', borderRadius:8, fontSize:13 }}>{l}</button>
            ))}
          </div>

          {mode === 'record' ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:18, alignItems:'start' }}>
              <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:18, overflow:'hidden', position:'relative', aspectRatio:'16/10' as any }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transform:'scaleX(-1)' }}/>
                {!recording && !camError && !transcribing && (
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(7,8,15,0.88)', flexDirection:'column', gap:10 }}>
                    <div style={{ fontSize:42 }}>🎥</div>
                    <div style={{ color:G.muted, fontSize:14 }}>Camera starts when you record</div>
                  </div>
                )}
                {transcribing && (
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(7,8,15,0.92)', flexDirection:'column', gap:14 }}>
                    <div style={{ width:44, height:44, position:'relative' }}>
                      <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`3px solid ${G.border}` }}/>
                      <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'3px solid transparent', borderTopColor:G.accent, animation:'spin 1s linear infinite' }}/>
                    </div>
                    <div style={{ color:G.text, fontSize:14, fontWeight:600 }}>Transcribing…</div>
                    <div style={{ color:G.muted, fontSize:13 }}>This takes a few seconds</div>
                  </div>
                )}
                {camError && (
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(7,8,15,0.9)', flexDirection:'column', gap:10, padding:24, textAlign:'center' as any }}>
                    <div style={{ fontSize:32 }}>🚫</div>
                    <div style={{ color:'#ef4444', fontSize:13, lineHeight:1.6 }}>{camError}</div>
                  </div>
                )}
                {recording && (
                  <>
                    <div style={{ position:'absolute', top:12, left:12, display:'flex', alignItems:'center', gap:7, background:'rgba(0,0,0,0.72)', padding:'5px 11px', borderRadius:8 }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:'#ef4444', animation:'recPulse 1.5s infinite' }}/>
                      <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{String(Math.floor(recTime/60)).padStart(2,'0')}:{String(recTime%60).padStart(2,'0')}</span>
                    </div>
                    <div style={{ position:'absolute', top:12, right:12, background:'rgba(0,0,0,0.72)', padding:'4px 10px', borderRadius:7, fontSize:12, color:G.muted }}>
                      {pauses.length} pause{pauses.length !== 1 ? 's' : ''} detected
                    </div>
                    <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:'rgba(255,255,255,0.1)' }}>
                      <div style={{ height:'100%', width:`${(recTime/60)*100}%`, background:`linear-gradient(90deg,${G.accent},#8b5cf6)`, transition:'width 1s linear' }}/>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:18, padding:22, textAlign:'center' }}>
                  {!recording && !transcript && !transcribing ? (
                    <>
                      <div style={{ fontSize:13, color:G.muted, marginBottom:14, lineHeight:1.65 }}>
                        Speak for 60 seconds on any topic — introduce yourself, pitch an idea, or give a short speech.
                      </div>
                      <button className="btn" onClick={startRecording}
                        style={{ background:`linear-gradient(135deg,#ef4444,#dc2626)`, color:'#fff', fontWeight:700, fontSize:15, padding:'13px 28px', borderRadius:11, width:'100%', boxShadow:'0 5px 18px rgba(239,68,68,0.3)' }}>
                        🔴 Start Recording
                      </button>
                    </>
                  ) : recording ? (
                    <>
                      <div style={{ marginBottom:14 }}>
                        <div style={{ fontSize:12, color:G.muted, marginBottom:4 }}>Time remaining</div>
                        <div style={{ fontSize:52, fontWeight:900, fontFamily:'"Playfair Display",serif', color:tLeft<=10?'#ef4444':G.text, lineHeight:1 }}>
                          {tLeft}<span style={{ fontSize:18, color:G.muted }}>s</span>
                        </div>
                      </div>
                      <button className="btn" onClick={handleStopAndTranscribe}
                        style={{ background:G.surface, border:`1px solid ${G.border}`, color:G.text, fontWeight:700, fontSize:14, padding:'10px 22px', borderRadius:10, width:'100%' }}>
                        ⏹ Stop & Transcribe
                      </button>
                    </>
                  ) : null}
                </div>

                {(transcript || transcribing) && (
                  <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:14, padding:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:9 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:transcribing?G.accent:'#22c55e', textTransform:'uppercase' as any, letterSpacing:'0.08em' }}>
                        {transcribing ? '⏳ Transcribing…' : '✓ Transcript Ready'}
                      </span>
                      {transcript && <span style={{ fontSize:11, color:G.muted }}>{wordCount} words</span>}
                    </div>
                    {transcribing ? (
                      <div style={{ fontSize:13, color:G.muted, animation:'pulse 1.5s infinite' }}>Processing your audio…</div>
                    ) : (
                      <div style={{ fontSize:13, color:G.text, lineHeight:1.7, maxHeight:160, overflowY:'auto' as any }}>{transcript}</div>
                    )}
                  </div>
                )}

                {transcript && !recording && !transcribing && (
                  <div className="fadeUp">
                    {apiError && <div style={{ fontSize:13, color:'#ef4444', marginBottom:10, padding:'10px 14px', background:'rgba(239,68,68,0.08)', borderRadius:10, border:'1px solid rgba(239,68,68,0.2)', lineHeight:1.5 }}>{apiError}</div>}
                    <button className="btn" onClick={handleAnalyze}
                      style={{ background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, color:'#fff', fontWeight:700, fontSize:15, padding:'13px', borderRadius:11, width:'100%', boxShadow:`0 6px 20px ${G.accentGlow}` }}>
                      🔍 Analyze Now →
                    </button>
                    <button className="btn" onClick={reset}
                      style={{ background:'none', color:G.muted, fontSize:13, width:'100%', padding:'8px', marginTop:6 }}>
                      ↺ Record again
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:18, alignItems:'start' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
                  style={{ background:drag?G.accentSoft:G.card, border:`2px dashed ${drag?G.accent:G.border}`, borderRadius:18, padding:44, textAlign:'center' as any, cursor:'pointer', transition:'all 0.2s' }}>
                  <input ref={fileRef} type="file" accept="video/*,audio/*" style={{ display:'none' }} onChange={e => handleFile(e.target.files?.[0] || null)}/>
                  {uploadFile ? (
                    <>
                      <div style={{ fontSize:36, marginBottom:10 }}>🎬</div>
                      <div style={{ fontWeight:700, marginBottom:4 }}>{uploadFile.name}</div>
                      <div style={{ color:G.muted, fontSize:13 }}>{uploadDur}s · {(uploadFile.size/1024/1024).toFixed(1)} MB</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:36, marginBottom:10 }}>📁</div>
                      <div style={{ fontWeight:700, marginBottom:6 }}>Drop your video or audio here</div>
                      <div style={{ color:G.muted, fontSize:13 }}>MP4, MOV, WebM, MP3, M4A · min. 60 seconds</div>
                    </>
                  )}
                </div>

                {uploadFile && (
                  <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:14, padding:18 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>Transcript</div>
                      <button className="btn" onClick={transcribeUpload} disabled={uploadTranscribing}
                        style={{ background:G.accentSoft, border:`1px solid ${G.accent}44`, color:G.accent, fontSize:12, fontWeight:700, padding:'5px 12px', borderRadius:7 }}>
                        {uploadTranscribing ? '⏳ Transcribing…' : '🎤 Auto-transcribe'}
                      </button>
                    </div>
                    <textarea value={uTranscript} onChange={e => setUTranscript(e.target.value)}
                      placeholder="Click 'Auto-transcribe' or type manually…"
                      style={{ width:'100%', minHeight:110, background:G.surface, border:`1px solid ${G.border}`, borderRadius:9, padding:'10px 13px', color:G.text, fontSize:13, resize:'vertical' as any, lineHeight:1.6 }}/>
                  </div>
                )}
              </div>

              <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:18, padding:22 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>Ready to Analyze</div>
                {!uploadFile ? (
                  <div style={{ fontSize:13, color:G.muted, lineHeight:1.7 }}>Upload a video or audio file to get started.</div>
                ) : (
                  <>
                    {([['File', uploadFile.name.length>22?uploadFile.name.slice(0,22)+'…':uploadFile.name], ['Duration', `${uploadDur}s`], ['Transcript', uTranscript?`${uTranscript.split(/\s+/).length} words`:'Not yet']] as [string,string][]).map(([k,v]) => (
                      <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:10 }}>
                        <span style={{ color:G.muted }}>{k}</span>
                        <span style={{ fontWeight:500 }}>{v}</span>
                      </div>
                    ))}
                    {apiError && <div style={{ fontSize:13, color:'#ef4444', marginBottom:12, padding:'9px 12px', background:'rgba(239,68,68,0.08)', borderRadius:9 }}>{apiError}</div>}
                    <button className="btn" onClick={() => {
                      if (!canAnalyze) { setShowUpgrade(true); return; }
                      if (!uTranscript || uTranscript.trim().split(/\s+/).length < 15) { setApiError('Please add a transcript first.'); return; }
                      runAnalysis(uTranscript, uploadDur, []);
                    }} style={{ background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, color:'#fff', fontWeight:700, fontSize:14, padding:'12px', borderRadius:10, width:'100%', boxShadow:`0 5px 18px ${G.accentGlow}`, marginTop:6 }}>
                      🔍 Analyze →
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AnalyzingScreen = () => (
    <div style={{ minHeight:'100vh', width:'100%', background:G.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:28 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:76, height:76, margin:'0 auto 22px', position:'relative' }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`3px solid ${G.border}` }}/>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'3px solid transparent', borderTopColor:G.accent, animation:'spin 1s linear infinite' }}/>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>🧠</div>
        </div>
        <h2 style={{ fontSize:26, fontFamily:'"Playfair Display",serif', fontWeight:900, marginBottom:7 }}>Analyzing your speech…</h2>
        <p style={{ color:G.muted, fontSize:14 }}>AI is reviewing your presentation in detail</p>
      </div>
      <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:18, padding:24, width:'100%', maxWidth:380 }}>
        {['Processing transcript…','Analyzing tone & pace…','Detecting patterns & errors…','Generating personal tips…'].map((step, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom:i<3?`1px solid ${G.border}`:'none' }}>
            <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${i<analysisStep?G.accent:G.border}`, background:i<analysisStep?G.accentSoft:'none', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0, transition:'all 0.4s' }}>
              {i < analysisStep ? '✓' : i === analysisStep ? <div style={{ width:7, height:7, borderRadius:'50%', background:G.accent, animation:'pulse 1s infinite' }}/> : ''}
            </div>
            <span style={{ fontSize:13, color:i<=analysisStep?G.text:G.muted, fontWeight:i===analysisStep?600:400 }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const ResultsScreen = () => {
    if (!results) return null;
    const cols = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#22c55e'];
    return (
      <div style={{ minHeight:'100vh', width:'100%', background:G.bg }}>
        <div style={{ padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${G.border}`, background:`${G.surface}cc`, backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:50 }}>
          <button className="btn" onClick={reset} style={{ color:G.muted, background:'none', fontSize:14 }}>← Try Again</button>
          <span style={{ fontFamily:'"Playfair Display",serif', fontWeight:700 }}>Your Results</span>
          {!user?.isPaid && <button className="btn" onClick={() => setShowUpgrade(true)} style={{ background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, color:'#fff', fontWeight:700, fontSize:13, padding:'6px 14px', borderRadius:8 }}>Go Pro →</button>}
        </div>

        <div style={{ maxWidth:880, margin:'0 auto', padding:'36px 20px 72px', display:'flex', flexDirection:'column', gap:20 }} className="fadeUp">
          <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:22, padding:'32px 28px', display:'flex', alignItems:'center', gap:32, flexWrap:'wrap' as any }}>
            <ScoreRing score={results.overallScore} size={156}/>
            <div style={{ flex:1, minWidth:220 }}>
              <div style={{ fontSize:12, fontWeight:700, color:G.accent, textTransform:'uppercase' as any, letterSpacing:'0.1em', marginBottom:9 }}>Overall Score</div>
              <h2 style={{ fontSize:26, fontFamily:'"Playfair Display",serif', fontWeight:900, marginBottom:11, lineHeight:1.2 }}>
                {results.overallScore>=8?'🏆 Outstanding!':results.overallScore>=6?'💪 Solid Foundation':results.overallScore>=4?'📈 Clear Potential':'🎯 Let\'s Get to Work'}
              </h2>
              <p style={{ color:G.muted, fontSize:14, lineHeight:1.7 }}>{results.summary}</p>
              {!user?.isPaid && remaining <= 1 && (
                <div style={{ marginTop:14, padding:'11px 14px', background:G.accentSoft, border:`1px solid ${G.accent}44`, borderRadius:11, fontSize:13, color:G.accent }}>
                  {remaining===0?'🔒 No free analyses left. ':'⚡ Last free analysis. '}
                  <button className="btn" onClick={() => setShowUpgrade(true)} style={{ background:'none', color:G.accent, fontWeight:700, textDecoration:'underline', fontSize:13 }}>Upgrade now →</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:18 }}>
            <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:18, padding:22 }}>
              <div style={{ fontSize:11, fontWeight:700, color:G.muted, textTransform:'uppercase' as any, letterSpacing:'0.08em', marginBottom:18 }}>Category Breakdown</div>
              {results.categories?.map((cat: any, i: number) => (
                <div key={i} style={{ marginBottom:i<4?16:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{cat.icon} {cat.name}</span>
                    <span style={{ fontSize:13, fontWeight:800, color:cols[i] }}>{cat.score}/10</span>
                  </div>
                  <div style={{ height:4, background:'rgba(255,255,255,0.07)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(cat.score/10)*100}%`, background:cols[i], borderRadius:2, transition:'width 1.2s ease' }}/>
                  </div>
                  <div style={{ fontSize:12, color:G.muted, marginTop:4 }}>{cat.comment}</div>
                </div>
              ))}
            </div>
            <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:18, padding:22 }}>
              <div style={{ fontSize:11, fontWeight:700, color:G.muted, textTransform:'uppercase' as any, letterSpacing:'0.08em', marginBottom:18 }}>Issues Found</div>
              {results.issues?.map((issue: any, i: number) => (
                <div key={i} style={{ padding:'11px 13px', background:G.surface, border:`1px solid ${G.border}`, borderRadius:11, marginBottom:i<results.issues.length-1?10:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>{issue.type}</span>
                    <SeverityBadge severity={issue.severity}/>
                  </div>
                  <div style={{ fontSize:12, color:G.muted, lineHeight:1.55 }}>{issue.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:18, padding:24 }}>
            <div style={{ fontSize:11, fontWeight:700, color:G.muted, textTransform:'uppercase' as any, letterSpacing:'0.08em', marginBottom:20 }}>🎯 Your Personal Action Plan</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:12 }}>
              {results.tips?.map((tip: string, i: number) => (
                <div key={i} style={{ padding:'14px 16px', background:G.surface, border:`1px solid ${G.border}`, borderRadius:12, display:'flex', gap:11, alignItems:'flex-start' }}>
                  <div style={{ width:26, height:26, background:G.accentSoft, border:`1px solid ${G.accent}44`, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, color:G.accent, flexShrink:0 }}>{i+1}</div>
                  <div style={{ fontSize:13, lineHeight:1.65 }}>{tip}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' as any }}>
            <button className="btn" onClick={reset} style={{ background:G.card, border:`1px solid ${G.border}`, color:G.text, fontWeight:700, padding:'11px 26px', borderRadius:11, fontSize:14 }}>🔄 Analyze Again</button>
            {!user?.isPaid && <button className="btn" onClick={() => setShowUpgrade(true)} style={{ background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, color:'#fff', fontWeight:700, padding:'11px 26px', borderRadius:11, fontSize:14, boxShadow:`0 5px 18px ${G.accentGlow}` }}>⚡ Unlimited Analyses →</button>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{css}</style>
      {screen==='home' && <HomeScreen/>}
      {screen==='record' && <RecordScreen/>}
      {screen==='analyzing' && <AnalyzingScreen/>}
      {screen==='results' && <ResultsScreen/>}
      <Footer onPrivacy={() => window.open('/privacy.html', '_blank')} />

      {showAuth && (
        <Modal title="Create Account" onClose={() => setShowAuth(false)}>
          <div style={{ fontSize:13, color:G.muted, marginBottom:20, lineHeight:1.65 }}>Save your progress and access your analyses anytime.</div>
          <input value={authEmail} onChange={e => setAuthEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && handleAuth()} type="email" placeholder="your@email.com"
            style={{ width:'100%', background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:'12px 15px', color:G.text, fontSize:14, marginBottom:11 }}/>
          <button className="btn" onClick={handleAuth}
            style={{ width:'100%', background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, color:'#fff', fontWeight:700, fontSize:15, padding:'13px', borderRadius:11, marginBottom:14, boxShadow:`0 6px 20px ${G.accentGlow}` }}>
            Continue →
          </button>
          <p style={{ fontSize:12, color:G.muted, textAlign:'center' as any }}>No spam. Just your account settings.</p>
        </Modal>
      )}

      {showUpgrade && (
        <Modal title="Unlock Pro" onClose={() => setShowUpgrade(false)}>
          <div style={{ fontSize:13, color:G.muted, marginBottom:20, lineHeight:1.65 }}>
            {analysesUsed>=FREE_LIMIT ? '🔒 All 3 free analyses used. Upgrade for unlimited access.' : '⚡ Get unlimited analyses and all features.'}
          </div>
          {([
            { plan:'weekly', label:'$9 / week', sub:'Auto-renews · cancel anytime' },
            { plan:'onetime', label:'$29 one-time', sub:'Lifetime access · no subscription', badge:'POPULAR' }
          ]).map(({ plan, label, sub, badge }: any) => (
            <button key={plan} className="btn" onClick={() => handleUpgrade(plan)}
              style={{ background:plan==='onetime'?G.accentSoft:G.surface, border:`1px solid ${plan==='onetime'?G.accent:G.border}`, borderRadius:13, padding:'14px 18px', textAlign:'left' as any, display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', marginBottom:10 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:G.text }}>{label}</div>
                <div style={{ fontSize:12, color:G.muted, marginTop:3 }}>{sub}</div>
              </div>
              {badge && <span style={{ background:`linear-gradient(135deg,${G.accent},#8b5cf6)`, color:'#fff', fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:6 }}>{badge}</span>}
            </button>
          ))}
          <p style={{ fontSize:12, color:G.muted, textAlign:'center' as any, marginTop:6 }}>🔒 Secure · Instant access · No hidden fees</p>
        </Modal>
      )}
    </>
  );
}
