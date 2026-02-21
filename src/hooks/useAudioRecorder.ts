'use client';

import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderReturn {
    isRecording: boolean;
    duration: number;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
    error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);

    const startRecording = useCallback(async () => {
        setError(null);
        chunksRef.current = [];
        setDuration(0);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100,
                },
            });

            // Try to use webm/opus, fall back to whatever's available
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4';

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                stream.getTracks().forEach((track) => track.stop());
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
                if (resolveRef.current) {
                    resolveRef.current(blob);
                    resolveRef.current = null;
                }
            };

            mediaRecorder.onerror = () => {
                setError('Recording failed. Please try again.');
                stream.getTracks().forEach((track) => track.stop());
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
                if (resolveRef.current) {
                    resolveRef.current(null);
                    resolveRef.current = null;
                }
            };

            mediaRecorder.start(250); // collect data every 250ms
            setIsRecording(true);

            timerRef.current = setInterval(() => {
                setDuration((d) => d + 1);
            }, 1000);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
                setError('Microphone access denied. Please allow microphone access in your browser settings.');
            } else if (err instanceof DOMException && err.name === 'NotFoundError') {
                setError('No microphone found. Please connect a microphone and try again.');
            } else {
                setError('Could not start recording. Please check your microphone.');
            }
        }
    }, []);

    const stopRecording = useCallback(async (): Promise<Blob | null> => {
        return new Promise((resolve) => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                resolve(null);
                return;
            }

            resolveRef.current = resolve;
            setIsRecording(false);
            mediaRecorderRef.current.stop();
        });
    }, []);

    return { isRecording, duration, startRecording, stopRecording, error };
}
