import type { FastifyInstance } from 'fastify';
import '@fastify/multipart';
import { v4 as uuidv4 } from 'uuid';
import { toFile } from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { redis, anthropic, openai } from '../lib/clients.js';
import type {
  SessionStartRequest,
  SessionStartResponse,
  SessionAnswerResponse,
  SessionEndRequest,
  SessionEndResponse,
  SessionConfig,
  Turn,
  SessionRecord,
  StarEvaluation,
} from '@speaking-practice/types';

const FILLER_RE = /えー+と?|あのー*|えーと|まあ|なんか|ちょっと|そのー+/g;
const SESSION_TTL = 1800;
const CLAUDE_MODEL = 'claude-sonnet-4-6';

function sessionKeys(id: string) {
  return {
    config: `session:${id}:config`,
    turns: `session:${id}:turns`,
    fillerCount: `session:${id}:filler_count`,
    currentQuestion: `session:${id}:current_question`,
  };
}

async function getSessionConfig(sessionId: string): Promise<SessionConfig | null> {
  const data = await redis.hgetall(sessionKeys(sessionId).config);
  if (Object.keys(data).length === 0) return null;
  const situation = data['situation'];
  const style = data['style'];
  const durationStr = data['duration_minutes'];
  if (!situation || !style || !durationStr) return null;
  return {
    situation: situation as SessionConfig['situation'],
    style: style as SessionConfig['style'],
    duration_minutes: parseInt(durationStr, 10),
  };
}

async function askClaude(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = response.content[0];
  if (!block || block.type !== 'text') throw new Error('Unexpected Claude response');
  return block.text.trim();
}

function buildFirstQuestionPrompt(config: SessionConfig): string {
  return `あなたは${config.style}スタイルの${config.situation}の面接官です。面接の最初の質問を1問だけ生成してください。質問のみを出力してください。`;
}

function buildNextQuestionPrompt(config: SessionConfig, recentTurns: Turn[]): string {
  const history = recentTurns
    .map((t) => `面接官: ${t.question}\n候補者: ${t.answer_text}`)
    .join('\n\n');
  return `あなたは${config.style}スタイルの${config.situation}の面接官です。\n\nこれまでの会話:\n${history}\n\n上記の会話を踏まえ、次の質問を1問だけ生成してください。質問のみを出力してください。`;
}

function buildStarPrompt(turns: Turn[]): string {
  const answers = turns.map((t) => `Q: ${t.question}\nA: ${t.answer_text}`).join('\n\n');
  return `以下は面接候補者の回答です:\n\n${answers}\n\nSTARフレームワーク(Situation/Task/Action/Result)の各要素が十分に含まれているか評価してください。必ず以下のJSON形式のみを出力してください（説明不要）:\n{"situation": true, "task": true, "action": true, "result": true}`;
}

function parseStarEvaluation(text: string): StarEvaluation {
  const match = text.match(/\{[^}]+\}/);
  if (!match?.[0]) throw new Error('Failed to parse STAR evaluation JSON');
  return JSON.parse(match[0]) as StarEvaluation;
}

