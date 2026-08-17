import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.join(__dirname, '..', '..', 'data', 'logs');

export interface LogEntry {
  id: string;
  timestamp: string;
  localTime: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'AUDIT' | 'DB' | 'RESET_WATCH';
  category: 'DATABASE' | 'STORAGE' | 'ADMIN_ACTION' | 'LIFECYCLE' | 'FALLBACK' | 'AUTH' | 'DIAGNOSTIC';
  message: string;
  details?: Record<string, any>;
  instanceId: string;
  uptimeSeconds: number;
}

// Generate unique container instance ID for this process
const INSTANCE_ID = `inst_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
const SERVER_START_TIME = Date.now();

// Circular in-memory buffer of latest 500 logs for instant access
const MAX_IN_MEMORY_LOGS = 500;
const memoryLogs: LogEntry[] = [];

// Ensure log directory exists
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (e) {
  console.error('Failed to create log dir:', e);
}

function getBrazilianTimeString(date: Date = new Date()): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function logEvent(
  level: LogEntry['level'],
  category: LogEntry['category'],
  message: string,
  details?: Record<string, any>
): LogEntry {
  const now = new Date();
  const entry: LogEntry = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now.toISOString(),
    localTime: getBrazilianTimeString(now),
    level,
    category,
    message,
    details,
    instanceId: INSTANCE_ID,
    uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000)
  };

  // Add to memory
  memoryLogs.unshift(entry);
  if (memoryLogs.length > MAX_IN_MEMORY_LOGS) {
    memoryLogs.pop();
  }

  // Console output
  const prefix = `[${entry.localTime}][${entry.level}][${entry.category}]`;
  if (level === 'ERROR') {
    console.error(prefix, message, details || '');
  } else if (level === 'WARN') {
    console.warn(prefix, message, details || '');
  } else {
    console.log(prefix, message, details || '');
  }

  // Append to current date log file asynchronously
  try {
    const today = now.toISOString().slice(0, 10);
    const logFile = path.join(logDir, `system_${today}.log`);
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (err) {
    // Silently ignore disk write error if container filesystem is restricted
  }

  return entry;
}

export function getLogs(filters?: {
  level?: string;
  category?: string;
  search?: string;
  limit?: number;
}): { logs: LogEntry[]; diagnostics: Record<string, any> } {
  let filtered = [...memoryLogs];

  if (filters?.level && filters.level !== 'ALL') {
    filtered = filtered.filter(l => l.level === filters.level);
  }

  if (filters?.category && filters.category !== 'ALL') {
    filtered = filtered.filter(l => l.category === filters.category);
  }

  if (filters?.search) {
    const term = filters.search.toLowerCase();
    filtered = filtered.filter(l =>
      l.message.toLowerCase().includes(term) ||
      (l.details && JSON.stringify(l.details).toLowerCase().includes(term))
    );
  }

  const limit = filters?.limit || 100;
  const logs = filtered.slice(0, limit);

  return {
    logs,
    diagnostics: {
      instanceId: INSTANCE_ID,
      serverStartTime: new Date(SERVER_START_TIME).toISOString(),
      uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
      totalLogsRecorded: memoryLogs.length,
      storageMode: 'PostgreSQL (Cloud SQL Relational Database)',
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      localTimeBR: getBrazilianTimeString()
    }
  };
}

export function clearLogs(): boolean {
  memoryLogs.length = 0;
  logEvent('INFO', 'LIFECYCLE', 'Histórico de logs em memória foi limpo pelo administrador.');
  return true;
}

// Log initial startup state
logEvent('INFO', 'LIFECYCLE', '🚀 Servidor inicializado / Container iniciado', {
  instanceId: INSTANCE_ID,
  storageMode: 'PostgreSQL (Cloud SQL Relational Database)',
  environment: process.env.NODE_ENV || 'development'
});

