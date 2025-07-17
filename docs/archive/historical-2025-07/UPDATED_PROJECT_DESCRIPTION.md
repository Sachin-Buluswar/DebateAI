DebateAI – Technical Design & Implementation Plan
Product Requirements Document (PRD)
1. Overview & Vision
DebateAI is envisioned as an AI-powered debate simulation platform that allows users to engage in structured debates with multiple AI-driven participants. The goal is to provide a realistic, educational, and engaging debate experience, where AI debaters present arguments in lifelike speech and a human user can participate as a debater. This platform aims to redefine debate practice by leveraging advanced AI for argument generation and analysis . Users will be able to challenge their beliefs, understand multiple perspectives, and improve their critical thinking through AI-powered discourse . Ultimately, DebateAI seeks to cultivate critical thinking and communication skills by immersing users in vibrant, Oxford-style debates on a wide range of topics.
2. Objectives and Goals
Skill Development: Help users (students, professionals, or enthusiasts) improve their debating skills, critical thinking, and rhetoric through practice with AI opponents. The system will simulate formal debate formats, enabling users to practice constructing arguments, rebutting opposing points, and thinking on their feet.


Multi-Perspective Insight: Expose users to diverse viewpoints. Multiple AI debaters (with distinct personas or stances) will ensure that debates cover differing perspectives, enriching the discussion and allowing the user to hear strong arguments from all sides . This aids in broader understanding of complex issues.


Realism and Engagement: Deliver a highly realistic experience using natural language generation and speech technology. All AI monologues are delivered in human-like voices via advanced text-to-speech (TTS), and interactive cross-examination segments (“crossfires”) are handled by conversational AI, making the debate feel like a real interaction. The use of expressive synthetic voices and dynamic dialogue will make the experience immersive and engaging .


Accessibility and Convenience: Provide a safe, accessible space to practice debates anytime. Users who may not have access to debate clubs or willing human opponents can still practice with AI. The platform should be easy to use, with minimal setup, whether for an educator in a classroom or an individual at home.


3. Target Users & Use Cases
3.1 Students and Educators
Students can use DebateAI to prepare for debate competitions, class discussions, or simply to sharpen their persuasive writing and speaking skills . For example, a student preparing for a school debate on climate change might simulate a full debate with AI opponents presenting various opposing viewpoints . This helps them refine their arguments and deepen their understanding of the topic in a risk-free environment. Debate coaches or teachers could assign debates with AI to let students practice and then review transcripts and AI feedback.
3.2 Professionals (Law, Business, Policy)
Professionals in fields like law, politics, or business can leverage the platform to hone argumentation and public speaking skills . For instance, a lawyer could practice an opening statement for a trial with AI debaters posing as opposition counsel to raise counterarguments . The AI's feedback and challenging questions help the professional refine their reasoning and anticipate counterpoints. Business leaders might use DebateAI to practice pitching an idea and defending it under tough questioning from AI playing the "devil's advocate."
3.3 Individual Learners & Enthusiasts
Any individual interested in improving their communication and critical thinking can use DebateAI for personal development . This includes people preparing for public speaking events, job interviews (to practice handling challenging questions), or those who enjoy debating current events for fun. By engaging with AI debaters, users can learn to articulate their thoughts more clearly and respond to unexpected arguments. The AI can also function as a personal debate coach by providing analysis of the user's arguments and suggestions for improvement (e.g. pointing out logical fallacies or weak evidence).
3.4 Entertainment and Content Creation (Secondary Use)
While the primary focus is skill development, DebateAI can also be used for entertainment or content generation. For example, one could stage a debate between AI personas on a hypothetical or humorous topic and share the resulting debate (audio or transcript) as content. The system's multi-voice, multi-agent capabilities make it possible to create engaging podcast-style debates or YouTube videos where AI characters debate each other (with the user perhaps moderating or participating). This broadens the appeal of the platform to content creators and audiences interested in seeing AI tackle interesting questions.
4. Key Features and Functional Requirements
Structured Debate Format: DebateAI supports a formal debate structure with clearly defined segments:


Opening Statements (Monologues): Each participant delivers a timed opening monologue presenting their stance. For instance, in a 4-person debate (2 vs 2 teams), there will be four opening statements (e.g., Affirmative 1, Negative 1, Affirmative 2, Negative 2). These monologues will be generated by the AI for AI participants, and provided by the human user for their turn (the user can input their speech). All monologues are then synthesized to speech so they can be heard in natural voices.


Rebuttals: The format may include rebuttal speeches after openings. AI debaters can generate rebuttal monologues that address points made by the opposing side. (This is optional/configurable based on debate style).


Crossfire (Interactive Debate) Sessions: After the set-piece speeches, the system enters free-form cross-examination or "crossfire" sessions where participants engage in back-and-forth dialogue. Conversational AI is used for all crossfires, meaning the AI debaters will respond in real-time to each other's and the human's statements, rather than delivering pre-written speeches. Different crossfire modes can be supported:


1-on-1 Crossfire: e.g., between one affirmative and one negative debater at a time.


Grand Crossfire (All Participants): a session where all 4 debaters (3 AIs and 1 human) converse together . The system must handle multi-agent conversation in this mode, allowing interjections and responses from any participant.


Closing Statements: Optionally, each side delivers a closing monologue to summarize their arguments. AI can generate closing remarks, and the human user can deliver theirs, with TTS output if needed.

 The DebateAI orchestrator will enforce timing rules (e.g., 3 minutes per opening statement, 2 minutes per rebuttal, 5 minutes crossfire, etc.) to keep the format consistent. Structured timing is a hallmark of formal debates , ensuring fairness and clarity.


AI Debater Personas: The system will include multiple AI debater agents, each with a distinct persona or designated stance on the topic. For example, one AI might be "Affirmative - Main Speaker", advocating in favor of the topic, while another is "Negative - Main Speaker" arguing against. In a team scenario, additional AI could act as secondary speakers to provide supporting arguments for each side. Each AI will be given a profile with its stance and some personality traits (e.g., polite and logical vs. passionate and aggressive) to make the debates more dynamic and realistic. Ensuring each AI has a well-defined persona is crucial; as voice UI design research notes, all voices project a persona, and planning a clear persona leads to more engaging, credible interactions . DebateAI will not leave persona to chance – we will craft the AI characters deliberately so they sound consistent and believable in their roles (e.g., an AI assigned as a professor will have a more measured, authoritative tone than one assigned as a fiery activist).


Natural Language Generation for Arguments: At the core of DebateAI is an LLM-based argument generation engine. For any given debate topic, the AI agents must generate coherent, relevant arguments and rebuttals:


The system will prompt a large language model (LLM) to generate opening statements given the topic and the side (affirmative/negative) it represents. The prompts can include guidelines (like "You are Debater A, arguing in favor of the proposition. Provide a 2-minute opening speech with clear points and evidence.").


Rebuttal generation will similarly use prompts that provide a summary of the opponent's points (from the opening) and ask the LLM to refute them.


During crossfire, conversational AI mode is used. The AI agents no longer produce long speeches but rather short responses or questions. The system uses multi-turn dialogue management: as each utterance is made, it's added to the conversational context so that the next agent can respond. The LLM will be prompted with the recent dialogue and instructed to respond in character for that agent.


Multi-Agent Conversation: Importantly, the platform must handle cases where multiple AI agents converse with each other and the user. This requires managing turn-taking and context for each agent. We may utilize a framework or pattern for multi-agent LLM interactions, ensuring that each AI agent only sees relevant parts of the conversation and maintains its own perspective. Recent approaches like Microsoft's AutoGen framework allow developers to compose multiple LLM agents that converse and even include humans in the loop . DebateAI's design draws on such patterns to coordinate the AI debaters. For example, the system might orchestrate that in grand crossfire, AI agents are listening for questions directed at them or pauses in the conversation to speak, and an underlying logic ("moderator" process) decides whose turn it is to talk to avoid chaotic overlaps.


