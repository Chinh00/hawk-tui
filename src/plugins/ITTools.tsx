import React, { useState, useEffect, useRef } from 'react';
import { Text, Box, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ToolPluginProps } from './types.js';
import { spawn, exec } from 'child_process';
import os from 'os';
import net from 'net';
import crypto from 'crypto';
import qrcode from 'qrcode-terminal';

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
  // Network Tools
  { id: 'traceroute', name: 'Traceroute', category: 'Network', labels: ['diagnostic'], description: 'Track packet path', winCommand: 'tracert', command: 'traceroute' },
  { id: 'ping', name: 'Ping', category: 'Network', labels: ['diagnostic'], description: 'Test connectivity', command: 'ping' },
  { id: 'port-check', name: 'Port Checker', category: 'Network', labels: ['connectivity'], description: 'Check if port is open', hasPort: true },
  
  // Dev Tools - Data
  { id: 'json-format', name: 'JSON Formatter', category: 'Dev', labels: ['data'], description: 'Prettify JSON strings' },
  { id: 'base64', name: 'Base64 Tool', category: 'Dev', labels: ['encoding'], description: 'Encode/Decode Base64' },
  { id: 'jwt-decode', name: 'JWT Decoder', category: 'Dev', labels: ['auth'], description: 'Decode JWT payload' },
  
  // Dev Tools - Generators & Converters
  { id: 'otp-gen', name: 'OTP & QR Generator', category: 'Dev', labels: ['auth', 'gen', 'qr'], description: 'Generate OTP or QR codes from text' },
  { id: 'timestamp', name: 'Timestamp Conv', category: 'Dev', labels: ['data', 'time'], description: 'Unix Epoch <-> Local Time' },
  { id: 'uuid-gen', name: 'UUID Generator', category: 'Dev', labels: ['data', 'gen'], description: 'Generate random UUID v4' },
  { id: 'url-tool', name: 'URL Tool', category: 'Dev', labels: ['web', 'encoding'], description: 'URL Encode/Decode' },
  { id: 'cron-info', name: 'Cron Explainer', category: 'Dev', labels: ['devops', 'utils'], description: 'Parse cron expressions' },
  { id: 'lorem', name: 'Lorem Ipsum', category: 'Dev', labels: ['ui', 'gen'], description: 'Generate placeholder text' },
  
  // System
  { id: 'env-info', name: 'Env Info', category: 'Dev', labels: ['system'], description: 'Node, NPM and Env info' }
];

const PAGE_SIZE = 10;
const OUTPUT_PAGE_SIZE = 15;

