"use client";

import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { MainScene } from './MainScene';
import { EventBus } from './EventBus';

interface GameProps {
    theme: string;
    lilies: any[];
    floatingEchoData: any;
    onEchoClick: (data: any) => void;
    onCastComplete: () => void;
    onCoinLanded: () => void;
}

export default function Game({ 
    theme, 
    lilies, 
    floatingEchoData, 
    onEchoClick,
    onCastComplete,
    onCoinLanded 
}: GameProps) {
    const gameContainer = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<MainScene | null>(null);

    useEffect(() => {
        if (!gameContainer.current) return;

        // Initialize Phaser
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.WEBGL,
            width: window.innerWidth,
            height: window.innerHeight,
            parent: gameContainer.current,
            transparent: true,
            physics: {
                default: 'arcade',
                arcade: {
                    debug: false
                }
            },
            scene: [MainScene],
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            }
        };

        gameRef.current = new Phaser.Game(config);

        // Listen for scene ready
        EventBus.on('current-scene-ready', (scene: MainScene) => {
            sceneRef.current = scene;
            
            // Initial synchronization
            EventBus.emit('theme-changed', theme === 'dark');
            if (lilies.length > 0) {
                EventBus.emit('spawn-lilies', lilies);
            }
            if (floatingEchoData) {
                EventBus.emit('receive-echo', floatingEchoData);
            }
        });

        // Listen for internal Phaser events to trigger React callbacks
        EventBus.on('open-echo', (data: any) => onEchoClick(data));
        EventBus.on('cast-complete', () => onCastComplete());
        EventBus.on('coin-landed', () => onCoinLanded());

        return () => {
            // Cleanup
            EventBus.removeListener('current-scene-ready');
            EventBus.removeListener('open-echo');
            EventBus.removeListener('cast-complete');
            EventBus.removeListener('coin-landed');
            
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []); // Only run once on mount

    // --- Synchronization Effects ---

    useEffect(() => {
        if (sceneRef.current) {
            EventBus.emit('theme-changed', theme === 'dark');
        }
    }, [theme]);

    useEffect(() => {
        if (sceneRef.current) {
            EventBus.emit('spawn-lilies', lilies);
        }
    }, [lilies]);

    useEffect(() => {
        if (sceneRef.current && floatingEchoData) {
            EventBus.emit('receive-echo', floatingEchoData);
        } else if (sceneRef.current && !floatingEchoData) {
            EventBus.emit('clear-echo');
        }
    }, [floatingEchoData]);

    return <div ref={gameContainer} className="absolute inset-0 z-0 pointer-events-auto" />;
}
