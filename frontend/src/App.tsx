import React, { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertCircle, CheckCircle2, Server, Terminal, Wifi } from 'lucide-react';
import { format } from 'date-fns';

export default function App() {
  const [data, setData] = useState<{ config: any; state: any } | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        setData(await statsRes.json());
      }
      const logsRes = await fetch('/api/logs');
      if (logsRes.ok) {
        setLogs(await logsRes.json());
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!data || !data.config) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-400 flex items-center justify-center font-mono">
        <Activity className="animate-pulse mr-2" /> Initializing Dashboard...
      </div>
    );
  }

  const { config, state } = data;
  const targets = config.targets || [];
  
  const groupedTargets = targets.reduce((acc: any, target: any) => {
    const group = target.group || 'ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(target);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center">
              <Activity className="mr-3 text-emerald-500" />
              Network Monitor
            </h1>
            <p className="text-zinc-500 mt-1 text-sm">Real-time status and latency metrics</p>
          </div>
          <div className="text-xs font-mono bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-400">
            Polling: {config.polling?.interval || 5000}ms
          </div>
        </header>

        {/* Targets Groups */}
        <div className="space-y-12">
          {Object.entries(groupedTargets).map(([groupName, groupTargets]: [string, any]) => (
            <div key={groupName}>
              <h2 className="text-xl font-medium tracking-tight mb-4 text-zinc-300 capitalize flex items-center">
                <span className="w-2 h-2 rounded-full bg-zinc-700 mr-2"></span>
                {groupName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupTargets.map((target: any) => {
                  const stats = state.stats[target.id] || [];
                  const latest = stats.length > 0 ? stats[stats.length - 1] : null;
                  const isUp = latest ? latest.isUp : false;
                  
                  return (
                    <div key={target.id} className="bg-[#111] border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <div className="p-5 pb-0">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-medium text-zinc-200">{target.name}</h3>
                            <p className="text-xs text-zinc-500 font-mono mt-1">{target.url || target.host || target.interface}</p>
                          </div>
                          {latest ? (
                            isUp ? (
                              <div className="flex items-center text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Online
                              </div>
                            ) : (
                              <div className="flex items-center text-xs font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded-full">
                                <AlertCircle className="w-3.5 h-3.5 mr-1" /> Offline
                              </div>
                            )
                          ) : (
                            <div className="text-xs text-zinc-600 font-mono">Waiting...</div>
                          )}
                        </div>
                        
                        {target.type === 'arp' ? (
                          <div className="h-40 overflow-y-auto mb-4 custom-scrollbar">
                            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Discovered Hosts</div>
                            {latest?.devices?.length > 0 ? (
                              <div className="space-y-2">
                                {latest.devices.map((d: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-zinc-900/50 border border-zinc-800/50">
                                    <span className="font-mono text-zinc-300 flex items-center"><Server className="w-3 h-3 mr-2 text-zinc-500"/>{d.ip}</span>
                                    <span className="text-zinc-600 truncate max-w-[100px]">{d.vendor || 'Unknown'}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-zinc-600 py-4 text-center">No devices found on {target.interface}</div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-end mb-2">
                              <span className="text-3xl font-light tracking-tighter">
                                {latest ? Math.round(latest.latency) : 0}
                              </span>
                              <span className="text-zinc-500 text-sm ml-1 mb-1">ms</span>
                            </div>
                            
                            <div className="h-28 mt-4 -mx-5 -mb-1">
                              {stats.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={stats.map((s:any, i:number) => ({ ...s, index: i }))}>
                                    <defs>
                                      <linearGradient id={`color-${target.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <Tooltip 
                                      content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                          const data = payload[0].payload;
                                          return (
                                            <div className="bg-zinc-900 border border-zinc-800 p-2 rounded text-xs font-mono shadow-xl">
                                              <div className={data.isUp ? "text-emerald-400" : "text-red-400"}>
                                                {Math.round(data.latency)}ms
                                              </div>
                                              <div className="text-zinc-500 mt-1">
                                                {format(new Date(data.time), 'HH:mm:ss')}
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      }}
                                    />
                                    <Area 
                                      type="monotone" 
                                      dataKey="latency" 
                                      stroke={isUp ? "#10b981" : "#ef4444"} 
                                      strokeWidth={2}
                                      fillOpacity={1} 
                                      fill={`url(#color-${target.id})`} 
                                      isAnimationActive={false}
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="h-full flex items-center justify-center text-zinc-700 text-sm font-mono border-t border-zinc-800/50">Collecting data...</div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Terminal Logs */}
        <div className="mt-8 bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-3 flex items-center">
            <Terminal className="w-4 h-4 mr-2 text-zinc-500" />
            <h3 className="font-medium text-sm text-zinc-300">System Logs</h3>
          </div>
          <div className="p-4 h-64 overflow-y-auto font-mono text-xs space-y-1.5 custom-scrollbar">
            {logs.length === 0 ? (
              <div className="text-zinc-600 italic">No logs available.</div>
            ) : (
              logs.map((log: any, i: number) => (
                <div key={i} className="flex items-start">
                  <span className="text-zinc-600 mr-3 shrink-0">[{format(new Date(log.timestamp), 'HH:mm:ss')}]</span>
                  <span className={log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-zinc-300'}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #3f3f46;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