export const ITTools: React.FC<ToolPluginProps> = ({ activeSubMenuId, isFocused, onInputFocus }) => {
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  
  // States
  const [target, setTarget] = useState('');
  const [port, setPort] = useState('80');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [outputScrollOffset, setOutputScrollOffset] = useState(0);
  const [inputMode, setInputMode] = useState<'NONE' | 'TARGET' | 'PORT'>('NONE');

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
    if (end > items.length) {
      end = items.length;
      start = Math.max(0, end - pageSize);
    }
    return { visibleItems: items.slice(start, end), startIndex: start, total: items.length };
  };

  // Simple TOTP Implementation (Basic)
  const generateTOTP = (secret: string) => {
    try {
      const epoch = Math.round(Date.now() / 1000.0);
      const time = Buffer.alloc(8);
      time.writeBigInt64BE(BigInt(Math.floor(epoch / 30)));
      
      const hmac = crypto.createHmac('sha1', secret);
      hmac.update(time);
      const hash = hmac.digest();
      
      const offset = hash[hash.length - 1] & 0xf;
      const binary = ((hash[offset] & 0x7f) << 24) |
                     ((hash[offset + 1] & 0xff) << 16) |
                     ((hash[offset + 2] & 0xff) << 8) |
                     (hash[offset + 3] & 0xff);
      
      const otp = binary % 1000000;
      return otp.toString().padStart(6, '0');
    } catch (e) {
      return null;
    }
  };

  const runTool = () => {
    if (!activeToolId) return;
    const tool = TOOLS.find(t => t.id === activeToolId);
    if (!tool) return;

    setIsRunning(true);
    setInputMode('NONE');
    onInputFocus?.(false);
    setOutput([`Executing ${tool.name}...`]);
    setOutputScrollOffset(0);

    // OTP & QR Logic
    if (tool.id === 'otp-gen') {
      const input = target.trim();
      
      // Check for QR trigger (if input starts with 'qr:')
      if (input.startsWith('qr:')) {
        const qrContent = input.substring(3).trim();
        if (!qrContent) {
          setOutput(["❌ Please input content after 'qr:' (e.g., qr:hello world)"]);
        } else {
          // Use qrcode-terminal to get a string representation
          qrcode.generate(qrContent, { small: true }, (code) => {
            setOutput([
              `QR Code for: ${qrContent}`,
              ``,
              ...code.split('\n'),
              ``,
              `[Scan with your phone]`
            ]);
          });
        }
      } 
      // Numeric OTP
      else if (!input || /^\d+$/.test(input)) {
        const length = parseInt(input) || 6;
        if (length > 20) { setOutput(["❌ Length too long (max 20)"]); }
        else {
          const digits = '0123456789';
          let otp = '';
          for (let i = 0; i < length; i++) otp += digits[crypto.randomInt(0, 10)];
          setOutput([
            `Random ${length}-digit OTP:`, 
            ``, 
            `👉 ${otp}`, 
            ``, 
            `Tip: Input 'qr:text' to generate a QR Code`
          ]);
        }
      } 
      // TOTP
      else {
        const code = generateTOTP(input);
        if (code) {
          setOutput([
            `TOTP Code for secret: ${input}`, 
            ``, 
            `👉 ${code}`, 
            ``, 
            `Refresh in: ${30 - (Math.round(Date.now() / 1000) % 30)}s`
          ]);
        } else {
          setOutput([`❌ Could not generate TOTP. Ensure secret is valid.`]);
        }
      }
      setIsRunning(false); return;
    }

    // Fullstack Dev Logic
    if (tool.id === 'json-format') {
      try {
        const parsed = JSON.parse(target);
        setOutput(JSON.stringify(parsed, null, 2).split('\n'));
      } catch (e: any) { setOutput([`❌ Invalid JSON: ${e.message}`]); }
      setIsRunning(false); return;
    }

    if (tool.id === 'base64') {
      const encoded = Buffer.from(target).toString('base64');
      const decoded = Buffer.from(target, 'base64').toString('utf8');
      setOutput([`Original: ${target}`, ``, `➡ Encoded: ${encoded}`, `⬅ Decoded: ${decoded}`]);
      setIsRunning(false); return;
    }

    if (tool.id === 'jwt-decode') {
      try {
        const parts = target.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        setOutput([`JWT PAYLOAD:`, ...JSON.stringify(payload, null, 2).split('\n')]);
      } catch (e: any) { setOutput([`❌ Invalid JWT`]); }
      setIsRunning(false); return;
    }

    if (tool.id === 'hash-gen') {
      const md5 = crypto.createHash('md5').update(target).digest('hex');
      const sha256 = crypto.createHash('sha256').update(target).digest('hex');
      setOutput([`MD5: ${md5}`, `SHA256: ${sha256}`]);
      setIsRunning(false); return;
    }

    if (tool.id === 'timestamp') {
      try {
        if (/^\d+$/.test(target)) {
          const date = new Date(parseInt(target) * (target.length <= 10 ? 1000 : 1));
          setOutput([`Timestamp: ${target}`, `Local Time: ${date.toLocaleString()}`, `ISO: ${date.toISOString()}`]);
        } else {
          const ts = Math.floor(new Date(target).getTime() / 1000);
          if (isNaN(ts)) throw new Error("Invalid date string");
          setOutput([`Date: ${target}`, `Unix Timestamp: ${ts}`]);
        }
      } catch (e: any) { setOutput([`❌ Error: ${e.message}`]); }
      setIsRunning(false); return;
    }

    if (tool.id === 'uuid-gen') {
      const uuids = Array.from({length: 5}).map(() => crypto.randomUUID());
      setOutput([`Generated 5 UUIDs:`, ...uuids.map(u => ` ➜ ${u}`)]);
      setIsRunning(false); return;
    }

    if (tool.id === 'url-tool') {
      setOutput([`Original: ${target}`, ``, `➡ Encoded: ${encodeURIComponent(target)}`, `⬅ Decoded: ${decodeURIComponent(target)}`]);
      setIsRunning(false); return;
    }

    if (tool.id === 'cron-info') {
      const parts = target.split(' ');
      if (parts.length < 5) { setOutput(["❌ Invalid Cron: Must have 5 parts (e.g., * * * * *)"]); }
      else {
        setOutput([`Expression: ${target}`, ``, `Interpretation (Basic):`, `Minutes: ${parts[0]}`, `Hours: ${parts[1]}`, `Day of Month: ${parts[2]}`, `Month: ${parts[3]}`, `Day of Week: ${parts[4]}`]);
      }
      setIsRunning(false); return;
    }

    if (tool.id === 'lorem') {
      const count = parseInt(target) || 3;
      const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(count);
      setOutput([`Generated ${count} units:`, ``, text]);
      setIsRunning(false); return;
    }

    if (tool.id === 'env-info') {
      setOutput([`Node: ${process.version}`, `OS: ${os.type()} ${os.release()}`, ``, `Top Env:`, ...Object.entries(process.env).slice(0, 30).map(([k, v]) => `${k}=${v?.substring(0, 50)}...`)]);
      setIsRunning(false); return;
    }

    if (tool.id === 'port-check') {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.on('connect', () => { setOutput([`✅ ${target}:${port} is OPEN.`]); socket.destroy(); setIsRunning(false); });
      socket.on('error', () => { setOutput([`❌ ${target}:${port} is CLOSED.`]); setIsRunning(false); });
      socket.connect(parseInt(port), target); return;
    }

    const isWin = os.platform() === 'win32';
    const cmd = isWin ? (tool.winCommand || tool.command) : (tool.command || tool.winCommand);
    if (!cmd) { setIsRunning(false); return; }
    let args = [target];
    if (tool.id === 'ping') args = isWin ? ['-n', '4', target] : ['-c', '4', target];
    const proc = spawn(cmd.split(' ')[0], [...(cmd.split(' ').slice(1)), ...args]);
    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      setOutput(prev => {
        const newOutput = [...prev, ...lines];
        if (outputScrollOffset + OUTPUT_PAGE_SIZE >= prev.length) {
          setOutputScrollOffset(Math.max(0, newOutput.length - OUTPUT_PAGE_SIZE));
        }
        return newOutput;
      });
    });
    proc.on('close', (code) => { setIsRunning(false); setOutput(prev => [...prev, `--- Done (${code}) ---`]); });
  };

  useInput((input, key) => {
    if (inputMode !== 'NONE') {
      if (key.escape) { setInputMode('NONE'); onInputFocus?.(false); }
      return;
    }
    if (isSearching) {
      if (key.escape) { setIsSearching(false); onInputFocus?.(false); }
      return;
    }
    if (activeToolId) {
      if (isRunning) return;
      if (key.escape || input === 'b') { setActiveToolId(null); setOutput([]); setTarget(''); setOutputScrollOffset(0); }
      if (input === 'r') { setInputMode('TARGET'); onInputFocus?.(true); }
      if (input === 'p' && TOOLS.find(t => t.id === activeToolId)?.hasPort) { setInputMode('PORT'); onInputFocus?.(true); }
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
      if (tool.id === 'env-info' || tool.id === 'uuid-gen') setTimeout(runTool, 100);
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
              {filteredTools.length > PAGE_SIZE && <Text color="gray" dimColor>  (Scroll for more... {selectedIndex + 1}/{filteredTools.length})</Text>}
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
            {activeToolId !== 'env-info' && activeToolId !== 'uuid-gen' && (
              <Box marginBottom={1} flexDirection="column">
                <Text bold>
                  {activeToolId === 'otp-gen' ? "Input (length, secret, or 'qr:text'): " : 
                   activeToolId === 'lorem' ? 'Units: ' : 
                   activeToolId === 'port-check' ? 'Target Host: ' : 'Input Data: '}
                </Text>
                {inputMode === 'TARGET' ? <TextInput value={target} onChange={setTarget} onSubmit={runTool} /> : <Text color="cyan" wrap="truncate-end">{target || "(Press 'r' to input)"}</Text>}
              </Box>
            )}
            <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} minHeight={15}>
              {output.slice(outputScrollOffset, outputScrollOffset + OUTPUT_PAGE_SIZE).map((line, i) => <Text key={i} color="white" wrap="truncate-end">{line}</Text>)}
            </Box>
            {output.length > OUTPUT_PAGE_SIZE && (
              <Text color="yellow" dimColor>Scroll Output: {outputScrollOffset + 1}-{Math.min(outputScrollOffset + OUTPUT_PAGE_SIZE, output.length)} / {output.length} (Use [ and ] to scroll)</Text>
            )}
            {!isRunning && activeToolId !== 'env-info' && activeToolId !== 'uuid-gen' && <Text color="gray" marginTop={1}>r: Input & Run | b: Back</Text>}
          </Box>
        </Box>
      )}
    </Box>
  );
};
