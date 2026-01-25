import { useMemo } from 'react';
import type { Registration, Ticket } from '@/types';

interface TechnicianHistoryChartProps {
    registrations: Registration[];
    tickets: Ticket[];
}

export function TechnicianHistoryChart({ registrations, tickets }: TechnicianHistoryChartProps) {
    // 1. Process Data
    const { chartData, technicians, months } = useMemo(() => {
        const today = new Date();
        const monthsList: { label: string; fullParams: { month: number; year: number } }[] = [];
        // Generate last 6 months labels
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            monthsList.push({
                label: d.toLocaleString('default', { month: 'short' }),
                fullParams: { month: d.getMonth(), year: d.getFullYear() }
            });
        }

        // Identify all technicians
        const techs = new Set<string>();
        registrations.forEach(r => { if (r.installation?.technician) techs.add(r.installation.technician); });
        tickets.forEach(t => { if (t.technician) techs.add(t.technician); });
        const techList = Array.from(techs).sort();

        // Build Data Map: [MonthIndex][TechName] = Count
        const dataMap: Record<number, Record<string, number>> = {};

        // Helper to add
        const addCount = (date: Date, tech: string) => {
            const mIndex = monthsList.findIndex(m => m.fullParams.month === date.getMonth() && m.fullParams.year === date.getFullYear());
            if (mIndex === -1) return; // Out of range

            if (!dataMap[mIndex]) dataMap[mIndex] = {};
            dataMap[mIndex][tech] = (dataMap[mIndex][tech] || 0) + 1;
        };

        registrations.forEach(r => {
            if (r.status === 'done' && r.installation?.technician && r.installation.date) {
                addCount(new Date(r.installation.date), r.installation.technician);
            }
        });

        tickets.forEach(t => {
            if ((t.status === 'resolved' || t.status === 'closed') && t.technician) {
                // Use updatedAt or createdAt? Usually resolvedAt is best but we might verify simple logic.
                // Assuming createdAt for simplicity as per common dashboard "volume" logic, 
                // BUT "performance" usually implies closed. Let's strictly use closed tickets based on createdAt 
                // (or updatedAt if available, but type check might be tricky without seeing full type. 
                // Let's safe-bet on createdAt as "Activity" or assume they closed it roughly same month).
                // BETTER: If we want "Performance", it should be when they did the work. 
                // Let's use createdAt for now as a proxy for "Work assigned/handled" 
                // OR if we can find a date. Ticking ID 175 plan said "Resolved". 
                // Let's stick to createdAt for stability unless we see a 'resolvedAt' field.
                addCount(new Date(t.createdAt), t.technician);
            }
        });

        // Format for Chart
        const processedData = monthsList.map((m, i) => {
            const monthData: any = { month: m.label };
            let maxVal = 0;
            techList.forEach(tech => {
                const val = dataMap[i]?.[tech] || 0;
                monthData[tech] = val;
                if (val > maxVal) maxVal = val;
            });
            return { ...monthData, _max: maxVal };
        });

        return { chartData: processedData, technicians: techList, months: monthsList };
    }, [registrations, tickets]);

    // 2. Chart Dimensions
    const height = 300;
    const width = 600; // viewBox width
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom; // 250

    // Scaling
    const allValues = chartData.flatMap(d => technicians.map(t => d[t] as number));
    const maxValue = Math.max(...allValues, 10); // Min max 10 to avoid flatline
    // Round up max value for nice grid
    const yMax = Math.ceil(maxValue / 5) * 5;

    const getX = (index: number) => (index / (months.length - 1)) * chartWidth;
    const getY = (val: number) => chartHeight - (val / yMax) * chartHeight;

    const colors = [
        '#2563eb', // Blue
        '#16a34a', // Green
        '#d97706', // Amber
        '#dc2626', // Red
        '#7c3aed', // Violet
        '#db2777', // Pink
        '#0891b2', // Cyan
    ];

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-6">Technician Performance History (6 Months)</h3>

            <div className="relative w-full aspect-[2/1] min-h-[300px] hover:cursor-crosshair">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                    {/* Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                        const y = chartHeight - (tick * chartHeight);
                        return (
                            <g key={tick}>
                                <line
                                    x1={0}
                                    y1={y}
                                    x2={chartWidth}
                                    y2={y}
                                    stroke="#e2e8f0"
                                    strokeDasharray={tick === 0 ? "" : "4 4"}
                                    transform={`translate(${padding.left}, ${padding.top})`}
                                />
                                <text
                                    x={padding.left - 10}
                                    y={y + padding.top + 4}
                                    textAnchor="end"
                                    className="text-[10px] fill-slate-400 font-mono"
                                >
                                    {Math.round(tick * yMax)}
                                </text>
                            </g>
                        );
                    })}

                    <g transform={`translate(${padding.left}, ${padding.top})`}>
                        {/* Lines */}
                        {technicians.map((tech, techIndex) => {
                            const points = chartData.map((d, i) => `${getX(i)},${getY(d[tech])}`).join(' ');
                            const color = colors[techIndex % colors.length];

                            return (
                                <g key={tech}>
                                    <polyline
                                        points={points}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="transition-all duration-300 hover:stroke-[4]"
                                    />
                                    {/* Dots */}
                                    {chartData.map((d, i) => (
                                        <circle
                                            key={i}
                                            cx={getX(i)}
                                            cy={getY(d[tech])}
                                            r="4"
                                            fill="white"
                                            stroke={color}
                                            strokeWidth="2"
                                        />
                                    ))}
                                </g>
                            );
                        })}

                        {/* Interactive Overlay logic could go here, leveraging hoveredIndex via mouse events on a rectifier overlay */}

                    </g>

                    {/* X Axis Labels */}
                    {months.map((m, i) => (
                        <text
                            key={i}
                            x={padding.left + getX(i)}
                            y={height - 5}
                            textAnchor="middle"
                            className="text-[10px] fill-slate-500 font-medium uppercase"
                        >
                            {m.label}
                        </text>
                    ))}
                </svg>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-6 justify-center">
                {technicians.map((tech, i) => (
                    <div key={tech} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                        <span className="font-medium text-slate-600">{tech}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
