import React, { useState, useEffect } from 'react';
import { Text, Box, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ToolPluginProps } from './types.js';
import { spawn, exec } from 'child_process';
import os from 'os';
import net from 'net';
import crypto from 'crypto';
import qrcode from 'qrcode-terminal';
import axios from 'axios';

interface SubTool {
  id: string;
  name: string;
  category: 'Network' | 'Security' | 'Dev';
  labels: string[];
  description: string;
  command?: string;
  winCommand?: string;
  hasPort?: boolean;
}

const TOOLS: SubTool[] = [
  { id: 'traceroute', name: 'Traceroute', category: 'Network', labels: ['diagnostic'], description: 'Track packet path', winCommand: 'tracert', command: 'traceroute' },
  { id: 'ping', name: 'Ping', category: 'Network', labels: ['diagnostic'], description: 'Test connectivity', command: 'ping' },
  { id: 'port-check', name: 'Port Checker', category: 'Network', labels: ['connectivity'], description: 'Check if port is open', hasPort: true },
  { id: 'cron-manager', name: 'Cron Manager', category: 'Dev', labels: ['automation', 'system'], description: 'Manage background jobs & view logs' },
  { id: 'json-format', name: 'JSON Formatter', category: 'Dev', labels: ['data'], description: 'Prettify JSON strings' },
  { id: 'base64', name: 'Base64 Tool', category: 'Dev', labels: ['encoding'], description: 'Encode/Decode Base64' },
  { id: 'jwt-decode', name: 'JWT Decoder', category: 'Dev', labels: ['auth'], description: 'Decode JWT payload' },
  { id: 'otp-gen', name: 'OTP & QR Generator', category: 'Dev', labels: ['auth', 'gen', 'qr'], description: 'Generate OTP or QR codes from text' },
  { id: 'timestamp', name: 'Timestamp Conv', category: 'Dev', labels: ['data', 'time'], description: 'Unix Epoch <-> Local Time' },
  { id: 'uuid-gen', name: 'UUID Generator', category: 'Dev', labels: ['data', 'gen'], description: 'Generate random UUID v4' },
  { id: 'url-tool', name: 'URL Tool', category: 'Dev', labels: ['web', 'encoding'], description: 'URL Encode/Decode' },
  { id: 'call-url', name: 'Call URL', category: 'Dev', labels: ['web', 'network', 'api'], description: 'Make HTTP GET request to URL' },
  { id: 'env-info', name: 'Env Info', category: 'Dev', labels: ['system'], description: 'Node, NPM and Env info' }
];

const PAGE_SIZE = 10;
const OUTPUT_PAGE_SIZE = 15;

const CRON_PRESETS: Record<string, string> = {
  '@1min': '* * * * *',
  '@5min': '*/5 * * * *',
  '@15min': '*/15 * * * *',
  '@30min': '*/30 * * * *',
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *'
};

