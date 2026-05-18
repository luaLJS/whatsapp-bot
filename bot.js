const { exec } = require("child_process");

const contadorSessao = {};

const CADENCE_CONFIG = {
  sendingWindow: {
    startHour: 10,
    endHour: 22,
  },
  normalDelaySeconds: {
    minRange: [43, 57],
    modeRange: [58, 70],
    maxRange: [70, 95],
  },
  jitterPercentRange: [0.2, 0.4],
  longPauseAfterMessagesRange: [7, 11],
  longPauseSecondsRange: [180, 480],
  hourlyLimitMessagesRange: [17, 25],
  hourlyCooldownSecondsRange: [180, 600],
  errorBackoffSecondsRange: [300, 1200],
  typing: {
    charsPerSecondRange: [7, 15],
    beforeTypingSecondsRange: [0.4, 2.5],
    afterTypingSecondsRange: [0.2, 1.2],
    minTypingSecondsRange: [1.5, 3],
    maxTypingSecondsRange: [10, 22],
    jitterPercentRange: [0.15, 0.35],
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(randomFloat(min, max + 1));
}

function randomTriangular(min, max, mode) {
  const u = Math.random();
  const c = (mode - min) / (max - min);

  if (u < c) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }

  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function applyJitter(value, minPercent, maxPercent) {
  const percent = randomFloat(minPercent, maxPercent);
  const direction = Math.random() < 0.5 ? -1 : 1;
  return value * (1 + direction * percent);
}

function secondsToMs(seconds) {
  return Math.round(seconds * 1000);
}

function formatDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}min ${seconds}s` : `${minutes}min`;
}

function primeirasFrases(texto, quantidade = 4) {
  const textoNormalizado = String(texto || "").replace(/\s+/g, " ").trim();

  if (!textoNormalizado) {
    return "";
  }

  const frases = textoNormalizado.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [
    textoNormalizado,
  ];

  return frases.slice(0, quantidade).join(" ").trim();
}

function media(min, max) {
  return (min + max) / 2;
}

function sortearRange([min, max], decimals = 0) {
  const value = decimals > 0 ? randomFloat(min, max) : randomInt(min, max);
  return Number(value.toFixed(decimals));
}

function criarPerfilCadenciaSessao() {
  const normalMin = sortearRange(CADENCE_CONFIG.normalDelaySeconds.minRange);
  let normalMode = sortearRange(CADENCE_CONFIG.normalDelaySeconds.modeRange);
  let normalMax = sortearRange(CADENCE_CONFIG.normalDelaySeconds.maxRange);

  normalMode = Math.max(normalMode, normalMin + 1);
  normalMax = Math.max(normalMax, normalMode + 1);

  const typingMin = sortearRange(CADENCE_CONFIG.typing.minTypingSecondsRange, 1);
  let typingMax = sortearRange(CADENCE_CONFIG.typing.maxTypingSecondsRange, 1);
  typingMax = Math.max(typingMax, typingMin + 1);

  return {
    normalDelaySeconds: {
      min: normalMin,
      mode: normalMode,
      max: normalMax,
    },
    jitterPercent: sortearRange(CADENCE_CONFIG.jitterPercentRange, 2),
    longPauseAfterMessages: sortearRange(
      CADENCE_CONFIG.longPauseAfterMessagesRange,
    ),
    hourlyLimitMessages: sortearRange(
      CADENCE_CONFIG.hourlyLimitMessagesRange,
    ),
    typing: {
      charsPerSecond: sortearRange(
        CADENCE_CONFIG.typing.charsPerSecondRange,
        1,
      ),
      beforeTypingSeconds: CADENCE_CONFIG.typing.beforeTypingSecondsRange,
      afterTypingSeconds: CADENCE_CONFIG.typing.afterTypingSecondsRange,
      minTypingSeconds: typingMin,
      maxTypingSeconds: typingMax,
      jitterPercent: sortearRange(CADENCE_CONFIG.typing.jitterPercentRange, 2),
    },
  };
}

function descreverPerfilCadencia(perfil) {
  return [
    `delay triangular ${perfil.normalDelaySeconds.min}/${perfil.normalDelaySeconds.mode}/${perfil.normalDelaySeconds.max}s`,
    `jitter ${(perfil.jitterPercent * 100).toFixed(0)}%`,
    `pausa longa apos ${perfil.longPauseAfterMessages} envios`,
    `limite horario ${perfil.hourlyLimitMessages}`,
    `digitacao ${perfil.typing.charsPerSecond} chars/s, max ${perfil.typing.maxTypingSeconds}s`,
  ].join(" | ");
}

function sortearProximaPausaLonga() {
  return sortearRange(CADENCE_CONFIG.longPauseAfterMessagesRange);
}

function calcularDelayNormal(perfil) {
  const { min, mode, max } = perfil.normalDelaySeconds;
  const baseSeconds = randomTriangular(min, max, mode);
  const jitteredSeconds = applyJitter(
    baseSeconds,
    perfil.jitterPercent,
    perfil.jitterPercent,
  );
  const finalSeconds = clamp(jitteredSeconds, min, max);

  return secondsToMs(finalSeconds);
}

function calcularPausaLonga() {
  const baseSeconds = randomFloat(
    CADENCE_CONFIG.longPauseSecondsRange[0],
    CADENCE_CONFIG.longPauseSecondsRange[1],
  );
  const jitteredSeconds = applyJitter(baseSeconds, 0.05, 0.15);
  const finalSeconds = clamp(
    jitteredSeconds,
    CADENCE_CONFIG.longPauseSecondsRange[0],
    CADENCE_CONFIG.longPauseSecondsRange[1],
  );

  return secondsToMs(finalSeconds);
}

function calcularCooldownHorario() {
  return secondsToMs(
    randomFloat(
      CADENCE_CONFIG.hourlyCooldownSecondsRange[0],
      CADENCE_CONFIG.hourlyCooldownSecondsRange[1],
    ),
  );
}

function calcularBackoffErro() {
  return secondsToMs(
    randomFloat(
      CADENCE_CONFIG.errorBackoffSecondsRange[0],
      CADENCE_CONFIG.errorBackoffSecondsRange[1],
    ),
  );
}

function estimarTempoRestanteSegundos(restante, enviosComSucesso, perfil) {
  const delayNormalMedio =
    (perfil.normalDelaySeconds.min +
      perfil.normalDelaySeconds.mode +
      perfil.normalDelaySeconds.max) /
    3;
  const delayLongoMedio = media(
    CADENCE_CONFIG.longPauseSecondsRange[0],
    CADENCE_CONFIG.longPauseSecondsRange[1],
  );
  const frequenciaPausaLonga = media(
    CADENCE_CONFIG.longPauseAfterMessagesRange[0],
    CADENCE_CONFIG.longPauseAfterMessagesRange[1],
  );

  let total = 0;

  for (let i = 1; i <= restante; i++) {
    const numeroDoEnvio = enviosComSucesso + i;
    total += delayNormalMedio;

    if (numeroDoEnvio % Math.round(frequenciaPausaLonga) === 0) {
      total += delayLongoMedio;
    }
  }

  return total;
}

require("dotenv").config();

const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;
const originalConsoleTrace = console.trace;
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
let ocultarStreamBaileysAte = 0;

const LOGS_BAILEYS_SENSIVEIS = [
  "Failed to decrypt message",
  "Decrypted message with closed session",
  "Session error",
  "Bad MAC",
  "Closing session",
  "SessionEntry",
  "ephemeralKeyPair",
  "currentRatchet",
  "remoteIdentityKey",
  "messageKeys",
];

function deveOcultarLogBaileys(args) {
  return args.some((arg) => {
    if (typeof arg === "string") {
      return LOGS_BAILEYS_SENSIVEIS.some((texto) => arg.includes(texto));
    }

    if (arg && typeof arg === "object") {
      return (
        "_chains" in arg ||
        "currentRatchet" in arg ||
        "indexInfo" in arg ||
        "registrationId" in arg
      );
    }

    return false;
  });
}

function contemLogSensivelBaileys(texto) {
  return LOGS_BAILEYS_SENSIVEIS.some((item) => texto.includes(item));
}

function filtrarWriteStream(originalWrite) {
  return function writeFiltrado(chunk, encoding, callback) {
    const texto = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    const agora = Date.now();

    if (contemLogSensivelBaileys(texto)) {
      ocultarStreamBaileysAte = agora + 1500;
    }

    if (agora < ocultarStreamBaileysAte) {
      if (typeof encoding === "function") {
        encoding();
      } else if (typeof callback === "function") {
        callback();
      }

      return true;
    }

    return originalWrite(chunk, encoding, callback);
  };
}

console.error = (...args) => {
  if (deveOcultarLogBaileys(args))
    return;

  originalConsoleError(...args);
};

console.log = (...args) => {
  if (deveOcultarLogBaileys(args))
    return;

  originalConsoleLog(...args);
};

console.warn = (...args) => {
  if (deveOcultarLogBaileys(args))
    return;

  originalConsoleWarn(...args);
};

console.info = (...args) => {
  if (deveOcultarLogBaileys(args))
    return;

  originalConsoleInfo(...args);
};

console.debug = (...args) => {
  if (deveOcultarLogBaileys(args))
    return;

  originalConsoleDebug(...args);
};

console.trace = (...args) => {
  if (deveOcultarLogBaileys(args))
    return;

  originalConsoleTrace(...args);
};

process.stdout.write = filtrarWriteStream(originalStdoutWrite);
process.stderr.write = filtrarWriteStream(originalStderrWrite);

const duckdb = require("duckdb");

// Caminhos dos bancos
const DW_PATH = process.env.DW_PATH || "data/receitech.duckdb";
const FEEDBACK_PATH =
  process.env.FEEDBACK_DB_PATH || "data/bot_feedback.duckdb";

// Baileys (mantido igual)
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  DisconnectReason,
  WAMessageStatus,
  generateMessageIDV2,
} = require("@whiskeysockets/baileys");

const P = require("pino");
const qrcode = require("qrcode-terminal");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

const AUTH_DIR = "auth";
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 5;
const SERVER_ACK_STATUS = WAMessageStatus?.SERVER_ACK ?? 2;
const SEND_ACK_TIMEOUT_MS = 5000;

let reconnectAttempts = 0;
let restartingConnection = false;
let workerStarted = false;
let processandoRespostas = false;
let envioExclusivo = Promise.resolve();
let activeSock = null;
let activeDw = null;
let activeFeedbackDb = null;

function definirConexoesAtivas(dw, feedbackDb) {
  if (dw) {
    activeDw = dw;
  }

  if (feedbackDb) {
    activeFeedbackDb = feedbackDb;
  }
}

async function obterDwAtual() {
  while (!activeDw) {
    await delay(250);
  }

  return activeDw;
}

async function obterFeedbackDbAtual() {
  while (!activeFeedbackDb) {
    await delay(250);
  }

  return activeFeedbackDb;
}

function carregarRegraJson(fileName) {
  const filePath = path.join(__dirname, "rules", fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const optOutRule = carregarRegraJson("opt-out.json");
const regrasAtendimento = [optOutRule, carregarRegraJson("cadastrar-receitas-lote.json")]
  .sort((a, b) => (a.priority || 100) - (b.priority || 100));

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, words) {
  return words.some((word) => text.includes(normalizeText(word)));
}

function scoreByGroups(text, groups) {
  return groups.reduce((score, words) => score + (hasAny(text, words) ? 1 : 0), 0);
}

function regraOptOutReconhecida(text) {
  return optOutRule.intentPatterns.some((pattern) =>
    pattern.allGroups.every((words) => hasAny(text, words)),
  );
}

function regraReconhecida(rule, normalized) {
  if (rule.id === optOutRule.id) {
    return regraOptOutReconhecida(normalized);
  }

  if (rule.matchGroups) {
    return scoreByGroups(normalized, rule.matchGroups) >= (rule.minimumScore || 1);
  }

  return false;
}

async function findMatchingRule(text) {
  const normalized = normalizeText(text);

  for (const rule of regrasAtendimento) {
    if (!regraReconhecida(rule, normalized)) continue;

    return {
      rule,
      normalized,
      result: {
        text: rule.id === optOutRule.id ? rule.confirmationPrompt : rule.text,
        pendingOptOutConfirmation: rule.id === optOutRule.id,
      },
    };
  }

  return {
    rule: null,
    normalized,
    result: null,
  };
}

function isOptOutConfirmation(text) {
  return optOutRule.confirmationWords
    .map(normalizeText)
    .includes(normalizeText(text));
}

function isOptOutCancellation(text) {
  return optOutRule.cancellationWords
    .map(normalizeText)
    .includes(normalizeText(text));
}

// ========================
// DUCKDB SETUP
// ========================

function criarConexaoDW() {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(DW_PATH, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function fecharConexao(db) {
  if (!db) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function criarConexaoFeedback() {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(FEEDBACK_PATH, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function executarSql(db, sql, ...params) {
  return new Promise((resolve, reject) => {
    db.run(sql, ...params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function consultarSql(db, sql, ...params) {
  return new Promise((resolve, reject) => {
    db.all(sql, ...params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function inicializarFeedbackDB(db) {
  await executarSql(
    db,
    `
      CREATE TABLE IF NOT EXISTS message_results (
        message_id VARCHAR PRIMARY KEY,
        status VARCHAR,
        sent_at TIMESTAMP,
        error_msg VARCHAR
      )
    `,
  );

  await executarSql(
    db,
    `
      CREATE TABLE IF NOT EXISTS incoming_messages (
        message_key VARCHAR PRIMARY KEY,
        jid VARCHAR,
        phone VARCHAR,
        message_text VARCHAR,
        normalized_text VARCHAR,
        rule_id VARCHAR,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
  );

  await executarSql(
    db,
    `
      CREATE TABLE IF NOT EXISTS auto_reply_queue (
        id VARCHAR PRIMARY KEY,
        jid VARCHAR,
        phone VARCHAR,
        message_text VARCHAR,
        rule_id VARCHAR,
        status VARCHAR,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP,
        error_msg VARCHAR
      )
    `,
  );

  await executarSql(
    db,
    `
      CREATE TABLE IF NOT EXISTS contact_state (
        phone VARCHAR PRIMARY KEY,
        jid VARCHAR,
        campaign_blocked_until TIMESTAMP,
        opt_out_confirmation_pending BOOLEAN DEFAULT FALSE,
        opt_out_pending_since TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
  );

  await executarSql(
    db,
    `
      CREATE TABLE IF NOT EXISTS auto_opt_outs (
        phone VARCHAR PRIMARY KEY,
        jid VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source VARCHAR
      )
    `,
  );
}

// ========================
// LEITURA DA FILA
// ========================

function buscarMensagensPendentes(db) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT id, user_id, phone, message_text
      FROM gold.whatsapp_message_queue
      WHERE status = 'pending'
      ORDER BY priority ASC, created_at ASC, id ASC
    `,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      },
    );
  });
}

