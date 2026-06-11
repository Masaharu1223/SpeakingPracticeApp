import { Redis } from 'ioredis';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

// These SDKs auto-read ANTHROPIC_API_KEY / OPENAI_API_KEY from env
export const anthropic = new Anthropic();
export const openai = new OpenAI();