export const ITTools: React.FC<ToolPluginProps> = ({ activeSubMenuId, isFocused, onInputFocus }) => {
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  
  const [target, setTarget] = useState('');
  const [port, setPort] = useState('80');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [outputScrollOffset, setOutputScrollOffset] = useState(0);
  const [inputMode, setInputMode] = useState<'NONE' | 'TARGET' | 'PORT' | 'CRON_SCHEDULE' | 'CRON_COMMAND' | 'CRON_LOG_INDEX'>('NONE');
  
  const [cronSchedule, setCronSchedule] = useState('@hourly');
  const [cronCommand, setCronCommand] = useState('');

  const isWin = os.platform() === 'win32';
  const cronPrefix = isWin ? 'wsl ' : '';

  const filteredTools = TOOLS.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                         t.labels.some(l => l.includes(search.toLowerCase()));
    if (activeSubMenuId === 'network') return t.category === 'Network' && matchesSearch;
    if (activeSubMenuId === 'utils') return t.category === 'Dev' && matchesSearch;
    return matchesSearch;
  });

  const getScrollWindow = (items: any[], current: number, pageSize: number) => {
    let start = Math.max(0, current - Math.floor(pageSize / 2));
    let end = start + pageSize;
    if (end > items.length) { end = items.length; start = Math.max(0, end - pageSize); }
    return { visibleItems: items.slice(start, end), startIndex: start, total: items.length };
  };

  const refreshCronList = () => {
    setIsRunning(true);
    exec(`${cronPrefix}crontab -l`, (err, stdout) => {
      setIsRunning(false);
      if (err) {
        if (err.message.includes('no crontab for')) setOutput(["(Your crontab is empty)"]);
        else setOutput([`❌ System Error: ${err.message}`]);
      } else {
        const lines = stdout.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
        setOutput(lines.length > 0 ? lines : ["(No active cron jobs)"]);
      }
    });
  };

  const viewCronLog = (index: number) => {
    setIsRunning(true);
    exec(`${cronPrefix}crontab -l`, (err, stdout) => {
      if (err) { setIsRunning(false); return; }
      const lines = stdout.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
      const job = lines[index];
      if (!job) { setOutput(["❌ Job index not found"]); setIsRunning(false); return; }

      // Look for redirected output file
      const match = job.match(/>>\s*(\/[^\s]+)/);
      if (!match) {
        setOutput([`❌ No log file found for this job.`, `Only jobs added via Hawk TUI with auto-logging are trackable.`, `Current command: ${job}`]);
        setIsRunning(false);
      } else {
        const logFile = match[1];
        exec(`${cronPrefix}tail -n 20 ${logFile}`, (err2, stdout2) => {
          setIsRunning(false);
          if (err2) setOutput([`❌ Could not read log: ${err2.message}`]);
          else setOutput([`📜 Last 20 lines of log (${logFile}):`, ``, ...(stdout2.trim().split('\n'))]);
        });
      }
    });
  };

  const addCronJob = () => {
    if (!cronCommand.trim()) return;
    setIsRunning(true);
    const finalSchedule = CRON_PRESETS[cronSchedule.trim()] || cronSchedule;
    const logId = crypto.randomBytes(4).toString('hex');
    const logPath = `/tmp/hawk-cron-${logId}.log`;
    
    // Auto-redirect output to log file
    const commandWithLog = `${cronCommand} >> ${logPath} 2>&1`;
    const newEntry = `${finalSchedule} ${commandWithLog}`;
    
    const cmd = isWin 
      ? `wsl bash -c "(crontab -l 2>/dev/null; echo '${newEntry}') | crontab -"`
      : `(crontab -l 2>/dev/null; echo "${newEntry}") | crontab -`;
    
    exec(cmd, (err) => {
      setIsRunning(false);
      if (err) setOutput([`❌ Failed: ${err.message}`]);
      else { setOutput([`✅ Job added with Logging!`, `Log: ${logPath}`, `Run: ${cronCommand}`]); setCronCommand(''); setInputMode('NONE'); setTimeout(refreshCronList, 1500); }
    });
  };

  const deleteCronJob = (index: number) => {
    setIsRunning(true);
    exec(`${cronPrefix}crontab -l`, (err, stdout) => {
      if (err) { setIsRunning(false); return; }
      const lines = stdout.trim().split('\n').filter(l => l.trim());
      const filtered = lines.filter((_, i) => i !== index);
      const newCrontab = filtered.join('\n');
      const cmd = newCrontab ? (isWin ? `wsl bash -c "echo '${newCrontab}' | crontab -"` : `echo "${newCrontab}" | crontab -`) : `${cronPrefix}crontab -r`;
      exec(cmd, (err2) => {
        setIsRunning(false);
        if (err2) setOutput([`❌ Failed: ${err2.message}`]);
        else { setOutput([`✅ Job deleted.`]); setTimeout(refreshCronList, 1500); }
      });
    });
  };

  const runTool = () => {
    if (!activeToolId) return;
    const tool = TOOLS.find(t => t.id === activeToolId);
    if (!tool) return;
    setIsRunning(true); setInputMode('NONE'); onInputFocus?.(false); setOutputScrollOffset(0);

    if (tool.id === 'cron-manager') { refreshCronList(); return; }
    
    // Logic for other tools...
    if (tool.id === 'otp-gen') {
      const input = target.trim();
      if (input.startsWith('qr:')) qrcode.generate(input.substring(3).trim(), { small: true }, (code) => setOutput([`QR:`, ...code.split('\n')]));
      else { setOutput([`OTP: ${crypto.randomInt(100000, 999999)}`]); }
      setIsRunning(false); return;
    }
    if (tool.id === 'json-format') { try { setOutput(JSON.stringify(JSON.parse(target), null, 2).split('\n')); } catch (e) { setOutput(["❌ Error"]); } setIsRunning(false); return; }
    if (tool.id === 'base64') { setOutput([`➡ ${Buffer.from(target).toString('base64')}`, `⬅ ${Buffer.from(target, 'base64').toString('utf8')}`]); setIsRunning(false); return; }
    if (tool.id === 'jwt-decode') { try { setOutput([`Payload:`, ...JSON.stringify(JSON.parse(Buffer.from(target.split('.')[1], 'base64').toString()), null, 2).split('\n')]); } catch (e) { setOutput(["❌ Error"]); } setIsRunning(false); return; }
    if (tool.id === 'uuid-gen') { setOutput([`UUID: ${crypto.randomUUID()}`]); setIsRunning(false); return; }
    if (tool.id === 'timestamp') { try { if (/^\d+$/.test(target)) { setOutput([`Time: ${new Date(parseInt(target)*1000).toLocaleString()}`]); } else { setOutput([`TS: ${Math.floor(new Date(target).getTime()/1000)}`]); } } catch (e) { setOutput(["❌ Error"]); } setIsRunning(false); return; }
    if (tool.id === 'env-info') { setOutput([`Node: ${process.version}`, `OS: ${os.type()}`, ``, `Env:`, ...Object.entries(process.env).slice(0, 10).map(([k,v]) => `${k}=${v?.substring(0,30)}...`)]); setIsRunning(false); return; }
    
    if (tool.id === 'call-url') {
      const url = target.trim();
      if (!url) { setOutput(["❌ Error: URL is required"]); setIsRunning(false); return; }
      
      axios.get(url, { timeout: 10000 })
        .then(res => {
          const resOutput = [
            `✅ Success: ${res.status} ${res.statusText}`,
            `Time: ${new Date().toLocaleTimeString()}`,
            `Content-Type: ${res.headers['content-type']}`,
            `--- Response Body ---`,
            ...(typeof res.data === 'object' 
              ? JSON.stringify(res.data, null, 2).split('\n') 
              : String(res.data).split('\n'))
          ];
          setOutput(resOutput);
          setIsRunning(false);
        })
        .catch(err => {
          const errorMsg = err.response 
            ? `❌ Error: ${err.response.status} ${err.response.statusText}`
            : `❌ Error: ${err.message}`;
          setOutput([errorMsg, ...(err.response ? JSON.stringify(err.response.data, null, 2).split('\n') : [])]);
          setIsRunning(false);
        });
      return;
    }

    if (tool.id === 'port-check') {
      const socket = new net.Socket(); socket.setTimeout(2000);
      socket.on('connect', () => { setOutput([`✅ ${target}:${port} OPEN`]); socket.destroy(); setIsRunning(false); });
      socket.on('error', () => { setOutput([`❌ ${target}:${port} CLOSED`]); setIsRunning(false); });
      socket.connect(parseInt(port), target); return;
    }

    const cmd = isWin ? (tool.winCommand || tool.command) : (tool.command || tool.winCommand);
    if (!cmd) { setIsRunning(false); return; }
    const proc = spawn(cmd.split(' ')[0], [...(cmd.split(' ').slice(1)), target]);
    proc.stdout.on('data', (data) => setOutput(prev => {
      const lines = [...prev, data.toString().trim()];
      if (outputScrollOffset + OUTPUT_PAGE_SIZE >= prev.length) setOutputScrollOffset(Math.max(0, lines.length - OUTPUT_PAGE_SIZE));
      return lines;
    }));
    proc.on('close', () => setIsRunning(false));
  };

  useInput((input, key) => {
    if (inputMode !== 'NONE') { if (key.escape) { setInputMode('NONE'); onInputFocus?.(false); } return; }
    if (isSearching) { if (key.escape) { setIsSearching(false); onInputFocus?.(false); } return; }
    if (activeToolId) {
      if (isRunning) return;
      if (key.escape || input === 'b') { setActiveToolId(null); setOutput([]); setTarget(''); setOutputScrollOffset(0); }
      if (activeToolId === 'cron-manager') {
        if (input === 'a') { setInputMode('CRON_SCHEDULE'); onInputFocus?.(true); }
        if (input === 'd') { setInputMode('TARGET'); onInputFocus?.(true); }
        if (input === 'l') { setInputMode('CRON_LOG_INDEX'); onInputFocus?.(true); }
        if (input === 'r') { refreshCronList(); }
      } else {
        if (input === 'r') { setInputMode('TARGET'); onInputFocus?.(true); }
        if (input === 'p' && TOOLS.find(t => t.id === activeToolId)?.hasPort) { setInputMode('PORT'); onInputFocus?.(true); }
      }
      if (input === '[') setOutputScrollOffset(Math.max(0, outputScrollOffset - 5));
      if (input === ']') setOutputScrollOffset(Math.min(Math.max(0, output.length - OUTPUT_PAGE_SIZE), outputScrollOffset + 5));
      return;
    }
    if (!isFocused) return;
    if (key.upArrow) setSelectedIndex(Math.max(0, selectedIndex - 1));
    if (key.downArrow) setSelectedIndex(Math.min(filteredTools.length - 1, selectedIndex + 1));
    if (key.return && filteredTools[selectedIndex]) {
      const tool = filteredTools[selectedIndex];
      setActiveToolId(tool.id);
      if (tool.id === 'env-info' || tool.id === 'cron-manager' || tool.id === 'uuid-gen') setTimeout(runTool, 100);
    }
    if (input === '/') { setIsSearching(true); onInputFocus?.(true); }
  });

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">🛠️ IT Tools Explorer</Text>
        <Text color="gray">/: Search | Enter: Select | b: Back</Text>
      </Box>

      {!activeToolId ? (
        <Box flexDirection="column">
          <Box borderStyle="round" borderColor={isSearching ? "cyan" : "gray"} paddingX={1} marginBottom={1}>
            <Text bold color={isSearching ? "cyan" : "white"}>🔍 Search: </Text>
            {isSearching ? <TextInput value={search} onChange={setSearch} /> : <Text color="gray">{search || "Search tools or labels..."}</Text>}
          </Box>
          <Box flexDirection="row">
            <Box flexDirection="column" width={40} borderRightStyle="single" borderColor="gray" paddingRight={1}>
              {getScrollWindow(filteredTools, selectedIndex, PAGE_SIZE).visibleItems.map((t, i) => {
                const actualIndex = i + getScrollWindow(filteredTools, selectedIndex, PAGE_SIZE).startIndex;
                return (
                  <Box key={t.id} flexDirection="column" marginBottom={1}>
                    <Text color={actualIndex === selectedIndex ? "cyan" : "white"}>{actualIndex === selectedIndex ? "> " : "  "}{t.name}</Text>
                    <Box marginLeft={4} flexDirection="row">{t.labels.map(l => <Text key={l} color="magenta" dimColor fontSize="small"> #{l}</Text>)}</Box>
                  </Box>
                );
              })}
            </Box>
            <Box flexDirection="column" flexGrow={1} paddingLeft={2}>
              {filteredTools[selectedIndex] && (
                <>
                  <Text bold underline color="yellow">{filteredTools[selectedIndex].name}</Text>
                  <Text italic color="gray" marginBottom={1}>{filteredTools[selectedIndex].description}</Text>
                  <Text>Category: <Text color="green">{filteredTools[selectedIndex].category}</Text></Text>
                </>
              )}
            </Box>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          <Box borderBottomStyle="single" borderColor="cyan" marginBottom={1} justifyContent="space-between">
            <Text bold color="yellow">Running: {TOOLS.find(t => t.id === activeToolId)?.name.toUpperCase()}</Text>
            <Text color="gray">ESC/b: Back</Text>
          </Box>
          <Box flexDirection="column">
            {activeToolId === 'cron-manager' ? (
              <Box flexDirection="column">
                {inputMode === 'CRON_SCHEDULE' && <Box marginBottom={1} borderStyle="single" borderColor="magenta" paddingX={1}><Text bold>Schedule (@hourly, ...): </Text><TextInput value={cronSchedule} onChange={setCronSchedule} onSubmit={() => setInputMode('CRON_COMMAND')} /></Box>}
                {inputMode === 'CRON_COMMAND' && <Box marginBottom={1} borderStyle="single" borderColor="yellow" paddingX={1}><Text bold>Command: </Text><TextInput value={cronCommand} onChange={setCronCommand} onSubmit={addCronJob} /></Box>}
                {inputMode === 'TARGET' && <Box marginBottom={1} borderStyle="single" borderColor="red" paddingX={1}><Text bold color="red">Delete Index: </Text><TextInput value={target} onChange={setTarget} onSubmit={() => { deleteCronJob(parseInt(target)); setTarget(''); setInputMode('NONE'); }} /></Box>}
                {inputMode === 'CRON_LOG_INDEX' && <Box marginBottom={1} borderStyle="single" borderColor="cyan" paddingX={1}><Text bold color="cyan">View Log Index: </Text><TextInput value={target} onChange={setTarget} onSubmit={() => { viewCronLog(parseInt(target)); setTarget(''); setInputMode('NONE'); }} /></Box>}
                
                <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} minHeight={15}>
                  <Text bold underline color="cyan" marginBottom={1}>Active Cron Jobs (Indices):</Text>
                  {output.slice(outputScrollOffset, outputScrollOffset + OUTPUT_PAGE_SIZE).map((line, i) => (
                    <Text key={i} color="white" wrap="truncate-end">{`[${i + outputScrollOffset}] ${line}`}</Text>
                  ))}
                </Box>
                <Text color="gray" marginTop={1}>a: Add | d: Delete | l: View Log | r: Refresh | b: Back</Text>
              </Box>
            ) : (
              <Box flexDirection="column">
                <Box marginBottom={1} flexDirection="column">
                  <Text bold>{activeToolId === 'otp-gen' ? "Input: " : 'Data: '}</Text>
                  {inputMode === 'TARGET' ? <TextInput value={target} onChange={setTarget} onSubmit={runTool} /> : <Text color="cyan">{target || "(Press 'r' to input)"}</Text>}
                </Box>
                <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} minHeight={15}>
                  {output.slice(outputScrollOffset, outputScrollOffset + OUTPUT_PAGE_SIZE).map((line, i) => <Text key={i} color="white" wrap="truncate-end">{line}</Text>)}
                </Box>
                {!isRunning && activeToolId !== 'env-info' && activeToolId !== 'uuid-gen' && <Text color="gray" marginTop={1}>r: Input & Run | b: Back</Text>}
              </Box>
            )}
            {output.length > OUTPUT_PAGE_SIZE && <Text color="yellow" dimColor>Scroll Output: {outputScrollOffset + 1}-{Math.min(outputScrollOffset + OUTPUT_PAGE_SIZE, output.length)} / {output.length} ([, ])</Text>}
          </Box>
        </Box>
      )}
    </Box>
  );
};