function contarPendentes(db) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT COUNT(*) AS total
      FROM gold.whatsapp_message_queue
      WHERE status = 'pending'
    `,
      (err, rows) => {
        if (err) reject(err);
        else resolve(Number(rows?.[0]?.total || 0));
      },
    );
  });
}

// ========================
// REGISTRO DE FEEDBACK
// ========================

function registrarResultado(db, messageId, status, erro = null) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT OR REPLACE INTO message_results (message_id, status, sent_at, error_msg)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    `,
      messageId,
      status,
      erro,
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

function formatarTimestampLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + " " + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(":");
}

function proximoDiaAs10h() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(CADENCE_CONFIG.sendingWindow.startHour, 0, 0, 0);
  return date;
}

function ehConversaIndividual(jid) {
  return typeof jid === "string" && jid.endsWith("@s.whatsapp.net");
}

function telefoneDoJid(jid) {
  const digits = String(jid || "").split("@")[0].replace(/\D/g, "");
  return digits || null;
}

function extrairTextoMensagem(msg) {
  const message = msg?.message;
  if (!message) return "";

  const conteudo = message.ephemeralMessage?.message || message;
  return (
    conteudo.conversation ||
    conteudo.extendedTextMessage?.text ||
    conteudo.imageMessage?.caption ||
    conteudo.videoMessage?.caption ||
    conteudo.documentMessage?.caption ||
    ""
  ).trim();
}

