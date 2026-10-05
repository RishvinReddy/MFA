import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface FusionGraphProps {
    scores: {
        face: number;
        voice: number;
        behavior: number;
        fusion: number;
        timestamp: string;
    }[];
}

export const FusionGraph: React.FC<FusionGraphProps> = ({ scores }) => {
    const labels = scores.map(s => s.timestamp);

    const data = {
        labels,
        datasets: [
            {
                label: 'Fused Score',
                data: scores.map(s => s.fusion),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                tension: 0.3,
            },
            {
                label: 'Face Score',
                data: scores.map(s => s.face),
                borderColor: 'rgb(53, 162, 235)',
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
                borderDash: [5, 5],
                tension: 0.3,
            },
            {
                label: 'Voice Score',
                data: scores.map(s => s.voice),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                borderDash: [5, 5],
                tension: 0.3,
            },
            {
                label: 'Threshold',
                data: scores.map(() => 0.75),
                borderColor: 'rgb(255, 205, 86)',
                borderWidth: 2,
                pointRadius: 0,
            }
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: 'Real-Time Biometric Fusion Stream',
            },
        },
        scales: {
            y: {
                min: 0,
                max: 1.0,
            }
        }
    };

    return <Line options={options} data={data} />;
};
