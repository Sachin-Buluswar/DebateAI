# DebateAI Tech Stack Specification

## 1. Guiding Principles
- **Hybrid AI Model:** Combine the strengths of different AI services. Use a powerful Large Language Model (LLM) for high-quality, structured content generation and a specialized, low-latency conversational AI for real-time, interactive dialogue.
- **Modularity & Consistency:** Separate frontend, backend, and AI integration layers with strict interface contracts and uniform coding practices.
- **API-First:** Leverage managed API services to minimize infrastructure management and ensure scalability.

---

## 2. Frontend
- **Framework:** Next.js with React (TypeScript).
- **Styling:** Tailwind CSS.
- **Real-Time Communication:** Socket.IO client for WebSocket communication with the backend.
- **Deployment:** Vercel.

---

## 3. Backend
- **Runtime & Framework:** Next.js API Routes.
- **Primary Database & Authentication:** Supabase for user auth and PostgreSQL database.
- **Real-Time Communication:** Socket.IO running within a Next.js API Route.
- **Testing:** Jest for unit and integration tests.

---

## 4. AI & Voice Services

### 4.1 Core AI Services
- **Argument & Analysis Generation (LLM):**
  - **Service:** OpenAI gpt-4o.
  - **Use Case:** Generating long-form, structured content for debate speeches (Constructives, Rebuttals, Summaries) and for the post-debate analysis and user feedback.

- **Real-Time Conversational AI:**
  - **Service:** ElevenLabs Conversational AI.
  - **Use Case:** Handling the live, interactive "Crossfire" segments. Its low-latency, turn-taking capabilities are essential for creating a realistic, back-and-forth dialogue.

### 4.2 Voice Synthesis (Text-to-Speech)
- **Service:** ElevenLabs TTS API.
- **Use Case:** Converting all AI-generated text (both speeches and crossfire responses) into high-quality, expressive, and distinct voices for each AI persona.

### 4.3 Voice Transcription (Speech-to-Text)

- **Service:** ElevenLabs STT API (using eleven_multilingual_v2 model).
- **Use Case:** Transcribing the human user's spoken input in real-time during their speeches and crossfire participation.

### 4.4 Wiki Search (RAG)
- **Service:** OpenAI Vector Storage.
- **Use Case:** For the document search and retrieval feature, allowing users to find relevant evidence from a knowledge base.

---

## 5. DevOps & Deployment
- **Containerization:** Docker.
- **Orchestration & CI/CD:** Kubernetes and GitHub Actions.
- **Monitoring & Logging:** Prometheus, Grafana, and ELK Stack.

---

## 6. Summary of Core Technologies
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Socket.IO.
- **Backend:** Next.js (API Routes), TypeScript, Supabase (Postgres & Auth).
- **AI - Content Generation:** OpenAI gpt-4o.
- **AI - Conversational & Voice:** ElevenLabs (Conversational AI & TTS).
- **AI - Transcription:** ElevenLabs (STT).
- **AI - RAG:** OpenAI Vector Storage.
- **DevOps:** Docker, Kubernetes, GitHub Actions.

---

## 7. Instructions for AI Coding Models

- **Consistency:** All generated code must strictly adhere to this tech stack specification.
- **Modularity:** Ensure that the frontend, backend, and AI modules are developed as separate components with clear APIs and context boundaries.
- **Error Handling & Logging:** Include robust error handling for all API interactions (e.g., if OpenAI calls fail or search queries time out, log these events clearly).
- **Documentation:** Each module should have header comments and inline documentation referencing this tech stack file.
- **Context Updates:** Always reference external documentation such as `docs/architecture.mermaid` and `docs/technical_specifications.md` when relevant to ensure compatibility with the design.

---

## 8. Final Remarks

This tech stack specification is the master blueprint for building DebateAI with a focus on simplicity, cost efficiency, and high-quality user experience. All automated code generation and AI-driven improvements must use these guidelines as the source of truth.

*Begin code generation using these instructions and ensure all service integrations strictly follow the outlined APIs and integration patterns.*

- **Tooling:** ESLint (strict), Prettier, Jest, GitHub Actions CI pipeline (lint → format → typecheck → test → build).
- **Environment Vars Added:** `DEBUG_API_KEY` for securing diagnostic endpoints. 