async function registrarMensagemRecebida(db, msg, phone, text, normalized, ruleId) {
  await executarSql(
    db,
    `
      INSERT OR REPLACE INTO incoming_messages
        (message_key, jid, phone, message_text, normalized_text, rule_id, received_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    msg.key.id,
    msg.key.remoteJid,
    phone,
    text,
    normalized,
    ruleId,
  );
}

async function bloquearCampanhaAteAmanha(db, phone, jid) {
  const ate = formatarTimestampLocal(proximoDiaAs10h());

  await executarSql(
    db,
    `
      INSERT INTO contact_state
        (phone, jid, campaign_blocked_until, updated_at)
      VALUES (?, ?, ?, now())
      ON CONFLICT (phone) DO UPDATE SET
        jid = excluded.jid,
        campaign_blocked_until = excluded.campaign_blocked_until,
        updated_at = now()
    `,
    phone,
    jid,
    ate,
  );

  return ate;
}

async function campanhaBloqueadaParaContato(db, phone) {
  const rows = await consultarSql(
    db,
    `
      SELECT campaign_blocked_until
      FROM contact_state
      WHERE phone = ?
        AND campaign_blocked_until IS NOT NULL
        AND campaign_blocked_until > CURRENT_TIMESTAMP
    `,
    phone,
  );

  return rows?.[0]?.campaign_blocked_until || null;
}

async function contatoEmOptOut(db, phone) {
  const rows = await consultarSql(
    db,
    `
      SELECT phone
      FROM auto_opt_outs
      WHERE phone = ?
    `,
    phone,
  );

  return Boolean(rows?.length);
}

async function definirConfirmacaoOptOutPendente(db, phone, jid, pendente) {
  await executarSql(
    db,
    `
      INSERT INTO contact_state
        (phone, jid, opt_out_confirmation_pending, opt_out_pending_since, updated_at)
      VALUES (?, ?, ?, CASE WHEN ? THEN now() ELSE NULL END, now())
      ON CONFLICT (phone) DO UPDATE SET
        jid = excluded.jid,
        opt_out_confirmation_pending = excluded.opt_out_confirmation_pending,
        opt_out_pending_since = excluded.opt_out_pending_since,
        updated_at = now()
    `,
    phone,
    jid,
    pendente,
    pendente,
  );
}

async function confirmacaoOptOutPendente(db, phone) {
  const rows = await consultarSql(
    db,
    `
      SELECT opt_out_confirmation_pending
      FROM contact_state
      WHERE phone = ?
    `,
    phone,
  );

  return Boolean(rows?.[0]?.opt_out_confirmation_pending);
}

async function registrarOptOut(db, phone, jid, source) {
  await executarSql(
    db,
    `
      INSERT OR REPLACE INTO auto_opt_outs (phone, jid, created_at, source)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    `,
    phone,
    jid,
    source,
  );

  await definirConfirmacaoOptOutPendente(db, phone, jid, false);
}

async function enfileirarRespostaAutomatica(db, jid, phone, text, ruleId) {
  const id = randomUUID();

  await executarSql(
    db,
    `
      INSERT INTO auto_reply_queue
        (id, jid, phone, message_text, rule_id, status, attempts, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP)
    `,
    id,
    jid,
    phone,
    text,
    ruleId,
  );

  return id;
}

async function buscarRespostasPendentes(db) {
  return consultarSql(
    db,
    `
      SELECT id, jid, phone, message_text, rule_id, attempts
      FROM auto_reply_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC, id ASC
    `,
  );
}

async function marcarRespostaEnviada(db, id) {
  await executarSql(
    db,
    `
      UPDATE auto_reply_queue
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error_msg = NULL
      WHERE id = ?
    `,
    id,
  );
}

async function registrarFalhaResposta(db, id, erro, attempts) {
  const status = attempts >= 2 ? "failed" : "pending";

  await executarSql(
    db,
    `
      UPDATE auto_reply_queue
      SET status = ?, attempts = attempts + 1, error_msg = ?
      WHERE id = ?
    `,
    status,
    erro,
    id,
  );
}


function rodarReconcile() {
  return new Promise((resolve, reject) => {
    exec(
  'cd /d "C:\\Users\\ljsen\\DEV RECEITECH\\dw-receitech" && .venv\\Scripts\\python.exe -m pipeline reconcile',
  (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function tentarComRetry(nome, operacao, tentativas = 5, esperaMs = 2000) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    try {
      return await operacao();
    } catch (erro) {
      ultimoErro = erro;

      if (tentativa >= tentativas) {
        break;
      }

      console.log(
        `${nome} falhou na tentativa ${tentativa}/${tentativas}; tentando novamente em ${formatDuration(esperaMs)}`,
      );
      await delay(esperaMs);
    }
  }

  throw ultimoErro;
}

function rodarReconcileComRetry() {
  return tentarComRetry("Reconcile", rodarReconcile, 5, 3000);
}

async function fecharConexoesParaReconcile(dw, feedbackDb) {
  activeDw = null;
  activeFeedbackDb = null;

  await delay(500);
  await Promise.all([fecharConexao(dw), fecharConexao(feedbackDb)]);
  await delay(1000);
}

async function reabrirConexoesAposReconcile() {
  const dw = await tentarComRetry("Reabrir DW", criarConexaoDW, 5, 2000);
  const feedbackDb = await tentarComRetry(
    "Reabrir feedback",
    criarConexaoFeedback,
    5,
    2000,
  );

  await inicializarFeedbackDB(feedbackDb);
  definirConexoesAtivas(dw, feedbackDb);

  return { dw, feedbackDb };
}



function dentroDaJanelaDeEnvio() {
  const agora = new Date();
  const hora = agora.getHours();

  // permite de 10:00 até antes de 22:00
  return (
    hora >= CADENCE_CONFIG.sendingWindow.startHour &&
    hora < CADENCE_CONFIG.sendingWindow.endHour
  );
}

async function esperarSeAindaDentroDaJanela(ms, motivo) {
  console.log(`${motivo}: aguardando ${formatDuration(ms)}`);
  await delay(ms);

  if (!dentroDaJanelaDeEnvio()) {
    console.log(
      `Janela de envio encerrada (${CADENCE_CONFIG.sendingWindow.startHour}h as ${CADENCE_CONFIG.sendingWindow.endHour}h). Campanha pausada, bot continua ouvindo respostas.`,
    );
    return false;
  }

  return true;
}

function limparEnviosAntigos(timestamps, agoraMs) {
  const umaHoraMs = 60 * 60 * 1000;

  while (timestamps.length && agoraMs - timestamps[0] >= umaHoraMs) {
    timestamps.shift();
  }
}

async function aplicarCooldownHorarioSeNecessario(perfil, timestamps) {
  while (true) {
    const agoraMs = Date.now();
    limparEnviosAntigos(timestamps, agoraMs);

    if (timestamps.length < perfil.hourlyLimitMessages) {
      return;
    }

    const cooldown = calcularCooldownHorario();
    console.log(
      `Limite horario da sessao atingido (${timestamps.length}/${perfil.hourlyLimitMessages} envios na ultima hora).`,
    );
    const continuar = await esperarSeAindaDentroDaJanela(
      cooldown,
      "Cooldown horario",
    );

    if (!continuar) {
      return false;
    }
  }
}

function calcularTempoDigitacao(texto, perfil) {
  const tamanhoTexto = String(texto || "").length;
  const baseSeconds = tamanhoTexto / perfil.typing.charsPerSecond;
  const jitteredSeconds = applyJitter(
    baseSeconds,
    perfil.typing.jitterPercent,
    perfil.typing.jitterPercent,
  );
  let finalSeconds = jitteredSeconds;

  if (finalSeconds > perfil.typing.maxTypingSeconds) {
    finalSeconds = randomFloat(
      Math.max(perfil.typing.minTypingSeconds, perfil.typing.maxTypingSeconds * 0.72),
      perfil.typing.maxTypingSeconds,
    );
  }

  finalSeconds = clamp(
    finalSeconds,
    perfil.typing.minTypingSeconds,
    perfil.typing.maxTypingSeconds,
  );

  return secondsToMs(finalSeconds);
}

async function simularDigitacao(sock, jid, texto, perfil) {
  try {
    const antesMs = secondsToMs(
      randomFloat(
        perfil.typing.beforeTypingSeconds[0],
        perfil.typing.beforeTypingSeconds[1],
      ),
    );
    const digitandoMs = calcularTempoDigitacao(texto, perfil);
    const depoisMs = secondsToMs(
      randomFloat(
        perfil.typing.afterTypingSeconds[0],
        perfil.typing.afterTypingSeconds[1],
      ),
    );

    console.log(
      `Presenca de digitacao: antes ${formatDuration(antesMs)}, digitando ${formatDuration(digitandoMs)}, depois ${formatDuration(depoisMs)}`,
    );
    await delay(antesMs);
    await sock.sendPresenceUpdate("composing", jid);
    await delay(digitandoMs);
    await sock.sendPresenceUpdate("paused", jid);
    await delay(depoisMs);
  } catch (erro) {
    console.log(
      "Aviso: nao foi possivel enviar presenca de digitacao:",
      erro.message,
    );
  }
}

function chaveMensagemIgual(a, b) {
  return (
    a?.id &&
    b?.id &&
    a.id === b.id &&
    a.remoteJid === b.remoteJid &&
    a.fromMe === b.fromMe
  );
}

function criarMonitorAckMensagem(sock, key, timeoutMs = SEND_ACK_TIMEOUT_MS) {
  let finalizado = false;
  let timeout = null;
  let onUpdate = null;

  const cleanup = () => {
    if (finalizado) return;
    finalizado = true;
    clearTimeout(timeout);
    sock.ev.off("messages.update", onUpdate);
  };

  const promise = new Promise((resolve, reject) => {
    if (!key?.id) {
      reject(new Error("sendMessage_sem_message_id"));
      return;
    }

    timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`send_ack_timeout_${timeoutMs}ms`));
    }, timeoutMs);

    onUpdate = (updates) => {
      for (const item of updates || []) {
        if (!chaveMensagemIgual(item.key, key)) {
          continue;
        }

        const status = item.update?.status;
        console.log(`ACK da mensagem ${key.id}: status ${status}`);

        if (status >= SERVER_ACK_STATUS) {
          cleanup();
          resolve(status);
          return;
        }
      }
    };

    sock.ev.on("messages.update", onUpdate);
  });

  return {
    promise,
    cancel: cleanup,
  };
}

async function observarAckMensagem(mensagemEnviada, monitorAck) {
  const statusInicial = mensagemEnviada?.status;
  const key = mensagemEnviada?.key;

  console.log(
    `Mensagem enviada para socket: id=${key?.id}, jid=${key?.remoteJid}, status_inicial=${statusInicial ?? "sem_status"}`,
  );

  if (!key?.id) {
    throw new Error("sendMessage_sem_message_id");
  }

  if (statusInicial >= SERVER_ACK_STATUS) {
    console.log(`ACK da mensagem ${key.id}: status ${statusInicial}`);
    monitorAck?.cancel();
    return statusInicial;
  }

  try {
    return await monitorAck.promise;
  } catch (erro) {
    console.log(
      `Aviso: ACK nao observado para ${key.id} em ${formatDuration(SEND_ACK_TIMEOUT_MS)} (${erro.message}). Mantendo como enviado porque o WhatsApp aceitou o envio no socket.`,
    );
    return statusInicial;
  }
}

async function enviarMensagemComConfirmacao(sock, jid, conteudo) {
  const messageId = generateMessageIDV2(sock.user?.id);
  const keyEsperada = {
    id: messageId,
    remoteJid: jid,
    fromMe: true,
  };
  const monitorAck = criarMonitorAckMensagem(sock, keyEsperada);

  try {
    const mensagemEnviada = await sock.sendMessage(jid, conteudo, {
      messageId,
    });
    await observarAckMensagem(mensagemEnviada, monitorAck);
    return mensagemEnviada;
  } catch (erro) {
    monitorAck.cancel();
    throw erro;
  }
}

async function executarComEnvioExclusivo(fn) {
  const anterior = envioExclusivo.catch(() => {});
  let liberar;

  envioExclusivo = new Promise((resolve) => {
    liberar = resolve;
  });

  await anterior;

  try {
    return await fn();
  } finally {
    liberar();
  }
}

function criarPerfilRespostaAutomatica() {
  return {
    typing: {
      charsPerSecond: randomFloat(9, 17),
      beforeTypingSeconds: [0.3, 1.4],
      afterTypingSeconds: [0.2, 0.8],
      minTypingSeconds: 1,
      maxTypingSeconds: 8,
      jitterPercent: 0.2,
    },
  };
}

async function processarRespostasPendentes(sock, feedbackDb) {
  if (processandoRespostas) return;
  processandoRespostas = true;

  try {
    while (true) {
      const respostas = await buscarRespostasPendentes(feedbackDb);
      if (!respostas.length) return;

      for (const resposta of respostas) {
        try {
          console.log(
            `Enviando resposta automatica ${resposta.id} (${resposta.rule_id}) para ${resposta.phone}`,
          );

          await executarComEnvioExclusivo(async () => {
            await simularDigitacao(
              sock,
              resposta.jid,
              resposta.message_text,
              criarPerfilRespostaAutomatica(),
            );
            await enviarMensagemComConfirmacao(sock, resposta.jid, {
              text: resposta.message_text,
            });
          });

          await marcarRespostaEnviada(feedbackDb, resposta.id);
          console.log(`Resposta automatica enviada: ${resposta.id}`);
        } catch (erro) {
          console.log("Erro ao enviar resposta automatica:", erro.message);
          await registrarFalhaResposta(
            feedbackDb,
            resposta.id,
            erro.message,
            Number(resposta.attempts || 0),
          );
        }
      }
    }
  } finally {
    processandoRespostas = false;
  }
}

async function lidarComMensagemRecebida(sock, feedbackDb, msg) {
  if (msg.key.fromMe) return;

  const jid = msg.key.remoteJid;
  if (!ehConversaIndividual(jid)) return;

  const text = extrairTextoMensagem(msg);
  if (!text) return;

  const phone = telefoneDoJid(jid);
  if (!phone) return;

  const normalized = normalizeText(text);
  await bloquearCampanhaAteAmanha(feedbackDb, phone, jid);

  if (await confirmacaoOptOutPendente(feedbackDb, phone)) {
    if (isOptOutConfirmation(normalized)) {
      await registrarOptOut(feedbackDb, phone, jid, "auto_reply_confirmation");
      await registrarMensagemRecebida(
        feedbackDb,
        msg,
        phone,
        text,
        normalized,
        "opt_out_confirmed",
      );
      await enfileirarRespostaAutomatica(
        feedbackDb,
        jid,
        phone,
        optOutRule.confirmationText,
        "opt_out_confirmed",
      );
      await processarRespostasPendentes(sock, feedbackDb);
      return;
    }

    if (isOptOutCancellation(normalized)) {
      await definirConfirmacaoOptOutPendente(feedbackDb, phone, jid, false);
      await registrarMensagemRecebida(
        feedbackDb,
        msg,
        phone,
        text,
        normalized,
        "opt_out_cancelled",
      );
      await enfileirarRespostaAutomatica(
        feedbackDb,
        jid,
        phone,
        optOutRule.cancellationText,
        "opt_out_cancelled",
      );
      await processarRespostasPendentes(sock, feedbackDb);
      return;
    }
  }

  const match = await findMatchingRule(text);
  await registrarMensagemRecebida(
    feedbackDb,
    msg,
    phone,
    text,
    match.normalized,
    match.rule?.id || null,
  );

  if (!match.rule || !match.result?.text) {
    return;
  }

  if (match.result.pendingOptOutConfirmation) {
    await definirConfirmacaoOptOutPendente(feedbackDb, phone, jid, true);
  }

  await enfileirarRespostaAutomatica(
    feedbackDb,
    jid,
    phone,
    match.result.text,
    match.rule.id,
  );

  console.log(
    `Mensagem recebida reconhecida pela regra ${match.rule.id}. Resposta prioritaria enfileirada.`,
  );
  await processarRespostasPendentes(sock, feedbackDb);
}

async function verificarNumeroWhatsApp(sock, numeroNormalizado) {
  const resultado = await sock.onWhatsApp(numeroNormalizado);
  const contato = resultado?.[0];

  if (!contato?.exists) {
    return null;
  }

  return contato.jid || `${numeroNormalizado}@s.whatsapp.net`;
}

function contarEnviosUltimos7Dias(dw, userId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT COUNT(*) AS total
      FROM gold.whatsapp_message_log l
      JOIN gold.whatsapp_message_queue q
        ON q.id = l.message_id
      WHERE l.status = 'sent'
        AND q.user_id = ?
        AND l.sent_at >= NOW() - INTERVAL '7 days'
    `;

    dw.all(query, userId, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(Number(rows?.[0]?.total || 0));
    });
  });
}