Realistic Text-to-Speech for AI Monologues: Each AI debater will be associated with a distinct synthetic voice. Using ElevenLabs' state-of-the-art TTS, the AI's generated speeches will be converted into natural-sounding audio. ElevenLabs offers a wide library of human-like voices and even emotional intonations . For DebateAI:


All prepared speeches (openings, rebuttals, closings) from AI agents will be synthesized before playback, using a standard voice selected for that agent (e.g., one AI might have a deep male voice, another a higher-pitched female voice, etc., to help the listener distinguish speakers easily). The voices will be chosen to match the personas (friendly vs. authoritative, etc.).


The TTS conversion will be done via ElevenLabs API. (ElevenLabs' API provides high-quality voices with low latency, and as of 2025 supports 1000+ voice options .) We will leverage these options to give each AI a unique vocal identity. The importance of high-quality TTS is underscored by the role of voice in user engagement – expressive, human-like voices make the AI agents feel like real participants, improving immersion .


All crossfire dialogue from AIs will also use TTS. Since crossfire involves shorter exchanges, the system will need to convert each AI utterance to speech on the fly. We will ensure the TTS API can handle rapid turnaround. If needed, crossfire responses might have a slight delay (a second or two) as the AI text is generated and then voiced. We aim to minimize this delay for a seamless experience, potentially using streaming TTS capabilities if available (where the voice audio starts playing while still being generated).


Voice Consistency: The human user, if they choose, could also have their voice output by TTS. For instance, if a user prefers not to use their own voice, they could type their statements and select a voice (perhaps even clone their own voice using ElevenLabs if desired). However, primarily the user is expected to speak their parts.


Speech Recognition for User Input (optional): To fully mirror a real debate, the system should allow the human debater to speak naturally. We plan to integrate Speech-to-Text (STT) for the user's spoken input during debates. For example, using a service like ElevenLabs Scribe v1, the user's speech can be transcribed in real time and fed into the system for the AI to respond. Twilio's ConversationRelay or similar frameworks demonstrate how STT and TTS can be combined with an AI backend for live voice conversations . By integrating STT:


The user can deliver their opening speech by actually speaking into their microphone. The system will transcribe it and also optionally play it back using a chosen TTS voice (or even the user's own recorded voice if quality is good). Alternatively, the user might type their speech and have it spoken by a voice – the system will support both modes for flexibility.


During crossfire, if the user speaks a question or an interjection, the system immediately transcribes it to text (possibly showing the text on screen for clarity) and then the AI agents will process that text to formulate responses.


Low latency is crucial here; the STT engine needs to be real-time. Modern STT services can transcribe with very low delay and high accuracy across languages. While ElevenLabs' current Scribe v1 model is optimized for accuracy over real-time performance, a low-latency version is expected soon, which will be ideal for the crossfire segments. This ensures the conversation flows naturally without long pauses.


Debate Orchestration & Timing Control: A core requirement is the Debate Orchestrator component that manages the flow of the debate. This orchestrator ensures the debate follows the chosen format and time limits:


It will signal whose turn it is to speak, start and stop timers for monologues, and transition to the next segment. For instance, after scheduling all opening statements, the orchestrator moves to the first crossfire segment automatically.


During crossfires, it may act as a silent moderator to prevent everyone from speaking at once. In a grand crossfire with 4 participants, the orchestrator could enforce a rule like "one person speaks at a time". If two AI agents try to speak simultaneously (due to the nature of asynchronous generation), the orchestrator can decide order (perhaps by pre-assigning a priority or simply alternating turns). The orchestrator can also detect if the human is trying to speak (e.g., via a UI cue or voice activity detection) and give precedence to the human's turn to ensure they have a fair chance to participate.


After a crossfire ends (when the timer runs out or a certain number of exchanges have happened), the orchestrator moves the debate to the next phase (e.g., closing statements). It can also enforce that certain agents speak only in their allocated segments (for example, maybe only two debaters are allowed in a particular crossfire session).


The orchestrator logs the entire debate (who spoke when, what was said) into a Debate State or transcript, which can later be reviewed or used by an AI judge (if implemented) or simply presented to the user for learning purposes . Maintaining this state also helps AI agents refer back to earlier arguments if needed.


Transcript and Analysis Output: For every debate session, the system will produce a transcript of all speeches and dialogues (at least in text form). This is important for user review and for any analytical features:


The transcript will label each speaker and show their words. It can be presented live during the debate (like a caption feed) and saved at the end.


AI-based Analysis: As an advanced feature (possibly not in MVP but in later version), the system can include an AI Judge or Analyst agent that reviews the debate and provides feedback. For example, after the debate, an AI judge could summarize the strongest points from each side and even declare a winner or provide scores on argument quality. Research in 2024 has shown that AI models (even less powerful ones) can effectively judge debates or at least provide structured evaluations, sometimes correlating well with human judgments . A study by Liu et al. (2024) introduced methods for evaluating debate speeches with LLM "judges" analyzing each speech in context . Leveraging such capabilities, DebateAI could give users feedback like "Your second argument lacked evidence" or "AI Debater 3 used a logical fallacy here, can you spot it?" This transforms the debate into a learning opportunity.


Additionally, the transcript can be used for searchable archives. Users might want to review what an AI said or extract references from a debate. The platform could allow saving debates for later playback or analysis.


Content Moderation & Accuracy Controls: Since debates can delve into controversial topics, the platform needs safeguards:


Topic Selection Limits: The system might restrict or warn against certain sensitive topics (e.g., hate speech, extreme politics) to avoid generating harmful content. Alternatively, if allowing open topics, the AI models should be filtered (using an AI moderation service or model guardrails) to prevent toxic or biased outputs.


Factuality Aids: While debates involve persuasion, factual accuracy is important. LLMs can sometimes produce false information confidently. We plan to mitigate this by possibly integrating a fact-checking step or encouraging the AI (via its prompts) to cite evidence rather than making facts up. For example, the prompt could say "If you state a factual claim, back it up with a known example or source." We might also use retrieval augmentation – connecting the AI to a knowledge base or the web for current data – especially for topics of current events. This is a stretch goal; initial versions may rely on the model's internal knowledge.


Bias and Fairness: Ensure that AI debaters don't always take one side with higher quality. We want a balance such that the AI on either side are equally competent. This might involve symmetric prompt tuning or even using the same model for all and just altering persona. Ongoing testing will check that one side's AI isn't systematically stronger unless intended (perhaps the user can set difficulty levels, see below).


User Controls and Customization:


Topic and Side Selection: The user should be able to choose the debate topic or resolution. They may also choose which side they want to argue (affirmative or negative). The platform supports debates with one or two human participants. A solo user can team up with an AI partner against two AI opponents, or two human users can team up against two AI opponents.


Debate Format Options: Provide options to select different formats (e.g., Oxford/Oxford-style, Parliamentary, Public Forum, etc., each with slightly different structures and number of participants). The default described (with 4 debaters including the user) is akin to Public Forum (team debate with crossfires). Alternatively, a one-on-one Lincoln-Douglas style could be supported (1 AI vs 1 human, with longer speeches). The system should be flexible to accommodate these with configuration changes in the orchestrator.


AI Skill Level: Allow the user to set the sophistication of the AI debaters. For beginners, they might want the AI to use simpler language and arguments; advanced users might want the AI to be extremely challenging, using advanced rhetoric and data. This could be achieved by selecting different underlying model sizes or adjusting the prompt style (e.g., an "easy" mode AI might intentionally make a few logical mistakes for the user to catch, whereas "expert" mode AI will be very rigorous).


Voice and Persona Customization: Users can pick or adjust the voices of AI participants (e.g., choose from a set of voice profiles if they have a preference). They could also tweak persona settings – for example, instruct that the negative side's AI should be very aggressive or that one of the AI speakers has a particular style (humorous, formal, etc.). This adds an element of personalization and fun.


Assistance and Hints: If used as a learning tool, the user might enable a feature where the system provides hints or coaching during their preparation. For instance, before delivering their speech, the user could ask the AI for some pointers or to critique a draft argument.


Pause/Replay: The user should be able to pause the debate (especially if it's just them practicing, not a competitive live setting) and replay sections of audio or scroll back through the transcript. This is useful if they want to re-listen to an AI's point or if they need a moment to think before responding in crossfire.


Performance and Scalability Requirements: The system should handle the real-time nature of spoken debate:


Responses in crossfire should ideally be generated within a couple of seconds to keep conversation flow. We target a response latency of < 2 seconds for AI replies in interactive segments. To achieve this, efficient model usage or streaming generation will be necessary.


The TTS should produce audio quickly (ElevenLabs' API is known for low latency and high quality , which is promising). We might pre-generate longer speeches entirely before playing them (since we know the text), but for spontaneous dialogue, we might utilize parallel processing (generate text and immediately send to TTS).


The system must handle multiple AI agents potentially generating simultaneously. This means ensuring enough computational resources (or API calls in parallel). If using a local model, it needs to run multiple instances or handle concatenated prompts for multiple roles.


The design should allow multiple concurrent debates if this is a cloud service (i.e., many users using DebateAI at the same time). This suggests a scalable backend where sessions are isolated and resources (LLM and TTS calls) scale horizontally.


Non-functional Requirements (NFR):


Usability: The interface should be intuitive. Even users unfamiliar with debate formats should be guided by the system (e.g., on-screen prompts like "Your turn to speak – click the microphone to start talking"). Visual cues and clear labels are critical so the user knows what's happening and what's expected of them at each phase. The experience should be engaging rather than confusing.


Reliability: The system should not crash or freeze during a debate session. Long sessions (possibly 30+ minutes if a full debate with multiple segments) should remain stable. Also, the state (transcripts, scores) should be preserved even if the network hiccups, etc., to be robust.


Security & Privacy: If user audio is recorded for STT, it should be handled securely. Conversations may be sensitive (depending on topics users choose), so communications with any API (OpenAI, ElevenLabs, etc.) should be encrypted. If we store debate transcripts or audio, users should have control (e.g., a way to delete their data). For younger users (students), parental controls or safe-topic filters might be needed.


Compatibility: DebateAI should ideally be accessible via web browser (for ease of use) and possibly as a mobile app. The design will ensure compatibility with modern browsers and various devices. If using WebRTC or similar for audio streaming, we'll verify it works across platforms.


Maintainability: The system will be modular (as described in architecture below) to allow updates. For instance, we might swap out the LLM component when a more advanced model becomes available (e.g., future GPT-5 or Google's Gemini) without reworking the entire system. The same for TTS or STT services. We'll document the components so future developers can maintain or upgrade pieces independently.


5. Latest Context and Rationale
Why build DebateAI now? Recent advances in AI make this platform feasible and effective in 2025:
Advanced LLMs: Large language models like gpt-4o (2023) and others have demonstrated the ability to generate human-quality persuasive text and engage in dialogues. They can maintain context over long conversations and produce convincing arguments. Models are continually improving, and even open-source alternatives (like Meta's LLaMA-2 or others) are available for custom deployment. Using the latest generation models ensures that AI debaters can truly simulate skilled human debaters.


Multi-Agent AI Frameworks: New frameworks have emerged to handle multi-agent interactions. For example, Microsoft's AutoGen (2024) provides patterns for multi-agent conversations where agents can talk to each other and coordinate . This means we don't have to build multi-agent logic from scratch; we can leverage and adapt proven approaches from the research community. Multi-agent debate as a concept has been explored and found to improve AI reasoning and decision-making by having agents with different viewpoints challenge each other . DebateAI will apply these ideas in a user-facing application.


Speech Technology: The quality of AI voices (TTS) is now remarkably high. ElevenLabs, for instance, released a new model (Eleven v3) with extremely expressive speech that's nearly indistinguishable from real humans . By integrating such technology, we can overcome one major hurdle of past virtual debate tools (which often lacked voice and felt less immersive). Moreover, services like Twilio's ConversationRelay (2025) show that real-time voice conversations with AI are possible to implement, combining STT, LLM, and TTS in a pipeline . This gives confidence that our technical approach is sound.


Persuasiveness of AI: Studies have started to show that AI debaters can be highly persuasive. A June 2024 study found that personalized AI debaters were more persuasive than humans in 64.4% of debates, as measured by how often they changed the opponent's stance . The reason cited is that people perceive AI as more objective and factual . This insight suggests that DebateAI's users might find the AI arguments quite compelling, which is excellent for challenging users to think critically. It also underscores the importance of using AI responsibly – we will need to ensure AI arguments are not misleading users with false confidence.


Educational Demand: There is a growing recognition of AI's role in education and training. Institutions are exploring how AI can aid learning (for example, the National Speech & Debate Association and NFHS have been discussing how AI can assist in debate coaching ). The timing is right for a tool like DebateAI to be introduced to classrooms or training programs, as stakeholders are looking for innovative tools that maintain educational value while harnessing AI.


By incorporating the latest knowledge and technology, as detailed above, DebateAI is positioned at the cutting edge of AI-enabled learning tools. The requirements and design choices have been made to ensure the platform is not using outdated methods (e.g. we're not relying on 2020-era TTS or GPT-2 level language models) – instead, we lean on current, proven AI capabilities to deliver a state-of-the-art experience.
Architecture & System Design Task Plan
1. System Architecture Overview
The architecture of DebateAI is designed as a modular system with a clear separation of concerns between the front-end user interface, the back-end debate logic, and external AI service integrations. At a high level, the system can be visualized in two layers:
Front-End (Client): The user-facing application (web or mobile) that handles user input (voice or text), displays the debate interface (text transcripts, speaker indicators, controls), and plays audio for the speeches.


Back-End (Server): The brains of the operation, which includes the Debate Orchestrator, AI logic (LLM interactions), and integration with TTS/STT services. This back-end can be further broken down into subcomponents such as the Debate Flow Manager, AI Agent Modules, Voice Processing module, etc.


Figure 1: A conversational AI pipeline integrating speech-to-text (STT) and text-to-speech (TTS) around an LLM-based agent, enabling natural dialogue between users and AI .
The above figure illustrates the core loop relevant to DebateAI: the user's speech is converted to text (STT), processed by the Agent/LLM component which generates a response, and then that response is converted back to speech (TTS) for the user to hear . DebateAI's architecture expands this basic loop to multiple agents and a structured sequence of interactions, orchestrated by the system.
Key architectural components include:
Debate Session Manager (Orchestrator): Coordinates the overall flow of a debate session. It enforces the debate format (timing and turn-taking rules), signals the AI agents when to produce speeches or responses, and collects outputs to route them to front-end or to other agents. Think of it as the "conductor" ensuring everyone speaks in the right order. (This may not have a UI presence except maybe a timer display; it's mostly logic.)


AI Agents (Debater Modules): Each AI debater is encapsulated in a module that can generate content when prompted. This module interfaces with the LLM. We will likely create an Agent class that contains the persona/profile of the debater (their stance, style guidelines) and has a method to produce a speech or reply given the context. Internally it calls the LLM API with a prompt constructed from its persona and the current debate state.


LLM Service: This can be an external API (e.g., OpenAI gpt-4o via API) or a local model server (like Ollama running LLaMA or other models ). The LLM service is responsible for natural language generation. The system is model-agnostic in design (we can plug in different models), but in practice we'll start with a known reliable one (gpt-4o or a fine-tuned equivalent) to ensure high-quality argumentation.


Voice Services:


Text-to-Speech (TTS) Engine: We will integrate with ElevenLabs API for generating speech audio from text. This is an external service call that takes text plus a voice ID and returns an audio clip. The architecture needs to handle the asynchronous nature of this (i.e., when an AI agent produces text, the system must wait for or asynchronously fetch the audio before playing it to the user).


Speech-to-Text (STT) Engine: For user speech input, an STT service (e.g., ElevenLabs Scribe v1) is used. This could either stream text in real-time or return full transcription after the user finishes speaking. The architecture will have a Listener component that receives audio from the client and sends it to STT, then forwards the recognized text to the Orchestrator/AI agents.


Database/Storage: A lightweight storage might be needed to save debate configurations, user profiles (for personalization settings like chosen voices, past topics), and transcripts. For an initial version, the system can operate mostly in-memory for a session and then optionally export data. However, in a multi-user environment, a database (SQL or NoSQL) will keep track of sessions and results.


APIs and Integration Layer: The server will expose endpoints or use WebSocket connections to communicate with the front-end. For example, when an AI response (text + audio) is ready, it might push it to the client via a WebSocket so that the client can play it immediately. Similarly, the client might send events like "user started speaking" or "user submitted their speech text" to the server via an API call, which triggers back-end processing.


Real-time Communication: If we enable live audio streaming (for user speech and possibly streaming AI responses), we might use technologies like WebRTC or socket streams. Twilio's ConversationRelay example suggests one approach, but if we are implementing ourselves, we might have a dedicated WebSocket for the audio/text exchange.


In summary, the architecture is event-driven: events (like "monologue complete", "crossfire timer elapsed", "user spoke X") flow into the Orchestrator, which then triggers actions (like "AI2, it's now your turn to give a rebuttal" or "send this text to TTS and then play it"). The design emphasizes modularity so that each AI agent's behavior is encapsulated, and services like TTS/STT can be swapped or scaled independently.
2. Core Components and Responsibilities
2.1 Debate Orchestrator & Session Flow Manager
Responsibilities:
Initialize a debate session based on chosen format (e.g., set up agents for each role, schedule of rounds).


Keep the official "clock" and sequence. For each segment of debate (opening round, rebuttal round, crossfire, etc.), the orchestrator activates the appropriate agents or awaits user input.


Enforce turn-taking: e.g., during crossfire, it can route the last speaker's utterance to the opposing participant for response. If the format allows free-form interaction, it still monitors to prevent overlap.


Manage timing: If a speech time limit is, say, 2 minutes, it should cut off or prompt the AI to conclude if it's verbose. Similarly, end a crossfire after X minutes by signaling agents to stop and not initiating new turns.


Aggregate debate state: maintain a transcript log, track what points have been made (this can be simple text log initially; more advanced could be semantic tracking of arguments). Possibly pass a condensed state to agents if needed for context (for instance, an agent's prompt for a closing statement might include a summary of key points from the debate state).


Handle transitions: e.g., after all openings are done, emit an event or call that triggers the first crossfire, etc. It essentially is a state machine that goes through states like OpeningStatements -> Crossfire1 -> Rebuttals -> Crossfire2 -> ClosingStatements -> Completed. Each state defines which agent or participant has control and what kind of interaction (monologue vs. dialogue) occurs.


Design Consideration: The orchestrator can be implemented as a class that has methods like startDebate() and internal methods for each phase. It may use asynchronous event handling (since it will be waiting on external outputs: AI generation, user input). For example, after sending a prompt to an LLM for an opening speech, the orchestrator might await the result (without blocking other tasks), then upon receiving the text, sends it to TTS, then after TTS returns audio or confirms playback, moves on. This asynchronous, non-blocking design will help in keeping the UI responsive and handling parallel tasks (like preparing the next speech while one is playing, etc.).
The orchestrator does not generate content itself; it calls the AI agents to generate content. It also might incorporate a Debate Moderator AI persona if we choose to have an AI that interjects as a moderator (e.g., asking questions or keeping decorum), but initially, the orchestrator is more a behind-the-scenes controller than a speaking entity.
2.2 AI Debater Agents (LLM-driven modules)
Each AI debater agent can be thought of as consisting of:
Persona & Role Data: This includes their name, side (Affirmative/Negative or more nuanced stance), any specific personality trait or expertise, and voice ID for TTS. For example: Agent_A: {role: "Affirmative", style: "calm and logical", voice: "VoiceID123"}.


Prompt Templates: Predefined templates for various actions. e.g.,


Opening statement template: "You are {name}, a debater arguing for {position}. Craft a compelling opening argument about: {topic}. Keep it under {N} words, use at least 2 strong points with supporting evidence."


Rebuttal template: "You are {name}, {position}. Your opponent just argued that {summary of opponent points}. Rebut these points and defend your stance."


Crossfire response template: "You are {name}. Participate in an interactive discussion. Respond briefly to the following comment from {other}: '{other's last statement}'."


Closing statement template, etc.


Memory/Context handling: During crossfire, the agent should have context of at least the recent exchanges. This can be handled by maintaining a rolling conversation history specifically for that agent. In an LLM conversation model (like OpenAI's ChatCompletion API), we could treat each agent as a "virtual user" with their own conversation thread. Another approach is a single conversation thread with system instructions that enforce roles, but that is complex for 4 agents. Instead, we might simulate conversation turn-by-turn:


When it's an AI agent's turn to speak in crossfire, the orchestrator can compile a prompt that includes the last few exchanges (from all participants) and instruct the agent to reply. This effectively gives the agent partial view of the dialogue. Or we give the agent full dialogue but prepend a system message like "You are Alice (Affirmative debater). Only provide Alice's perspective in your next response.".


The agent might also benefit from knowledge of earlier speeches (so it can recall what it or others said before). If the context window of the model allows, we may carry the entire debate transcript in the prompt (for powerful models with large context, e.g., Anthropic's Claude with 100k token context can hold hours of conversation ). If not, we may summarize or keep track of key points manually in a memory object that is passed into prompts as needed (for instance, a list of "our side's arguments" and "their side's arguments" gleaned from the openings, which the rebuttal agent can use).


LLM Interface: The agent will call the LLM service with the composed prompt. For example, using OpenAI API, it would send a list of messages: system message with role instructions, and user message with the content it needs to respond to. If using a local model, it might just call a function with the prompt string. This is abstracted in the agent module.


Post-processing: Once the LLM returns a response text, the agent module might do some post-processing. For example, ensure the text meets time limits (if too long, maybe truncate or summarize). Or strip any tokens where the model mistakenly tried to speak as another character.


Then it sends the final text to the orchestrator (or directly triggers TTS).


Agent Orchestration in Crossfire: For multi-agent conversation, one pattern is to have agents operate in a loop where each agent reads others' messages and responds . A simplified approach in our design is sequential turn-taking controlled by orchestrator rather than fully free chat (since fully autonomous agents might talk over each other or go off-topic). So orchestrator essentially says: "Agent X, it's your turn, here's what was said to you or the latest question." Agent X generates a reply. Then orchestrator sends it to others or directly picks the next agent to respond. This continues. This controlled sequence approximates a natural conversation but with structure to avoid chaos. (This is akin to a moderated debate where people generally speak when called upon.)
Potential Use of Frameworks: As mentioned, Microsoft's AutoGen or similar could manage a lot of the multi-agent communication behind the scenes . We could explore using such a library where we define each agent's profile and let the library handle message passing. For example, AutoGen allows setting up agents and a central controller to pass messages and can incorporate human input as well . If integrating it reduces complexity, it might be part of the system design (with modifications to fit our debate format). This way, we build on proven multi-agent patterns (like those used for collaborative problem solving or debates in research) rather than reinventing the wheel.
2.3 Natural Language Processing Services (LLM backend)
The quality of DebateAI largely depends on the LLM used:
Initial Choice: We will likely use a cloud-based model (gpt-4o) for its robust capability in understanding context and generating persuasive arguments. gpt-4o's performance in nuanced tasks (like debate or legal arguments) is among the best available in 2025. Alternatively or additionally, Anthropic Claude 2 could be used especially because it offers a very large context window (up to 100k tokens) which might allow keeping the whole debate in context . Claude is also designed to be helpful and less likely to produce harmful content, which is beneficial for moderation.


Model Hosting: If using OpenAI or Anthropic, we will call their APIs. If we need offline or cost-effective operations, we could deploy an open-source model using a library like HuggingFace's Transformers or the Ollama engine . For example, a fine-tuned 13B parameter model could potentially handle debate tasks, though with possibly lower quality. We should design the system to allow switching out the model without affecting other components (so use a service wrapper with a common interface).


Ensuring Up-to-date Info: One drawback of closed LLMs is fixed training data. For current events or very specific factual topics, we might integrate a retrieval mechanism. A simplified approach: if the debate topic is about a current event (e.g., "Should a new 2025 policy be enacted?"), we could have a step where the system queries a search API or database for relevant info and gives it to the AI agents as part of their context. This is similar to giving "evidence packets" to debaters. Implementation-wise, we could integrate something like Bing Web Search API or a wiki browser. However, this adds complexity and potential latency, so it might be a future enhancement. In the near term, we may restrict topics to those the model is likely to know about, or accept that some info might be hallucinated and mitigate via user oversight and disclaimers.


Prompt Engineering & Few-Shot: We will craft prompts carefully to ensure the model sticks to role. Possibly we'll include a few-shot example in the system prompt (like a short example of a question and an answer in a debate style) to bias it toward the right genre of response. The model will also be instructed not to stray out of character or reveal the prompting. We might have to iterate on these prompts for optimal results (this is part of development).


Moderation & Safety with LLM: We will use OpenAI's or Anthropic's built-in content filters where available. Additionally, the orchestrator can scan outputs for flagged content. If a generated argument contains disallowed content (hate speech, etc.), the system could either regenerate it or sanitize it (worst case, skip that part with an apology). Keeping debates productive and civil is important, so we will rely on both the model's training (OpenAI and Anthropic models have been trained via RLHF to avoid toxic content) and explicit checks.


2.4 Speech-to-Text (STT) Integration
For user voice input, we integrate STT as follows:
The client captures audio from the user (e.g., via Web Audio API for a web app or native microphone access on mobile). We can capture in short chunks or stream continuously during crossfire.


Streaming vs. Full-pass STT: Ideally, to reduce latency, we use streaming STT. That means as the user speaks, partial transcriptions are generated in real time. However, for simplicity, we might start with a push-to-talk model: user holds a "talk" button, speaks a sentence or two, and releases; then that audio chunk is sent to STT and transcribed text returned. The orchestrator then feeds that to the AI. This push-to-talk approach gives the user more deliberate turn-taking control and aligns with debate where you typically speak in turns, not simultaneously.


We will choose a service known for speed and accuracy. ElevenLabs Scribe v1 is a strong option, offering high accuracy. If using Twilio's ConversationRelay as a template, it already integrates with Google's STT under the hood. Since our use case is specific (somewhat formal language, possibly domain-specific terms in topics), we might also look for a model that can be custom tuned or at least choose an STT with a good vocabulary coverage.


Accuracy and Error Handling: If an STT error occurs (mis-transcription), the system could either allow the user to see and edit the transcribed text quickly before it's submitted (not in a live heated debate, but maybe in practice mode). Or the user can clarify by repeating. The UI might show the recognized text immediately so the user knows if it was wrong.


Latency: The expectation is that by the time the user finishes a sentence and releases the mic, the transcription is ready within a second or so. We will test and possibly shorten the audio clips if needed to ensure quick turnaround. In crossfire, this is crucial so that AI can reply almost immediately after the user finishes speaking, keeping a natural rhythm.


2.5 Text-to-Speech (TTS) Integration
For output voice, ElevenLabs is the chosen provider due to its natural voices and flexibility:
We will use ElevenLabs' API. According to their documentation, it's a simple POST request with text and voice parameters, returning an audio file URL or binary data . We must handle authentication (API keys) securely on the back-end.


We will set up a few voice profiles in our ElevenLabs account for the AI personas (perhaps using their preset voices or custom-created ones). These voice IDs will be stored in the agent profiles. If needed, we might use ElevenLabs' voice cloning to create a specific voice (for example, if we want a voice that sounds like a famous debater or a certain accent for variety). However, voice cloning would require voice data and raises ethical questions if not original, so probably we use built-in voices initially.


Performance: Each TTS request takes some amount of time (depending on length of text and voice complexity). We plan to mitigate delays by:


Generating monologue audios in parallel with other tasks. For instance, while the first opening speech audio is playing, we can start generating the second opening speech's audio in the background so it's ready by the time it's needed.


For crossfire, since utterances are shorter, the TTS calls are faster (maybe under a second for a sentence or two). Still, any delay adds up. ElevenLabs has a low-latency mode and we will ensure to use the most efficient approach. If needed, we could pre-synthesize some common acknowledgments ("I agree", "However, ..." that AI might frequently say, but that's micro-optimization. A straightforward approach with fast API calls should suffice as long as network and service are reliable.


Additionally, Twilio's blog (May 2025) notes that ConversationRelay with ElevenLabs can handle synchronous calls seamlessly, implying the tech is up to the task of real-time voice conversations .


The audio that comes back will be played on the client side. We need to ensure the audio streaming/playing is smooth. Likely, we'll use HTML5 Audio API or Web Audio to play it. If the file is small enough, we can send it as a blob via WebSocket rather than the client fetching from ElevenLabs (to avoid CORS or requiring the client to have the API key). So the server might do: get audio binary → send to client → client plays from memory.


If an error occurs (e.g., TTS service down or text too long), we have a fallback to display text. The system might then use a backup TTS (maybe a browser's built-in one, albeit lower quality) or just apologize that the voice is unavailable for that segment.


2.6 Front-End Application
While details will be in the UI/UX section, from an architecture perspective, the front-end is responsible for:
Rendering the debate interface: showing participant names, current phase, timers, transcripts.


Audio input/output: capturing mic input (if user speaks) and playing audio output for AI voices.


Communication with server: via WebSockets or HTTP for exchanging messages. Likely, once a debate session starts, we open a WebSocket for continuous event exchange (new speech, end of speech, etc.). This ensures low-latency updates.


We might also handle some logic client-side to reduce server load, e.g., timing countdown display, simple UI state changes, but the authoritative logic is on the server.


The front-end must be synchronized with the back-end state. For instance, when an AI speech is being delivered, the UI could show a "speaking..." indicator for that agent, and maybe a progress bar for time. Such signals will come from the orchestrator (or can be inferred by the client when audio is playing).
2.7 Scalability and Deployment Considerations
We plan to deploy the back-end as a cloud service (could be containerized microservices):


The LLM service could be a separate component. If using OpenAI API, it's external and scales on OpenAI's side. If we host a model, we might use a dedicated server with GPU for it.


The orchestrator and web server could run on a scalable application server (Node.js or Python FastAPI, etc., depending on implementation). We must allow multiple sessions concurrently, which means the server should manage separate session states (possibly in memory or in a DB).


The STT and TTS calls are external API calls (to ElevenLabs). We have to consider their rate limits and possibly cost. Caching could be used for repeated phrases (though in debate, repeated identical sentences might be rare).


We can use a message queue or pub-sub system if needed to coordinate events between subcomponents. For example, if using a microservice architecture, one service could be dedicated to AI generation, another to audio processing, etc., and they communicate via events.


Scaling number of agents: Right now, at most 3 AI + 1 human per debate. But if we ever tried something like 3 vs 3, or an all-AI panel of 6, the architecture should handle N agents logically. The orchestrator and agent modules should be designed in a generic way (like an array of agents, not hardcoded "three"). However, more agents increase load (more simultaneous LLM calls). So, practically, we might limit the feature set to 4 participants for now (which already is complex enough).


Logging and Monitoring: We will implement logging of events for debugging (especially in early development). This will help trace issues (like if an AI takes too long or a message didn't get TTS). Monitoring at runtime (with tools or dashboards) will ensure the service remains healthy. This is also important for content monitoring: logs of AI output can be scanned for problematic content in case we need to intervene or adjust moderation strategies.


2.8 Security & Privacy
From a design perspective:
All communications will use HTTPS / WSS (secure WebSocket) to encrypt user voice and data.


No raw audio will be stored by default. If recordings are needed (maybe an optional feature to let user save an audio of the whole debate), it will be opt-in.


API keys for the AI and voice services are kept on server side (never exposed to client).


We'll implement authentication if the platform requires login (e.g., to track user progress or premium usage). Possibly initially it's open or minimal auth, but any user-specific data will be protected.


Privacy of the content: If using third-party APIs like OpenAI or ElevenLabs, we must inform users that their data (text or audio) is sent to these services. We'll review those providers' data policies. OpenAI allows opting out of data retention for API, which we will do for user privacy. ElevenLabs also has policies for voice data usage.


Rate limiting and abuse prevention: The system should avoid being misused (someone trying to overload generation by spamming inputs). We will enforce reasonable debate length/turn limits and possibly require user accounts to prevent misuse.


3. Data Flow & Sequence Diagrams (Conceptual)
To illustrate how the components interact during key scenarios, here are two key sequences:
3.1 Opening Speech Generation (AI):
Orchestrator: "Start debate – Opening round. Agent_A's turn to speak."


Orchestrator calls Agent_A's generate_opening(topic) method.


Agent_A formulates prompt and calls LLM service.


LLM returns text for opening speech.


Agent_A returns text to Orchestrator.


Orchestrator passes text to TTS module along with Agent_A's voice setting.


TTS service generates audio and returns it (or a URL).


Orchestrator sends an event to Front-End: {agent: A, action: "play_audio", content: <audio_blob>, text: <transcript>}.


Front-End receives event, displays "Agent A is speaking..." and plays the audio. It also could show the transcript text in sync.


Once audio playback is done (front-end knows via audio end event), front-end notifies orchestrator (or orchestrator times it out).


Orchestrator then moves to next scheduled speaker (could be user or another AI) and repeats.


3.2 Crossfire Interaction (All 4 participants):
Orchestrator: "Entering Grand Crossfire – 4 participants". It sets a timer for total crossfire duration (e.g., 3 minutes).


Orchestrator decides who speaks first (say Agent_B from Negative side).


Agent_B is prompted with something like: "Open crossfire. You may ask a question or make a point to start the discussion." Possibly Agent_B was prepared with some questions during its earlier generation phase (or we just let the LLM generate something on the fly).


Agent_B's LLM output (e.g., a question aimed at affirmative side) goes through TTS and is played, just like an opening.


Now orchestrator awaits a response. Potentially multiple participants can respond; but to avoid chaos, orchestrator might designate "the question was directed to Agent_C (human or AI) – they should respond next."


If the next responder is an AI (Agent_C), orchestrator calls Agent_C's generate_reply(last_statement) -> LLM -> text -> TTS -> send to client to play.


If the next responder is the human user, orchestrator sends an event to front-end: {action: "user_turn", prompt: last_statement} meaning it's user's turn to speak. The UI might display the opponent's question and prompt the user to respond (with a mic button or text box).


The user speaks (client captures audio, sends to server STT). Server gets text, and now orchestrator wraps that as if it were Agent_C's response (with a slight difference: we won't TTS the human's own voice back unless they explicitly wanted that). Instead, the human's speech text is added to the transcript and maybe displayed for clarity. If the user's voice is heard directly by others (if this were a group call scenario, others would need audio – but since others are AI, they don't "hear" audio, they just get the text). So just having the text is fine for AI consumption and for record.


The crossfire continues: orchestrator alternates turns. Perhaps after user spoke, Agent_D (the remaining AI on the other side) jumps in. Or if the user asked a question back, orchestrator decides which AI answers.


At each turn, the pipeline of STT (for user) and LLM+TTS (for AI) is used as appropriate. All participants' utterances are getting appended to a shared conversation log (for context and transcript).


The timer for crossfire is running. Once time is nearly up, orchestrator might send a message like "final remark" to the side currently holding the floor or just cut politely.


Orchestrator: "Crossfire time over." It sends an event to front-end to indicate crossfire is concluded (maybe a sound or message).


The debate moves to next phase (e.g., closings).


These sequences show a continuous loop of events between user, front-end, orchestrator, AI, and voice services. The design is event-driven with the orchestrator at the center. We will implement robust state management to handle unexpected events (like user not responding – maybe then an AI teammate can step in? Or if an AI's response comes late, perhaps skip it, etc.).
4. Technology Stack
Based on the design, here is a proposed tech stack (using the latest or most stable technologies as of 2025):
Programming Language / Framework (Back-end): Likely Python (due to excellent AI ecosystem and our need to integrate with Python AI libraries for LLM) using an async web framework like FastAPI or Quart for WebSocket support. Python has libraries for most of what we need (OpenAI API client, etc.). Alternatively, Node.js could be used especially if we use JavaScript for both front and back (which is nice for real-time comms), but Python's AI libraries make it strong for the core logic. We might do a hybrid: Python for the AI worker, Node for the signaling server. However, to reduce complexity, a single Python service with async (ASGI) could handle both orchestrating and calling AI services.


Front-End: A web application built with React or a similar modern framework. React can handle dynamic state changes (like updating the UI as messages come in). We'll use plain HTML/CSS/JS for audio and such, possibly leveraging WebAudio API directly. If we need cross-platform (mobile apps), we might either wrap the web app into a mobile webview or eventually build a native mobile app. But initial target is desktop web (which can also work on tablets).


Communication: WebSockets (using an ASGI server or Socket.io if Node) for low-latency duplex communication. This is needed for the interactive parts to avoid constant polling.


LLM Integration:


If OpenAI: use openai Python SDK (latest version) – ensure we have support for function calling or newer features if needed.


If Anthropic: use their anthropic SDK for Claude.


For open-source: possibly use HuggingFace's transformers with a model loaded locally (like GPT4All, Llama2 70B etc.). Might require a strong GPU machine or multi-GPU.


We ensure whichever we use, the library is updated to support streaming outputs (OpenAI API supports streaming token by token, which can allow us to start TTS sooner perhaps).


TTS: ElevenLabs API – their latest API endpoints (as documented on their site ). The integration might just be through HTTP calls; we can use Python requests or httpx. If needed, for speed, maybe their websocket if available, but likely REST is fine.


STT: The ElevenLabs STT API (Scribe v1) can be called from Python. We'll choose one and utilize it. Twilio's ConversationRelay suggests maybe a TwiML voice integration if phone line; but since we operate in app, direct STT API is fine.


Database: Possibly use PostgreSQL or a simple NoSQL like Firestore if we want cloud ease. Initially, we might not need a heavy database beyond storing user accounts and some transcripts. Even a file-based storage (JSON logs) could suffice in early prototype. But to be safe, plan for Postgres (and use SQLAlchemy or an ORM in Python for convenience).


Cloud Deployment: Services like AWS or Azure – e.g., deploy on AWS Fargate or EC2, using an API Gateway/WebSocket gateway. If using multiple microservices, containerize them (Docker) and orchestrate with something like Kubernetes or AWS ECS. But likely a simpler single service can run on an EC2 instance behind an Nginx or so for WebSocket.


AutoGen or Frameworks: If we integrate AutoGen, we'd include it as a Python package (it's open source on PyPI as indicated ). The decision will come after initial manual implementation – we can compare if using AutoGen simplifies multi-agent management. Given it's new (2024) but has Microsoft backing, it could be beneficial.


Version Control & CI: Use GitHub for code, and set up continuous integration for running tests (especially for prompt outputs – we might have automated tests for making sure certain prompt templates don't break after changes). Possibly incorporate CI to deploy to our cloud environment.


This stack is chosen for being modern, widely supported, and matching the needs of an AI-centric application. We will remain flexible if new developments occur (for example, if OpenAI releases GPT-5 with even better capabilities or if ElevenLabs introduces a new streaming voice API, we'll consider those upgrades as part of continuous improvement).
5. Implementation Challenges & Mitigations
Multi-agent coherence: Ensuring that multiple AI agents produce a coherent debate (not just talking past each other) is challenging. Mitigation: carefully design how each agent sees others' arguments. Possibly implement a simple mechanism for the AI to reference opponent's points (we may parse or label arguments so the AI can say "Regarding what you said about X, I disagree because Y"). If needed, include an intermediate step where after each speech, we extract key points and feed those into the prompt for the other side's rebuttal. This keeps the debate logically connected.


Latency management: Real-time feel is crucial. To mitigate slowness, we will extensively profile each step (STT, LLM, TTS) and possibly do things in parallel. For example, for crossfire, we can start TTS generation even before the LLM completes using streaming, or overlap operations (like have one thread handle STT while another is already prompting AI).


Moderation of content: As mentioned, we'll use API tools and careful prompt phrasing (like instruct AI "do not use profanity or derogatory remarks, even if debating intensely"). We also limit certain topics if necessary. Possibly we include a user setting like "safe mode" where debates avoid highly sensitive content.


User interruptions: In real debates, people sometimes interject. Our initial system might not support true interruption (barge-in) because handling that with AI turn-taking is complicated. We will assume turns are respected until a phase break. If the user tries to talk while an AI is still speaking, we might detect voice and either pause the AI (not easy once audio is playing) or ignore the user until the AI finishes. We'll educate the user to use designated crossfire periods to speak. Over time, if needed, we could detect barge-in and cut off AI (like voice assistants do), but that's a stretch goal.


By addressing these challenges early in design, we hope to build a robust system that delivers on the product requirements. Our architecture plan will be refined continuously as we prototype and test with actual debates.
Project Implementation Task List
Implementing DebateAI will be an extensive project. We break it down into phases and tasks, each with specific outcomes. The approach will be iterative – we aim to first get a minimal viable product (MVP) working for a simple case (e.g., 1 AI vs 1 human, text-only perhaps), then expand to full functionality (3 AI vs 1 human with voices, etc.), incorporating user feedback at each stage.
Below is a comprehensive task list organized by phases:
Phase 1: Planning and Environment Setup
Requirement Finalization & Use Case Detailing:


Re-confirm the debate formats to support (likely start with a 2 vs 2 Public Forum style as discussed). Write down the exact flow with timings for reference.


Identify a few debate topics and example arguments to use as test cases during development (helps in prompt engineering and testing).


List out all external API accounts needed (OpenAI, ElevenLabs, etc.) and ensure keys/credits are available.


Tech Stack Setup:


Set up version control repository (e.g., GitHub).


Initialize the back-end project (create a Python virtual environment, install FastAPI/Flask or chosen framework, install OpenAI SDK, etc.).


Initialize front-end project (React app scaffold if using React, or a simple HTML/JS page for early tests).


Configure basic WebSocket or HTTP server to ensure front-end <-> back-end communication works in simplest form.


Prototyping Environment:


If using GPU for LLM, ensure that environment (local or cloud with GPU) is accessible. Possibly set up a small instance for development testing.


Draft a simple prompt and call the LLM API manually (e.g., through a short script) to test that we can get a sensible debate response. This is to verify API access and gauge model behavior.


Do a quick test of ElevenLabs API: send a sample text and retrieve audio, play it to confirm quality and latency.


Do a quick test of STT: record a sample audio and see how quickly and accurately it transcribes.


Phase 2: Core Debate Logic (Text-Based Prototype)
Implement Debate Orchestrator (basic):


Create a DebateSession class that can hold state (phase, whose turn, etc.) and methods to progress the debate.


Hardcode a simple debate flow initially: e.g., 1 AI vs 1 AI on a fixed topic, with just one speech each. This is to incrementally build logic.


Implement turn scheduling: e.g., orchestrator can call an agent's method to get an opening, then another's. Use dummy agents at first that return a fixed string to test sequencing.


Ensure the orchestrator can send messages to front-end (simulate by logging or simple prints if no UI yet).


Agent Module Development:


Create an AIAgent class with at least: name, role, and a generate_statement(type, context) method. Implement this to call the actual LLM API. For now, implement for opening statement type. Use a basic prompt template.


Test this in isolation: call agent.generate_statement for a topic and print the output. Adjust prompt until output is formatted as desired (e.g., not too long, stays on topic).


Extend AIAgent to handle a generate_rebuttal(opponent_statement) for the next phase.


(If user agent is considered, maybe have a subclass or just handle user externally for now).


Front-End Minimal Interface (for testing):


Create a simple web page that connects to the WebSocket and prints messages. It should display AI outputs (as text) in order.


At this stage, because we focus on text, simply output the transcripts. We can simulate user input by having a fixed user message or a prompt.


This is more to verify end-to-end text communication.


Single Round Debate (text) E2E Test:


Use orchestrator + agents to run a full cycle for a test topic: AI1 opening, AI2 opening, maybe AI1 rebuttal, AI2 rebuttal (keep it short).


Observe the conversation in the front-end log. Ensure ordering and content make sense.


Debug any issues (like messages not arriving, or model giving overly long output).


Refine agent prompts as needed.


Add User Participation (text mode):


Introduce a HumanParticipant representation. For now, this could simply be handled by orchestrator waiting for input from front-end.


In front-end, add an input box or use console to send a user message.


Modify orchestrator to allow, say, user to take one role's place. For example, have user be Affirmative side and AI be Negative.


Implement a simple flow: user types their opening, AI responds with opening, then perhaps short crossfire where user types a question, AI answers.


This will test the loop of waiting for user input -> receiving -> generating AI response.


Ensure the state management can handle this (the orchestrator might have to pause and wait for user event). Using async or a promise in front-end for user input is fine.


By end of Phase 2, we should have a basic working debate with text only. This sets the stage for adding voices and multi-agent complexity.
Phase 3: Voice Integration (TTS/STT)
Integrate Text-to-Speech for AI outputs:


Wrap the part where orchestrator sends message to front-end: now instead of sending text directly, orchestrator should call the TTS module to get an audio file/URL for that text.


Develop a VoiceService helper with method synthesize(text, voice_id). Use ElevenLabs API. Handle the response (store the audio file or base64 data).


On front-end, add code to play audio when received. Possibly use an <audio> HTML element or Web Audio API. Also display the text as caption for clarity.


Test with a single message: e.g., orchestrator sends "Hello, this is AI" through TTS to front-end, front-end plays audio.


Measure how long the TTS call takes for, say, a 100-word paragraph. (This informs whether we need loading spinners or pre-generation).


Optimize: If too slow, consider calling TTS slightly earlier. For instance, if we know which agent is next, maybe start generating while the user is finishing their turn. This might be done later.


Integrate Speech-to-Text for user input:


On the front-end, implement a recording control. Perhaps a button "Hold to speak" or toggle "Start Recording". Use Web Audio API or MediaRecorder to capture audio.


Decide on approach: possibly simpler is clicking a button to start recording, click again to stop. (Later could refine to hold-to-talk).


Once an audio blob is captured, send it via WebSocket (or an HTTP upload) to the back-end. Ensure binary data transfer is handled (may use Base64 encoding if needed).


On back-end, receive the audio data and call STT service. Implement a SpeechService.transcribe(audio) that returns text.


After getting text, feed it into the orchestrator as if it was user's message.


Test this in isolation: record a short sentence, get transcription back, and see it appear. Tweak microphone settings or STT parameters as needed if accuracy is off.


Also consider continuous listening for crossfire: perhaps integrate streaming STT where partial results are sent. This could be complex; initial approach could just be chunked input. We can refine after confirming basic STT works.


Full Voice Loop Test (1 AI vs 1 Human):


Conduct a simple voice debate: user speaks a statement, AI responds with voice. Perhaps one exchange or a simple Q&A.


Evaluate the latency and quality. For example, user speaks question -> (transcription) -> AI answer generation -> TTS -> user hears answer. If this loop is too slow (say >5 seconds), identify which step is bottleneck and consider improvements (maybe shorter user utterances, or concurrently generating text and audio).


Ensure the user can hear themselves or not? (Usually, user's own voice they know, so we might not playback user audio to them, but maybe to ensure the transcript is right, we display the recognized text).


If the user's audio is not played back, that's fine. Just show the text "(You: ...)" on screen.


Add Multiple AI Agents (2 vs 2 scenario):


Expand orchestrator and agent management to handle 4 participants (3 AI + 1 user).


Instantiate Agent_A1, Agent_A2 (team A, same side as user maybe), and Agent_B1, Agent_B2 (team B). Decide which one the user replaces; e.g., user is A1, AI as A2, etc., or user as single speaker and 3 AIs on the other side – clarify design from PRD (we assumed user + AI vs AI + AI).


Implement turn ordering and segment roles: e.g., Opening: A1 (user), Opening: B1 (AI), Opening: A2 (AI), Opening: B2 (AI); then crossfire etc.


Ensure each agent has appropriate context – e.g., A2's opening might build on A1's points, etc. Might need to prompt A2 with A1's summary. For now, just treat them as independent openings on same side. We can refine coordination (like not overlapping arguments) later.


Test an AI vs AI debate 2v2 with voices: since user involvement is complex, first do a full AI-only debate: the orchestrator cycles through AIs speaking their parts with TTS. This will test if the sequence of 4 voices plays correctly, and if our multi-agent support works (like storing multiple prompts, etc.).


Then test with user in the loop: user does their part, and AIs do theirs.


This is a big integration test: many moving parts at once. We will likely debug issues such as:


Managing context between phases (after crossfire, an AI might mention something already said – that could be fine).


Possibly overlapping audio if not careful (we should ensure one speech audio finishes before next starts, orchestrator should queue them).


Front-end needing to show which of the four is speaking – implement highlighting or labels.


At the end of this task, we should achieve the full DebateAI scenario: 3 AI and 1 human in a structured debate with voices.


Phase 4: UI/UX Development
Design Polishing:


Implement a proper UI layout: divide the screen into sections (maybe a main area for debate content and a sidebar for controls/info).


Show participant labels and maybe avatars (placeholder icons or colored circles for each debater).


Create a text chat-style timeline for the transcript: each speech or utterance appears as a "bubble" or block with the speaker's name and text. This scrolls as the debate progresses, allowing the user to read along or catch up if they missed audio.


Show timers for timed segments: e.g., a countdown during each speech and crossfire. This can be a progress bar or a clock. Or simply text like "Time remaining: 1:30". The orchestrator can send these updates or the front-end can track once started (or both to be safe).


Implement interactive elements:


A "Start Debate" screen where the user selects topic, maybe chooses side and voices etc. This means building forms or dropdowns. (This data then starts a session with orchestrator with parameters).


A microphone button for crossfire (active only when it's user's turn or in open crossfire – possibly always active in open crossfire if user can jump in anytime).


Perhaps a "Next" button if we allow user to manually trigger next segment (if we don't automate fully).


Volume control or an option to replay last speech audio.


Ensure the UI is responsive (works on different screen sizes) and accessible (e.g., text contrast, maybe an option to enlarge text).


User Guidance & Feedback:


Add on-screen prompts or modals explaining to the user what to do. For example, before crossfire, a message "Crossfire started – you may press the mic to ask a question." Or if it's the user's speech, "Your turn to give opening statement. Press record when ready, or type and press enter."


Possibly incorporate a hint system or tips on debating (this could be text blurbs shown while waiting for AI to generate, to keep user engaged).


Provide feedback signals: when AI is thinking/generating, show a loader or an animating "..." under that agent's name so user knows something is coming. This is important to avoid confusion in any pause.


Testing UI/UX with Sample Users:


Have a few people (or team members) try using the interface without dev guidance. Gather if they understood how to use it, where they got confused.


Pay attention to the flow: e.g., did they know when to speak? Did they find the voices clear? Did any element annoy them (like overlapping audio or text scroll)?


Fix usability issues found. For instance, if users talk out of turn frequently, maybe adjust UI to better indicate when it's okay to talk or even restrict mic input except during allowed times.


Phase 5: Enhancements and Refinements
Improve AI Argument Quality:


Evaluate transcripts of some debates. Are the AI arguments coherent, relevant, and challenging? We might find issues like repetitiveness or superficial arguments.


Refine prompt templates: maybe add instructions like "use facts and cite examples if possible" or "avoid repeating the same point." Possibly implement a list of sub-topics for them to cover so that two AI on same side cover different angles (if user has an AI teammate, their speeches should not be redundant). We can generate these sub-topics by brainstorming or using the LLM in a planning prompt.


If budget allows, fine-tune an open-source model on debate transcripts or add a few demonstrations in the prompt to improve performance.


Continue testing on a variety of topics (some factual, some philosophical) to ensure AI doesn't hallucinate too badly or go off-topic. If it does, we might restrict certain things or allow user to correct it in crossfire (which is itself a realistic thing – the user can call out an AI's incorrect fact, making it part of the debate).


Add AI Judge/Analysis (optional feature):


Implement an agent that only activates after the debate: it would read the entire transcript and then output a summary and verdict. This uses the LLM as well (with a prompt like "Provide a summary of the debate and who you think made the better case, with reasoning.").


This agent's output can be shown or spoken by another voice (like a neutral narrator voice).


This feature can enhance the learning aspect. If doing this, ensure to label it clearly as "AI's evaluation" not an official result.


We can cite how human evaluation aligns with such AI judges, but as long as it's just additional info for the user, it should be fine.


Performance Tuning & Scaling:


Profile memory and CPU usage. Running multiple large models or heavy voice processing could strain a single machine. We might need to distribute load: e.g., run the LLM inference on a separate server or use a managed API to offload it.


If latency is an issue at scale, consider parallelizing where possible. For example, in an all-AI debate, agents' speeches could theoretically be generated in parallel for some segments (though we did sequential for logic, maybe for openings that don't depend on each other, we can generate simultaneously to save time).


Implement caching for repetitive operations: If multiple runs use the same topic and position, maybe cache that opening speech (though each debate should be fresh ideally, so maybe limited caching). Caching more applicable if a user replays the same debate scenario.


Test concurrent sessions: simulate 5-10 debates happening at once (if we foresee classroom usage, could be many simultaneous). Ensure system and APIs can handle throughput. Watch out for API rate limits on TTS/STT and handle via queueing if necessary.


Content Moderation and Safety Review:


Run some "edge case" debates on sensitive topics to see how the AI handles them. For example, a debate on a controversial political issue or something. If the AI remains civil and factual, good. If it starts generating problematic content, we need to tighten the prompt or filter that topic.