function countFillers(text: string): number {
  return (text.match(FILLER_RE) ?? []).length;
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // POST /session/start
  app.post<{ Body: SessionStartRequest }>('/session/start', async (request, reply) => {
    const { situation, style, duration_minutes } = request.body;
    if (!situation || !style || !duration_minutes) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const sessionId = uuidv4();
    const keys = sessionKeys(sessionId);
    const createdAt = new Date().toISOString();

    await redis.hset(keys.config, {
      situation,
      style,
      duration_minutes: String(duration_minutes),
    });
    await redis.expire(keys.config, SESSION_TTL);
    await redis.set(keys.fillerCount, '0');
    await redis.expire(keys.fillerCount, SESSION_TTL);

    const config: SessionConfig = { situation, style, duration_minutes };
    const firstQuestion = await askClaude(buildFirstQuestionPrompt(config));

    await redis.set(keys.currentQuestion, firstQuestion);
    await redis.expire(keys.currentQuestion, SESSION_TTL);

    const response: SessionStartResponse = {
      session_id: sessionId,
      created_at: createdAt,
      first_question: firstQuestion,
      turn_id: 1,
    };
    return reply.status(201).send(response);
  });

  // POST /session/answer (multipart/form-data)
  app.post('/session/answer', async (request, reply) => {
    let sessionId = '';
    let turnId = 0;
    let audioBuffer: Buffer | null = null;
    let audioMimetype = 'audio/webm';

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'field') {
        const val = String(part.value);
        if (part.fieldname === 'session_id') sessionId = val;
        else if (part.fieldname === 'turn_id') turnId = parseInt(val, 10);
      } else {
        audioBuffer = await part.toBuffer();
        audioMimetype = part.mimetype;
      }
    }

    if (!sessionId || !audioBuffer) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const config = await getSessionConfig(sessionId);
    if (!config) return reply.status(404).send({ error: 'Session not found' });

    const keys = sessionKeys(sessionId);
    const currentQuestion = await redis.get(keys.currentQuestion);
    if (!currentQuestion) return reply.status(404).send({ error: 'Session not found' });

    // Transcribe audio via Whisper
    const audioFile = await toFile(audioBuffer, 'audio.wav', { type: audioMimetype });
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });
    const answerText = transcription.text;

    // Accumulate filler count
    const fillerCount = countFillers(answerText);
    await redis.incrby(keys.fillerCount, fillerCount);
    await redis.expire(keys.fillerCount, SESSION_TTL);

    // Save turn
    const turn: Turn = {
      turn_id: turnId,
      question: currentQuestion,
      answer_text: answerText,
      recorded_at: new Date().toISOString(),
    };
    await redis.rpush(keys.turns, JSON.stringify(turn));
    await redis.expire(keys.turns, SESSION_TTL);

    // Get recent 5 turns for Claude context
    const recentRaw = await redis.lrange(keys.turns, -5, -1);
    const recentTurns: Turn[] = recentRaw.map((s: string) => JSON.parse(s) as Turn);

    // Generate next question
    const nextQuestion = await askClaude(buildNextQuestionPrompt(config, recentTurns));
    await redis.set(keys.currentQuestion, nextQuestion);
    await redis.expire(keys.currentQuestion, SESSION_TTL);

    const response: SessionAnswerResponse = {
      turn_id: turnId,
      answer_text: answerText,
      next_question: nextQuestion,
      turn_id_next: turnId + 1,
    };
    return reply.send(response);
  });

  // POST /session/end
  app.post<{ Body: SessionEndRequest }>('/session/end', async (request, reply) => {
    const { session_id } = request.body;
    if (!session_id) {
      return reply.status(400).send({ error: 'Missing session_id' });
    }

    const config = await getSessionConfig(session_id);
    if (!config) return reply.status(404).send({ error: 'Session not found' });

    const keys = sessionKeys(session_id);
    const allRaw = await redis.lrange(keys.turns, 0, -1);
    const allTurns: Turn[] = allRaw.map((s: string) => JSON.parse(s) as Turn);

    // STAR evaluation via Claude
    const starText = await askClaude(buildStarPrompt(allTurns));
    const starEvaluation = parseStarEvaluation(starText);

    // Get accumulated filler count
    const fillerRaw = await redis.get(keys.fillerCount);
    const totalFillerCount = parseInt(fillerRaw ?? '0', 10);

    const summaryFeedback = {
      total_filler_count: totalFillerCount,
      star_evaluation: starEvaluation,
    };

    const record: SessionRecord = {
      session_id,
      created_at: new Date().toISOString(),
      config,
      turns: allTurns,
      summary_feedback: summaryFeedback,
    };

    // Persist session record to sessions/{session_id}.json
    const sessionsDir = path.join(process.cwd(), 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionsDir, `${session_id}.json`),
      JSON.stringify(record, null, 2),
      'utf-8',
    );

    // Clean up Redis
    await redis.del(keys.config, keys.turns, keys.fillerCount, keys.currentQuestion);

    const response: SessionEndResponse = {
      session_id,
      summary_feedback: summaryFeedback,
    };
    return reply.send(response);
  });
}