// ========================
// NORMALIZAÇÃO DE TELEFONE
// ========================

function normalizarNumero(phone) {
  if (!phone) return null;

  let digits = phone.replace(/\D/g, "");

  // remove 55 se já tiver
  if (digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  // precisa ter DDD + número
  if (digits.length < 10) return null;

  // força padrão Brasil
  const numeroFinal = "55" + digits;

  // garante exatamente 13 dígitos
  if (numeroFinal.length !== 13) return null;

  return numeroFinal;
}

// ========================
// BOT PRINCIPAL
// ========================

async function startBot() {
  console.log("1. Iniciando bot");
  console.log("Rodando reconcile do dw-receitech antes de iniciar a fila...");

  try {
    await rodarReconcileComRetry();
    console.log("Reconcile inicial concluido.");
  } catch (erro) {
    console.log("Erro no reconcile inicial:", erro.message);
    console.log("Bot nao sera iniciado para evitar envio com fila desatualizada.");
    process.exit(1);
  }

  const dw = await criarConexaoDW();
  const feedbackDb = await criarConexaoFeedback();

  await inicializarFeedbackDB(feedbackDb);
  definirConexoesAtivas(dw, feedbackDb);

  await conectarWhatsApp(dw, feedbackDb);
}

async function conectarWhatsApp(dw, feedbackDb) {
  restartingConnection = false;
  definirConexoesAtivas(dw, feedbackDb);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const { version } = await fetchLatestWaWebVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    logger: P({ level: "silent" }),
    browser: ["Chrome (Linux)", "", ""],
  });
  activeSock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages || []) {
      obterFeedbackDbAtual()
        .then((db) => lidarComMensagemRecebida(sock, db, msg))
        .catch((erro) => {
          console.log("Erro ao processar mensagem recebida:", erro.message);
        });
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, isNewLogin, lastDisconnect } = update;

    if (qr) {
      console.log("Escaneie o QR:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      reconnectAttempts = 0;
      console.log("WhatsApp conectado!");

      if (!workerStarted) {
        workerStarted = true;
        iniciarWorker(sock, dw, feedbackDb);
      }
    }

    if (connection === "close") {
      console.log("Conexão fechada:", lastDisconnect?.error?.message);
      const erro = lastDisconnect?.error;
      const mensagemErro = erro?.message || "sem mensagem";
      const statusCode = erro?.output?.statusCode;
      const ehConflito = mensagemErro.toLowerCase().includes("conflict");
      const precisaReiniciarLogin =
        mensagemErro === "Stream Errored (restart required)" ||
        mensagemErro.includes("restart required") ||
        isNewLogin;

      if (ehConflito) {
        console.log(
          "Conflito de sessao detectado. Nao apague a pasta 'auth'. Feche outras janelas do WhatsApp Web/Desktop ou outros bots e rode novamente.",
        );
        process.exit(1);
      }

      if (statusCode === DisconnectReason.loggedOut) {
        console.log(
          `Sessao encerrada pelo WhatsApp. Apague a pasta '${AUTH_DIR}' e rode o bot novamente para gerar um novo QR.`,
        );
        process.exit(1);
      }

      if (precisaReiniciarLogin) {
        console.log("Reiniciando conexao para finalizar autenticacao...");
      }

      reiniciarConexao(sock);
    }
  });
}

