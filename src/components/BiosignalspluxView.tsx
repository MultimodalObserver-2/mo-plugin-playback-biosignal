import { useEffect, useState, useRef, useMemo } from "react";
import { useTranslation, type PluginViewProps } from "mo-sdk";

interface SensorConfig {
    title: string;
    unit: string;
    color: string;
}

const SENSOR_DEFAULTS: Record<string, SensorConfig> = {
    "EMG": { title: "Electromiografía (EMG)", unit: "mV", color: "#8884d8" },
    "ECG": { title: "Electrocardiograma (ECG)", unit: "mV", color: "#ff7300" },
    "EDA": { title: "Actividad Electrodérmica (EDA)", unit: "µS", color: "#82ca9d" },
    "ACC": { title: "Acelerómetro", unit: "g", color: "#00C49F" },
    "DEFAULT": { title: "Señal de Sensor", unit: "mV", color: "#6c757d" }
};

interface BiosignalEvent {
    seq: number;
    timestamp: number;
    [key: string]: number;
}

interface ProcessedData {
    time: number;
    value: number;
}

const transferFunction = (raw: number) => {
    if (Math.abs(raw) < 100)
        return raw;
    const sampleBits = 16;
    const voltsDevice = 3;
    const gain = 1007;
    const volt = (((raw / Math.pow(2, sampleBits)) - 0.5) * voltsDevice) / gain;
    return volt * 1000;
};

const calculateStats = (data: number[]) => {
    if (!data || data.length === 0)
        return null;
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const rms = Math.sqrt(data.reduce((a, b) => a + Math.pow(b, 2), 0) / n);
    const peak = Math.max(...data.map(Math.abs));
    const cvp = mean !== 0 ? (stdDev / mean) * 100 : 0;
    return { mean, stdDev, rms, peak, cvp };
};

