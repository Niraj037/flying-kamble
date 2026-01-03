"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';

// Game Constants
const GRAVITY = 0.38;
const JUMP_STRENGTH = -7;
const PIPE_SPEED = 3;
const PIPE_SPAWN_RATE = 1700;
const BIRD_SIZE = 40;
const PIPE_WIDTH = 60;
const GAP_SIZE = 155;
const GROUND_HEIGHT = 80;
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

interface Bird {
    x: number;
    y: number;
    velocity: number;
}

interface Pipe {
    x: number;
    gapY: number;
    passed: boolean;
}

interface ScoreEntry {
    name: string;
    score: number;
}

type MenuScreen = 'MAIN' | 'PLAY' | 'LEADERBOARD' | 'CREDITS';

const GameEngine: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Game state refs
    const gameStateRef = useRef<'MENU' | 'PLAYING' | 'GAME_OVER'>('MENU');
    const scoreRef = useRef(0);
    const birdRef = useRef<Bird>({ x: 100, y: 300, velocity: 0 });
    const pipesRef = useRef<Pipe[]>([]);
    const animationRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const spawnTimerRef = useRef<number>(0);
    const randomSoundTimerRef = useRef<number>(0);
    const dprRef = useRef<number>(1);
    const cloudOffsetRef = useRef(0);

    // UI State
    const [uiState, setUiState] = useState<'MENU' | 'PLAYING' | 'GAME_OVER'>('MENU');
    const [menuScreen, setMenuScreen] = useState<MenuScreen>('MAIN');
    const [displayScore, setDisplayScore] = useState(0);
    const [playerName, setPlayerName] = useState('');
    const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Assets
    const birdImgRef = useRef<HTMLImageElement | null>(null);
    const faceImgRef = useRef<HTMLImageElement | null>(null);

    // Audio refs
    const audioRefs = useRef<{
        bgMusic: HTMLAudioElement | null;
        hitCid: HTMLAudioElement | null;
        pakadMc: HTMLAudioElement | null;
        bcCid: HTMLAudioElement | null;
        score: HTMLAudioElement | null;
    }>({ bgMusic: null, hitCid: null, pakadMc: null, bcCid: null, score: null });

    const bgMusicPlayingRef = useRef(false);
    const audioUnlockedRef = useRef(false);

    // Initialize assets
    useEffect(() => {
        dprRef.current = Math.min(window.devicePixelRatio || 1, 2);

        // Preload images
        const img = new Image();
        img.src = '/bird.png';
        img.onload = () => { birdImgRef.current = img; };

        const faceImg = new Image();
        faceImg.src = '/face.png';
        faceImg.onload = () => { faceImgRef.current = faceImg; };

        // Create audio
        const createAudio = (src: string, volume: number = 0.5) => {
            const audio = new Audio();
            audio.src = src;
            audio.preload = 'auto';
            audio.volume = volume;
            audio.load();
            return audio;
        };

        audioRefs.current.bgMusic = createAudio('/bg-music.mp3', 0.3);
        audioRefs.current.bgMusic!.loop = true;
        audioRefs.current.hitCid = createAudio('/hit-cid.mp3', 0.6);
        audioRefs.current.pakadMc = createAudio('/pakad-mc.mp3', 0.4);
        audioRefs.current.bcCid = createAudio('/bc-cid.mp3', 0.5);
        audioRefs.current.score = createAudio('/score.mp3', 0.4);

        fetchLeaderboard();

        return () => { stopAllAudio(); };
    }, []);

    const stopAllAudio = useCallback(() => {
        Object.values(audioRefs.current).forEach(audio => {
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
        bgMusicPlayingRef.current = false;
    }, []);

    const unlockAudio = useCallback(() => {
        if (audioUnlockedRef.current) return;
        Object.values(audioRefs.current).forEach(audio => {
            if (audio) {
                audio.play().then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                }).catch(() => { });
            }
        });
        audioUnlockedRef.current = true;
    }, []);

    const playSound = useCallback((type: 'hitCid' | 'pakadMc' | 'bcCid' | 'score') => {
        const audio = audioRefs.current[type];
        if (audio && audioUnlockedRef.current) {
            audio.currentTime = 0;
            audio.play().catch(() => { });
        }
    }, []);

    const startBgMusic = useCallback(() => {
        const bgMusic = audioRefs.current.bgMusic;
        if (bgMusic && !bgMusicPlayingRef.current && audioUnlockedRef.current) {
            bgMusic.currentTime = 0;
            bgMusic.play().catch(() => { });
            bgMusicPlayingRef.current = true;
        }
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch('/api/leaderboard');
            const data = await res.json();
            if (data.success) setLeaderboard(data.data);
        } catch (e) {
            console.error("Leaderboard fetch failed", e);
        }
    };

    const submitScore = async (name: string, score: number) => {
        if (isSubmitting || !name.trim()) return;
        setIsSubmitting(true);
        try {
            await fetch('/api/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), score }),
            });
            await fetchLeaderboard();
        } catch (e) {
            console.error("Score submit failed", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const startGame = useCallback(() => {
        unlockAudio();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const logicalHeight = canvas.height / dprRef.current;
        birdRef.current = { x: 100, y: logicalHeight / 2, velocity: 0 };
        pipesRef.current = [];
        scoreRef.current = 0;
        spawnTimerRef.current = 0;
        randomSoundTimerRef.current = 0;
        cloudOffsetRef.current = 0;
        gameStateRef.current = 'PLAYING';
        setUiState('PLAYING');
        setDisplayScore(0);
        lastTimeRef.current = performance.now();

        setTimeout(() => { startBgMusic(); }, 100);
    }, [unlockAudio, startBgMusic]);

    const endGame = useCallback(() => {
        gameStateRef.current = 'GAME_OVER';
        setUiState('GAME_OVER');
        setDisplayScore(scoreRef.current);
        cancelAnimationFrame(animationRef.current);

        // Stop only bg music and pakad-mc, NOT hitCid
        const bgMusic = audioRefs.current.bgMusic;
        const pakadMc = audioRefs.current.pakadMc;
        const bcCid = audioRefs.current.bcCid;

        if (bgMusic) {
            bgMusic.pause();
            bgMusic.currentTime = 0;
        }
        if (pakadMc) {
            pakadMc.pause();
            pakadMc.currentTime = 0;
        }
        if (bcCid) {
            bcCid.pause();
            bcCid.currentTime = 0;
        }
        bgMusicPlayingRef.current = false;

        // Play hit sound
        const hitAudio = audioRefs.current.hitCid;
        if (hitAudio) {
            hitAudio.currentTime = 0;
            hitAudio.play().catch(() => { });
        }

        if (playerName.trim()) {
            submitScore(playerName, scoreRef.current);
        }
    }, [playerName]);

    const jump = useCallback(() => {
        if (gameStateRef.current === 'PLAYING') {
            birdRef.current.velocity = JUMP_STRENGTH;
            playSound('bcCid');
        }
    }, [playSound]);

    // Input handling
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (gameStateRef.current === 'PLAYING') jump();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [jump]);

    // Canvas sizing
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (canvas && container) {
                const dpr = dprRef.current;
                const w = container.clientWidth;
                const h = container.clientHeight;
                canvas.width = w * dpr;
                canvas.height = h * dpr;
                canvas.style.width = `${w}px`;
                canvas.style.height = `${h}px`;
            }
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    // Game loop
    useEffect(() => {
        if (uiState !== 'PLAYING') return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { alpha: false });
        if (!canvas || !ctx) return;

        const dpr = dprRef.current;
        let accumulator = 0;

        const loop = (time: number) => {
            if (gameStateRef.current !== 'PLAYING') return;

            const delta = Math.min(time - lastTimeRef.current, 50);
            lastTimeRef.current = time;
            accumulator += delta;

            while (accumulator >= FRAME_TIME) {
                updatePhysics(canvas.width / dpr, canvas.height / dpr);
                accumulator -= FRAME_TIME;
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawPixelArt(ctx, canvas.width / dpr, canvas.height / dpr);

            animationRef.current = requestAnimationFrame(loop);
        };

        animationRef.current = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(animationRef.current);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        };
    }, [uiState]);

    const updatePhysics = (w: number, h: number) => {
        const bird = birdRef.current;
        bird.velocity += GRAVITY;
        bird.y += bird.velocity;

        cloudOffsetRef.current += 0.5;

        // Random pakad-mc sound
        randomSoundTimerRef.current += FRAME_TIME;
        if (randomSoundTimerRef.current > 10000 + Math.random() * 8000) {
            randomSoundTimerRef.current = 0;
            if (gameStateRef.current === 'PLAYING') {
                const pakadAudio = audioRefs.current.pakadMc;
                if (pakadAudio && audioUnlockedRef.current) {
                    pakadAudio.currentTime = 0;
                    pakadAudio.play().catch(() => { });
                }
            }
        }

        // Spawn pipes
        spawnTimerRef.current += FRAME_TIME;
        if (spawnTimerRef.current > PIPE_SPAWN_RATE) {
            spawnTimerRef.current = 0;
            const minGapY = GAP_SIZE / 2 + 60;
            const maxGapY = h - GROUND_HEIGHT - GAP_SIZE / 2 - 60;
            const gapY = Math.random() * (maxGapY - minGapY) + minGapY;
            pipesRef.current.push({ x: w, gapY, passed: false });
        }

        // Update pipes
        for (let i = 0; i < pipesRef.current.length; i++) {
            const pipe = pipesRef.current[i];
            pipe.x -= PIPE_SPEED;

            if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
                pipe.passed = true;
                scoreRef.current++;
                setDisplayScore(scoreRef.current);
                playSound('score');
            }

            const birdL = bird.x - BIRD_SIZE / 2 + 6;
            const birdR = bird.x + BIRD_SIZE / 2 - 6;
            const birdT = bird.y - BIRD_SIZE / 2 + 6;
            const birdB = bird.y + BIRD_SIZE / 2 - 6;

            if (birdR > pipe.x && birdL < pipe.x + PIPE_WIDTH) {
                if (birdT < pipe.gapY - GAP_SIZE / 2 || birdB > pipe.gapY + GAP_SIZE / 2) {
                    endGame();
                    return;
                }
            }
        }

        pipesRef.current = pipesRef.current.filter(p => p.x > -PIPE_WIDTH);

        if (bird.y + BIRD_SIZE / 2 > h - GROUND_HEIGHT || bird.y - BIRD_SIZE / 2 < 0) {
            endGame();
        }
    };

    const drawPixelArt = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.imageSmoothingEnabled = false;

        // Sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h - GROUND_HEIGHT);
        skyGrad.addColorStop(0, '#87CEEB');
        skyGrad.addColorStop(0.6, '#7EC8E3');
        skyGrad.addColorStop(1, '#B8E6F0');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Fluffy clouds
        const drawCloud = (x: number, y: number, scale: number) => {
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x + 25 * scale, y + 15 * scale, 20 * scale, 0, Math.PI * 2);
            ctx.arc(x + 45 * scale, y + 10 * scale, 25 * scale, 0, Math.PI * 2);
            ctx.arc(x + 70 * scale, y + 15 * scale, 22 * scale, 0, Math.PI * 2);
            ctx.arc(x + 35 * scale, y + 5 * scale, 18 * scale, 0, Math.PI * 2);
            ctx.arc(x + 55 * scale, y + 5 * scale, 20 * scale, 0, Math.PI * 2);
            ctx.fill();

            // Cloud highlight
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.arc(x + 40 * scale, y, 12 * scale, 0, Math.PI * 2);
            ctx.fill();
        };

        const offset = (cloudOffsetRef.current * 0.5) % (w + 300);
        drawCloud(50 - offset * 0.3, 40, 1.2);
        drawCloud(250 - offset * 0.2, 80, 1);
        drawCloud(w - 200 + offset * 0.1, 60, 1.3);
        drawCloud(w - 400 + offset * 0.15, 100, 0.9);

        // Pipes
        pipesRef.current.forEach(pipe => {
            const gapTop = pipe.gapY - GAP_SIZE / 2;
            const gapBottom = pipe.gapY + GAP_SIZE / 2;

            // Pipe body
            ctx.fillStyle = '#5DBE4C';
            ctx.fillRect(pipe.x, 0, PIPE_WIDTH, gapTop);
            ctx.fillRect(pipe.x, gapBottom, PIPE_WIDTH, h - GROUND_HEIGHT - gapBottom);

            // Highlights
            ctx.fillStyle = '#7DD86C';
            ctx.fillRect(pipe.x, 0, 10, gapTop);
            ctx.fillRect(pipe.x, gapBottom, 10, h - GROUND_HEIGHT - gapBottom);

            // Shadows
            ctx.fillStyle = '#3A9A2C';
            ctx.fillRect(pipe.x + PIPE_WIDTH - 10, 0, 10, gapTop);
            ctx.fillRect(pipe.x + PIPE_WIDTH - 10, gapBottom, 10, h - GROUND_HEIGHT - gapBottom);

            // Caps
            const capW = PIPE_WIDTH + 12;
            const capX = pipe.x - 6;

            ctx.fillStyle = '#5DBE4C';
            ctx.fillRect(capX, gapTop - 28, capW, 28);
            ctx.fillRect(capX, gapBottom, capW, 28);

            ctx.fillStyle = '#7DD86C';
            ctx.fillRect(capX, gapTop - 28, 12, 28);
            ctx.fillRect(capX, gapBottom, 12, 28);

            ctx.fillStyle = '#3A9A2C';
            ctx.fillRect(capX + capW - 12, gapTop - 28, 12, 28);
            ctx.fillRect(capX + capW - 12, gapBottom, 12, 28);
        });

        // Ground - Grass
        ctx.fillStyle = '#7EC850';
        ctx.fillRect(0, h - GROUND_HEIGHT, w, 15);

        ctx.fillStyle = '#9ADE6C';
        for (let i = 0; i < w; i += 10) {
            ctx.fillRect(i, h - GROUND_HEIGHT, 5, 6);
        }

        // Dirt
        ctx.fillStyle = '#C4A35A';
        ctx.fillRect(0, h - GROUND_HEIGHT + 15, w, 30);

        ctx.fillStyle = '#A68B4B';
        for (let i = 0; i < w; i += 18) {
            ctx.fillRect(i + 4, h - GROUND_HEIGHT + 20, 10, 8);
        }

        ctx.fillStyle = '#8B7355';
        ctx.fillRect(0, h - GROUND_HEIGHT + 45, w, 35);

        // Bird
        const bird = birdRef.current;
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.04)));

        if (birdImgRef.current) {
            ctx.drawImage(birdImgRef.current, -BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE);
        } else {
            ctx.fillStyle = '#F9D71C';
            ctx.beginPath();
            ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Score
        ctx.font = 'bold 48px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(scoreRef.current.toString(), w / 2 + 2, 62);
        ctx.fillStyle = '#FFF';
        ctx.fillText(scoreRef.current.toString(), w / 2, 60);
    };

    const handleCanvasClick = () => {
        if (gameStateRef.current === 'PLAYING') jump();
    };

    // MENU BUTTON COMPONENT
    const MenuButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
        <button
            onClick={onClick}
            className="w-full max-w-[240px] py-3 px-6 text-white font-bold text-base sm:text-lg tracking-wider uppercase transition-all hover:scale-105 active:scale-95 hover:brightness-110"
            style={{
                fontFamily: '"Courier New", monospace',
                background: 'linear-gradient(180deg, #8B5A2B 0%, #704214 50%, #5A3410 100%)',
                border: '3px solid #3D2106',
                borderRadius: '8px',
                boxShadow: '0 4px 0 #2D1804, inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -2px 4px rgba(0,0,0,0.2)',
                textShadow: '1px 1px 2px #000',
            }}
        >
            {children}
        </button>
    );

    return (
        <div ref={containerRef} className="relative w-full h-screen overflow-hidden">
            {/* Canvas */}
            <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full ${uiState === 'PLAYING' ? 'block' : 'hidden'}`}
                onClick={handleCanvasClick}
                onTouchStart={(e) => { e.preventDefault(); handleCanvasClick(); }}
            />

            {/* MENU */}
            {uiState === 'MENU' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
                    style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #7EC8E3 60%, #B8E6F0 100%)' }}>

                    {/* Clouds decoration */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute top-[8%] left-[5%] w-20 h-10 bg-white rounded-full opacity-90 blur-[2px]" />
                        <div className="absolute top-[12%] left-[12%] w-14 h-8 bg-white rounded-full opacity-80" />
                        <div className="absolute top-[5%] right-[10%] w-24 h-12 bg-white rounded-full opacity-90 blur-[1px]" />
                        <div className="absolute top-[10%] right-[20%] w-16 h-8 bg-white rounded-full opacity-80" />
                        <div className="absolute top-[15%] left-[40%] w-20 h-10 bg-white rounded-full opacity-85 blur-[1px]" />
                    </div>

                    {/* Ground */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 sm:h-20">
                        <div className="absolute top-0 left-0 right-0 h-4 bg-[#7EC850]" />
                        <div className="absolute top-4 left-0 right-0 h-6 bg-[#C4A35A]" />
                        <div className="absolute top-10 left-0 right-0 h-10 bg-[#8B7355]" />
                    </div>


                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center px-4 w-full max-w-sm">

                        {/* MAIN MENU */}
                        {menuScreen === 'MAIN' && (
                            <>
                                <h1
                                    className="text-3xl sm:text-5xl font-black text-white mb-8 text-center leading-tight"
                                    style={{
                                        fontFamily: '"Courier New", monospace',
                                        textShadow: '3px 3px 0 #2D7A20, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
                                    }}
                                >
                                    FLYING<br />KAMBLE
                                </h1>

                                <div className="flex flex-col items-center gap-3 w-full">
                                    <MenuButton onClick={() => setMenuScreen('PLAY')}>
                                        ▶ PLAY
                                    </MenuButton>
                                    <MenuButton onClick={() => { fetchLeaderboard(); setMenuScreen('LEADERBOARD'); }}>
                                        🏆 LEADERBOARD
                                    </MenuButton>
                                    <MenuButton onClick={() => setMenuScreen('CREDITS')}>
                                        ℹ CREDITS
                                    </MenuButton>
                                </div>

                                <p className="mt-6 text-white/80 text-xs sm:text-sm tracking-widest"
                                    style={{ fontFamily: '"Courier New", monospace', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                                    SPACE / TAP TO FLY
                                </p>
                            </>
                        )}

                        {/* PLAY - Enter Name */}
                        {menuScreen === 'PLAY' && (
                            <>
                                <h2 className="text-2xl sm:text-3xl font-black text-white mb-6"
                                    style={{ fontFamily: '"Courier New", monospace', textShadow: '2px 2px 0 #000' }}>
                                    ENTER NAME
                                </h2>

                                <input
                                    type="text"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    placeholder="YOUR NAME"
                                    maxLength={10}
                                    autoFocus
                                    className="w-full max-w-[240px] px-4 py-3 mb-4 text-center text-white placeholder-white/50 text-lg tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                    style={{
                                        fontFamily: '"Courier New", monospace',
                                        background: 'linear-gradient(180deg, #5A3410 0%, #3D2106 100%)',
                                        border: '3px solid #2D1804',
                                        borderRadius: '8px',
                                        boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.4)',
                                        textShadow: '1px 1px 2px #000',
                                    }}
                                />

                                <div className="flex flex-col gap-3 w-full items-center">
                                    <MenuButton onClick={startGame}>
                                        ▶ START
                                    </MenuButton>
                                    <button
                                        onClick={() => setMenuScreen('MAIN')}
                                        className="text-white/80 text-sm hover:text-white transition-colors"
                                        style={{ fontFamily: '"Courier New", monospace' }}
                                    >
                                        ← BACK
                                    </button>
                                </div>
                            </>
                        )}

                        {/* LEADERBOARD */}
                        {menuScreen === 'LEADERBOARD' && (
                            <>
                                <h2 className="text-2xl sm:text-3xl font-black text-white mb-4"
                                    style={{ fontFamily: '"Courier New", monospace', textShadow: '2px 2px 0 #000' }}>
                                    🏆 LEADERBOARD
                                </h2>

                                <div className="w-full max-w-[280px] max-h-[50vh] overflow-y-auto p-3 rounded-lg mb-4"
                                    style={{
                                        background: 'linear-gradient(180deg, #704214 0%, #5A3410 100%)',
                                        border: '3px solid #3D2106',
                                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)',
                                    }}>
                                    {leaderboard.length > 0 ? (
                                        <ul className="space-y-2">
                                            {leaderboard.slice(0, 10).map((entry, i) => (
                                                <li key={i} className="flex justify-between items-center px-2 py-2 rounded"
                                                    style={{
                                                        background: i === 0 ? 'rgba(255,215,0,0.25)' : 'rgba(0,0,0,0.15)',
                                                        border: i === 0 ? '1px solid #FFD700' : '1px solid transparent',
                                                    }}>
                                                    <span className="text-white text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                                                        {i + 1}. {entry.name}
                                                    </span>
                                                    <span className="font-bold text-lg" style={{
                                                        fontFamily: '"Courier New", monospace',
                                                        color: i === 0 ? '#FFD700' : '#FFF',
                                                        textShadow: '1px 1px 2px #000',
                                                    }}>
                                                        {entry.score}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-white/60 text-center text-sm py-4" style={{ fontFamily: '"Courier New", monospace' }}>
                                            No scores yet!
                                        </p>
                                    )}
                                </div>

                                <button
                                    onClick={() => setMenuScreen('MAIN')}
                                    className="text-white/80 text-sm hover:text-white transition-colors"
                                    style={{ fontFamily: '"Courier New", monospace' }}
                                >
                                    ← BACK
                                </button>
                            </>
                        )}

                        {/* CREDITS */}
                        {menuScreen === 'CREDITS' && (
                            <>
                                <h2 className="text-2xl sm:text-3xl font-black text-white mb-4"
                                    style={{ fontFamily: '"Courier New", monospace', textShadow: '2px 2px 0 #000' }}>
                                    CREDITS
                                </h2>

                                <div className="w-full max-w-[280px] p-4 rounded-lg mb-4 text-center"
                                    style={{
                                        background: 'linear-gradient(180deg, #704214 0%, #5A3410 100%)',
                                        border: '3px solid #3D2106',
                                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)',
                                    }}>

                                    <div className="mb-3">
                                        <h3 className="text-yellow-300 text-sm font-bold mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                                            🎮 DEVELOPER
                                        </h3>
                                        <p className="text-white text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                                            Niraj
                                        </p>
                                    </div>

                                    <div className="mb-3">
                                        <h3 className="text-yellow-300 text-sm font-bold mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                                            🎵 MUSIC & AUDIO
                                        </h3>
                                        <p className="text-white text-xs leading-relaxed" style={{ fontFamily: '"Courier New", monospace' }}>
                                            "Boss" - Lil Pump
                                        </p>
                                        <p className="text-white/70 text-[10px] mt-1" style={{ fontFamily: '"Courier New", monospace' }}>
                                            CID audio and other SFX sourced<br />from YouTube, belonging to their<br />respective owners.
                                        </p>
                                    </div>

                                    <div className="mb-3">
                                        <h3 className="text-yellow-300 text-sm font-bold mb-1" style={{ fontFamily: '"Courier New", monospace' }}>
                                            🙏 SPECIAL THANKS
                                        </h3>
                                        <p className="text-white text-sm" style={{ fontFamily: '"Courier New", monospace' }}>
                                            Harshal & Arsalan
                                        </p>
                                    </div>

                                    <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                                        <p className="text-yellow-200/80 text-[9px] leading-relaxed" style={{ fontFamily: '"Courier New", monospace' }}>
                                            ⚠️ DISCLAIMER<br />
                                            This game is made for fun and<br />entertainment purposes only.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setMenuScreen('MAIN')}
                                    className="text-white/80 text-sm hover:text-white transition-colors"
                                    style={{ fontFamily: '"Courier New", monospace' }}
                                >
                                    ← BACK
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* GAME OVER */}
            {uiState === 'GAME_OVER' && (
                <div className="absolute inset-0 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.8)' }}>
                    <div className="w-full max-w-xs p-6 rounded-lg text-center"
                        style={{
                            background: 'linear-gradient(180deg, #8B5A2B 0%, #5A3410 100%)',
                            border: '4px solid #3D2106',
                            boxShadow: '0 6px 0 #2D1804',
                        }}>

                        {/* Face image */}
                        <img
                            src="/face.png"
                            alt=""
                            className="w-28 h-28 sm:w-36 sm:h-36 mx-auto mb-3 object-contain rounded-xl"
                            style={{ imageRendering: 'auto' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />

                        <h2 className="text-3xl font-black text-red-400 mb-2"
                            style={{ fontFamily: '"Courier New", monospace', textShadow: '2px 2px 0 #000' }}>
                            GAME OVER
                        </h2>

                        <div className="text-5xl font-black text-white my-4"
                            style={{ fontFamily: '"Courier New", monospace', textShadow: '3px 3px 0 #000' }}>
                            {displayScore}
                        </div>
                        <p className="text-white/60 text-xs tracking-widest mb-6"
                            style={{ fontFamily: '"Courier New", monospace' }}>
                            YOUR SCORE
                        </p>

                        {isSubmitting && (
                            <p className="text-yellow-300 text-sm mb-3" style={{ fontFamily: '"Courier New", monospace' }}>
                                Saving...
                            </p>
                        )}

                        <div className="flex flex-col gap-3 items-center">
                            <MenuButton onClick={startGame}>
                                ▶ PLAY AGAIN
                            </MenuButton>
                            <button
                                onClick={() => { setUiState('MENU'); setMenuScreen('MAIN'); fetchLeaderboard(); }}
                                className="text-white/80 text-sm hover:text-white transition-colors"
                                style={{ fontFamily: '"Courier New", monospace' }}
                            >
                                ← MENU
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameEngine;