startBot();

function reiniciarConexao(sock) {
  if (restartingConnection) return;

  restartingConnection = true;
  reconnectAttempts++;

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.log(
      `Limite de ${MAX_RECONNECT_ATTEMPTS} tentativas de reconexao atingido.`,
    );
    process.exit(1);
  }

  try {
    sock.ev.removeAllListeners("connection.update");
    sock.ev.removeAllListeners("creds.update");
    sock.ev.removeAllListeners("messages.upsert");
    sock.ws?.close();
  } catch (erro) {
    console.log("Aviso ao fechar socket anterior:", erro.message);
  }

  setTimeout(() => {
    Promise.all([obterDwAtual(), obterFeedbackDbAtual()])
      .then(([dw, feedbackDb]) => conectarWhatsApp(dw, feedbackDb))
      .catch((erro) => {
        restartingConnection = false;
        console.log("Erro ao reiniciar conexao:", erro.message);
        reiniciarConexao(sock);
      });
  }, RECONNECT_DELAY_MS);
}

// ========================
// WORKER
// ========================

async function processarFila(sock, dw, feedbackDb) {
  const perfilCadencia = criarPerfilCadenciaSessao();
  const enviosUltimaHora = [];
  let enviosDesdePausaLonga = 0;
  let proximaPausaLonga = perfilCadencia.longPauseAfterMessages;

  console.log(
    `Perfil de cadencia da sessao: ${descreverPerfilCadencia(perfilCadencia)}`,
  );

  const totalFila = await contarPendentes(dw);
  console.log(`Fila total: ${totalFila} mensagens`);

  if (!dentroDaJanelaDeEnvio()) {
    console.log(
      "Fora da janela de envio (10h as 22h). Campanha aguardara a proxima janela.",
    );
    return false;
  }

  const mensagens = await buscarMensagensPendentes(dw);

  let index = 0;

  if (!mensagens || mensagens.length === 0) {
    console.log("Fila vazia.");
    return false;
  }

  let enviosComSucesso = 0;

  for (const msg of mensagens) {
    index++;
    console.log(`[${index}/${mensagens.length}] Preparando envio`);
    try {
      await processarRespostasPendentes(sock, feedbackDb);

      if (!dentroDaJanelaDeEnvio()) {
        console.log("Campanha pausada porque a janela de envio acabou.");
        return true;
      }

      const numeroNormalizado = normalizarNumero(msg.phone);

      if (!numeroNormalizado) {
        console.log("Numero invalido:", msg.phone);
        await registrarResultado(
          feedbackDb,
          msg.id,
          "failed",
          "invalid_number",
        );
        continue;
      }

      if (await contatoEmOptOut(feedbackDb, numeroNormalizado)) {
        console.log("Contato em opt-out, pulando user_id:", msg.user_id);
        await registrarResultado(feedbackDb, msg.id, "failed", "auto_opt_out");
        continue;
      }

      const bloqueadoAte = await campanhaBloqueadaParaContato(
        feedbackDb,
        numeroNormalizado,
      );

      if (bloqueadoAte) {
        console.log(
          `Contato ${numeroNormalizado} conversou recentemente. Campanha bloqueada ate ${bloqueadoAte}.`,
        );
        continue;
      }

      const totalHistorico = await contarEnviosUltimos7Dias(dw, msg.user_id);
      const totalSessao = contadorSessao[msg.user_id] || 0;

      const total = totalHistorico + totalSessao;

      if (total >= 2) {
        console.log("Limite semanal atingido para user_id:", msg.user_id);
        await registrarResultado(
          feedbackDb,
          msg.id,
          "failed",
          "weekly_limit_exceeded",
        );
        continue;
      }

      const jid = await verificarNumeroWhatsApp(sock, numeroNormalizado);

      if (!jid) {
        console.log("Numero nao encontrado no WhatsApp:", numeroNormalizado);
        await registrarResultado(
          feedbackDb,
          msg.id,
          "failed",
          "not_on_whatsapp",
        );
        continue;
      }

      const podeContinuarAposCooldown = await aplicarCooldownHorarioSeNecessario(
        perfilCadencia,
        enviosUltimaHora,
      );

      if (podeContinuarAposCooldown === false) {
        return true;
      }

      console.log(
        `Enviando mensagem ${msg.id} para ${numeroNormalizado} (${String(msg.message_text || "").length} caracteres)`,
      );

      await executarComEnvioExclusivo(async () => {
        await simularDigitacao(sock, jid, msg.message_text, perfilCadencia);
        await enviarMensagemComConfirmacao(sock, jid, {
          text: msg.message_text,
        });
      });

      await registrarResultado(feedbackDb, msg.id, "sent");
      enviosComSucesso++;
      enviosDesdePausaLonga++;
      enviosUltimaHora.push(Date.now());
      const restante = totalFila - index;
      console.log(`Restam aproximadamente ${restante} mensagens na fila`);
      const tempoEstimadoSegundos = estimarTempoRestanteSegundos(
        restante,
        enviosComSucesso,
        perfilCadencia,
      );
      console.log(
        `Tempo estimado restante: ~${Math.ceil(tempoEstimadoSegundos / 60)} min`,
      );
      contadorSessao[msg.user_id] = (contadorSessao[msg.user_id] || 0) + 1;

      console.log("Mensagem enviada com sucesso");
      console.log(
        `Texto enviado com sucesso: "${primeirasFrases(msg.message_text)}"`,
      );

      if (index < mensagens.length) {
        if (enviosDesdePausaLonga >= proximaPausaLonga) {
          const pausaLonga = calcularPausaLonga();
          console.log(
            `Pausa longa sorteada apos ${enviosDesdePausaLonga} envios com sucesso`,
          );
          const continuar = await esperarSeAindaDentroDaJanela(
            pausaLonga,
            "Pausa longa",
          );
          if (!continuar) return true;
          enviosDesdePausaLonga = 0;
          proximaPausaLonga = sortearProximaPausaLonga();
          console.log(`Proxima pausa longa apos ${proximaPausaLonga} envios`);
        } else {
          const pausaNormal = calcularDelayNormal(perfilCadencia);
          console.log(
            `Delay normal sorteado: ${formatDuration(pausaNormal)}`,
          );
          const continuar = await esperarSeAindaDentroDaJanela(
            pausaNormal,
            "Pausa normal ate a proxima mensagem",
          );
          if (!continuar) return true;
        }
      }
    } catch (erro) {
      console.log("Erro ao enviar:", erro.message);

      await registrarResultado(feedbackDb, msg.id, "failed", erro.message);

      if (index < mensagens.length) {
        const backoff = calcularBackoffErro();
        const continuar = await esperarSeAindaDentroDaJanela(
          backoff,
          "Backoff apos erro de envio",
        );
        if (!continuar) return true;
      }
    }
  }

  return true;
}

