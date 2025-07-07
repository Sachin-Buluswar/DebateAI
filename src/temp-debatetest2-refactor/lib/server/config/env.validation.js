import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Supabase credentials
  NEXT_PUBLIC_SUPABASE_URL: Joi.string().required(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),

  // OpenAI API key
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_VECTOR_FILE_ID: Joi.string().allow('').default(''),

  // Server configuration
  PORT: Joi.number().default(3003),
  HOST: Joi.string().default('localhost'),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
}); 