export function BiosignalsPluxView({ controls, context }: PluginViewProps) {
    //@ts-ignore
    const { t } = useTranslation("interaction-lab-biosignals-playback");

    const [rawData, setRawData] = useState<BiosignalEvent[]>([]);
    const [availableChannels, setAvailableChannels] = useState<string[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<string>("");
    
    const [chartData, setChartData] = useState<ProcessedData[]>([]);
    const [config, setConfig] = useState<SensorConfig>(SENSOR_DEFAULTS.DEFAULT);
    const [yMin, setYMin] = useState(-2);
    const [yMax, setYMax] = useState(2);
    
    const [totalDuration, setTotalDuration] = useState(0);
    const [viewStart, setViewStart] = useState(0);
    const [viewEnd, setViewEnd] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const timeMsRef = useRef(0);
    const lastRealTimeRef = useRef(0);
    const rafIdRef = useRef<number | null>(null);

    const [selectStart, setSelectStart] = useState<number | null>(null);
    const [selectEnd, setSelectEnd] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const loadFile = async () => {
            try {
                const raw = (await window.core.fs.readFileSync(context.filePath, "utf-8")) as string;
                const json: BiosignalEvent[] = JSON.parse(raw);
                
                if (json.length > 0) {
                    const keys = Object.keys(json[0]).filter(k => k !== "seq" && k !== "timestamp" && k !== "nSeq");
                    
                    setRawData(json);
                    setAvailableChannels(keys);
                    
                    if (keys.length > 0) {
                        setSelectedChannel(keys[0]);
                    }
                }
            } catch (err) { console.error("Error loading file:", err); }
        };
        loadFile();
    }, [context.filePath]);

    useEffect(() => {
        if (rawData.length === 0 || !selectedChannel)
            return;

        const startTime = rawData[0].timestamp;

        let foundConfig = SENSOR_DEFAULTS.DEFAULT;
        if (selectedChannel.includes("EMG"))
            foundConfig = SENSOR_DEFAULTS.EMG;
        else if (selectedChannel.includes("ECG"))
            foundConfig = SENSOR_DEFAULTS.ECG;
        else if (selectedChannel.includes("EDA"))
            foundConfig = SENSOR_DEFAULTS.EDA;
        else if (selectedChannel.includes("ACC"))
            foundConfig = SENSOR_DEFAULTS.ACC;
        
        foundConfig = { ...foundConfig, title: `Canal: ${selectedChannel}` };
        setConfig(foundConfig);

        const processed: ProcessedData[] = rawData.map(item => ({
            time: item.timestamp - startTime,
            value: transferFunction(item[selectedChannel] || 0)
        }));

        const values = processed.map(d => d.value);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const margin = (maxVal - minVal) * 0.1 || 1.0;
        
        setYMin(minVal - margin);
        setYMax(maxVal + margin);

        setChartData(processed);
        const duration = processed.length > 0 ? processed[processed.length - 1].time : 0;
        
        if (Math.abs(duration - totalDuration) > 0.1) {
            setTotalDuration(duration);
            setViewStart(0);
            setViewEnd(duration);
        }

    }, [rawData, selectedChannel]);

    const tick = (now: number) => {
        const delta = now - lastRealTimeRef.current;
        lastRealTimeRef.current = now;
        timeMsRef.current += delta;
        setCurrentTime(timeMsRef.current / 1000);
        rafIdRef.current = requestAnimationFrame(tick);
    };

    useEffect(() => {
        const up = controls.onPlay((f) => { timeMsRef.current = f; lastRealTimeRef.current = performance.now(); setIsPlaying(true); });
        const uPa = controls.onPause(() => setIsPlaying(false));
        const uSe = controls.onSeek((t) => { timeMsRef.current = t; setCurrentTime(t / 1000); });
        const uSy = controls.onSync((t) => { if (Math.abs(t - timeMsRef.current) > 100) { timeMsRef.current = t; setCurrentTime(t/1000); }});
        return () => { up(); uPa(); uSe(); uSy(); };
    }, [controls]);

    useEffect(() => {
        if (isPlaying) {
            lastRealTimeRef.current = performance.now();
            rafIdRef.current = requestAnimationFrame(tick);
        } else {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        }
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [isPlaying]);

    const handleZoom = (direction: "in" | "out") => {
        const currentDur = viewEnd - viewStart;
        if (currentDur <= 0)
            return;
        const factor = direction === "in" ? 0.6 : 1.4;
        let newDur = currentDur * factor;
        if (newDur > totalDuration)
            newDur = totalDuration;
        const center = viewStart + (currentDur / 2);
        let newStart = center - (newDur / 2);
        let newEnd = center + (newDur / 2);
        if (newStart < 0) {
            newStart = 0;
            newEnd = newDur;
        }
        if (newEnd > totalDuration) {
            newEnd = totalDuration;
            newStart = totalDuration - newDur;
        }
        setViewStart(newStart);
        setViewEnd(newEnd);
    };

    const points = useMemo(() => {
        const dur = viewEnd - viewStart;
        if (chartData.length === 0 || dur <= 0)
            return "";
        const buffer = dur * 0.1;
        const visible = chartData.filter(d => d.time >= viewStart - buffer && d.time <= viewEnd + buffer);
        const yRange = yMax - yMin;
        return visible.map((d: ProcessedData) => {
            const x = ((d.time - viewStart) / dur) * 100;
            const y = ((yMax - d.value) / yRange) * 100;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(" ");
    }, [chartData, viewStart, viewEnd, yMin, yMax]);

    const getChartTime = (e: React.MouseEvent) => {
        if (!svgRef.current)
            return 0;
        const r = svgRef.current.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        return viewStart + (p * (viewEnd - viewStart));
    };

    const mouseUp = () => {
        setIsDragging(false);
        if (selectStart !== null && selectEnd !== null) {
             const min = Math.min(selectStart, selectEnd);
             const max = Math.max(selectStart, selectEnd);
             if (max - min > 0.1) {
                 setViewStart(min); setViewEnd(max);
                 setSelectStart(null); setSelectEnd(null);
             } else {
                 setSelectStart(null); setSelectEnd(null);
             }
        }
    };

    const stats = useMemo(() => {
        if (chartData.length === 0)
            return null;
        let s = viewStart, e = viewEnd;
        if (selectStart !== null && selectEnd !== null) {
            s = Math.min(selectStart, selectEnd); e = Math.max(selectStart, selectEnd);
        }
        const sub = chartData.filter(d => d.time >= s && d.time <= e).map(d => d.value);
        return calculateStats(sub);
    }, [chartData, viewStart, viewEnd, selectStart, selectEnd]);

    const cursorX = ((currentTime - viewStart) / (viewEnd - viewStart)) * 100;
    let selX = 0, selW = 0;
    if (selectStart !== null && selectEnd !== null) {
        const mn = Math.min(selectStart, selectEnd); const mx = Math.max(selectStart, selectEnd);
        selX = ((mn - viewStart)/(viewEnd - viewStart))*100;
        selW = ((mx - viewStart)/(viewEnd - viewStart))*100 - selX;
    }

    const exportMetrics = () => {
        if (!stats)
            return;
        const content = [
            `Canal;${selectedChannel}`,
            `Media;${stats.mean}`, `Desv. Estándar;${stats.stdDev}`, `RMS;${stats.rms}`,
            `Pico;${stats.peak}`, `CV %;${stats.cvp}`
        ].join("\n");
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Analisis_${selectedChannel}_${new Date().toISOString().slice(0,10)}.txt`;
        link.click();
    };

    return (
        <div style={{ display: "flex", height: "100%", flexDirection: "row", background: "#fff", fontFamily: "sans-serif", userSelect: "none" }}>
            <div style={{ flex: 3, padding: "10px 10px 25px 40px", position: "relative", display: "flex", flexDirection: "column" }}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5}}>
                    
                    <div style={{display: "flex", alignItems: "center", gap: 10}}>
                        <h3 style={{ margin: 0, fontSize: "1rem", color: config.color }}>{config.title}</h3>
                        <select 
                            value={selectedChannel} 
                            onChange={(e) => setSelectedChannel(e.target.value)}
                            style={{padding: "2px 5px", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.9rem"}}
                        >
                            {availableChannels.map(ch => (
                                <option key={ch} value={ch}>{ch}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{display: "flex", gap: 5}}>
                        <button onClick={() => handleZoom("in")} style={zoomBtnStyle}>Zoom (+)</button>
                        <button onClick={() => handleZoom("out")} style={zoomBtnStyle}>Zoom (-)</button>
                        <button onClick={() => { setViewStart(0); setViewEnd(totalDuration); }} style={{...zoomBtnStyle, background: "#6c757d"}}>Reset</button>
                    </div>
                </div>

                <div style={{ flex: 1, border: "1px solid #ccc", position: "relative", overflow: "hidden" }}>
                    <svg 
                        ref={svgRef} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
                        style={{ display: "block", cursor: "crosshair" }}
                        onMouseDown={(e) => { const t=getChartTime(e); setSelectStart(t); setSelectEnd(t); setIsDragging(true); }}
                        onMouseMove={(e) => { if(isDragging) setSelectEnd(getChartTime(e)); }}
                        onMouseUp={mouseUp} onMouseLeave={mouseUp}
                    >
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#eee" strokeWidth="0.5" />
                        <polyline points={points} fill="none" stroke={config.color} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                        {selW > 0 && <rect x={selX} y="0" width={selW} height="100" fill={config.color} fillOpacity="0.2" />}
                        {cursorX >= 0 && cursorX <= 100 && <line x1={cursorX} y1="0" x2={cursorX} y2="100" stroke="red" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
                    </svg>
                    
                    <div style={{position: "absolute", left: -35, top: 0, fontSize: "10px", color: "#666"}}>{yMax.toFixed(2)}</div>
                    <div style={{position: "absolute", left: -35, top: "50%", fontSize: "10px", color: "#666"}}>{((yMax+yMin)/2).toFixed(2)}</div>
                    <div style={{position: "absolute", left: -35, bottom: 0, fontSize: "10px", color: "#666"}}>{yMin.toFixed(2)}</div>
                </div>
                
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666'}}>
                    <span>{viewStart.toFixed(1)}s</span>
                    <span>{viewEnd.toFixed(1)}s</span>
                </div>
            </div>

            <div style={{ flex: 1, borderLeft: "1px solid #ddd", padding: "10px", background: "#f9f9f9" }}>
                <h4 style={{marginTop: 0}}>Análisis: {selectedChannel}</h4>
                {stats ? (
                    <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse", background: "white" }}>
                        <tbody>
                            <tr><td style={tdStyle}>Media</td><td style={tdStyle}>{stats.mean.toFixed(4)} {config.unit}</td></tr>
                            <tr><td style={tdStyle}>RMS</td><td style={tdStyle}>{stats.rms.toFixed(4)} {config.unit}</td></tr>
                            <tr><td style={tdStyle}>Pico Abs</td><td style={tdStyle}>{stats.peak.toFixed(4)} {config.unit}</td></tr>
                            <tr><td style={tdStyle}>CV %</td><td style={tdStyle}>{stats.cvp.toFixed(2)}</td></tr>
                        </tbody>
                    </table>
                ) : <p></p>}
                
                <div style={{display: "flex", flexDirection: "column", gap: 10, marginTop: 15}}>
                     <button onClick={exportMetrics} disabled={!stats} style={btnStyle}>Exportar Datos</button>
                     {selectStart !== null && (
                        <button onClick={() => {setSelectStart(null); setSelectEnd(null)}} style={{...btnStyle, background: "#f0ad4e"}}>
                        </button>
                     )}
                </div>
            </div>
        </div>
    );
}

const tdStyle: React.CSSProperties = { 
    border: "1px solid #ddd", 
    padding: "4px" 
};
const btnStyle: React.CSSProperties = {
    width: "100%", 
    padding: "8px", 
    border: "none", 
    borderRadius: "4px", 
    background: "#007bff", 
    color: "white", 
    cursor: "pointer" 
};
const zoomBtnStyle: React.CSSProperties = { 
    padding: "2px 8px", 
    fontSize: "0.8rem", 
    cursor: "pointer", 
    background: "#007bff", 
    color: "white", 
    border: "none", 
    borderRadius: "3px" 
};