async function iniciarWorker(sock, dw, feedbackDb) {
  console.log("Worker continuo iniciado.");
  let dwAtual = dw;
  let feedbackDbAtual = feedbackDb;
  definirConexoesAtivas(dwAtual, feedbackDbAtual);

  while (true) {
    try {
      const sockAtual = activeSock || sock;
      await processarRespostasPendentes(sockAtual, feedbackDbAtual);
      console.log("Verificando fila...");
      const houveProcessamento = await processarFila(
        sockAtual,
        dwAtual,
        feedbackDbAtual,
      );

      if (houveProcessamento) {
        try {
          await fecharConexoesParaReconcile(dwAtual, feedbackDbAtual);
          dwAtual = null;
          feedbackDbAtual = null;

          await rodarReconcileComRetry();

          const conexoes = await reabrirConexoesAposReconcile();
          dwAtual = conexoes.dw;
          feedbackDbAtual = conexoes.feedbackDb;
        } catch (erro) {
          console.log("Aviso: reconcile falhou:", erro.message);

          if (!dwAtual || !feedbackDbAtual) {
            const conexoes = await reabrirConexoesAposReconcile();
            dwAtual = conexoes.dw;
            feedbackDbAtual = conexoes.feedbackDb;
          }
        }
      }
    } catch (erro) {
      console.log("Erro no worker continuo:", erro.message);

      try {
        if (!dwAtual || !feedbackDbAtual) {
          const conexoes = await reabrirConexoesAposReconcile();
          dwAtual = conexoes.dw;
          feedbackDbAtual = conexoes.feedbackDb;
        }
      } catch (erroReabrir) {
        console.log(
          "Aviso: nao foi possivel reabrir conexoes do DuckDB:",
          erroReabrir.message,
        );
      }
    }

    await delay(60 * 1000);
  }
}
