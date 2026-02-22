/**
 * useSpaceAudio — 太空环境音效 Hook
 * Web Audio API 合成音效：低频环境底噪 + hover/click 反馈音
 * 无需外部音频文件，全部实时合成
 */

import { useRef, useCallback, useEffect } from 'react';

interface SpaceAudioReturn {
  toggleAmbient: () => boolean;
  playHover: () => void;
  playClick: () => void;
  isPlaying: React.RefObject<boolean>;
}

export function useSpaceAudio(): SpaceAudioReturn {
  const ctxRef = useRef<AudioContext | null>(null);
  const dronesRef = useRef<OscillatorNode[]>([]);
  const masterGainRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);

  // 懒初始化 AudioContext（需用户交互触发）
  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  // 启动环境音
  const startAmbient = useCallback(() => {
    if (isPlayingRef.current) return;

    const ctx = getContext();

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    // 低沉嗡鸣 — 三个轻微失谐的正弦波产生 beating 效果
    const frequencies = [55, 57, 30];
    const gains = [0.12, 0.08, 0.06];
    const oscillators: OscillatorNode[] = [];

    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequencies[i];

      const oscGain = ctx.createGain();
      oscGain.gain.value = gains[i];

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start();
      oscillators.push(osc);
    }

    dronesRef.current = oscillators;
    isPlayingRef.current = true;

    // 2 秒淡入
    masterGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 2);
  }, [getContext]);

  // 停止环境音
  const stopAmbient = useCallback(() => {
    if (!isPlayingRef.current || !masterGainRef.current || !ctxRef.current) return;

    const ctx = ctxRef.current;
    masterGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);

    const drones = dronesRef.current;
    setTimeout(() => {
      for (const osc of drones) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      }
      dronesRef.current = [];
      isPlayingRef.current = false;
    }, 1200);
  }, []);

  // 切换环境音
  const toggleAmbient = useCallback(() => {
    if (isPlayingRef.current) {
      stopAmbient();
      return false;
    } else {
      startAmbient();
      return true;
    }
  }, [startAmbient, stopAmbient]);

  // Hover 提示音 — 轻柔高频 ping
  const playHover = useCallback(() => {
    if (!isPlayingRef.current) return;
    try {
      const ctx = getContext();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 800 + Math.random() * 400;

      const gain = ctx.createGain();
      gain.gain.value = 0.04;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      /* ignore audio errors */
    }
  }, [getContext]);

  // Click 确认音 — 短促频率上扫
  const playClick = useCallback(() => {
    if (!isPlayingRef.current) return;
    try {
      const ctx = getContext();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 600;
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.06);

      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      /* ignore audio errors */
    }
  }, [getContext]);

  // 清理
  useEffect(() => {
    return () => {
      for (const osc of dronesRef.current) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      }
      ctxRef.current?.close();
    };
  }, []);

  return {
    toggleAmbient,
    playHover,
    playClick,
    isPlaying: isPlayingRef,
  };
}
